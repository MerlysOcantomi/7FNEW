import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { createHmac } from "node:crypto"
import { requireReadAccess } from "@core/auth/workspace-auth"
import { resolveLabGate } from "@/app/voice-lab/gate"
import { mintEphemeralClientSecret } from "@/app/voice-lab/mint"
import {
  resolveLabModel,
  resolveLabVoice,
  DEFAULT_LAB_MODEL,
  DEFAULT_LAB_VOICE,
  LAB_LIMITS,
  LAB_TRANSCRIPTION_MODEL,
} from "@/app/voice-lab/config"
import { DOMAIN_INSTRUCTIONS } from "@/app/voice-lab/scope"

/**
 * `POST /api/voice/realtime-token` (CORE-VOICE-0B.1).
 *
 * POST-only, nodejs runtime, Cache-Control: no-store. Same gate as `/voice-lab`.
 * Mints a short-lived ephemeral Realtime credential server-side and returns the
 * NORMALIZED { clientSecret, expiresAt }. The real OPENAI_API_KEY never reaches
 * the client. No tokens, API keys or audio are ever logged.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

/**
 * Best-effort, in-memory rate limit. NOTE: on serverless (Vercel) each instance
 * has its own memory, so this is NOT a durable global limit — it is documented
 * as best-effort for the spike only. Production would need a shared store
 * (e.g. KV / Upstash).
 */
const RATE = new Map<string, number[]>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 10

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (RATE.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  hits.push(now)
  RATE.set(key, hits)
  return hits.length > RATE_MAX
}

/** Anonymized safety identifier (HMAC of user+workspace) — never PII. */
function anonSafetyId(userId: string, workspaceId: string): string {
  const secret = process.env.AUTH_SECRET ?? ""
  const digest = createHmac("sha256", secret).update(`${userId}:${workspaceId}`).digest("hex")
  return `anon_${digest.slice(0, 32)}`
}

export async function POST(req: NextRequest) {
  // Same gate as the page. 404 when off/non-admin; 403 when workspace invalid.
  const gate = await resolveLabGate()
  if (!gate.allowed) {
    return new NextResponse(null, { status: gate.status, headers: NO_STORE })
  }

  // Re-derive identity server-side (never trust the client). Gate already
  // confirmed access, so this should succeed; treat any failure as 403.
  let userId = ""
  let workspaceId = ""
  try {
    const auth = await requireReadAccess()
    userId = auth.session.userId
    workspaceId = auth.workspaceId
  } catch {
    return new NextResponse(null, { status: 403, headers: NO_STORE })
  }

  if (rateLimited(`${userId}:${workspaceId}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Lab enabled without a key — misconfiguration. Generic, no detail.
    return new NextResponse(null, { status: 503, headers: NO_STORE })
  }

  // Validate the client-supplied model/voice against the server allowlist.
  let payload: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>
  } catch {
    payload = {}
  }
  const model = resolveLabModel(payload.model) ?? DEFAULT_LAB_MODEL
  const voice = resolveLabVoice(payload.voice) ?? DEFAULT_LAB_VOICE

  try {
    const cred = await mintEphemeralClientSecret({
      apiKey,
      model,
      voice,
      instructions: DOMAIN_INSTRUCTIONS,
      ttlSeconds: LAB_LIMITS.ephemeralTtlSeconds,
      safetyIdentifier: anonSafetyId(userId, workspaceId),
    })
    return NextResponse.json(
      {
        clientSecret: cred.clientSecret,
        expiresAt: cred.expiresAt,
        model,
        voice,
        transcriptionModel: LAB_TRANSCRIPTION_MODEL,
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    // Log only the error name — never the body, headers, key or audio.
    console.error("voice-lab realtime-token mint failed:", err instanceof Error ? err.name : "unknown")
    return new NextResponse(null, { status: 502, headers: NO_STORE })
  }
}
