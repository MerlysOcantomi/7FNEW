/**
 * Voice Lab Realtime wrapper (CORE-VOICE-0B.1.1) — browser only.
 *
 * Thin wrapper over `@openai/agents@0.3.0` `RealtimeSession` (WebRTC transport).
 * Maps SDK high-level events to the governed `VoiceState`, and forwards RAW
 * transport events to `onRawEvent` so the client can parse usage / transcript /
 * timing defensively (see `events.ts`). This wrapper does NOT count turns and
 * does NOT touch transcript — those are derived by the client from parsed
 * events, keyed by response/item id.
 *
 * Handlers use `unknown` params so the wrapper does not couple to exact SDK
 * payload shapes.
 */

import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime"
import {
  LAB_AGENT_NAME,
  LAB_TRANSCRIPTION_MODEL,
  type LabModel,
  type LabVoice,
} from "./config"
import { LAB_TOOLS } from "./tools"
import { DOMAIN_INSTRUCTIONS, scopeGuardrailPlaceholder } from "./scope"
import type { VoiceState } from "@core/voice/contracts"

export interface VoiceLabCallbacks {
  onState: (state: VoiceState) => void
  onError: (message: string) => void
  /** Raw transport event — the client parses it with `parseLabEvent`. */
  onRawEvent: (event: unknown) => void
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

export class VoiceLabSession {
  private session: RealtimeSession | null = null

  constructor(private readonly cb: VoiceLabCallbacks) {}

  async start(opts: StartOptions): Promise<void> {
    const agent = new RealtimeAgent({
      name: LAB_AGENT_NAME,
      instructions: DOMAIN_INSTRUCTIONS,
      tools: LAB_TOOLS,
      voice: opts.voice,
    })

    const session = new RealtimeSession(agent, {
      transport: "webrtc",
      model: opts.model,
      outputGuardrails: [scopeGuardrailPlaceholder],
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
    // Raw transport events → client parses usage / transcript / timing.
    session.on("transport_event", (event: unknown) => this.cb.onRawEvent(event))

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
