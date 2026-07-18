/**
 * Shared ephemeral Realtime credential minting (server-only). Extracted from
 * `app/voice-lab/mint.ts` (CORE-VOICE-0B.1) so every voice surface (Voice Lab,
 * Ask Finesse) mints credentials through ONE audited path.
 *
 * Calls OpenAI's `POST /v1/realtime/client_secrets` with the SERVER API key and
 * returns a NORMALIZED shape (`clientSecret` / `expiresAt`) — the official
 * response is `{ value, expires_at, session }`, we never surface a raw
 * `client_secret` field. The real API key never leaves the server; only the
 * short-lived `ek_…` value is returned to the browser.
 *
 * Generic on purpose: model / voice / transcription model / instructions are
 * plain parameters — no Voice Lab constants, no Finesse constants. Each caller
 * applies its OWN allowlists BEFORE minting. `fetchImpl` is injectable so tests
 * mock the network — no test ever calls OpenAI for real.
 */

import { createHmac } from "node:crypto"

const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"

/**
 * Anonymized OpenAI-Safety-Identifier (HMAC of user+workspace) — never PII.
 * Returns `null` when `AUTH_SECRET` is absent/empty: the caller must then NOT
 * mint a credential (respond 503) rather than sign with an empty key.
 */
export function resolveSafetyIdentifier(
  userId: string,
  workspaceId: string,
  authSecret: string | undefined,
): string | null {
  if (!authSecret) return null
  const digest = createHmac("sha256", authSecret).update(`${userId}:${workspaceId}`).digest("hex")
  return `anon_${digest.slice(0, 32)}`
}

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
  /** Already validated against the CALLER's allowlist. */
  model: string
  /** Already validated against the CALLER's allowlist. */
  voice: string
  transcriptionModel: string
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
        input: { transcription: { model: params.transcriptionModel } },
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
