/**
 * Ephemeral Realtime credential minting (server-only, CORE-VOICE-0B.1).
 *
 * Calls OpenAI's `POST /v1/realtime/client_secrets` with the SERVER API key and
 * returns a NORMALIZED shape (`clientSecret` / `expiresAt`) — the official
 * response is `{ value, expires_at, session }`, we never surface a raw
 * `client_secret` field. The real API key never leaves the server; only the
 * short-lived `ek_…` value is returned to the browser.
 *
 * `fetchImpl` is injectable so tests mock the network — no test ever calls
 * OpenAI for real.
 */

import { LAB_TRANSCRIPTION_MODEL, type LabModel, type LabVoice } from "./config"

const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"

/** OpenAI's official response shape for a created client secret. */
interface OpenAIClientSecretResponse {
  value: string
  expires_at: number
  session?: unknown
}

/** Normalized credential returned to our client. Never exposes the raw field. */
export interface EphemeralCredential {
  clientSecret: string
  expiresAt: number
}

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

export class MintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MintError"
  }
}

function isClientSecretResponse(v: unknown): v is OpenAIClientSecretResponse {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).value === "string" &&
    typeof (v as Record<string, unknown>).expires_at === "number"
  )
}

export async function mintEphemeralClientSecret(
  params: MintParams,
): Promise<EphemeralCredential> {
  const doFetch = params.fetchImpl ?? fetch

  const body = {
    expires_after: { anchor: "created_at", seconds: params.ttlSeconds },
    session: {
      type: "realtime",
      model: params.model,
      instructions: params.instructions,
      audio: {
        input: { transcription: { model: LAB_TRANSCRIPTION_MODEL } },
        output: { voice: params.voice },
      },
    },
  }

  const res = await doFetch(OPENAI_CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      // Anonymized abuse-monitoring identifier — never PII.
      "OpenAI-Safety-Identifier": params.safetyIdentifier,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    // Never include the response body or headers — they may echo secrets.
    throw new MintError(`client_secrets request failed (${res.status})`)
  }

  const json: unknown = await res.json()
  if (!isClientSecretResponse(json)) {
    throw new MintError("unexpected client_secrets response shape")
  }

  return { clientSecret: json.value, expiresAt: json.expires_at }
}
