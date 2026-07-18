/**
 * Shared Realtime voice session wrapper — browser only. Extracted from
 * `app/voice-lab/realtime-client.ts` (CORE-VOICE-0B.1.1) and made
 * configuration-driven so BOTH the Voice Lab and production surfaces (Ask
 * Finesse) run on one proven transport.
 *
 * Thin wrapper over `@openai/agents@0.3.0` `RealtimeSession` (WebRTC
 * transport). Maps SDK high-level events to the governed `VoiceState`, and
 * forwards RAW transport events to `onRawEvent` so the client can parse usage /
 * transcript / timing defensively (see `realtime-events.ts`). This wrapper does
 * NOT count turns and does NOT touch transcript — those are derived by the
 * client from parsed events, keyed by response/item id.
 *
 * Deliberately decoupled: agent name, instructions, tools, guardrails and the
 * transcription model are all OPTIONS. It never imports Voice Lab or Finesse
 * constants, page context or UI. Handlers use `unknown` params so the wrapper
 * does not couple to exact SDK payload shapes.
 */

import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime"
import type { VoiceState } from "./contracts"

export interface RealtimeVoiceCallbacks {
  onState: (state: VoiceState) => void
  onError: (message: string) => void
  /** Raw transport event — parse with `parseRealtimeEvent`. */
  onRawEvent: (event: unknown) => void
}

/** Tool/guardrail types come from the SDK; kept loose here on purpose. */
type AgentTools = ConstructorParameters<typeof RealtimeAgent>[0]["tools"]

export interface RealtimeVoiceStartOptions {
  clientSecret: string
  model: string
  voice: string
  transcriptionModel: string
  agentName: string
  instructions: string
  tools?: AgentTools
  outputGuardrails?: unknown[]
}

/** Minimal surface of the SDK session this wrapper relies on (test seam). */
export interface RealtimeSessionLike {
  on(event: string, handler: (...args: unknown[]) => void): unknown
  connect(options: { apiKey: string; model: string }): Promise<void>
  interrupt(): void
  mute(muted: boolean): void
  close(): void
}

export type RealtimeSessionFactory = (
  opts: RealtimeVoiceStartOptions,
) => RealtimeSessionLike

/** Default factory — constructs the real SDK agent + WebRTC session. */
export function defaultRealtimeSessionFactory(
  opts: RealtimeVoiceStartOptions,
): RealtimeSessionLike {
  const agent = new RealtimeAgent({
    name: opts.agentName,
    instructions: opts.instructions,
    tools: opts.tools,
    voice: opts.voice,
  })
  return new RealtimeSession(agent, {
    transport: "webrtc",
    model: opts.model,
    // The SDK types guardrails structurally; callers pass their own placeholder.
    outputGuardrails: (opts.outputGuardrails ?? []) as never,
    config: {
      voice: opts.voice,
      inputAudioTranscription: { model: opts.transcriptionModel },
    },
  }) as unknown as RealtimeSessionLike
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  return "realtime error"
}

export class RealtimeVoiceSession {
  private session: RealtimeSessionLike | null = null
  private starting = false

  constructor(
    private readonly cb: RealtimeVoiceCallbacks,
    private readonly factory: RealtimeSessionFactory = defaultRealtimeSessionFactory,
  ) {}

  /** True between a successful `start()` and `stop()`. */
  get live(): boolean {
    return this.session !== null && !this.starting
  }

  async start(opts: RealtimeVoiceStartOptions): Promise<void> {
    // One active session per wrapper — a second start while one is live or
    // connecting is a caller bug; fail loudly instead of leaking a transport.
    if (this.session || this.starting) {
      throw new Error("realtime session already active")
    }
    this.starting = true
    const session = this.factory(opts)
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
    try {
      await session.connect({ apiKey: opts.clientSecret, model: opts.model })
    } catch (err) {
      // Failed start must not leave a half-open session behind.
      this.session = null
      this.starting = false
      try {
        session.close()
      } catch {
        /* never opened */
      }
      throw err
    }
    this.starting = false
    this.cb.onState("listening")
  }

  /** Manual barge-in (also happens automatically when the user speaks). */
  interrupt(): void {
    this.session?.interrupt()
  }

  /** Mute/unmute the microphone without closing the transport. */
  mute(muted: boolean): void {
    try {
      this.session?.mute(muted)
    } catch {
      /* transport without mute support — ignore */
    }
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
    this.starting = false
    this.cb.onState("idle")
  }
}
