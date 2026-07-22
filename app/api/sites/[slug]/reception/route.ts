import { NextRequest, NextResponse } from "next/server"
import {
  resolveReceptionModel,
  handleReceptionMessage,
  handleReceptionAppointment,
  type ReceptionFailure,
} from "@engines/presence/reception-service"
import {
  sanitizeVisitorText,
  isValidVisitorId,
  isRateLimited,
} from "@engines/presence/reception-security"
import type { QuickActionId } from "@engines/presence/reception"

/**
 * Public digital-reception API for a Presence site: `/api/sites/<slug>/reception`.
 *
 * SECURITY: the workspace is derived SERVER-SIDE from the public slug (the site
 * must be published + entitled); the browser never sends a workspaceId and never
 * sends a WhatsApp number. Input is rate-limited, size-capped and sanitized
 * (HTML/scripts stripped). No internal ids are returned beyond the opaque
 * conversation id needed for continuity. Same-origin only (no CORS wildcard).
 */

export const dynamic = "force-dynamic"

// Per-instance, best-effort sliding-window limiter (mirrors the voice routes).
const RATE = new Map<string, number[]>()
const MAX_BODY_BYTES = 16_384

const VALID_ACTIONS = new Set<QuickActionId>(["services", "hours", "location", "appointment", "whatsapp", "human"])

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) || "unknown"
}

function statusForReason(reason: ReceptionFailure): number {
  switch (reason) {
    case "not_found":
    case "offline":
      return 404 // neutral — never reveal whether a site exists/is offline
    case "disabled":
      return 403
    case "invalid_appointment":
      return 400
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await resolveReceptionModel(slug)
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: statusForReason(result.reason!) })
  }
  return NextResponse.json({ ok: true, model: result.model, businessName: result.businessName })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Size guard before parsing.
  const len = Number(req.headers.get("content-length") ?? "0")
  if (len > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 })
  }

  // Rate limit by IP + slug.
  if (isRateLimited(RATE, `${clientIp(req)}:${slug}`, Date.now())) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const visitorId = body.visitorId
  if (!isValidVisitorId(visitorId)) {
    return NextResponse.json({ ok: false, error: "invalid_visitor" }, { status: 400 })
  }

  // Appointment submission.
  if (body.appointment && typeof body.appointment === "object") {
    const appt = body.appointment as Record<string, unknown>
    const result = await handleReceptionAppointment({
      slug,
      visitorId,
      appointment: {
        name: sanitizeVisitorText(appt.name, 80),
        service: sanitizeVisitorText(appt.service, 120),
        preferredDay: sanitizeVisitorText(appt.preferredDay, 120),
        contact: sanitizeVisitorText(appt.contact, 120),
        contactPreference: typeof appt.contactPreference === "string" ? appt.contactPreference : undefined,
        comment: sanitizeVisitorText(appt.comment, 500),
      },
      consent: body.consent && typeof body.consent === "object" ? (body.consent as { promotional?: unknown }) : null,
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason, errors: result.errors }, { status: statusForReason(result.reason!) })
    }
    return NextResponse.json({
      ok: true,
      conversationId: result.conversationId,
      reply: result.reply,
      contactPreference: result.contactPreference,
      whatsapp: result.whatsapp,
    })
  }

  // Chat message or quick action.
  const message = sanitizeVisitorText(body.message)
  const rawAction = typeof body.action === "string" ? body.action : null
  const action = rawAction && VALID_ACTIONS.has(rawAction as QuickActionId) ? (rawAction as QuickActionId) : null

  if (!message && !action) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 })
  }

  const result = await handleReceptionMessage({ slug, visitorId, message, action })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: statusForReason(result.reason!) })
  }
  return NextResponse.json({
    ok: true,
    conversationId: result.conversationId,
    reply: result.reply,
    intent: result.intent,
    quickActions: result.quickActions,
    offerAppointmentForm: result.offerAppointmentForm,
    handoff: result.handoff,
    whatsapp: result.whatsapp,
  })
}
