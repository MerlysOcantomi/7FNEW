/**
 * Ask Finesse — deterministic, data-aware suggestion engine. Pure functions:
 * no LLM calls, no I/O, no clock — the SAME registered page context always
 * yields the SAME ranked suggestions (stable between renders by construction).
 *
 * Pipeline: registered `FinesseAssistantPageContext` → per-page candidate
 * generators (reading ONLY the metrics the page already showed the user —
 * permission-aware by construction) → priority ranking → id dedup → cap at
 * `MAX_SUGGESTIONS` → static page suggestions as fallback when no signal
 * produced anything.
 *
 * The visible `label` stays short; the submitted `prompt` carries enough
 * wording for a useful answer. `reason` documents WHY a suggestion surfaced
 * (also handy in tests). All visible text lives in the per-locale
 * `SUGGESTION_TEXTS` catalogs (EN canonical + ES, resolved through the same
 * contract as `finesse-assistant.ts`); the generators keep logic, ids,
 * priorities and `reason`/`source` locale-independent, so a suggestion's
 * identity never changes with the UI language.
 */

import {
  getFinesseSuggestions,
  resolveFinesseAssistantLocale,
  type FinesseAssistantLocale,
  type FinesseAssistantPageContext,
  type FinesseAssistantPageKey,
} from "./finesse-assistant"

export type FinesseSuggestionSource =
  | "overview"
  | "schedule"
  | "clients"
  | "messages"
  | "marketing"
  | "billing"
  | "services"
  | "workspace"
  | "fallback"

export interface FinesseSuggestion {
  id: string
  label: string
  prompt: string
  reason: string
  priority: number
  source: FinesseSuggestionSource
  entityType?: string
  entityId?: string
}

export const MAX_SUGGESTIONS = 4

// ─── Localized text (label + prompt per suggestion id) ───────────────────────

interface SuggestionCopy {
  label: string
  prompt: string
}

/**
 * Every visible string, keyed by the suggestion's stable base id. Entries
 * that interpolate a count are functions of the RAW integer (no formatting —
 * the prompt is for the model, not the UI). The interface guarantees both
 * catalogs cover exactly the same ids with the same shapes.
 */
interface FinesseSuggestionTexts {
  "overview-first-period": SuggestionCopy
  "overview-earnings-drop": SuggestionCopy
  "overview-earnings-growth": SuggestionCopy
  "overview-weak-rebooking": SuggestionCopy
  "overview-pending-payments": SuggestionCopy
  "overview-peak-availability": SuggestionCopy
  "today-fill-gaps": (gaps: number) => SuggestionCopy
  "today-first-move": (appointments: number) => SuggestionCopy
  "today-summary": SuggestionCopy
  "agenda-fill-tomorrow": (gaps: number) => SuggestionCopy
  "agenda-pending-confirmation": (appointments: number) => SuggestionCopy
  "agenda-cancelled-slot": SuggestionCopy
  "agenda-fit-urgent": SuggestionCopy
  "clients-selected-summary": SuggestionCopy
  "clients-selected-contact": SuggestionCopy
  "clients-overdue-rebooking": (clients: number) => SuggestionCopy
  "messages-selected-summary": SuggestionCopy
  "messages-need-reply": (messages: number) => SuggestionCopy
  "marketing-post-latest-work": SuggestionCopy
  "marketing-no-media": SuggestionCopy
  "marketing-review-ready": (posts: number) => SuggestionCopy
  "billing-follow-up": SuggestionCopy
  "billing-collection-health": SuggestionCopy
  "billing-revenue-change": SuggestionCopy
}

const SUGGESTION_TEXTS: Record<FinesseAssistantLocale, FinesseSuggestionTexts> = {
  en: {
    "overview-first-period": {
      label: "What should I watch in my first month?",
      prompt: "This is my first period with data, with no previous period to compare against. What signals should I watch during my first month?",
    },
    "overview-earnings-drop": {
      label: "Why did my earnings drop?",
      prompt: "My earnings went down compared to the previous period. What could have caused the drop and what can I do?",
    },
    "overview-earnings-growth": {
      label: "What drove the growth?",
      prompt: "My earnings grew compared to the previous period. What drove that growth and how do I keep it up?",
    },
    "overview-weak-rebooking": {
      label: "Which clients should come back?",
      prompt: "My rebooking rate is weak. Which clients should come back soon and how do I reach out to them?",
    },
    "overview-pending-payments": {
      label: "Which payments need attention?",
      prompt: "I have outstanding payments from visits that are already completed. Which ones should I handle first?",
    },
    "overview-peak-availability": {
      label: "How do I free up my peak day?",
      prompt: "My busiest day is almost fully booked. How can I create more availability without losing clients?",
    },
    "today-fill-gaps": (gaps) => ({
      label: "How do I fill today's gaps?",
      prompt: `I have ${gaps} open slot(s) in today's calendar. How can I fill them?`,
    }),
    "today-first-move": (appointments) => ({
      label: "What should I do first?",
      prompt: `I have ${appointments} appointments today. What should I do first so the day goes well?`,
    }),
    "today-summary": {
      label: "Summarize my day",
      prompt: "Summarize my day: appointments, open slots and whatever needs my attention.",
    },
    "agenda-fill-tomorrow": (gaps) => ({
      label: "How do I fill tomorrow's gaps?",
      prompt: `I have ${gaps} open slot(s) tomorrow. How can I fill them?`,
    }),
    "agenda-pending-confirmation": (appointments) => ({
      label: "Which appointments need confirming?",
      prompt: `I have ${appointments} unconfirmed appointment(s). Which should I confirm first?`,
    }),
    "agenda-cancelled-slot": {
      label: "What do I do with the cancelled slot?",
      prompt: "An appointment was cancelled today. What can I do with that slot?",
    },
    "agenda-fit-urgent": {
      label: "Where can an urgent appointment fit?",
      prompt: "My day is almost fully booked. Where could I fit an urgent appointment without disrupting the calendar?",
    },
    "clients-selected-summary": {
      label: "Summarize their recent history",
      prompt: "Summarize this client's recent history: visits, services and any signals to watch.",
    },
    "clients-selected-contact": {
      label: "Should I reach out to them again?",
      prompt: "Should I reach out to this client again? When, and with what message?",
    },
    "clients-overdue-rebooking": (clients) => ({
      label: "Who should I contact this week?",
      prompt: `There are ${clients} clients who haven't been back in a while. Who should I contact this week, and how?`,
    }),
    "messages-selected-summary": {
      label: "Summarize this conversation",
      prompt: "Summarize this conversation and tell me if anything still needs a reply.",
    },
    "messages-need-reply": (messages) => ({
      label: "Which messages do I answer first?",
      prompt: `I have ${messages} unanswered message(s). Which should I answer first?`,
    }),
    "marketing-post-latest-work": {
      label: "Create a post with my latest work",
      prompt: "I have photos of recent work that I haven't used. How do I prepare a post with my latest work?",
    },
    "marketing-no-media": {
      label: "What content should I create today?",
      prompt: "I don't have any photos uploaded yet. What content should I create today for my salon?",
    },
    "marketing-review-ready": (posts) => ({
      label: "What do I publish first?",
      prompt: `I have ${posts} post(s) ready. Which should I review and publish first?`,
    }),
    "billing-follow-up": {
      label: "Which payments do I chase first?",
      prompt: "I have outstanding payments. Which should I chase first, and how?",
    },
    "billing-collection-health": {
      label: "How is my collection going?",
      prompt: "I have no overdue payments right now. How is my collection pace doing overall?",
    },
    "billing-revenue-change": {
      label: "Explain this period's earnings",
      prompt: "My earnings changed compared to the previous period. Explain that change to me.",
    },
  },
  es: {
    "overview-first-period": {
      label: "¿Qué vigilo en mi primer mes?",
      prompt: "Es mi primer periodo con datos, sin comparativa anterior. ¿Qué señales debería vigilar durante mi primer mes?",
    },
    "overview-earnings-drop": {
      label: "¿Por qué bajaron mis ingresos?",
      prompt: "Mis ingresos han bajado respecto al periodo anterior. ¿Qué pudo causar la caída y qué puedo hacer?",
    },
    "overview-earnings-growth": {
      label: "¿Qué impulsó el crecimiento?",
      prompt: "Mis ingresos han crecido respecto al periodo anterior. ¿Qué impulsó ese crecimiento y cómo lo mantengo?",
    },
    "overview-weak-rebooking": {
      label: "¿Qué clientes deberían volver?",
      prompt: "Mi tasa de re-reserva está floja. ¿Qué clientes deberían volver pronto y cómo los contacto?",
    },
    "overview-pending-payments": {
      label: "¿Qué cobros necesitan atención?",
      prompt: "Tengo cobros pendientes de visitas ya completadas. ¿Cuáles debería atender primero?",
    },
    "overview-peak-availability": {
      label: "¿Cómo libero mi día punta?",
      prompt: "Mi día más ocupado está casi completo. ¿Cómo puedo crear más disponibilidad sin perder clientes?",
    },
    "today-fill-gaps": (gaps) => ({
      label: "¿Cómo lleno los huecos de hoy?",
      prompt: `Hoy tengo ${gaps} hueco(s) libre(s) en la agenda. ¿Cómo puedo llenarlos?`,
    }),
    "today-first-move": (appointments) => ({
      label: "¿Qué hago primero?",
      prompt: `Tengo ${appointments} citas hoy. ¿Qué debería hacer primero para que el día salga bien?`,
    }),
    "today-summary": {
      label: "Resume mi día",
      prompt: "Resume mi día de hoy: citas, huecos y lo que necesita mi atención.",
    },
    "agenda-fill-tomorrow": (gaps) => ({
      label: "¿Cómo lleno los huecos de mañana?",
      prompt: `Mañana tengo ${gaps} hueco(s) libre(s). ¿Cómo puedo llenarlos?`,
    }),
    "agenda-pending-confirmation": (appointments) => ({
      label: "¿Qué citas faltan por confirmar?",
      prompt: `Tengo ${appointments} cita(s) sin confirmar. ¿Cuáles debería confirmar primero?`,
    }),
    "agenda-cancelled-slot": {
      label: "¿Qué hago con el hueco cancelado?",
      prompt: "Se ha cancelado una cita hoy. ¿Qué puedo hacer con ese hueco?",
    },
    "agenda-fit-urgent": {
      label: "¿Dónde cabe una cita urgente?",
      prompt: "Mi día está casi completo. ¿Dónde podría encajar una cita urgente sin desordenar la agenda?",
    },
    "clients-selected-summary": {
      label: "Resume su historial reciente",
      prompt: "Resume el historial reciente de este cliente: visitas, servicios y cualquier señal a vigilar.",
    },
    "clients-selected-contact": {
      label: "¿Debería volver a contactarle?",
      prompt: "¿Debería volver a contactar a este cliente? ¿Cuándo y con qué mensaje?",
    },
    "clients-overdue-rebooking": (clients) => ({
      label: "¿A quién contacto esta semana?",
      prompt: `Hay ${clients} clientes que llevan tiempo sin volver. ¿A quiénes debería contactar esta semana y cómo?`,
    }),
    "messages-selected-summary": {
      label: "Resume esta conversación",
      prompt: "Resume esta conversación y dime si queda algo pendiente de responder.",
    },
    "messages-need-reply": (messages) => ({
      label: "¿Qué mensajes respondo primero?",
      prompt: `Tengo ${messages} mensaje(s) sin responder. ¿Cuáles debería responder primero?`,
    }),
    "marketing-post-latest-work": {
      label: "Crea un post con mi último trabajo",
      prompt: "Tengo fotos de trabajos recientes sin usar. ¿Cómo preparo una publicación con el último trabajo?",
    },
    "marketing-no-media": {
      label: "¿Qué contenido creo hoy?",
      prompt: "Todavía no tengo fotos subidas. ¿Qué contenido debería crear hoy para mi salón?",
    },
    "marketing-review-ready": (posts) => ({
      label: "¿Qué publico primero?",
      prompt: `Tengo ${posts} publicación(es) preparadas. ¿Cuál debería revisar y publicar primero?`,
    }),
    "billing-follow-up": {
      label: "¿Qué cobros persigo primero?",
      prompt: "Tengo cobros pendientes. ¿Cuáles debería perseguir primero y cómo?",
    },
    "billing-collection-health": {
      label: "¿Cómo va mi cobro?",
      prompt: "No tengo cobros vencidos ahora mismo. ¿Cómo va mi ritmo de cobro en general?",
    },
    "billing-revenue-change": {
      label: "Explica los ingresos del periodo",
      prompt: "Mis ingresos han cambiado respecto al periodo anterior. Explícame ese cambio.",
    },
  },
}

// ─── Metric helpers ──────────────────────────────────────────────────────────

type Metrics = NonNullable<FinesseAssistantPageContext["visibleMetrics"]>

function metricNumber(metrics: Metrics | undefined, key: string): number | null {
  const v = metrics?.[key]
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function metricFlag(metrics: Metrics | undefined, key: string): boolean {
  return metrics?.[key] === 1 || metrics?.[key] === "true"
}

// ─── Candidate generators (one per page family) ──────────────────────────────

function overviewCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const delta = metricNumber(m, "ingresosDelta")
  const noComparison = metricFlag(m, "sinComparativa")

  if (noComparison) {
    out.push({
      id: "overview-first-period",
      ...texts["overview-first-period"],
      reason: "no comparison period",
      priority: 90,
      source: "overview",
    })
  } else if (delta !== null && delta < -0.005) {
    out.push({
      id: "overview-earnings-drop",
      ...texts["overview-earnings-drop"],
      reason: "revenue decreased",
      priority: 100,
      source: "overview",
    })
  } else if (delta !== null && delta > 0.005) {
    out.push({
      id: "overview-earnings-growth",
      ...texts["overview-earnings-growth"],
      reason: "revenue increased",
      priority: 80,
      source: "overview",
    })
  }

  const retention = metricNumber(m, "tasaRetorno")
  if (retention !== null && retention < 0.6) {
    out.push({
      id: "overview-weak-rebooking",
      ...texts["overview-weak-rebooking"],
      reason: "rebooking is weak",
      priority: 85,
      source: "clients",
    })
  }

  const pending = metricNumber(m, "cobrosPendientes")
  if (pending !== null && pending > 0) {
    out.push({
      id: "overview-pending-payments",
      ...texts["overview-pending-payments"],
      reason: "payments pending",
      priority: 75,
      source: "billing",
    })
  }

  const peak = metricNumber(m, "ocupacionDiaPunta")
  if (peak !== null && peak >= 0.85) {
    out.push({
      id: "overview-peak-availability",
      ...texts["overview-peak-availability"],
      reason: "peak day nearly full",
      priority: 70,
      source: "schedule",
    })
  }

  return out
}

function todayCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const gaps = metricNumber(m, "huecosLibres")
  const appointments = metricNumber(m, "citas")

  if (gaps !== null && gaps > 0) {
    out.push({
      id: "today-fill-gaps",
      ...texts["today-fill-gaps"](gaps),
      reason: "open gaps today",
      priority: 90,
      source: "schedule",
    })
  }
  if (appointments !== null && appointments > 0) {
    out.push({
      id: "today-first-move",
      ...texts["today-first-move"](appointments),
      reason: "appointments today",
      priority: 80,
      source: "schedule",
    })
    out.push({
      id: "today-summary",
      ...texts["today-summary"],
      reason: "appointments today",
      priority: 60,
      source: "schedule",
    })
  }

  return out
}

function agendaCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const gapsTomorrow = metricNumber(m, "huecosManana")
  const pendingConfirm = metricNumber(m, "citasSinConfirmar")
  const cancellations = metricNumber(m, "cancelacionesHoy")
  const nearlyFull = metricFlag(m, "diaCasiCompleto")

  if (gapsTomorrow !== null && gapsTomorrow > 0) {
    out.push({
      id: "agenda-fill-tomorrow",
      ...texts["agenda-fill-tomorrow"](gapsTomorrow),
      reason: "gaps tomorrow",
      priority: 90,
      source: "schedule",
    })
  }
  if (pendingConfirm !== null && pendingConfirm > 0) {
    out.push({
      id: "agenda-pending-confirmation",
      ...texts["agenda-pending-confirmation"](pendingConfirm),
      reason: "appointments need confirmation",
      priority: 85,
      source: "schedule",
    })
  }
  if (cancellations !== null && cancellations > 0) {
    out.push({
      id: "agenda-cancelled-slot",
      ...texts["agenda-cancelled-slot"],
      reason: "cancellation today",
      priority: 80,
      source: "schedule",
    })
  }
  if (nearlyFull) {
    out.push({
      id: "agenda-fit-urgent",
      ...texts["agenda-fit-urgent"],
      reason: "day nearly full",
      priority: 75,
      source: "schedule",
    })
  }

  return out
}

function clientsCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const overdue = metricNumber(m, "clientasSinVolver")

  if (context.selectedEntityType === "client" && context.selectedEntityId) {
    out.push({
      id: `clients-selected-summary:${context.selectedEntityId}`,
      ...texts["clients-selected-summary"],
      reason: "client selected",
      priority: 95,
      source: "clients",
      entityType: "client",
      entityId: context.selectedEntityId,
    })
    out.push({
      id: `clients-selected-contact:${context.selectedEntityId}`,
      ...texts["clients-selected-contact"],
      reason: "client selected",
      priority: 70,
      source: "clients",
      entityType: "client",
      entityId: context.selectedEntityId,
    })
  }

  if (overdue !== null && overdue > 0) {
    out.push({
      id: "clients-overdue-rebooking",
      ...texts["clients-overdue-rebooking"](overdue),
      reason: "clients overdue for rebooking",
      priority: 90,
      source: "clients",
    })
  }

  return out
}

function messagesCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const unanswered = metricNumber(m, "mensajesSinResponder")

  if (context.selectedEntityType === "conversation" && context.selectedEntityId) {
    out.push({
      id: `messages-selected-summary:${context.selectedEntityId}`,
      ...texts["messages-selected-summary"],
      reason: "conversation selected",
      priority: 95,
      source: "messages",
      entityType: "conversation",
      entityId: context.selectedEntityId,
    })
  }
  if (unanswered !== null && unanswered > 0) {
    out.push({
      id: "messages-need-reply",
      ...texts["messages-need-reply"](unanswered),
      reason: "unanswered messages",
      priority: 90,
      source: "messages",
    })
  }

  return out
}

function marketingCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const works = metricNumber(m, "trabajosSubidos")
  const ready = metricNumber(m, "publicacionesListas")

  if (works !== null && works > 0) {
    out.push({
      id: "marketing-post-latest-work",
      ...texts["marketing-post-latest-work"],
      reason: "recent unused photo",
      priority: 90,
      source: "marketing",
    })
  } else if (works === 0) {
    out.push({
      id: "marketing-no-media",
      ...texts["marketing-no-media"],
      reason: "no media exists",
      priority: 85,
      source: "marketing",
    })
  }
  if (ready !== null && ready > 0) {
    out.push({
      id: "marketing-review-ready",
      ...texts["marketing-review-ready"](ready),
      reason: "posts ready for review",
      priority: 80,
      source: "marketing",
    })
  }

  return out
}

function billingCandidates(
  context: FinesseAssistantPageContext,
  texts: FinesseSuggestionTexts,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const overdue = metricNumber(m, "cobrosPendientes")
  const delta = metricNumber(m, "ingresosDelta")

  if (overdue !== null && overdue > 0) {
    out.push({
      id: "billing-follow-up",
      ...texts["billing-follow-up"],
      reason: "payments overdue",
      priority: 95,
      source: "billing",
    })
  } else if (overdue === 0) {
    out.push({
      id: "billing-collection-health",
      ...texts["billing-collection-health"],
      reason: "nothing overdue",
      priority: 60,
      source: "billing",
    })
  }
  if (delta !== null && Math.abs(delta) > 0.005) {
    out.push({
      id: "billing-revenue-change",
      ...texts["billing-revenue-change"],
      reason: "revenue changed",
      priority: 80,
      source: "billing",
    })
  }

  return out
}

const GENERATORS: Partial<
  Record<
    FinesseAssistantPageKey,
    (context: FinesseAssistantPageContext, texts: FinesseSuggestionTexts) => FinesseSuggestion[]
  >
> = {
  "my-salon": overviewCandidates,
  today: todayCandidates,
  agenda: agendaCandidates,
  clients: clientsCandidates,
  messages: messagesCandidates,
  marketing: marketingCandidates,
  billing: billingCandidates,
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export interface FinesseSuggestionInput {
  page: FinesseAssistantPageKey
  /** The registered page context, or null when the page registered nothing. */
  context: FinesseAssistantPageContext | null
  /**
   * Effective UI locale (as provided by `useI18n()` — never re-resolved
   * here). Unknown/untranslated locales fall back to English.
   */
  locale?: string | null
}

/** Static page suggestions wrapped in the dynamic contract (fallback only). */
export function fallbackSuggestions(
  page: FinesseAssistantPageKey,
  locale?: string | null,
): FinesseSuggestion[] {
  return getFinesseSuggestions(page, locale)
    .slice(0, MAX_SUGGESTIONS)
    .map((label, i) => ({
      id: `fallback-${page}-${i}`,
      label,
      prompt: label,
      reason: "static page fallback",
      priority: 10 - i,
      source: "fallback" as const,
    }))
}

/**
 * Rank, dedupe and cap candidates. Deterministic tie-break: priority desc,
 * then id asc — never render order or object identity.
 */
export function buildFinesseSuggestions(input: FinesseSuggestionInput): FinesseSuggestion[] {
  const locale = resolveFinesseAssistantLocale(input.locale)
  const texts = SUGGESTION_TEXTS[locale]
  const generate = GENERATORS[input.page]
  const candidates =
    input.context && generate && input.context.page === input.page
      ? generate(input.context, texts)
      : []

  if (candidates.length === 0) return fallbackSuggestions(input.page, locale)

  const seen = new Set<string>()
  const ranked = [...candidates]
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })

  // Top up with fallbacks (never duplicating labels) so the panel always
  // offers a useful minimum without inventing signals.
  if (ranked.length < 2) {
    const labels = new Set(ranked.map((s) => s.label))
    for (const fb of fallbackSuggestions(input.page, locale)) {
      if (ranked.length >= MAX_SUGGESTIONS) break
      if (!labels.has(fb.label)) ranked.push(fb)
    }
  }

  return ranked.slice(0, MAX_SUGGESTIONS)
}
