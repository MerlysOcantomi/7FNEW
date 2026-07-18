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
 * (also handy in tests). Copy follows the assistant's existing Spanish
 * convention (`finesse-assistant.ts`); ids are stable so a future locale
 * migration is mechanical.
 */

import {
  getFinesseSuggestions,
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

function overviewCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const delta = metricNumber(m, "ingresosDelta")
  const noComparison = metricFlag(m, "sinComparativa")

  if (noComparison) {
    out.push({
      id: "overview-first-period",
      label: "¿Qué vigilo en mi primer mes?",
      prompt: "Es mi primer periodo con datos, sin comparativa anterior. ¿Qué señales debería vigilar durante mi primer mes?",
      reason: "no comparison period",
      priority: 90,
      source: "overview",
    })
  } else if (delta !== null && delta < -0.005) {
    out.push({
      id: "overview-earnings-drop",
      label: "¿Por qué bajaron mis ingresos?",
      prompt: "Mis ingresos han bajado respecto al periodo anterior. ¿Qué pudo causar la caída y qué puedo hacer?",
      reason: "revenue decreased",
      priority: 100,
      source: "overview",
    })
  } else if (delta !== null && delta > 0.005) {
    out.push({
      id: "overview-earnings-growth",
      label: "¿Qué impulsó el crecimiento?",
      prompt: "Mis ingresos han crecido respecto al periodo anterior. ¿Qué impulsó ese crecimiento y cómo lo mantengo?",
      reason: "revenue increased",
      priority: 80,
      source: "overview",
    })
  }

  const retention = metricNumber(m, "tasaRetorno")
  if (retention !== null && retention < 0.6) {
    out.push({
      id: "overview-weak-rebooking",
      label: "¿Qué clientas deberían volver?",
      prompt: "Mi tasa de re-reserva está floja. ¿Qué clientas deberían volver pronto y cómo las contacto?",
      reason: "rebooking is weak",
      priority: 85,
      source: "clients",
    })
  }

  const pending = metricNumber(m, "cobrosPendientes")
  if (pending !== null && pending > 0) {
    out.push({
      id: "overview-pending-payments",
      label: "¿Qué cobros necesitan atención?",
      prompt: "Tengo cobros pendientes de visitas ya completadas. ¿Cuáles debería atender primero?",
      reason: "payments pending",
      priority: 75,
      source: "billing",
    })
  }

  const peak = metricNumber(m, "ocupacionDiaPunta")
  if (peak !== null && peak >= 0.85) {
    out.push({
      id: "overview-peak-availability",
      label: "¿Cómo libero mi día punta?",
      prompt: "Mi día más ocupado está casi completo. ¿Cómo puedo crear más disponibilidad sin perder clientas?",
      reason: "peak day nearly full",
      priority: 70,
      source: "schedule",
    })
  }

  return out
}

function todayCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const gaps = metricNumber(m, "huecosLibres")
  const appointments = metricNumber(m, "citas")

  if (gaps !== null && gaps > 0) {
    out.push({
      id: "today-fill-gaps",
      label: "¿Cómo lleno los huecos de hoy?",
      prompt: `Hoy tengo ${gaps} hueco(s) libre(s) en la agenda. ¿Cómo puedo llenarlos?`,
      reason: "open gaps today",
      priority: 90,
      source: "schedule",
    })
  }
  if (appointments !== null && appointments > 0) {
    out.push({
      id: "today-first-move",
      label: "¿Qué hago primero?",
      prompt: `Tengo ${appointments} citas hoy. ¿Qué debería hacer primero para que el día salga bien?`,
      reason: "appointments today",
      priority: 80,
      source: "schedule",
    })
    out.push({
      id: "today-summary",
      label: "Resume mi día",
      prompt: "Resume mi día de hoy: citas, huecos y lo que necesita mi atención.",
      reason: "appointments today",
      priority: 60,
      source: "schedule",
    })
  }

  return out
}

function agendaCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const gapsTomorrow = metricNumber(m, "huecosManana")
  const pendingConfirm = metricNumber(m, "citasSinConfirmar")
  const cancellations = metricNumber(m, "cancelacionesHoy")
  const nearlyFull = metricFlag(m, "diaCasiCompleto")

  if (gapsTomorrow !== null && gapsTomorrow > 0) {
    out.push({
      id: "agenda-fill-tomorrow",
      label: "¿Cómo lleno los huecos de mañana?",
      prompt: `Mañana tengo ${gapsTomorrow} hueco(s) libre(s). ¿Cómo puedo llenarlos?`,
      reason: "gaps tomorrow",
      priority: 90,
      source: "schedule",
    })
  }
  if (pendingConfirm !== null && pendingConfirm > 0) {
    out.push({
      id: "agenda-pending-confirmation",
      label: "¿Qué citas faltan por confirmar?",
      prompt: `Tengo ${pendingConfirm} cita(s) sin confirmar. ¿Cuáles debería confirmar primero?`,
      reason: "appointments need confirmation",
      priority: 85,
      source: "schedule",
    })
  }
  if (cancellations !== null && cancellations > 0) {
    out.push({
      id: "agenda-cancelled-slot",
      label: "¿Qué hago con el hueco cancelado?",
      prompt: "Se ha cancelado una cita hoy. ¿Qué puedo hacer con ese hueco?",
      reason: "cancellation today",
      priority: 80,
      source: "schedule",
    })
  }
  if (nearlyFull) {
    out.push({
      id: "agenda-fit-urgent",
      label: "¿Dónde cabe una cita urgente?",
      prompt: "Mi día está casi completo. ¿Dónde podría encajar una cita urgente sin desordenar la agenda?",
      reason: "day nearly full",
      priority: 75,
      source: "schedule",
    })
  }

  return out
}

function clientsCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const overdue = metricNumber(m, "clientasSinVolver")

  if (context.selectedEntityType === "client" && context.selectedEntityId) {
    out.push({
      id: `clients-selected-summary:${context.selectedEntityId}`,
      label: "Resume su historial reciente",
      prompt: "Resume el historial reciente de esta clienta: visitas, servicios y cualquier señal a vigilar.",
      reason: "client selected",
      priority: 95,
      source: "clients",
      entityType: "client",
      entityId: context.selectedEntityId,
    })
    out.push({
      id: `clients-selected-contact:${context.selectedEntityId}`,
      label: "¿Debería volver a contactarla?",
      prompt: "¿Debería volver a contactar a esta clienta? ¿Cuándo y con qué mensaje?",
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
      label: "¿A quién contacto esta semana?",
      prompt: `Hay ${overdue} clientas que llevan tiempo sin volver. ¿A quiénes debería contactar esta semana y cómo?`,
      reason: "clients overdue for rebooking",
      priority: 90,
      source: "clients",
    })
  }

  return out
}

function messagesCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const unanswered = metricNumber(m, "mensajesSinResponder")

  if (context.selectedEntityType === "conversation" && context.selectedEntityId) {
    out.push({
      id: `messages-selected-summary:${context.selectedEntityId}`,
      label: "Resume esta conversación",
      prompt: "Resume esta conversación y dime si queda algo pendiente de responder.",
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
      label: "¿Qué mensajes respondo primero?",
      prompt: `Tengo ${unanswered} mensaje(s) sin responder. ¿Cuáles debería responder primero?`,
      reason: "unanswered messages",
      priority: 90,
      source: "messages",
    })
  }

  return out
}

function marketingCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const works = metricNumber(m, "trabajosSubidos")
  const ready = metricNumber(m, "publicacionesListas")

  if (works !== null && works > 0) {
    out.push({
      id: "marketing-post-latest-work",
      label: "Crea un post con mi último trabajo",
      prompt: "Tengo fotos de trabajos recientes sin usar. ¿Cómo preparo una publicación con el último trabajo?",
      reason: "recent unused photo",
      priority: 90,
      source: "marketing",
    })
  } else if (works === 0) {
    out.push({
      id: "marketing-no-media",
      label: "¿Qué contenido creo hoy?",
      prompt: "Todavía no tengo fotos subidas. ¿Qué contenido debería crear hoy para mi salón?",
      reason: "no media exists",
      priority: 85,
      source: "marketing",
    })
  }
  if (ready !== null && ready > 0) {
    out.push({
      id: "marketing-review-ready",
      label: "¿Qué publico primero?",
      prompt: `Tengo ${ready} publicación(es) preparadas. ¿Cuál debería revisar y publicar primero?`,
      reason: "posts ready for review",
      priority: 80,
      source: "marketing",
    })
  }

  return out
}

function billingCandidates(context: FinesseAssistantPageContext): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const overdue = metricNumber(m, "cobrosPendientes")
  const delta = metricNumber(m, "ingresosDelta")

  if (overdue !== null && overdue > 0) {
    out.push({
      id: "billing-follow-up",
      label: "¿Qué cobros persigo primero?",
      prompt: "Tengo cobros pendientes. ¿Cuáles debería perseguir primero y cómo?",
      reason: "payments overdue",
      priority: 95,
      source: "billing",
    })
  } else if (overdue === 0) {
    out.push({
      id: "billing-collection-health",
      label: "¿Cómo va mi cobro?",
      prompt: "No tengo cobros vencidos ahora mismo. ¿Cómo va mi ritmo de cobro en general?",
      reason: "nothing overdue",
      priority: 60,
      source: "billing",
    })
  }
  if (delta !== null && Math.abs(delta) > 0.005) {
    out.push({
      id: "billing-revenue-change",
      label: "Explica los ingresos del periodo",
      prompt: "Mis ingresos han cambiado respecto al periodo anterior. Explícame ese cambio.",
      reason: "revenue changed",
      priority: 80,
      source: "billing",
    })
  }

  return out
}

const GENERATORS: Partial<
  Record<FinesseAssistantPageKey, (context: FinesseAssistantPageContext) => FinesseSuggestion[]>
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
}

/** Static page suggestions wrapped in the dynamic contract (fallback only). */
export function fallbackSuggestions(page: FinesseAssistantPageKey): FinesseSuggestion[] {
  return getFinesseSuggestions(page)
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
  const generate = GENERATORS[input.page]
  const candidates =
    input.context && generate && input.context.page === input.page
      ? generate(input.context)
      : []

  if (candidates.length === 0) return fallbackSuggestions(input.page)

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
    for (const fb of fallbackSuggestions(input.page)) {
      if (ranked.length >= MAX_SUGGESTIONS) break
      if (!labels.has(fb.label)) ranked.push(fb)
    }
  }

  return ranked.slice(0, MAX_SUGGESTIONS)
}
