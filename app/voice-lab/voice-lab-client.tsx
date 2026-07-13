"use client"

/**
 * Voice Lab client (CORE-VOICE-0B.1.1) — isolated experiment UI.
 *
 * Not part of AppShell / sidebar / top bar. Turns and cost are deduplicated by
 * response id via `SessionAccumulator`; transcript is id-keyed; latency channels
 * with no reliable 0.3.0 event show "no disponible"; `propose_action` opens a
 * simulated confirmation card that NEVER executes. No audio or conversation is
 * persisted.
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
  type TranscriptStore,
} from "./transcript"
import { VoiceLabSession } from "./realtime-client"
import { onProposeAction } from "./propose-bus"
import { simulateConfirmation } from "./confirmation-sim"
import type { ActionProposal } from "@core/voice/confirmation"
import type { VoiceState } from "@core/voice/contracts"

interface TokenResponse {
  clientSecret: string
  expiresAt: number
  model: LabModel
  voice: LabVoice
  transcriptionModel: string
}

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Inactivo",
  connecting: "Conectando…",
  listening: "Escuchando",
  thinking: "Pensando…",
  speaking: "Hablando",
  interrupted: "Interrumpido",
  error: "Error",
}

function ttfaText(s: LatencySummary): string {
  if (!s.available) return "no disponible"
  if (s.count === 0) return "sin datos"
  return `${Math.round(s.p50)}/${Math.round(s.p95)} ms`
}

export function VoiceLabClient() {
  const [state, setState] = useState<VoiceState>("idle")
  const [model, setModel] = useState<LabModel>(DEFAULT_LAB_MODEL)
  const [voice, setVoice] = useState<LabVoice>(DEFAULT_LAB_VOICE)
  const [store, setStore] = useState<TranscriptStore>(emptyTranscriptStore)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [turns, setTurns] = useState(0)
  const [estimatedCostUsd, setEstimatedCostUsd] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [proposal, setProposal] = useState<ActionProposal | null>(null)
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
  const modelRef = useRef<LabModel>(model)
  modelRef.current = model

  const connected = state !== "idle"

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

  const disconnect = useCallback((why?: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    sessionRef.current?.stop()
    sessionRef.current = null
    startedAtRef.current = null
    if (why) setNotice(why)
  }, [])

  // Register the propose_action card listener + close on unmount (adjustment 3).
  useEffect(() => {
    onProposeAction((p) => setProposal(p))
    return () => {
      onProposeAction(null)
      disconnect()
    }
  }, [disconnect])

  const handleState = useCallback((next: VoiceState) => {
    setState(next)
    const now = performance.now()
    const t = trackerRef.current
    if (!t) return
    if (next === "speaking") t.onAudibleStart(now)
    if (next === "interrupted") t.onInterrupted(now)
    if (next === "error") setErrorCount((c) => c + 1)
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
          break
        case "user_speech_stopped":
          tracker.onEndOfTurn(now)
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
    setError(null)
    setNotice(null)
    setStore(emptyTranscriptStore())
    setTurns(0)
    setEstimatedCostUsd(0)
    setElapsedMs(0)
    setProposal(null)
    accRef.current = new SessionAccumulator()
    trackerRef.current = new LatencyTracker()
    setState("connecting")
    try {
      const res = await fetch("/api/voice/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, voice }),
      })
      if (!res.ok) {
        setState("idle")
        setError(`No se pudo iniciar (HTTP ${res.status}).`)
        return
      }
      const token = (await res.json()) as TokenResponse

      const session = new VoiceLabSession({
        onState: handleState,
        onError: (message) => setError(message),
        onRawEvent: handleRawEvent,
      })
      sessionRef.current = session
      await session.start({ clientSecret: token.clientSecret, model: token.model, voice: token.voice })
      startedAtRef.current = Date.now()

      timerRef.current = setInterval(() => {
        const started = startedAtRef.current
        if (started != null) setElapsedMs(Date.now() - started)
      }, 1000)
    } catch (err) {
      setState("idle")
      setError(err instanceof Error ? err.message : "Fallo de conexión")
    }
  }, [model, voice, handleState, handleRawEvent])

  // Enforce hard limits using the REAL estimated cost.
  useEffect(() => {
    if (!connected || startedAtRef.current == null) return
    const status = evaluateSessionLimits(
      { elapsedMs, turns, estimatedCostUsd, activeMinutes: elapsedMs / 60000 },
      LAB_COST_ALERT_PER_ACTIVE_MIN[model],
    )
    if (status.shouldDisconnect) {
      disconnect(
        status.timeExceeded
          ? "Sesión finalizada: límite de 5 minutos alcanzado."
          : status.turnsExceeded
            ? "Sesión finalizada: límite de 20 turnos alcanzado."
            : "Sesión finalizada: límite de presupuesto alcanzado.",
      )
    }
  }, [elapsedMs, turns, estimatedCostUsd, connected, model, disconnect])

  const lines = useMemo(() => transcriptLines(store), [store])

  const confirmSim = (decision: "confirm" | "cancel") => {
    if (!proposal) return
    const result = simulateConfirmation(proposal, decision, new Date().toISOString())
    setNotice(result.message)
    setProposal(null)
  }

  return (
    <div className="mx-auto max-w-3xl p-6 font-sans">
      <h1 className="text-xl font-semibold">7F Voice Lab · experimento aislado</h1>
      <p className="mt-1 text-sm text-gray-500">
        Interfaz de voz de 7F (dentro de Finesse by Sevenef). Solo lectura / simulación · sin
        escrituras · sin persistencia de audio ni conversación · máx{" "}
        {LAB_LIMITS.sessionMaxMs / 60000} min / {LAB_LIMITS.sessionMaxTurns} turnos.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Modelo{" "}
          <select
            value={model}
            disabled={connected}
            onChange={(e) => setModel(e.target.value as LabModel)}
            className="rounded border px-2 py-1"
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
            disabled={connected}
            onChange={(e) => setVoice(e.target.value as LabVoice)}
            className="rounded border px-2 py-1"
          >
            {LAB_VOICES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        {!connected ? (
          <button onClick={connect} className="rounded bg-black px-4 py-1.5 text-white">
            Conectar
          </button>
        ) : (
          <button
            onClick={() => disconnect("Desconectado manualmente.")}
            className="rounded bg-red-600 px-4 py-1.5 text-white"
          >
            Desconectar
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
          <span
            className={
              "h-2.5 w-2.5 rounded-full " +
              (state === "speaking"
                ? "bg-green-500"
                : state === "listening"
                  ? "bg-blue-500"
                  : state === "error"
                    ? "bg-red-500"
                    : "bg-gray-400")
            }
          />
          {STATE_LABEL[state]}
        </span>
        {connected && (
          <button onClick={() => sessionRef.current?.interrupt()} className="rounded border px-3 py-1 text-sm">
            Interrumpir
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800">{notice}</p>}

      {proposal && (
        <section className="mt-4 rounded-lg border-2 border-indigo-300 p-4">
          <h3 className="text-sm font-semibold text-indigo-800">Propuesta (simulación)</h3>
          <p className="mt-1 text-sm"><strong>Acción:</strong> {proposal.toolName}</p>
          <p className="text-sm"><strong>Resumen:</strong> {proposal.summary.written}</p>
          <p className="text-sm text-gray-500"><strong>En voz:</strong> {proposal.summary.spoken}</p>
          <p className="text-xs text-gray-400">Expira: {proposal.expiresAt}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => confirmSim("cancel")} className="rounded border px-3 py-1 text-sm">
              Cancelar
            </button>
            <button onClick={() => confirmSim("confirm")} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white">
              Confirmar simulación
            </button>
          </div>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-sm font-semibold">Transcripción</h2>
        <div className="mt-2 max-h-64 overflow-y-auto rounded border p-3 text-sm">
          {lines.length === 0 ? (
            <p className="text-gray-400">Sin transcripción todavía.</p>
          ) : (
            lines.map((line) => (
              <p key={line.id} className={line.role === "user" ? "text-gray-900" : "text-indigo-700"}>
                <strong>{line.role === "user" ? "Tú" : LAB_SPEAKER_LABEL}:</strong>{" "}
                {line.status === "unavailable" ? <em className="text-gray-400">(transcripción no disponible)</em> : line.text}
              </p>
            ))
          )}
        </div>
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

      <p className="mt-4 text-xs text-gray-400">
        Alcance actual: instrucciones + tools limitadas. Guardrail semántico real: pendiente de
        CORE-VOICE-2. Las acciones con efectos son simulaciones. El coste total no puede
        garantizarse desde el navegador entre sesiones.
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-gray-500">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  )
}
