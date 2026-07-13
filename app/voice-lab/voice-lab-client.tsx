"use client"

/**
 * Voice Lab client (CORE-VOICE-0B.1.2) — isolated experiment UI, UX readiness.
 *
 * Not part of AppShell / sidebar / top bar. Turns and cost are deduplicated by
 * response id via `SessionAccumulator`; transcript is id-keyed; latency channels
 * with no reliable 0.3.0 event show "no disponible"; `propose_action` opens a
 * simulated confirmation card that NEVER executes. No audio or conversation is
 * persisted.
 *
 * This revision makes the seven governed states visually distinguishable (shape +
 * label + animation, never color alone), adds "mic open"/"te escucho" feedback,
 * auto-recovers from `interrupted` to `listening`, humanizes the proposal card
 * (human action label + countdown, never raw ISO), keeps one active proposal at a
 * time, separates the notice channels, adds soft limit warnings, and hardens the
 * connect/mic error paths — all inside the lab.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LAB_MODELS,
  LAB_VOICES,
  DEFAULT_LAB_MODEL,
  DEFAULT_LAB_VOICE,
  LAB_LIMITS,
  LAB_PRICING,
  LAB_TRANSCRIPTION_USD_PER_MIN,
  LAB_COST_ALERT_PER_ACTIVE_MIN,
  LAB_SPEAKER_LABEL,
  type LabModel,
  type LabVoice,
} from "./config"
import { evaluateSessionLimits } from "./metrics"
import {
  SessionAccumulator,
  LatencyTracker,
  summarizeLatency,
  PERCEIVED_INTERRUPTION_AVAILABLE,
  type LatencySummary,
} from "./accumulator"
import { parseLabEvent } from "./events"
import {
  emptyTranscriptStore,
  applyTranscript,
  transcriptLines,
  markInterrupted,
  type TranscriptStore,
} from "./transcript"
import { VoiceLabSession } from "./realtime-client"
import { onProposeAction } from "./propose-bus"
import { simulateConfirmation } from "./confirmation-sim"
import { humanizeActionName } from "./action-labels"
import { expiryView } from "./expiry"
import {
  EMPTY_PROPOSAL_QUEUE,
  receiveProposal,
  clearActiveProposal,
  DISCARDED_INCOMING_MESSAGE,
  type ProposalQueueState,
} from "./proposal-queue"
import {
  SESSION_LIVE_INITIAL,
  nextSessionLive,
  lifecycleView,
} from "./session-lifecycle"
import { sessionWarnings } from "./session-warnings"
import { describeConnectFailure } from "./mic-errors"
import {
  EMPTY_NOTICES,
  withSessionNotice,
  withConfirmationResult,
  withError,
  type LabNotices,
} from "./notices"
import {
  IDLE_ACTIVITY,
  reduceVoiceActivity,
  stateIndicator,
  canCutResponse,
  interruptRecovery,
  isNearBottom,
  transcriptLineView,
  type VoiceActivity,
  type StateTone,
  type StateShape,
} from "./lab-view"
import type { VoiceState } from "@core/voice/contracts"

interface TokenResponse {
  clientSecret: string
  expiresAt: number
  model: LabModel
  voice: LabVoice
  transcriptionModel: string
}

function ttfaText(s: LatencySummary): string {
  if (!s.available) return "no disponible"
  if (s.count === 0) return "sin datos"
  return `${Math.round(s.p50)}/${Math.round(s.p95)} ms`
}

// Supplementary color per tone (the visible label + shape are the primary cue).
const TONE_COLOR: Record<StateTone, string> = {
  idle: "bg-gray-400",
  connecting: "bg-amber-500",
  listening: "bg-blue-600",
  hearing: "bg-emerald-500",
  thinking: "bg-violet-600",
  speaking: "bg-green-600",
  interrupted: "bg-orange-500",
  error: "bg-red-600",
}

export function VoiceLabClient() {
  const [state, setState] = useState<VoiceState>("idle")
  const [model, setModel] = useState<LabModel>(DEFAULT_LAB_MODEL)
  const [voice, setVoice] = useState<LabVoice>(DEFAULT_LAB_VOICE)
  const [store, setStore] = useState<TranscriptStore>(emptyTranscriptStore)
  const [notices, setNotices] = useState<LabNotices>(EMPTY_NOTICES)
  const [turns, setTurns] = useState(0)
  const [estimatedCostUsd, setEstimatedCostUsd] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [queue, setQueue] = useState<ProposalQueueState>(EMPTY_PROPOSAL_QUEUE)
  const [sessionLive, setSessionLive] = useState<boolean>(SESSION_LIVE_INITIAL)
  const [activity, setActivity] = useState<VoiceActivity>(IDLE_ACTIVITY)
  const [nowMs, setNowMs] = useState(0)
  const [latency, setLatency] = useState({
    model: summarizeLatency([], true),
    audible: summarizeLatency([], true),
    sdkInterruption: summarizeLatency([], true),
    perceivedInterruption: summarizeLatency([], PERCEIVED_INTERRUPTION_AVAILABLE),
  })

  const sessionRef = useRef<VoiceLabSession | null>(null)
  const accRef = useRef<SessionAccumulator | null>(null)
  const trackerRef = useRef<LatencyTracker | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const interruptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modelRef = useRef<LabModel>(model)
  modelRef.current = model
  const shownWarningsRef = useRef<Set<string>>(new Set())
  const lastAssistantStreamingIdRef = useRef<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  // Source of truth for "a session is really open" — NOT `state !== "idle"`
  // (error after a failed start also satisfies that, faking a connected UI).
  const life = lifecycleView(state, sessionLive)

  const refreshLatency = useCallback(() => {
    const t = trackerRef.current
    if (!t) return
    setLatency({
      model: summarizeLatency(t.modelTtfaMs, true),
      audible: summarizeLatency(t.audibleTtfaMs, true),
      sdkInterruption: summarizeLatency(t.sdkInterruptionMs, true),
      perceivedInterruption: summarizeLatency([], PERCEIVED_INTERRUPTION_AVAILABLE),
    })
  }, [])

  // Full teardown: stop the session, release transport/mic, clear timers, reset
  // the local sub-states. Idempotent and safe to call from any failure path.
  const teardown = useCallback((sessionNote?: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (interruptTimerRef.current) {
      clearTimeout(interruptTimerRef.current)
      interruptTimerRef.current = null
    }
    sessionRef.current?.stop()
    sessionRef.current = null
    startedAtRef.current = null
    lastAssistantStreamingIdRef.current = null
    setSessionLive((p) => nextSessionLive(p, { type: "teardown" }))
    setActivity(IDLE_ACTIVITY)
    if (sessionNote !== undefined) setNotices((n) => withSessionNotice(n, sessionNote))
  }, [])

  const disconnect = useCallback(
    (why?: string) => {
      teardown(why)
    },
    [teardown],
  )

  // Register the propose_action card listener + close on unmount.
  useEffect(() => {
    onProposeAction((p) => {
      setNowMs(Date.now())
      setQueue((q) => receiveProposal(q, p))
    })
    return () => {
      onProposeAction(null)
      teardown()
    }
  }, [teardown])

  // Countdown clock — only ticks while a proposal is active.
  useEffect(() => {
    if (!queue.active) return
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 500)
    return () => clearInterval(id)
  }, [queue.active])

  const handleState = useCallback((next: VoiceState) => {
    setState(next)
    const now = performance.now()
    const t = trackerRef.current
    if (next === "speaking") {
      t?.onAudibleStart(now)
      setActivity((a) => ({ ...a, userSpeaking: false }))
    }
    if (next === "thinking") setActivity((a) => ({ ...a, userSpeaking: false }))
    if (next === "error") setErrorCount((c) => c + 1)
    if (next === "interrupted") {
      t?.onInterrupted(now)
      // Best-effort: mark the currently-streaming assistant line interrupted.
      const id = lastAssistantStreamingIdRef.current
      if (id) setStore((s) => markInterrupted(s, id))
      // Show "Interrumpido" briefly, then return to "Escuchando" on its own.
      const { to, delayMs } = interruptRecovery()
      if (interruptTimerRef.current) clearTimeout(interruptTimerRef.current)
      interruptTimerRef.current = setTimeout(() => {
        setState((prev) => (prev === "interrupted" ? to : prev))
      }, delayMs)
    }
  }, [])

  const handleRawEvent = useCallback((raw: unknown) => {
    const now = performance.now()
    const acc = accRef.current
    const tracker = trackerRef.current
    if (!acc || !tracker) return

    for (const ev of parseLabEvent(raw)) {
      switch (ev.kind) {
        case "user_speech_started":
          tracker.onBargeIn(now)
          setActivity((a) => reduceVoiceActivity(a, { type: "user_speech_started" }))
          break
        case "user_speech_stopped":
          tracker.onEndOfTurn(now)
          setActivity((a) => reduceVoiceActivity(a, { type: "user_speech_stopped" }))
          break
        case "model_audio_delta":
          tracker.onModelAudioDelta(now)
          break
        case "response_done":
          if (acc.recordResponseDone(ev.responseId, ev.usage, LAB_PRICING[modelRef.current])) {
            setTurns(acc.turns)
            setEstimatedCostUsd(acc.estimatedCostUsd)
          }
          break
        case "transcription_seconds":
          acc.recordTranscriptionSeconds(ev.seconds, LAB_TRANSCRIPTION_USD_PER_MIN)
          setEstimatedCostUsd(acc.estimatedCostUsd)
          break
        case "input_transcript":
          if (ev.itemId) {
            setStore((s) =>
              applyTranscript(s, { id: ev.itemId, role: "user", text: ev.text, status: ev.status }),
            )
          }
          break
        case "output_transcript":
          if (ev.itemId) {
            // Track the streaming assistant item so a barge-in can mark it.
            if (ev.status === "partial") lastAssistantStreamingIdRef.current = ev.itemId
            else if (ev.status === "final" && lastAssistantStreamingIdRef.current === ev.itemId) {
              lastAssistantStreamingIdRef.current = null
            }
            setStore((s) =>
              applyTranscript(s, {
                id: ev.itemId,
                role: "assistant",
                text: ev.text,
                status: ev.status,
              }),
            )
          }
          break
      }
    }
    refreshLatency()
  }, [refreshLatency])

  const connect = useCallback(async () => {
    setNotices(EMPTY_NOTICES)
    setStore(emptyTranscriptStore())
    setTurns(0)
    setEstimatedCostUsd(0)
    setElapsedMs(0)
    setQueue(EMPTY_PROPOSAL_QUEUE)
    setActivity(IDLE_ACTIVITY)
    // Requesting the token is NOT a live session yet.
    setSessionLive((p) => nextSessionLive(p, { type: "connect_requested" }))
    shownWarningsRef.current = new Set()
    lastAssistantStreamingIdRef.current = null
    accRef.current = new SessionAccumulator()
    trackerRef.current = new LatencyTracker()
    setState("connecting")

    let res: Response
    try {
      res = await fetch("/api/voice/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, voice }),
      })
    } catch (err) {
      // Network failure before any session existed — nothing to release.
      const failure = describeConnectFailure(err)
      setSessionLive((p) => nextSessionLive(p, { type: "connect_failed" }))
      setState("idle")
      setNotices((n) => withError(n, failure.message))
      return
    }
    if (!res.ok) {
      setSessionLive((p) => nextSessionLive(p, { type: "connect_failed" }))
      setState("idle")
      setNotices((n) => withError(n, describeConnectFailure({ name: "connection" }).message))
      return
    }

    const token = (await res.json()) as TokenResponse
    const session = new VoiceLabSession({
      onState: handleState,
      onError: (message) => setNotices((n) => withError(n, message)),
      onRawEvent: handleRawEvent,
    })
    sessionRef.current = session

    try {
      await session.start({ clientSecret: token.clientSecret, model: token.model, voice: token.voice })
      // Session is live ONLY after start() resolves.
      setSessionLive((p) => nextSessionLive(p, { type: "start_succeeded" }))
      startedAtRef.current = Date.now()
      setActivity((a) => reduceVoiceActivity(a, { type: "session_live" }))
      timerRef.current = setInterval(() => {
        const started = startedAtRef.current
        if (started != null) setElapsedMs(Date.now() - started)
      }, 1000)
    } catch (err) {
      // Partial failure AFTER creating the session (commonly a denied/absent
      // mic): close it explicitly (teardown clears sessionLive), release
      // transport/mic, land on "error" with the session genuinely closed.
      const failure = describeConnectFailure(err)
      teardown()
      setState("error")
      setErrorCount((c) => c + 1)
      setNotices((n) => withError(n, failure.message))
    }
  }, [model, voice, handleState, handleRawEvent, teardown])

  // Soft warnings (minute 4 / turn 17 / cost alert) + hard-limit auto-disconnect.
  useEffect(() => {
    if (!sessionLive || startedAtRef.current == null) return
    const status = evaluateSessionLimits(
      { elapsedMs, turns, estimatedCostUsd, activeMinutes: elapsedMs / 60000 },
      LAB_COST_ALERT_PER_ACTIVE_MIN[model],
    )
    for (const w of sessionWarnings({ elapsedMs, turns, costAlert: status.costAlert })) {
      if (!shownWarningsRef.current.has(w.kind)) {
        shownWarningsRef.current.add(w.kind)
        setNotices((n) => withSessionNotice(n, w.message))
      }
    }
    if (status.shouldDisconnect) {
      disconnect(
        status.timeExceeded
          ? "Sesión finalizada: límite de 5 minutos alcanzado."
          : status.turnsExceeded
            ? "Sesión finalizada: límite de 20 turnos alcanzado."
            : "Sesión finalizada: límite de presupuesto alcanzado.",
      )
    }
  }, [elapsedMs, turns, estimatedCostUsd, sessionLive, model, disconnect])

  const lines = useMemo(() => transcriptLines(store), [store])

  // Auto-scroll to the newest turn, unless the user scrolled up to read history.
  useEffect(() => {
    const el = transcriptRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [lines])

  const onTranscriptScroll = useCallback(() => {
    const el = transcriptRef.current
    if (el) stickToBottomRef.current = isNearBottom(el)
  }, [])

  const resolveProposal = (decision: "confirm" | "cancel") => {
    const active = queue.active
    if (!active) return
    const result = simulateConfirmation(active, decision, new Date().toISOString())
    setNotices((n) => withConfirmationResult(n, { kind: result.kind, message: result.message }))
    setQueue(clearActiveProposal())
  }

  const indicator = stateIndicator(state, activity)
  const expiry = queue.active ? expiryView(queue.active.expiresAt, nowMs) : null
  const showMicPreface = life.primaryAction === "connect" && !life.connecting

  return (
    <div className="mx-auto max-w-3xl p-6 font-sans text-gray-900">
      <div className="flex items-center gap-2">
        <span className="rounded bg-yellow-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-yellow-900">
          Laboratorio
        </span>
        <h1 className="text-xl font-semibold">7F Voice Lab · experimento aislado</h1>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Interfaz de voz de 7F (dentro de Finesse by Sevenef). Solo lectura / simulación · sin
        escrituras · sin persistencia de audio ni conversación · máx{" "}
        {LAB_LIMITS.sessionMaxMs / 60000} min / {LAB_LIMITS.sessionMaxTurns} turnos.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Modelo{" "}
          <select
            value={model}
            disabled={life.selectorsDisabled}
            onChange={(e) => setModel(e.target.value as LabModel)}
            className="min-h-[44px] rounded border px-2 py-1"
          >
            {LAB_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Voz{" "}
          <select
            value={voice}
            disabled={life.selectorsDisabled}
            onChange={(e) => setVoice(e.target.value as LabVoice)}
            className="min-h-[44px] rounded border px-2 py-1"
          >
            {LAB_VOICES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        {life.primaryAction === "connect" ? (
          <button
            onClick={connect}
            disabled={life.connectDisabled}
            aria-disabled={life.connectDisabled}
            className="min-h-[44px] rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {life.connecting ? "Conectando…" : "Conectar"}
          </button>
        ) : (
          <button
            onClick={() => disconnect("Desconectado manualmente.")}
            className="min-h-[44px] rounded bg-red-700 px-4 py-2 text-white"
          >
            Desconectar
          </button>
        )}
      </div>

      {showMicPreface && (
        <p className="mt-2 text-sm text-gray-600">
          El navegador te pedirá permiso para usar el micrófono.
        </p>
      )}

      {/* State — visible label + non-color shape + supplementary color. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          role="status"
          aria-live="polite"
          aria-label={`Estado: ${indicator.label}`}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
        >
          <StateShapeIcon shape={indicator.shape} animate={indicator.animate} tone={indicator.tone} />
          {indicator.label}
        </span>
        {life.showMic && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-700">
            <span
              aria-hidden
              className={"inline-block h-2 w-2 rounded-full " + (activity.micOpen ? "bg-emerald-500" : "bg-gray-300")}
            />
            {activity.micOpen ? "Micrófono abierto" : "Micrófono apagado"}
          </span>
        )}
        <button
          onClick={() => sessionRef.current?.interrupt()}
          disabled={!canCutResponse(state)}
          aria-disabled={!canCutResponse(state)}
          className="min-h-[44px] rounded border px-3 py-2 text-sm font-medium enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cortar respuesta
        </button>
      </div>
      {life.sessionLive && (
        <p className="mt-1 text-xs text-gray-600">
          También puedes empezar a hablar para interrumpir a 7F.
        </p>
      )}

      {/* Error channel — assertive so it is announced. */}
      {notices.error && (
        <p role="alert" aria-live="assertive" className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">
          {notices.error}
        </p>
      )}
      {/* Session channel — soft limits / lifecycle. */}
      {notices.session && (
        <p aria-live="polite" className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">
          {notices.session}
        </p>
      )}

      {/* Active proposal card (simulation). */}
      {queue.active && expiry && (
        <section
          aria-label="Propuesta simulada"
          className={
            "mt-4 rounded-lg border-2 p-4 " +
            (expiry.status === "expired" ? "border-gray-300 bg-gray-50" : "border-indigo-300")
          }
        >
          <h3 className="text-sm font-semibold text-indigo-900">Propuesta (simulación)</h3>
          <p className="mt-1 text-sm">
            <strong>Acción:</strong> {humanizeActionName(queue.active.toolName)}
          </p>
          <p className="text-sm"><strong>Resumen:</strong> {queue.active.summary.written}</p>
          <p className="text-sm text-gray-700"><strong>En voz:</strong> {queue.active.summary.spoken}</p>
          <p
            className={
              "mt-1 text-xs font-medium " +
              (expiry.status === "expired" ? "text-gray-600" : "text-gray-700")
            }
            aria-live="polite"
          >
            {expiry.status === "expired" ? "⚠ " : "⏳ "}
            {expiry.label}
          </p>
          {queue.discardedIncoming && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
              {DISCARDED_INCOMING_MESSAGE}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {expiry.status === "expired" ? (
              <button
                onClick={() => resolveProposal("confirm")}
                className="min-h-[44px] rounded border px-3 py-2 text-sm font-medium"
              >
                Cerrar
              </button>
            ) : (
              <>
                <button
                  onClick={() => resolveProposal("cancel")}
                  className="min-h-[44px] rounded border px-3 py-2 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => resolveProposal("confirm")}
                  className="min-h-[44px] rounded bg-indigo-700 px-3 py-2 text-sm font-medium text-white"
                >
                  Confirmar simulación
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Resolved card — the result stays here, not in a generic banner. */}
      {!queue.active && notices.confirmation && (
        <section
          aria-live="polite"
          className="mt-4 rounded-lg border border-gray-300 bg-gray-50 p-4"
        >
          <h3 className="text-sm font-semibold text-gray-800">Resultado de la simulación</h3>
          <p className="mt-1 text-sm text-gray-800">{notices.confirmation.message}</p>
          <button
            onClick={() => setNotices((n) => withConfirmationResult(n, null))}
            className="mt-3 min-h-[44px] rounded border px-3 py-2 text-sm font-medium"
          >
            Entendido
          </button>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-sm font-semibold">Transcripción</h2>
        <div
          ref={transcriptRef}
          onScroll={onTranscriptScroll}
          aria-live="polite"
          className="mt-2 max-h-64 overflow-y-auto rounded border p-3 text-sm"
        >
          {lines.length === 0 ? (
            <p className="text-gray-500">Sin transcripción todavía.</p>
          ) : (
            lines.map((entry) => {
              const v = transcriptLineView(entry, LAB_SPEAKER_LABEL)
              const toneClass =
                v.tone === "user"
                  ? "text-gray-900"
                  : v.tone === "assistant"
                    ? "text-indigo-800"
                    : v.tone === "interrupted"
                      ? "text-orange-800"
                      : "text-gray-500"
              return (
                <p key={v.id} className={toneClass + (v.isPartial ? " italic" : "")}>
                  <strong>{v.speaker}:</strong>{" "}
                  {v.isUnavailable ? <em className="text-gray-500">{v.text}</em> : v.text}
                  {v.marker && <span className="ml-1 text-xs text-gray-500">{v.marker}</span>}
                </p>
              )
            })
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          El marcado de interrupción es aproximado: el SDK 0.3.0 no relaciona de forma fiable el
          corte con un turno concreto.
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Turnos" value={`${turns} / ${LAB_LIMITS.sessionMaxTurns}`} />
        <Metric label="Tiempo" value={`${Math.floor(elapsedMs / 1000)}s`} />
        <Metric label="Coste est." value={`$${estimatedCostUsd.toFixed(4)}`} />
        <Metric label="Errores" value={`${errorCount}`} />
        <Metric label="Model TTFA p50/p95" value={ttfaText(latency.model)} />
        <Metric label="Audible TTFA p50/p95" value={ttfaText(latency.audible)} />
        <Metric label="Interrup. SDK p50/p95" value={ttfaText(latency.sdkInterruption)} />
        <Metric label="Interrup. percibida" value={ttfaText(latency.perceivedInterruption)} />
      </section>

      <p className="mt-4 text-xs text-gray-600">
        Alcance actual: instrucciones + tools limitadas. Guardrail semántico real: pendiente de
        CORE-VOICE-2. Las acciones con efectos son simulaciones. El coste total no puede
        garantizarse desde el navegador entre sesiones.
      </p>
    </div>
  )
}

/** A small non-color shape per state (label + shape together carry the meaning). */
function StateShapeIcon({
  shape,
  animate,
  tone,
}: {
  shape: StateShape
  animate: boolean
  tone: StateTone
}) {
  const color = TONE_COLOR[tone]
  if (shape === "cross") {
    return <span aria-hidden className="text-red-600">✕</span>
  }
  if (shape === "spinner") {
    return (
      <span
        aria-hidden
        className={"inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent " + (animate ? "animate-spin " : "") + "text-amber-600"}
      />
    )
  }
  if (shape === "ring") {
    return <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-blue-600" />
  }
  if (shape === "square") {
    return <span aria-hidden className={"inline-block h-3 w-3 rounded-sm " + color} />
  }
  if (shape === "bars" || shape === "wave" || shape === "ellipsis") {
    return (
      <span aria-hidden className="inline-flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={"inline-block w-1 rounded-sm " + color + (animate ? " animate-pulse" : "")}
            style={{ height: shape === "ellipsis" ? "0.4rem" : `${0.35 + i * 0.2}rem` }}
          />
        ))}
      </span>
    )
  }
  // dot
  return (
    <span aria-hidden className={"inline-block h-2.5 w-2.5 rounded-full " + color + (animate ? " animate-pulse" : "")} />
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-gray-600">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  )
}
