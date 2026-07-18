/**
 * Voice Lab Realtime wrapper (CORE-VOICE-0B.1.1) — browser only.
 *
 * Since the shared-voice extraction this is a THIN ADAPTER over the generic
 * `RealtimeVoiceSession` in `@core/voice/realtime-session`: the lab supplies
 * its own agent name, experimental instructions, simulation tools, placeholder
 * guardrail and transcription model as configuration. The transport, state
 * mapping and raw-event forwarding live in core and are shared with the
 * production Ask Finesse voice surface — one proven implementation, two
 * consumers.
 *
 * The public `VoiceLabSession` API is unchanged, so `voice-lab-client.tsx`
 * and the lab tests keep working as before.
 */

import {
  RealtimeVoiceSession,
  type RealtimeVoiceCallbacks,
} from "@core/voice/realtime-session"
import {
  LAB_AGENT_NAME,
  LAB_TRANSCRIPTION_MODEL,
  type LabModel,
  type LabVoice,
} from "./config"
import { LAB_TOOLS } from "./tools"
import { DOMAIN_INSTRUCTIONS, scopeGuardrailPlaceholder } from "./scope"

export type VoiceLabCallbacks = RealtimeVoiceCallbacks

export interface StartOptions {
  clientSecret: string
  model: LabModel
  voice: LabVoice
}

export class VoiceLabSession {
  private readonly session: RealtimeVoiceSession

  constructor(cb: VoiceLabCallbacks) {
    this.session = new RealtimeVoiceSession(cb)
  }

  async start(opts: StartOptions): Promise<void> {
    await this.session.start({
      clientSecret: opts.clientSecret,
      model: opts.model,
      voice: opts.voice,
      transcriptionModel: LAB_TRANSCRIPTION_MODEL,
      agentName: LAB_AGENT_NAME,
      instructions: DOMAIN_INSTRUCTIONS,
      tools: LAB_TOOLS,
      outputGuardrails: [scopeGuardrailPlaceholder],
    })
  }

  /** Manual barge-in (also happens automatically when the user speaks). */
  interrupt(): void {
    this.session.interrupt()
  }

  /** Close the session and release the transport. Idempotent. */
  stop(): void {
    this.session.stop()
  }
}
