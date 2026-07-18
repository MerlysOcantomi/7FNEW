/**
 * Voice Lab ephemeral credential minting (server-only, CORE-VOICE-0B.1).
 *
 * The generic minting client (OpenAI `POST /v1/realtime/client_secrets`,
 * normalized response, injectable fetch) and the anonymized safety-identifier
 * HMAC were promoted to `@core/voice/mint` during the shared-voice extraction.
 * This module keeps the lab's historical API: `MintParams` without a
 * transcription model (the lab always uses `LAB_TRANSCRIPTION_MODEL`).
 */

import {
  mintEphemeralClientSecret as mintShared,
  type EphemeralCredential,
} from "@core/voice/mint"
import { LAB_TRANSCRIPTION_MODEL, type LabModel, type LabVoice } from "./config"

export { resolveSafetyIdentifier, MintError, type EphemeralCredential } from "@core/voice/mint"

export interface MintParams {
  apiKey: string
  model: LabModel
  voice: LabVoice
  instructions: string
  ttlSeconds: number
  /** Anonymized OpenAI-Safety-Identifier (a hash — never PII). */
  safetyIdentifier: string
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch
}

export async function mintEphemeralClientSecret(
  params: MintParams,
): Promise<EphemeralCredential> {
  return mintShared({ ...params, transcriptionModel: LAB_TRANSCRIPTION_MODEL })
}
