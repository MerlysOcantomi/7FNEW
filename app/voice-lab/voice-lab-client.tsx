"use client"

/**
 * Voice Lab client (CORE-VOICE-0B.1) — isolated experiment UI.
 *
 * Not part of AppShell / sidebar / top bar. Mints an ephemeral credential from
 * our own endpoint, opens a WebRTC Realtime session, shows state + transcript,
 * enforces session limits (duration / turns) with auto-disconnect, and records
 * local-only metrics. No audio or conversation is persisted.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  LAB_MODELS,
  LAB_VOICES,
  DEFAULT_LAB_MODEL,
  DEFAULT_LAB_VOICE,
  LAB_LIMITS,
  LAB_COST_ALERT_PER_ACTIVE_MIN,
  type LabModel,
  type LabVoice,
} from "./config"
import { summarizeChannel, evaluateSessionLimits } from "./metrics"
import { VoiceLabSession } from "./realtime-client"
import type { VoiceState } from "@core/voice/contracts"

interface TokenResponse {
  clientSecret: string
  expiresAt: number
  model: LabModel
  voice: LabVoice
  transcriptionModel: string
}

interface TranscriptLine {
  role: "user" | "assistant"
  text: string
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

export function VoiceLabClient() {
  const [state, setState] = useState<VoiceState>("idle")
  const [model, setModel] = useState<LabModel>(DEFAULT_LAB_MODEL)
  const [voice, setVoice] = useState<LabVoice>(DEFAULT_LAB_VOICE)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [turns, setTurns] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [connectionMs, setConnectionMs] = useState<number[]>([])
  const [modelTtfaMs, setModelTtfaMs] = useState<number[]>([])

  const sessionRef = useRef<VoiceLabSession | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const thinkingAtRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connected = state !== "idle"

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

  // Close on unmount (adjustment 3).
  useEffect(() => () => disconnect(), [disconnect])

  const handleState = useCallback((next: VoiceState) => {
    setState(next)
    if (next === "thinking") thinkingAtRef.current = performance.now()
    if (next === "speaking") {
      setTurns((t) => t + 1)
      const started = thinkingAtRef.current
      if (started != null) {
        setModelTtfaMs((arr) => [...arr, performance.now() - started])
        thinkingAtRef.current = null
      }
    }
  }, [])

  const connect = useCallback(async () => {
    setError(null)
    setNotice(null)
    setTranscript([])
    setTurns(0)
    setElapsedMs(0)
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
        onUserTranscript: (text) =>
          setTranscript((t) => [...t, { role: "user", text }]),
        onAssistantTranscript: (text) =>
          setTranscript((t) => [...t, { role: "assistant", text }]),
        onError: (message) => setError(message),
      })
      sessionRef.current = session

      const t0 = performance.now()
      await session.start({ clientSecret: token.clientSecret, model: token.model, voice: token.voice })
      setConnectionMs((arr) => [...arr, performance.now() - t0])
      startedAtRef.current = Date.now()

      // Session-limit watchdog: duration + turns → auto-disconnect.
      timerRef.current = setInterval(() => {
        const started = startedAtRef.current
        if (started == null) return
        const elapsed = Date.now() - started
        setElapsedMs(elapsed)
      }, 1000)
    } catch (err) {
      setState("idle")
      setError(err instanceof Error ? err.message : "Fallo de conexión")
    }
  }, [model, voice, handleState])

  // Enforce hard limits whenever elapsed/turns change.
  useEffect(() => {
    if (!connected || startedAtRef.current == null) return
    const status = evaluateSessionLimits(
      { elapsedMs, turns, estimatedCostUsd: 0, activeMinutes: elapsedMs / 60000 },
      LAB_COST_ALERT_PER_ACTIVE_MIN[model],
    )
    if (status.shouldDisconnect) {
      const reason = status.timeExceeded
        ? "Sesión finalizada: límite de 5 minutos alcanzado."
        : status.turnsExceeded
          ? "Sesión finalizada: límite de 20 turnos alcanzado."
          : "Sesión finalizada: límite de presupuesto alcanzado."
      disconnect(reason)
    }
  }, [elapsedMs, turns, connected, model, disconnect])

  const conn = summarizeChannel(connectionMs)
  const ttfa = summarizeChannel(modelTtfaMs)

  return (
    <div className="mx-auto max-w-3xl p-6 font-sans">
      <h1 className="text-xl font-semibold">Voice Lab · experimento aislado</h1>
      <p className="mt-1 text-sm text-gray-500">
        Laboratorio de voz Realtime. Solo lectura / simulación · sin escrituras · sin persistencia
        de audio ni conversación · máx {LAB_LIMITS.sessionMaxMs / 60000} min / {LAB_LIMITS.sessionMaxTurns} turnos.
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

      <section className="mt-5">
        <h2 className="text-sm font-semibold">Transcripción</h2>
        <div className="mt-2 max-h-64 overflow-y-auto rounded border p-3 text-sm">
          {transcript.length === 0 ? (
            <p className="text-gray-400">Sin transcripción todavía.</p>
          ) : (
            transcript.map((line, i) => (
              <p key={i} className={line.role === "user" ? "text-gray-900" : "text-indigo-700"}>
                <strong>{line.role === "user" ? "Tú" : "Finesse"}:</strong> {line.text}
              </p>
            ))
          )}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Turnos" value={`${turns} / ${LAB_LIMITS.sessionMaxTurns}`} />
        <Metric label="Tiempo" value={`${Math.floor(elapsedMs / 1000)}s`} />
        <Metric label="Conexión p50/p95" value={`${Math.round(conn.p50)}/${Math.round(conn.p95)} ms`} />
        <Metric label="Model TTFA p50/p95" value={`${Math.round(ttfa.p50)}/${Math.round(ttfa.p95)} ms`} />
      </section>

      <p className="mt-4 text-xs text-gray-400">
        Nota: las acciones con efectos son simulaciones — “Simulación: confirmación recibida. No se
        realizó ningún cambio.” El coste total no puede garantizarse desde el navegador entre sesiones.
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
