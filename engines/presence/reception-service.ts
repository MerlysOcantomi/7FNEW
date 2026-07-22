/**
 * Sevenef Presence — reception service (PRESENCE-FANNY-01).
 *
 * DB-backed orchestration that wires the pure reception engine to the EXISTING
 * Smart Inbox primitives — it creates no parallel infrastructure. A visitor
 * message becomes a `web_chat` / `source:"web"` Conversation + Message via the
 * same shape the public widget already uses, Fanny answers deterministically,
 * and appointment / needs-human turn into a `WorkspaceTask` for human review.
 *
 * Multi-tenant safety: the workspace is ALWAYS derived server-side from the
 * public slug via `resolvePublicSite` (which also enforces published + entitled
 * visibility). The browser never supplies a workspaceId, and a WhatsApp number
 * is never accepted from the client — it is resolved from the workspace.
 */

import { db } from "@core/db"
import { addMessage } from "@modules/inbox/service"
import { isWebChatReceptionEnabled } from "@core/inbox/channel-setup"
import { resolvePublicSite } from "./repository"
import { loadPresenceContent } from "./content-loader"
import type { PresenceContentSource } from "./content-source"
import {
  resolveFannyProvider,
  buildReceptionModel,
  buildWhatsappLink,
  whatsappContextMessage,
  validateAppointmentRequest,
  normalizeConsent,
  type QuickActionId,
  type ReceptionModel,
  type AppointmentRequestInput,
  type QuickAction,
} from "./reception"

export type ReceptionFailure = "not_found" | "offline" | "disabled" | "invalid_appointment"

interface ResolvedSite {
  workspaceId: string
  content: PresenceContentSource
}

/** Resolve the workspace + public content for a slug, enforcing visibility + reception toggle. */
async function resolveReceptionSite(
  slug: string,
): Promise<{ ok: true; site: ResolvedSite } | { ok: false; reason: ReceptionFailure }> {
  const resolved = await resolvePublicSite(slug)
  if (!resolved) return { ok: false, reason: "not_found" }
  if (!resolved.isPubliclyVisible) return { ok: false, reason: "offline" }

  const ws = await db.workspace.findUnique({
    where: { id: resolved.site.workspaceId },
    select: { config: true },
  })
  if (!isWebChatReceptionEnabled(ws?.config)) return { ok: false, reason: "disabled" }

  const content = await loadPresenceContent(resolved.site.workspaceId)
  if (!content) return { ok: false, reason: "not_found" }
  return { ok: true, site: { workspaceId: resolved.site.workspaceId, content } }
}

/** WhatsApp: is the official API channel connected (vs. a public link only)? */
async function isWhatsappConnected(workspaceId: string): Promise<boolean> {
  const rows = await db.channelConnection.findMany({
    where: { workspaceId, channelType: "whatsapp" },
    select: { status: true },
  })
  return rows.some((r) => r.status === "connected")
}

async function resolveWhatsapp(
  workspaceId: string,
  content: PresenceContentSource,
  contextService?: string | null,
) {
  const number = content.channels.whatsapp
  const link = buildWhatsappLink(number, whatsappContextMessage(content.identity.name, contextService))
  return {
    available: !!link,
    connected: await isWhatsappConnected(workspaceId),
    link,
  }
}

/**
 * Ensure a `web_chat` conversation for an anonymous visitor, mirroring the
 * existing public-send flow (Contact keyed by `source: visitorId`, canal
 * `web_chat`, tipo `visitante`). Reuses one active conversation per visitor.
 */
async function ensureWebConversation(
  workspaceId: string,
  visitorId: string,
  firstContent: string,
): Promise<{ conversationId: string; isNew: boolean }> {
  let contact = await db.contact.findFirst({
    where: { workspaceId, source: visitorId, canal: "web_chat" },
  })
  if (!contact) {
    contact = await db.contact.create({
      data: { workspaceId, source: visitorId, canal: "web_chat", tipo: "visitante", nombre: null },
    })
  } else {
    await db.contact.update({ where: { id: contact.id }, data: { lastSeenAt: new Date() } })
  }

  const active = await db.conversation.findFirst({
    where: { workspaceId, contactId: contact.id, channel: "web_chat", status: { notIn: ["archived", "closed", "trashed"] } },
    orderBy: { lastMessageAt: "desc" },
  })
  if (active) return { conversationId: active.id, isNew: false }

  const subject = firstContent.trim().slice(0, 72) || "Web reception"
  const conv = await db.conversation.create({
    data: {
      workspaceId,
      contactId: contact.id,
      channel: "web_chat",
      source: "web",
      status: "new",
      subject,
      isPublic: true,
      lastMessageAt: new Date(),
      messageCount: 0,
    },
  })
  return { conversationId: conv.id, isNew: true }
}

/** Create a WorkspaceTask for human review (appointment / handoff). Never auto-confirms. */
async function createReceptionTask(
  workspaceId: string,
  conversationId: string,
  title: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db.workspaceTask.create({
    data: {
      workspaceId,
      title,
      status: "open",
      priority: "normal",
      sourceType: "inbox_conversation",
      sourceId: conversationId,
      sourceLabel: "Presence web reception",
      conversationId,
      suggestedBy: "fanny",
      createdBy: "fanny",
      executionMode: "manual",
      metadata: JSON.stringify(metadata),
    },
  })
}

// ---------------------------------------------------------------------------
// Public entry points (called by the API route)
// ---------------------------------------------------------------------------

export interface ReceptionModelResult {
  ok: boolean
  reason?: ReceptionFailure
  model?: ReceptionModel
  businessName?: string
}

/** Server-resolved reception model for initial widget render (page SSR). */
export async function resolveReceptionModel(slug: string): Promise<ReceptionModelResult> {
  const resolved = await resolveReceptionSite(slug)
  if (!resolved.ok) return { ok: false, reason: resolved.reason }
  const { workspaceId, content } = resolved.site
  const model = buildReceptionModel(content, {
    whatsappConnected: await isWhatsappConnected(workspaceId),
    fannyEnabled: true,
  })
  return { ok: true, model, businessName: content.identity.name }
}

export interface HandleMessageInput {
  slug: string
  visitorId: string
  message: string
  action?: QuickActionId | null
}

export interface ReceptionReply {
  ok: boolean
  reason?: ReceptionFailure
  conversationId?: string
  reply?: string
  intent?: string
  quickActions?: QuickAction[]
  offerAppointmentForm?: boolean
  handoff?: boolean
  /** Show the contextual "Continue on WhatsApp" affordance inside the chat. */
  suggestWhatsapp?: boolean
  whatsapp?: Awaited<ReturnType<typeof resolveWhatsapp>>
}

/** Handle a visitor chat message (or quick action) and produce Fanny's reply. */
export async function handleReceptionMessage(input: HandleMessageInput): Promise<ReceptionReply> {
  const resolved = await resolveReceptionSite(input.slug)
  if (!resolved.ok) return { ok: false, reason: resolved.reason }
  const { workspaceId, content } = resolved.site

  const seed = input.message || "(opened chat)"
  const { conversationId } = await ensureWebConversation(workspaceId, visitorSafe(input.visitorId), seed)

  if (input.message) {
    await addMessage({
      workspaceId,
      conversationId,
      role: "visitor",
      direction: "inbound",
      content: input.message,
      contentType: "text",
      isInternal: false,
      metadata: { origin: "presence", slug: input.slug },
    })
  }

  const fanny = resolveFannyProvider().respond({
    message: input.message ?? "",
    action: input.action ?? null,
    content,
  })

  await addMessage({
    workspaceId,
    conversationId,
    role: "assistant",
    direction: "outbound",
    content: fanny.reply,
    contentType: "text",
    isInternal: false,
    metadata: { agent: "fanny", provider: "deterministic", intent: fanny.intent },
  })

  if (fanny.handoff) {
    await createReceptionTask(workspaceId, conversationId, "Web visitor asked for a person", {
      origin: input.slug,
      intent: fanny.intent,
      reason: "human_requested",
    })
  }

  return {
    ok: true,
    conversationId,
    reply: fanny.reply,
    intent: fanny.intent,
    quickActions: fanny.quickActions,
    offerAppointmentForm: fanny.offerAppointmentForm,
    handoff: fanny.handoff,
    suggestWhatsapp: fanny.suggestWhatsapp,
    whatsapp: await resolveWhatsapp(workspaceId, content),
  }
}

export interface HandleAppointmentInput {
  slug: string
  visitorId: string
  appointment: AppointmentRequestInput
  consent?: { promotional?: unknown } | null
}

/** Collect an appointment request → structured message + WorkspaceTask (never auto-confirmed). */
export async function handleReceptionAppointment(input: HandleAppointmentInput): Promise<ReceptionReply & { errors?: string[]; contactPreference?: string }> {
  const resolved = await resolveReceptionSite(input.slug)
  if (!resolved.ok) return { ok: false, reason: resolved.reason }
  const { workspaceId, content } = resolved.site

  const validation = validateAppointmentRequest(input.appointment)
  if (!validation.ok || !validation.request || !validation.summary) {
    return { ok: false, reason: "invalid_appointment", errors: validation.errors }
  }
  const consent = normalizeConsent(input.consent)

  const { conversationId } = await ensureWebConversation(workspaceId, visitorSafe(input.visitorId), validation.summary)

  await addMessage({
    workspaceId,
    conversationId,
    role: "visitor",
    direction: "inbound",
    content: validation.summary,
    contentType: "text",
    isInternal: false,
    metadata: {
      origin: "presence",
      slug: input.slug,
      appointmentRequest: validation.request,
      contactPreference: validation.request.contactPreference,
      // Consent captured separately; promotional is explicit opt-in (default false).
      consent,
    },
  })

  const ack =
    "Thanks — I've prepared your appointment request for the team. They'll confirm availability. You can wait here or message us on WhatsApp."
  await addMessage({
    workspaceId,
    conversationId,
    role: "assistant",
    direction: "outbound",
    content: ack,
    contentType: "text",
    isInternal: false,
    metadata: { agent: "fanny", provider: "deterministic", intent: "appointment" },
  })

  await createReceptionTask(workspaceId, conversationId, `Appointment request — ${validation.request.name}`, {
    origin: input.slug,
    appointment: validation.request,
    contactPreference: validation.request.contactPreference,
    promotionalConsent: consent.promotional,
    needsHumanReview: true,
  })

  return {
    ok: true,
    conversationId,
    reply: ack,
    intent: "appointment",
    contactPreference: validation.request.contactPreference,
    // Offer WhatsApp continuity after finishing an appointment request, and
    // especially when the visitor chose WhatsApp as their preferred channel.
    suggestWhatsapp: true,
    whatsapp: await resolveWhatsapp(workspaceId, content, validation.request.service),
  }
}

/** Defensive: never let a malformed visitor id through to the DB layer. */
function visitorSafe(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 128) || "anon"
}
