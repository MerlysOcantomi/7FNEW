/**
 * Sevenef Presence — digital reception engine (PRESENCE-FANNY-01).
 *
 * Pure, DB-free logic for the DUAL public reception of a Presence site:
 *   1. Fanny — a web chat that answers from the public Business Profile and
 *      creates a Smart Inbox conversation on channel `web_chat`.
 *   2. WhatsApp — a prominent, server-resolved link for direct contact and
 *      continuity. Never secondary, never a fallback-only action.
 *
 * This module owns NO transport and NO persistence: the API route wires it to
 * the existing Smart Inbox primitives (`addMessage`, conversation reuse). The
 * default Fanny responder is DETERMINISTIC — no AI vendor is required — behind a
 * swappable `FannyReceptionProvider` so a natural-language provider can be added
 * later. English is the technical base language (per the repo i18n system); it
 * never hardcodes Spanish.
 *
 * Data boundary: the responder may use ONLY the public content projected by
 * `content-source.ts` (identity, services, hours, region, whatsapp, social). It
 * never sees internal notes, clients, other workspaces, secrets, or prompts.
 */

import type { PresenceContentSource } from "./content-source"

// ---------------------------------------------------------------------------
// WhatsApp link (server-resolved number only)
// ---------------------------------------------------------------------------

export interface WhatsappLink {
  href: string
  display: string
}

/**
 * Build a safe `wa.me` link from a raw public number, with an optional short
 * prefilled message. The number MUST be resolved server-side from the workspace
 * — never accept a number from the browser. Returns null for missing/implausible
 * numbers. No internal ids or private data may be placed in the message.
 */
export function buildWhatsappLink(
  rawNumber: string | null | undefined,
  contextMessage?: string | null,
): WhatsappLink | null {
  if (!rawNumber || typeof rawNumber !== "string") return null
  const digits = rawNumber.replace(/[^\d]/g, "")
  if (digits.length < 6 || digits.length > 15) return null
  let href = `https://wa.me/${digits}`
  const msg = (contextMessage ?? "").trim()
  if (msg) href += `?text=${encodeURIComponent(msg.slice(0, 280))}`
  return { href, display: rawNumber.trim() }
}

/** Neutral contextual opener; `serviceName` is optional and comes from the profile. */
export function whatsappContextMessage(businessName: string, serviceName?: string | null): string {
  const base = `Hi, I'm coming from the ${businessName} website`
  return serviceName ? `${base} and I'm interested in ${serviceName}.` : `${base} and I'd like some information.`
}

// ---------------------------------------------------------------------------
// Dual reception model (what the widget renders)
// ---------------------------------------------------------------------------

export type QuickActionId = "services" | "hours" | "location" | "appointment" | "whatsapp" | "human"

export interface QuickAction {
  id: QuickActionId
  label: string
}

const QUICK_ACTION_LABELS: Record<QuickActionId, string> = {
  services: "View services",
  hours: "Opening hours",
  location: "Location",
  appointment: "Request an appointment",
  whatsapp: "Continue on WhatsApp",
  human: "Talk to a person",
}

/** Contextual label for the WhatsApp affordance shown INSIDE the chat. */
export const WHATSAPP_CONTINUE_LABEL = "Continue on WhatsApp"

/**
 * Initial quick actions — Fanny leads the reception. WhatsApp is deliberately
 * NOT one of the initial actions (it stays visible OUTSIDE the chat and appears
 * inside only in context — see `FannyReply.suggestWhatsapp`). `appointment` and
 * `human` are always offered; `services`/`hours` only when backed by real data.
 */
export function buildQuickActions(content: PresenceContentSource): QuickAction[] {
  const actions: QuickActionId[] = []
  if (content.services.some((s) => s.active)) actions.push("services")
  if (content.hours) actions.push("hours")
  actions.push("appointment")
  actions.push("human")
  return actions.map((id) => ({ id, label: QUICK_ACTION_LABELS[id] }))
}

export interface ReceptionModel {
  fanny: {
    enabled: boolean
    /** Localizable greeting; `businessName` interpolated by the caller/widget. */
    greeting: string
    quickActions: QuickAction[]
  }
  whatsapp: {
    /** A public link is available (number resolved). */
    available: boolean
    /** The official API channel is connected (can receive/automate). */
    connected: boolean
    link: WhatsappLink | null
  }
}

/**
 * Compose the dual reception model. Handles the three shapes a business can
 * offer: Fanny + WhatsApp, only Fanny, only WhatsApp — never rendering an empty
 * control for a channel that is not configured.
 */
export function buildReceptionModel(
  content: PresenceContentSource,
  opts: { whatsappConnected: boolean; fannyEnabled: boolean },
): ReceptionModel {
  const link = buildWhatsappLink(content.channels.whatsapp, whatsappContextMessage(content.identity.name))
  return {
    fanny: {
      enabled: opts.fannyEnabled,
      greeting: `Hi, I'm Fanny, the virtual receptionist for ${content.identity.name}. I can help with our services, hours or an appointment request. You can also message us directly on WhatsApp.`,
      quickActions: buildQuickActions(content),
    },
    whatsapp: {
      available: !!link,
      connected: opts.whatsappConnected,
      link,
    },
  }
}

// ---------------------------------------------------------------------------
// Deterministic Fanny responder (no AI vendor)
// ---------------------------------------------------------------------------

export type ReceptionIntent =
  | "greeting"
  | "services"
  | "hours"
  | "location"
  | "social"
  | "whatsapp"
  | "appointment"
  | "human"
  | "fallback"

export interface FannyReply {
  reply: string
  intent: ReceptionIntent
  quickActions: QuickAction[]
  /** True when the visitor should be handed to a human (needs_human). */
  handoff: boolean
  /** True when Fanny is inviting the visitor to open the appointment form. */
  offerAppointmentForm: boolean
  /**
   * True ONLY when the context justifies offering WhatsApp inside the chat:
   * a human request, an explicit WhatsApp question, or an unresolved query.
   * The widget shows a single "Continue on WhatsApp" affordance in that case —
   * WhatsApp is never a permanent in-chat control.
   */
  suggestWhatsapp: boolean
}

export interface FannyReceptionInput {
  message: string
  /** A quick-action tap short-circuits keyword classification. */
  action?: QuickActionId | null
  content: PresenceContentSource
}

export interface FannyReceptionProvider {
  readonly id: string
  respond(input: FannyReceptionInput): FannyReply
}

// Keyword sets accept English + Spanish so a visitor writing in either is
// understood; the REPLY wrapper is English (the repo's base language), while the
// business DATA (service names, hours) is rendered verbatim in its own language.
const KEYWORDS: Record<Exclude<ReceptionIntent, "greeting" | "fallback">, RegExp> = {
  services: /\b(services?|servicios?|precios?|prices?|cost|coste|tarifas?|treatments?|tratamientos?)\b/i,
  hours: /\b(hours?|horario?s?|open(ing)?|abiert|cu[aá]ndo|when|schedule)\b/i,
  location: /\b(where|d[oó]nde|location|ubicaci[oó]n|address|direcci[oó]n|map|mapa|c[oó]mo llegar)\b/i,
  social: /\b(instagram|facebook|tiktok|social|redes)\b/i,
  whatsapp: /\b(whats?app|wasap|wa)\b/i,
  appointment: /\b(appointment|cita|book|reservar|reserva|agendar|schedule a|turno)\b/i,
  human: /\b(human|person|persona|agent|agente|someone|alguien|operator|hablar con)\b/i,
}

function classify(message: string): ReceptionIntent {
  const m = message.trim()
  if (!m) return "greeting"
  if (/^(hi|hello|hey|hola|buenas|buenos)\b/i.test(m)) return "greeting"
  for (const [intent, re] of Object.entries(KEYWORDS)) {
    if (re.test(m)) return intent as ReceptionIntent
  }
  return "fallback"
}

function listServices(content: PresenceContentSource): string {
  const names = content.services.filter((s) => s.active).map((s) => s.name)
  return names.length ? names.join(" · ") : ""
}

/** The default deterministic Fanny — safe, offline, honest. */
export class DeterministicFannyProvider implements FannyReceptionProvider {
  readonly id = "deterministic"

  respond(input: FannyReceptionInput): FannyReply {
    const { content } = input
    const intent: ReceptionIntent = input.action
      ? actionToIntent(input.action)
      : classify(input.message)
    const quickActions = buildQuickActions(content)
    const name = content.identity.name

    switch (intent) {
      case "services": {
        const list = listServices(content)
        return reply(
          list ? `Here's what ${name} offers: ${list}. Would you like to request an appointment?` : `Let me connect you with the team for details on our services.`,
          "services",
          quickActions,
          { offerAppointmentForm: !!list },
        )
      }
      case "hours":
        return content.hours
          ? reply(`Our opening hours: ${content.hours}.`, "hours", quickActions)
          : reply(`I don't have our hours to hand — I can pass your question to the team.`, "hours", quickActions, { handoff: false })
      case "location":
        return content.region
          ? reply(`We're based in ${content.region}.`, "location", quickActions)
          : reply(`I can ask the team for our exact location.`, "location", quickActions)
      case "social": {
        const socials = Object.keys(content.channels.social)
        return socials.length
          ? reply(`You can see our work on ${socials.map(cap).join(", ")}.`, "social", quickActions)
          : reply(`We'll share our channels soon.`, "social", quickActions)
      }
      case "whatsapp":
        return reply(`Of course — you can continue on WhatsApp, or stay here and I'll help you.`, "whatsapp", quickActions, { suggestWhatsapp: true })
      case "appointment":
        return reply(`Great — I can take an appointment request. Tell me your name, the service, and a preferred day, and the team will confirm.`, "appointment", quickActions, { offerAppointmentForm: true })
      case "human":
        return reply(`I've prepared your request for the team. You can wait for a reply here in the chat, or continue on WhatsApp.`, "human", quickActions, { handoff: true, suggestWhatsapp: true })
      case "greeting":
        return reply(`Hi! I'm Fanny, the virtual receptionist for ${name}. I can help with our services, hours or an appointment request.`, "greeting", quickActions)
      default:
        return reply(`I can help with our services, opening hours, location, or an appointment request. You can also talk to a person if you prefer.`, "fallback", quickActions, { suggestWhatsapp: true })
    }
  }
}

function actionToIntent(action: QuickActionId): ReceptionIntent {
  switch (action) {
    case "services": return "services"
    case "hours": return "hours"
    case "location": return "location"
    case "appointment": return "appointment"
    case "whatsapp": return "whatsapp"
    case "human": return "human"
  }
}

function reply(
  text: string,
  intent: ReceptionIntent,
  quickActions: QuickAction[],
  opts: { handoff?: boolean; offerAppointmentForm?: boolean; suggestWhatsapp?: boolean } = {},
): FannyReply {
  return {
    reply: text,
    intent,
    quickActions,
    handoff: opts.handoff ?? false,
    offerAppointmentForm: opts.offerAppointmentForm ?? false,
    suggestWhatsapp: opts.suggestWhatsapp ?? false,
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const defaultProvider = new DeterministicFannyProvider()

/** Resolve the Fanny provider — default deterministic; an AI provider can be injected later. */
export function resolveFannyProvider(override?: FannyReceptionProvider | null): FannyReceptionProvider {
  return override ?? defaultProvider
}

// ---------------------------------------------------------------------------
// Appointment request (Fanny collects; NEVER auto-confirms)
// ---------------------------------------------------------------------------

export type ContactPreference = "chat" | "whatsapp" | "phone" | "email"
const CONTACT_PREFERENCES: readonly ContactPreference[] = ["chat", "whatsapp", "phone", "email"]

export interface AppointmentRequestInput {
  name?: string
  service?: string
  preferredDay?: string
  contact?: string
  contactPreference?: string
  comment?: string
}

export interface AppointmentRequest {
  name: string
  service: string | null
  preferredDay: string | null
  contact: string | null
  contactPreference: ContactPreference
  comment: string | null
}

export interface AppointmentValidation {
  ok: boolean
  request?: AppointmentRequest
  /** Structured, human-readable summary message for the Smart Inbox conversation. */
  summary?: string
  errors: string[]
}

function clip(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

/**
 * Validate & normalize an appointment request. Requires a name and a way to
 * reach the visitor unless they chose to continue in the chat. Produces a
 * structured summary for the operator. NEVER confirms a booking (no Calendar
 * integration): the request is prepared for human review.
 */
export function validateAppointmentRequest(input: AppointmentRequestInput): AppointmentValidation {
  const errors: string[] = []
  const name = clip(input.name, 80)
  if (!name) errors.push("name_required")

  const pref = CONTACT_PREFERENCES.includes(input.contactPreference as ContactPreference)
    ? (input.contactPreference as ContactPreference)
    : "chat"
  const contact = clip(input.contact, 120) || null
  if (pref !== "chat" && !contact) errors.push("contact_required_for_preference")

  if (errors.length) return { ok: false, errors }

  const request: AppointmentRequest = {
    name,
    service: clip(input.service, 120) || null,
    preferredDay: clip(input.preferredDay, 120) || null,
    contact,
    contactPreference: pref,
    comment: clip(input.comment, 500) || null,
  }

  const lines = [
    `Appointment request from ${request.name}`,
    request.service ? `Service: ${request.service}` : null,
    request.preferredDay ? `Preferred: ${request.preferredDay}` : null,
    `Preferred contact: ${request.contactPreference}${request.contact ? ` (${request.contact})` : ""}`,
    request.comment ? `Note: ${request.comment}` : null,
  ].filter(Boolean)

  return { ok: true, request, summary: lines.join("\n"), errors: [] }
}

// ---------------------------------------------------------------------------
// Consent (minimal — no dedicated consent subsystem exists in the repo)
// ---------------------------------------------------------------------------

export interface ReceptionConsent {
  /** Permission to reply to THIS request — implicit when the visitor writes in. */
  operational: boolean
  /** OPTIONAL, explicit, opt-in permission for promotions. Default false. */
  promotional: boolean
}

/**
 * Normalize consent. Writing in / leaving a contact is operational consent only.
 * Promotional consent is separate, explicit, never preselected, and only granted
 * when the visitor sets it to exactly `true`.
 */
export function normalizeConsent(input: { promotional?: unknown } | null | undefined): ReceptionConsent {
  return { operational: true, promotional: input?.promotional === true }
}
