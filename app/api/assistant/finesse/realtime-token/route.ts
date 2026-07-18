import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { requireReadAccess } from "@core/auth/workspace-auth"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { mintEphemeralClientSecret, resolveSafetyIdentifier } from "@core/voice/mint"
import { sanitizeFinesseContext } from "@modules/assistant/finesse-assistant"
import {
  FINESSE_TRANSCRIPTION_MODEL,
  FINESSE_VOICE_LIMITS,
  createInMemoryMintLimiter,
  resolveFinesseVoiceEntitlement,
  validateFinesseModelVoice,
} from "@modules/assistant/finesse-voice-policy"
import {
  buildFinesseVoiceInstructions,
  clipConversationSummary,
} from "@modules/assistant/finesse-voice-prompt"

/**
 * `POST /api/assistant/finesse/realtime-token` — the PRODUCTION-facing
 * Finesse voice credential endpoint. Deliberately separate from the Voice
 * Lab's `/api/voice/realtime-token`: that endpoint is governed by the
 * platform-admin lab gate and lab instructions, neither of which is a
 * customer entitlement.
 *
 * Server guarantees (mission §8):
 *  - Authenticated session + read access; workspace and vertical resolved
 *    SERVER-side (payload identity is never trusted).
 *  - Entitlement: FINESSE_VOICE_ENABLED flag, optional FINESSE_VOICE_WORKSPACES
 *    allowlist, Beauty vertical. Reasons map to honest statuses:
 *    feature off / wrong vertical → 404 (the surface does not exist for you),
 *    workspace not allowlisted → 403.
 *  - Model/voice validated against the Finesse allowlist (400 on invalid;
 *    absent → cost-conscious defaults). Short-lived ephemeral credential only
 *    (45s TTL) with Finesse-specific read-only instructions — no tools, so
 *    this session CANNOT mutate business data.
 *  - Rate-limited minting per user+workspace (best-effort in-memory limiter
 *    behind an interface for a future durable store) → 429.
 *  - `Cache-Control: no-store`; the real OPENAI_API_KEY never leaves the
 *    server; tokens, audio and transcripts are never logged.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

const limiter = createInMemoryMintLimiter()

export async function POST(req: NextRequest) {
  // Identity first — always server-derived.
  let userId = ""
  let workspaceId = ""
  try {
    const auth = await requireReadAccess(req)
    userId = auth.session.userId
    workspaceId = auth.workspaceId
  } catch {
    return NextResponse.json({ error: "permission_denied" }, { status: 403, headers: NO_STORE })
  }

  const ws = await getWorkspaceWithResolvedConfig(workspaceId)
  if (!ws) {
    return NextResponse.json({ error: "permission_denied" }, { status: 403, headers: NO_STORE })
  }

  const entitlement = resolveFinesseVoiceEntitlement({
    featureFlag: process.env.FINESSE_VOICE_ENABLED,
    workspaceAllowlist: process.env.FINESSE_VOICE_WORKSPACES,
    workspaceId,
    verticalKey: ws.verticalKey,
    hasReadAccess: true,
  })
  if (!entitlement.enabled) {
    // Feature off / wrong vertical read as "not found" (no surface leak);
    // an explicit allowlist miss is an honest 403.
    const status =
      entitlement.reason === "workspace_not_allowed" || entitlement.reason === "permission_denied"
        ? 403
        : 404
    return NextResponse.json({ error: entitlement.reason }, { status, headers: NO_STORE })
  }

  if (limiter.limited(`${userId}:${workspaceId}`, Date.now())) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE })
  }

  // AUTH_SECRET is required for the anonymized safety identifier; never sign
  // with an empty key and never call OpenAI without one.
  const safetyIdentifier = resolveSafetyIdentifier(userId, workspaceId, process.env.AUTH_SECRET)
  if (!safetyIdentifier) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 503, headers: NO_STORE })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 503, headers: NO_STORE })
  }

  let payload: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>
  } catch {
    payload = {}
  }

  const validation = validateFinesseModelVoice(payload)
  if (!validation.ok) {
    return NextResponse.json(
      { error: "invalid_model_or_voice" },
      { status: 400, headers: NO_STORE },
    )
  }
  const { model, voice } = validation

  // Page context + optional short conversation summary — sanitized, then
  // scoped to the AUTHENTICATED workspace (payload identity ignored).
  const context = sanitizeFinesseContext(payload.context)
  const conversationSummary = clipConversationSummary(payload.conversationSummary)

  // Voice follows the viewer's interface language: the sanitized context
  // carries the effective `useI18n()` locale; the workspace locale is only
  // the server-side fallback (e.g. a tampered/legacy client omitting it).
  const instructions = buildFinesseVoiceInstructions({
    workspaceName: ws.nombre ?? null,
    locale: context.locale ?? ws.locale,
    context,
    conversationSummary,
  })

  try {
    const cred = await mintEphemeralClientSecret({
      apiKey,
      model,
      voice,
      transcriptionModel: FINESSE_TRANSCRIPTION_MODEL,
      instructions,
      ttlSeconds: FINESSE_VOICE_LIMITS.ephemeralTtlSeconds,
      safetyIdentifier,
    })
    return NextResponse.json(
      {
        clientSecret: cred.clientSecret,
        expiresAt: cred.expiresAt,
        model,
        voice,
        transcriptionModel: FINESSE_TRANSCRIPTION_MODEL,
        limits: {
          sessionMaxMs: FINESSE_VOICE_LIMITS.sessionMaxMs,
          inactivityMs: FINESSE_VOICE_LIMITS.inactivityMs,
        },
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    // Log only the error name — never the body, headers, key or audio.
    console.error("finesse realtime-token mint failed:", err instanceof Error ? err.name : "unknown")
    return NextResponse.json({ error: "mint_failed" }, { status: 502, headers: NO_STORE })
  }
}
