/**
 * Ask Finesse — pure contracts, page mapping and localized copy (EN canonical
 * + ES) for the global Beauty assistant. No React, no DB, no clock — safe on
 * client, server and in tests (mirrors `modules/overview/beauty-overview.ts`).
 *
 * The assistant is page-aware: pages REGISTER a small serializable context
 * (`FinesseAssistantPageContext`) through the provider, and this module maps
 * the current route → page key → contextual suggestions + intro. Context is
 * minimal and explicit — never scraped from the DOM — and the server route
 * re-scopes it to the authenticated workspace before building any prompt.
 */

import { parseLocale } from "@core/i18n"
import type { OverviewPeriodPreset } from "@modules/overview/types"

// ─── Page mapping ────────────────────────────────────────────────────────────

export type FinesseAssistantPageKey =
  | "my-salon"
  | "today"
  | "agenda"
  | "clients"
  | "messages"
  | "catalog"
  | "marketing"
  | "billing"
  | "team"
  | "settings"
  | "other"

/**
 * Route → page key for every surface the Beauty shell mounts. Pure prefix
 * mapping (query strings already stripped by the caller). Unknown routes are
 * honest "other" — generic suggestions, never a wrong context label.
 */
export function resolveFinessePageKey(pathname: string): FinesseAssistantPageKey {
  if (pathname === "/") return "my-salon"
  if (pathname === "/today" || pathname.startsWith("/today/")) return "today"
  if (pathname === "/calendario" || pathname.startsWith("/calendario/")) return "agenda"
  if (pathname === "/clientes" || pathname.startsWith("/clientes/")) return "clients"
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return "messages"
  if (pathname === "/services" || pathname.startsWith("/services/")) return "catalog"
  if (pathname === "/contenido" || pathname.startsWith("/contenido/")) return "marketing"
  if (pathname === "/facturacion" || pathname.startsWith("/facturacion/")) return "billing"
  if (pathname === "/usuarios" || pathname.startsWith("/usuarios/")) return "team"
  if (pathname === "/business-profile" || pathname.startsWith("/business-profile/")) return "settings"
  return "other"
}

// ─── Context contract ────────────────────────────────────────────────────────

/**
 * What a page can register (all optional beyond `page`). Serializable, small
 * and permission-aware by construction: pages only put in what the viewer
 * already sees on screen (e.g. `visibleMetrics` from the overview snapshot).
 */
export interface FinesseAssistantPageContext {
  page: FinesseAssistantPageKey
  section?: string
  selectedEntityType?: string
  selectedEntityId?: string
  period?: { preset: OverviewPeriodPreset; start: string; end: string }
  visibleMetrics?: Record<string, number | string | null>
}

/** The full context the panel sends to the API (workspace added by provider). */
export interface FinesseAssistantContext extends FinesseAssistantPageContext {
  workspaceId: string
  vertical: string
  route: string
  locale?: string
  currency?: string
}

// ─── Conversation contract ───────────────────────────────────────────────────

export interface FinesseAssistantMessage {
  id: string
  role: "user" | "assistant"
  content: string
  /** How the turn originated. Absent = "text" (pre-voice messages). */
  inputMode?: "text" | "voice"
  /**
   * Voice turns stream: `partial` while transcribing, `final` once settled,
   * `interrupted` when a barge-in cut the assistant short (the partial text is
   * kept, honestly marked, never presented as a complete answer).
   */
  status?: "partial" | "final" | "interrupted" | "error"
}

export type FinesseAssistantStatus = "idle" | "loading" | "error" | "unavailable"

// ─── Copy (localized: EN canonical + ES — resolved via the Core contract) ────

/**
 * Locales with a REAL assistant catalog today. The other official locales
 * (de/fr/it) fall back to English until real catalogs exist — same external
 * contract as everywhere else: `parseLocale` normalizes unknown input first.
 */
export type FinesseAssistantLocale = "en" | "es"

/** Effective UI locale → catalog locale (en fallback for de/fr/it/unknown). */
export function resolveFinesseAssistantLocale(
  locale: string | null | undefined,
): FinesseAssistantLocale {
  return parseLocale(locale) === "es" ? "es" : "en"
}

export interface FinesseAssistantCopy {
  /** Launcher label (desktop pill). */
  launcherLabel: string
  /** Accessible name for the icon-only mobile launcher. */
  launcherAria: string
  panelTitle: string
  panelSubtitle: string
  contextLead: string
  pageLabels: Record<FinesseAssistantPageKey, string>
  intros: Record<FinesseAssistantPageKey, string>
  suggestionsTitle: string
  composerPlaceholder: string
  send: string
  close: string
  thinking: string
  /** Honest state when the AI backend is not configured. */
  unavailable: { title: string; description: string }
  error: { title: string; retry: string }
  /** Honesty note: Finesse advises, it does not execute actions. */
  honestyNote: string
  emptyConversation: string
}

/**
 * English catalog — canonical. Proper nouns (Finesse, Sevenef, 7F Beauty) are
 * identical across locales. Page labels follow the app nav vocabulary
 * (`core/i18n/ui/en/nav.ts` + the Beauty vertical presets).
 */
const COPY_EN: FinesseAssistantCopy = {
  launcherLabel: "Ask Finesse",
  launcherAria: "Ask Finesse, your business assistant",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "You're on",
  pageLabels: {
    "my-salon": "My salon",
    today: "Today",
    agenda: "Calendar",
    clients: "Clients",
    messages: "Messages",
    catalog: "Services",
    marketing: "Marketing",
    billing: "Billing",
    team: "Team",
    settings: "Settings",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "I can explain how your salon is doing this period and what you can improve.",
    today: "I can help you organize your day and decide what to do first.",
    agenda: "I can help you with your appointments, open slots and peak hours.",
    clients: "I can help you look after your clients and spot who needs attention.",
    messages: "I can help you bring order to your conversations.",
    catalog: "I can help you understand which services perform best.",
    marketing: "I can give you ideas for your content and campaigns.",
    billing: "I can help you with your payments and outstanding invoices.",
    team: "I can help you organize your team's work.",
    settings: "I can help you set up your workspace.",
    other: "Ask me anything you need about your business.",
  },
  suggestionsTitle: "Suggestions",
  composerPlaceholder: "Type your question…",
  send: "Send",
  close: "Close",
  thinking: "Finesse is thinking…",
  unavailable: {
    title: "Finesse isn't connected yet.",
    description:
      "The assistant will be available once the AI service is connected. Everything else in your workspace keeps working as usual.",
  },
  error: {
    title: "I couldn't answer just now.",
    retry: "Try again in a few seconds.",
  },
  honestyNote:
    "Finesse answers with the information visible in your workspace. It doesn't take actions for you yet.",
  emptyConversation: "Pick a suggestion or type your question.",
}

/** Spanish catalog (España — same convention as the Beauty configs). */
const COPY_ES: FinesseAssistantCopy = {
  launcherLabel: "Preguntar a Finesse",
  launcherAria: "Preguntar a Finesse, tu asistente de negocio",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "Estás en",
  pageLabels: {
    "my-salon": "Mi salón",
    today: "Hoy",
    agenda: "Agenda",
    clients: "Clientes",
    messages: "Mensajes",
    catalog: "Servicios",
    marketing: "Marketing",
    billing: "Cobros",
    team: "Equipo",
    settings: "Ajustes",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "Puedo explicarte cómo va tu salón este periodo y qué puedes mejorar.",
    today: "Puedo ayudarte a organizar tu día y decidir qué hacer primero.",
    agenda: "Puedo ayudarte con tus citas, huecos libres y horas punta.",
    clients: "Puedo ayudarte a cuidar a tus clientes y detectar quién necesita atención.",
    messages: "Puedo ayudarte a poner orden en tus conversaciones.",
    catalog: "Puedo ayudarte a entender qué servicios funcionan mejor.",
    marketing: "Puedo darte ideas para tu contenido y campañas.",
    billing: "Puedo ayudarte con tus cobros y facturas pendientes.",
    team: "Puedo ayudarte a organizar el trabajo de tu equipo.",
    settings: "Puedo ayudarte a configurar tu espacio de trabajo.",
    other: "Pregúntame lo que necesites sobre tu negocio.",
  },
  suggestionsTitle: "Sugerencias",
  composerPlaceholder: "Escribe tu pregunta…",
  send: "Enviar",
  close: "Cerrar",
  thinking: "Finesse está pensando…",
  unavailable: {
    title: "Finesse aún no está conectada.",
    description:
      "El asistente estará disponible cuando se conecte el servicio de IA. Todo lo demás de tu espacio sigue funcionando con normalidad.",
  },
  error: {
    title: "No he podido responder ahora mismo.",
    retry: "Vuelve a intentarlo en unos segundos.",
  },
  honestyNote:
    "Finesse responde con la información visible en tu espacio. Todavía no ejecuta acciones por ti.",
  emptyConversation: "Elige una sugerencia o escribe tu pregunta.",
}

const COPY_BY_LOCALE: Record<FinesseAssistantLocale, FinesseAssistantCopy> = {
  en: COPY_EN,
  es: COPY_ES,
}

/**
 * Resolve the assistant copy for the effective UI locale (as provided by
 * `useI18n()` / the Core resolution chain — never re-resolved here). Unknown
 * or not-yet-translated locales fall back to the English canonical catalog.
 */
export function getFinesseAssistantCopy(
  locale: string | null | undefined,
): FinesseAssistantCopy {
  return COPY_BY_LOCALE[resolveFinesseAssistantLocale(locale)]
}

// ─── Contextual suggestions (mission §8, localized EN + ES) ──────────────────

/**
 * Static per-page prompts. Each entry pairs both locales so the arrays can
 * never drift out of alignment — the index IS the stable identity that
 * `fallbackSuggestions` turns into `fallback-<page>-<i>` ids.
 */
const SUGGESTIONS: Record<FinesseAssistantPageKey, Array<Record<FinesseAssistantLocale, string>>> = {
  "my-salon": [
    { en: "Explain this period to me", es: "Explícame este periodo" },
    { en: "Why did my earnings change?", es: "¿Por qué cambiaron mis ingresos?" },
    { en: "Which clients should come back?", es: "¿Qué clientes deberían volver?" },
    { en: "How can I improve next month?", es: "¿Cómo puedo mejorar el próximo mes?" },
  ],
  today: [
    { en: "What should I do first?", es: "¿Qué hago primero?" },
    { en: "Summarize my day", es: "Resume mi día" },
    { en: "What needs my attention?", es: "¿Qué necesita mi atención?" },
  ],
  agenda: [
    { en: "Find a free slot tomorrow", es: "Busca hueco libre mañana" },
    { en: "What are my peak hours?", es: "¿Cuáles son mis horas punta?" },
    { en: "Where can two more appointments fit?", es: "¿Dónde caben dos citas más?" },
  ],
  clients: [
    { en: "Who should I reach out to again?", es: "¿A quién debería volver a contactar?" },
    { en: "Which clients haven't come back?", es: "¿Qué clientes no han vuelto?" },
    { en: "Show me my most loyal clients", es: "Muéstrame mis clientes más fieles" },
  ],
  messages: [
    { en: "Summarize the pending conversations", es: "Resume las conversaciones pendientes" },
    { en: "Which messages need a reply?", es: "¿Qué mensajes necesitan respuesta?" },
  ],
  catalog: [
    { en: "Which service performs best?", es: "¿Qué servicio funciona mejor?" },
    { en: "What should I promote?", es: "¿Qué debería promocionar?" },
  ],
  marketing: [
    { en: "Create a post", es: "Crea una publicación" },
    { en: "Suggest a campaign", es: "Sugiéreme una campaña" },
    { en: "Use my latest work", es: "Usa mi último trabajo" },
    { en: "Help me fill open slots", es: "Ayúdame a llenar huecos libres" },
  ],
  billing: [
    { en: "Which payments are outstanding?", es: "¿Qué cobros tengo pendientes?" },
    { en: "Summarize my earnings for the period", es: "Resume mis ingresos del periodo" },
  ],
  team: [{ en: "How is the team's work going?", es: "¿Cómo va el trabajo del equipo?" }],
  settings: [{ en: "What do I still need to set up?", es: "¿Qué me falta por configurar?" }],
  other: [
    { en: "How is my business doing?", es: "¿Cómo va mi negocio?" },
    { en: "What needs my attention today?", es: "¿Qué necesita mi atención hoy?" },
  ],
}

/**
 * Localized suggestions for a page key — configurable in one place,
 * page-derived. Unknown/untranslated locales fall back to English.
 */
export function getFinesseSuggestions(
  page: FinesseAssistantPageKey,
  locale: string | null | undefined,
): string[] {
  const resolved = resolveFinesseAssistantLocale(locale)
  return SUGGESTIONS[page].map((s) => s[resolved])
}

// ─── Question limits (shared client/server) ──────────────────────────────────

export const FINESSE_MAX_QUESTION_LENGTH = 1000

// ─── Voice ↔ conversation merge (pure, id-keyed — one visible conversation) ──

export interface VoiceMessageUpdate {
  id: string
  role: "user" | "assistant"
  content: string
  status: "partial" | "final" | "interrupted"
}

/**
 * Upsert a voice turn into the shared conversation. Keyed by Realtime item id:
 * a partial transcript is REPLACED by its final text (never duplicated), and a
 * finalized/interrupted turn is never downgraded by a late partial.
 */
export function applyVoiceMessage(
  messages: FinesseAssistantMessage[],
  update: VoiceMessageUpdate,
): FinesseAssistantMessage[] {
  const index = messages.findIndex((m) => m.id === update.id)
  if (index === -1) {
    return [
      ...messages,
      {
        id: update.id,
        role: update.role,
        content: update.content,
        inputMode: "voice",
        status: update.status,
      },
    ]
  }
  const existing = messages[index]
  if (existing.status === "final" || existing.status === "interrupted") return messages
  if (existing.content === update.content && existing.status === update.status) return messages
  const next = [...messages]
  next[index] = { ...existing, content: update.content, status: update.status }
  return next
}

/**
 * Mark a streaming ASSISTANT voice turn as interrupted (barge-in). Its partial
 * text is kept but honestly marked — never presented as a complete answer.
 * No-op for user turns, unknown ids, or already-final answers.
 */
export function markVoiceMessageInterrupted(
  messages: FinesseAssistantMessage[],
  id: string,
): FinesseAssistantMessage[] {
  let changed = false
  const next = messages.map((m) => {
    if (m.id === id && m.role === "assistant" && m.status !== "final" && m.status !== "interrupted") {
      changed = true
      return { ...m, status: "interrupted" as const }
    }
    return m
  })
  return changed ? next : messages
}

/**
 * Short, safe summary of the finalized conversation for a new voice session —
 * the last few turns, clipped per turn. NEVER the unlimited transcript.
 */
export function buildVoiceConversationSummary(
  messages: FinesseAssistantMessage[],
  { maxTurns = 4, maxCharsPerTurn = 120 }: { maxTurns?: number; maxCharsPerTurn?: number } = {},
): string | null {
  const finalized = messages.filter((m) => m.status !== "partial" && m.content.trim().length > 0)
  if (finalized.length === 0) return null
  return finalized
    .slice(-maxTurns)
    .map((m) => `${m.role === "user" ? "User" : "Finesse"}: ${m.content.slice(0, maxCharsPerTurn)}`)
    .join("\n")
}

// ─── Server-side context sanitation (shared by the text + voice routes) ──────

/**
 * Whitelist-sanitize a client-published page context. Server routes call this
 * BEFORE building any prompt; workspace/vertical are then re-derived from the
 * AUTHENTICATED workspace — never taken from the payload.
 */
export function sanitizeFinesseContext(raw: unknown): Partial<FinesseAssistantContext> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const out: Partial<FinesseAssistantContext> = {}

  const str = (v: unknown, max = 120): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : undefined

  out.page = str(source.page) as FinesseAssistantContext["page"] | undefined
  out.route = str(source.route)
  out.section = str(source.section)
  out.selectedEntityType = str(source.selectedEntityType)
  out.selectedEntityId = str(source.selectedEntityId)
  out.locale = str(source.locale, 20)
  out.currency = str(source.currency, 8)

  const period = source.period
  if (period && typeof period === "object" && !Array.isArray(period)) {
    const p = period as Record<string, unknown>
    const preset = str(p.preset, 12)
    const start = str(p.start, 12)
    const end = str(p.end, 12)
    if (preset && start && end) {
      out.period = {
        preset: preset as NonNullable<FinesseAssistantContext["period"]>["preset"],
        start,
        end,
      }
    }
  }

  const metrics = source.visibleMetrics
  if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
    const entries = Object.entries(metrics as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" || typeof v === "string" || v === null)
      .slice(0, 24) as Array<[string, number | string | null]>
    if (entries.length > 0) out.visibleMetrics = Object.fromEntries(entries)
  }

  return out
}
