import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { requireReadAccess } from "@core/auth/workspace-auth"
import { resolveLabGate } from "@/app/voice-lab/gate"
import { mintEphemeralClientSecret, resolveSafetyIdentifier } from "@/app/voice-lab/mint"
import { validateModelVoice, LAB_LIMITS, LAB_TRANSCRIPTION_MODEL } from "@/app/voice-lab/config"
import { DOMAIN_INSTRUCTIONS } from "@/app/voice-lab/scope"

/**
 * `POST /api/voice/realtime-token` (CORE-VOICE-0B.1.1).
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

  // AUTH_SECRET is required to derive the anonymized safety identifier. If it is
  // missing we do NOT sign with an empty key and we do NOT call OpenAI — 503.
  const safetyIdentifier = resolveSafetyIdentifier(userId, workspaceId, process.env.AUTH_SECRET)
  if (!safetyIdentifier) {
    return new NextResponse(null, { status: 503, headers: NO_STORE })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Lab enabled without a key — misconfiguration. Generic, no detail.
    return new NextResponse(null, { status: 503, headers: NO_STORE })
  }

  // Validate the client-supplied model/voice: absent → default; present but not
  // allowlisted → 400 (never silently replaced with a default).
  let payload: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>
  } catch {
    payload = {}
  }
  const validation = validateModelVoice(payload)
  if (!validation.ok) {
    return NextResponse.json({ error: "invalid_model_or_voice" }, { status: 400, headers: NO_STORE })
  }
  const { model, voice } = validation

  try {
    const cred = await mintEphemeralClientSecret({
      apiKey,
      model,
      voice,
      instructions: DOMAIN_INSTRUCTIONS,
      ttlSeconds: LAB_LIMITS.ephemeralTtlSeconds,
      safetyIdentifier,
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
