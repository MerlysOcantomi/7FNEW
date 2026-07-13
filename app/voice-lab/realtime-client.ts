/**
 * Voice Lab Realtime wrapper (CORE-VOICE-0B.1) — browser only.
 *
 * Thin wrapper over `@openai/agents@0.3.0` `RealtimeSession` (WebRTC transport)
 * for the isolated spike. Never imported server-side. Maps SDK events to the
 * governed `VoiceState` set and surfaces transcripts defensively.
 *
 * Event handlers are typed with `unknown` params on purpose so the wrapper does
 * not couple to the exact SDK payload shapes (validated during the 0B.2
 * campaign); the payloads are narrowed defensively here.
 */

import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime"
import { LAB_TRANSCRIPTION_MODEL, type LabModel, type LabVoice } from "./config"
import { LAB_TOOLS } from "./tools"
import { DOMAIN_INSTRUCTIONS, offTopicGuardrail } from "./scope"
import type { VoiceState } from "@core/voice/contracts"

export interface VoiceLabCallbacks {
  onState: (state: VoiceState) => void
  onUserTranscript: (text: string) => void
  onAssistantTranscript: (text: string) => void
  onError: (message: string) => void
  onRawEvent?: (event: unknown) => void
}

export interface StartOptions {
  clientSecret: string
  model: LabModel
  voice: LabVoice
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  return "realtime error"
}

/** Best-effort transcript extraction from a history item of unknown shape. */
function readItem(item: unknown): { role: string; text: string } | null {
  if (typeof item !== "object" || item === null) return null
  const rec = item as Record<string, unknown>
  const role = typeof rec.role === "string" ? rec.role : ""
  let text = ""
  const content = rec.content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object") {
        const p = part as Record<string, unknown>
        if (typeof p.transcript === "string") text += p.transcript
        else if (typeof p.text === "string") text += p.text
      }
    }
  } else if (typeof rec.transcript === "string") {
    text = rec.transcript
  }
  if (!role || !text) return null
  return { role, text }
}

export class VoiceLabSession {
  private session: RealtimeSession | null = null

  constructor(private readonly cb: VoiceLabCallbacks) {}

  async start(opts: StartOptions): Promise<void> {
    const agent = new RealtimeAgent({
      name: "Finesse Voice Lab",
      instructions: DOMAIN_INSTRUCTIONS,
      tools: LAB_TOOLS,
      voice: opts.voice,
    })

    const session = new RealtimeSession(agent, {
      transport: "webrtc",
      model: opts.model,
      outputGuardrails: [offTopicGuardrail],
      config: {
        voice: opts.voice,
        inputAudioTranscription: { model: LAB_TRANSCRIPTION_MODEL },
      },
    })
    this.session = session

    session.on("agent_start", () => this.cb.onState("thinking"))
    session.on("audio_start", () => this.cb.onState("speaking"))
    session.on("audio_stopped", () => this.cb.onState("listening"))
    session.on("audio_interrupted", () => this.cb.onState("interrupted"))
    session.on("error", (e: unknown) => {
      this.cb.onState("error")
      this.cb.onError(errMessage(e))
    })
    session.on("history_updated", (history: unknown) => {
      if (!Array.isArray(history) || history.length === 0) return
      const parsed = readItem(history[history.length - 1])
      if (!parsed) return
      if (parsed.role === "user") this.cb.onUserTranscript(parsed.text)
      else if (parsed.role === "assistant") this.cb.onAssistantTranscript(parsed.text)
    })
    session.on("transport_event", (event: unknown) => this.cb.onRawEvent?.(event))

    this.cb.onState("connecting")
    await session.connect({ apiKey: opts.clientSecret, model: opts.model })
    this.cb.onState("listening")
  }

  /** Manual barge-in (also happens automatically when the user speaks). */
  interrupt(): void {
    this.session?.interrupt()
  }

  /** Close the session and release the transport. Idempotent. */
  stop(): void {
    if (this.session) {
      try {
        this.session.close()
      } catch {
        /* already closed */
      }
      this.session = null
    }
    this.cb.onState("idle")
  }
}
