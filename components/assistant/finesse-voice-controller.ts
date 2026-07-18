"use client"

/**
 * Ask Finesse voice controller — one hook owning the full voice lifecycle on
 * top of the shared `core/voice` layer (the same transport/parsing/lifecycle
 * the Voice Lab runs on). Instantiated ONCE by `FinesseAssistantProvider` and
 * exposed through the assistant context, so the panel, the composer mic and
 * the global launcher all read one source of truth.
 *
 * Responsibilities:
 *  - capability detection (secure context, getUserMedia, WebRTC, audio);
 *  - minting the ephemeral credential from the PRODUCTION endpoint
 *    (`/api/assistant/finesse/realtime-token`) with the current page context
 *    and a short conversation summary;
 *  - session lifecycle: connect, listening/thinking/speaking/interrupted
 *    mapping, barge-in recovery, manual interrupt, mute, explicit stop;
 *  - cost limits client-side: max session duration + inactivity timeout
 *    (server returns the same constants; the client honors them);
 *  - transcript integration: partial/final user + assistant turns upserted
 *    into the SHARED visible conversation keyed by Realtime item id (no
 *    duplicates, partial replaced by final, interrupted marked honestly);
 *  - teardown on stop/expiry/errors and via the provider on panel close,
 *    route change, workspace change and unmount. Timers/listeners are always
 *    cleared; no state updates after unmount.
 *
 * Privacy: no audio is persisted, transcripts stay in React memory, nothing
 * here logs transcript or token contents.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  RealtimeVoiceSession,
} from "@core/voice/realtime-session"
import { parseRealtimeEvent } from "@core/voice/realtime-events"
import { classifyConnectFailure } from "@core/voice/microphone"
import {
  evaluateVoiceSupport,
  readVoiceEnvironment,
  type VoiceSupport,
} from "@core/voice/capabilities"
import { FINESSE_VOICE_LIMITS } from "@modules/assistant/finesse-voice-policy"
import type { FinesseAssistantContext } from "@modules/assistant/finesse-assistant"

// ─── Public contract ─────────────────────────────────────────────────────────

export type FinesseVoiceState =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "stopping"
  | "expired"
  | "error"

export type FinesseVoiceErrorKind =
  | "permission_denied"
  | "mic_unavailable"
  | "connection"
  | "entitlement"
  | "rate_limited"
  | "provider_unavailable"
  | null

export interface FinesseVoiceHandle {
  state: FinesseVoiceState
  errorKind: FinesseVoiceErrorKind
  support: VoiceSupport
  /** False after the server said the workspace has no voice entitlement. */
  entitled: boolean
  /** True once a session successfully started at least once (hint gating). */
  everConnected: boolean
  muted: boolean
  active: boolean
  start: () => Promise<void>
  stop: (reason?: "user" | "expired" | "context" | "teardown") => void
  interrupt: () => void
  toggleMute: () => void
}

/** What the provider supplies to the controller. */
export interface FinesseVoiceControllerOptions {
  buildContext: () => FinesseAssistantContext
  buildConversationSummary: () => string | null
  /** Upsert a voice turn into the shared conversation (id-keyed). */
  upsertVoiceMessage: (update: {
    id: string
    role: "user" | "assistant"
    content: string
    status: "partial" | "final" | "interrupted"
  }) => void
  /** Mark the currently streaming assistant turn as interrupted. */
  markAssistantInterrupted: (id: string) => void
}

interface TokenResponse {
  clientSecret: string
  model: string
  voice: string
  transcriptionModel: string
  instructions?: string
  limits?: { sessionMaxMs?: number; inactivityMs?: number }
}

const INTERRUPT_RECOVERY_MS = 1200
/** Stop a session when the tab stays hidden longer than this. */
const HIDDEN_STOP_MS = 60_000

const AGENT_NAME = "Finesse"

export function useFinesseVoiceController(
  options: FinesseVoiceControllerOptions,
): FinesseVoiceHandle {
  const [state, setState] = useState<FinesseVoiceState>("idle")
  const [errorKind, setErrorKind] = useState<FinesseVoiceErrorKind>(null)
  const [entitled, setEntitled] = useState(true)
  const [everConnected, setEverConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [support, setSupport] = useState<VoiceSupport>(() =>
    evaluateVoiceSupport(readVoiceEnvironment()),
  )

  const sessionRef = useRef<RealtimeVoiceSession | null>(null)
  const mountedRef = useRef(true)
  const startingRef = useRef(false)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interruptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAssistantStreamingIdRef = useRef<string | null>(null)
  const limitsRef = useRef({
    sessionMaxMs: FINESSE_VOICE_LIMITS.sessionMaxMs,
    inactivityMs: FINESSE_VOICE_LIMITS.inactivityMs,
  })
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Re-read capabilities on mount (SSR snapshot is all-false by design).
  useEffect(() => {
    setSupport(evaluateVoiceSupport(readVoiceEnvironment()))
  }, [])

  const safeSetState = useCallback((next: FinesseVoiceState) => {
    if (mountedRef.current) setState(next)
  }, [])

  const clearTimers = useCallback(() => {
    for (const ref of [maxTimerRef, inactivityTimerRef, interruptTimerRef, hiddenTimerRef]) {
      if (ref.current) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
  }, [])

  const stop = useCallback(
    (reason: "user" | "expired" | "context" | "teardown" = "user") => {
      clearTimers()
      const session = sessionRef.current
      sessionRef.current = null
      startingRef.current = false
      lastAssistantStreamingIdRef.current = null
      if (session) {
        if (mountedRef.current && reason === "user") setState("stopping")
        session.stop() // releases mic tracks + closes WebRTC; idempotent
      }
      if (!mountedRef.current) return
      setMuted(false)
      setState(reason === "expired" ? "expired" : "idle")
    },
    [clearTimers],
  )

  /** Inactivity window restarts on any speech/audio activity. */
  const bumpInactivity = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => stop("expired"), limitsRef.current.inactivityMs)
  }, [stop])

  const handleRawEvent = useCallback(
    (raw: unknown) => {
      const opts = optionsRef.current
      for (const ev of parseRealtimeEvent(raw)) {
        switch (ev.kind) {
          case "user_speech_started":
          case "user_speech_stopped":
          case "model_audio_delta":
            bumpInactivity()
            break
          case "input_transcript":
            if (ev.itemId && ev.status !== "unavailable") {
              opts.upsertVoiceMessage({
                id: `voice-user-${ev.itemId}`,
                role: "user",
                content: ev.text,
                status: ev.status,
              })
            }
            bumpInactivity()
            break
          case "output_transcript":
            if (ev.itemId && ev.status !== "unavailable") {
              if (ev.status === "partial") {
                lastAssistantStreamingIdRef.current = ev.itemId
              } else if (lastAssistantStreamingIdRef.current === ev.itemId) {
                lastAssistantStreamingIdRef.current = null
              }
              opts.upsertVoiceMessage({
                id: `voice-assistant-${ev.itemId}`,
                role: "assistant",
                content: ev.text,
                status: ev.status,
              })
            }
            bumpInactivity()
            break
          default:
            break
        }
      }
    },
    [bumpInactivity],
  )

  const handleState = useCallback(
    (next: "idle" | "connecting" | "listening" | "thinking" | "speaking" | "interrupted" | "error") => {
      // The wrapper's terminal idle (from stop()) is handled in stop().
      if (next === "idle") return
      if (next === "error") {
        setErrorKind((k) => k ?? "connection")
        safeSetState("error")
        return
      }
      if (next === "interrupted") {
        const streamingId = lastAssistantStreamingIdRef.current
        if (streamingId) {
          optionsRef.current.markAssistantInterrupted(`voice-assistant-${streamingId}`)
          lastAssistantStreamingIdRef.current = null
        }
        safeSetState("interrupted")
        // Auto-recover to listening (Voice Lab behavior).
        if (interruptTimerRef.current) clearTimeout(interruptTimerRef.current)
        interruptTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setState((prev) => (prev === "interrupted" ? "listening" : prev))
          }
        }, INTERRUPT_RECOVERY_MS)
        return
      }
      safeSetState(next)
    },
    [safeSetState],
  )

  const start = useCallback(async () => {
    if (!support.voiceSupported || !entitled) return
    if (sessionRef.current || startingRef.current) return // one active session

    startingRef.current = true
    setErrorKind(null)
    setMuted(false)
    safeSetState("requesting-permission")

    // Mint the ephemeral credential from the PRODUCTION endpoint.
    let token: TokenResponse
    try {
      safeSetState("connecting")
      const res = await fetch("/api/assistant/finesse/realtime-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: optionsRef.current.buildContext(),
          conversationSummary: optionsRef.current.buildConversationSummary(),
        }),
      })
      if (!res.ok) {
        startingRef.current = false
        if (res.status === 403 || res.status === 404) {
          // Honest entitlement outcome: remember it and hide the mic.
          setEntitled(false)
          setErrorKind("entitlement")
        } else if (res.status === 429) {
          setErrorKind("rate_limited")
        } else {
          setErrorKind("provider_unavailable")
        }
        safeSetState("error")
        return
      }
      token = (await res.json()) as TokenResponse
      if (token.limits?.sessionMaxMs) limitsRef.current.sessionMaxMs = token.limits.sessionMaxMs
      if (token.limits?.inactivityMs) limitsRef.current.inactivityMs = token.limits.inactivityMs
    } catch {
      startingRef.current = false
      setErrorKind("connection")
      safeSetState("error")
      return
    }

    const session = new RealtimeVoiceSession({
      onState: handleState,
      onError: () => {
        // Message is normalized visually via errorKind; never log payloads.
        setErrorKind((k) => k ?? "connection")
      },
      onRawEvent: handleRawEvent,
    })
    sessionRef.current = session

    try {
      await session.start({
        clientSecret: token.clientSecret,
        model: token.model,
        voice: token.voice,
        transcriptionModel: token.transcriptionModel,
        agentName: AGENT_NAME,
        // Server-authored instructions travel with the minted session; the
        // client mirrors them so the SDK's session.update cannot blank them.
        instructions: token.instructions ?? "",
      })
      startingRef.current = false
      if (!mountedRef.current) {
        // Unmounted while connecting — never leave a live mic behind.
        session.stop()
        sessionRef.current = null
        return
      }
      setEverConnected(true)
      // Hard cost caps: max duration + inactivity.
      maxTimerRef.current = setTimeout(() => stop("expired"), limitsRef.current.sessionMaxMs)
      bumpInactivity()
    } catch (err) {
      startingRef.current = false
      sessionRef.current = null
      const kind = classifyConnectFailure(err)
      setErrorKind(kind)
      safeSetState("error")
    }
  }, [support.voiceSupported, entitled, handleState, handleRawEvent, safeSetState, stop, bumpInactivity])

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt()
  }, [])

  const toggleMute = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    setMuted((prev) => {
      session.mute(!prev)
      return !prev
    })
  }, [])

  // Stop when the tab stays hidden beyond a safe timeout (cost control).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (sessionRef.current && !hiddenTimerRef.current) {
          hiddenTimerRef.current = setTimeout(() => stop("expired"), HIDDEN_STOP_MS)
        }
      } else if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current)
        hiddenTimerRef.current = null
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [stop])

  // Unmount teardown — release mic, close transport, clear timers.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimers()
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [clearTimers])

  const active =
    state === "connecting" ||
    state === "requesting-permission" ||
    state === "listening" ||
    state === "thinking" ||
    state === "speaking" ||
    state === "interrupted"

  return useMemo(
    () => ({
      state,
      errorKind,
      support,
      entitled,
      everConnected,
      muted,
      active,
      start,
      stop,
      interrupt,
      toggleMute,
    }),
    [state, errorKind, support, entitled, everConnected, muted, active, start, stop, interrupt, toggleMute],
  )
}
