/**
 * Ask Finesse — deterministic, data-aware suggestion engine. Pure functions:
 * no LLM calls, no I/O, no clock — the SAME registered page context and the
 * SAME catalog always yield the SAME ranked suggestions (stable between
 * renders by construction).
 *
 * Pipeline: registered `FinesseAssistantPageContext` → per-page candidate
 * generators (reading ONLY the metrics the page already showed the user —
 * permission-aware by construction) → priority ranking → id dedup → cap at
 * `MAX_SUGGESTIONS` → static page suggestions as fallback when no signal
 * produced anything.
 *
 * The visible `label` stays short; the submitted `prompt` carries enough
 * wording for a useful answer. `reason` documents WHY a suggestion surfaced
 * (also handy in tests). All copy comes from the localized catalogs under
 * `./i18n` (resolved by the caller from the effective `useI18n()` locale);
 * ids stay stable across locales so analytics and tests never depend on
 * language.
 */

import {
  type FinesseAssistantPageContext,
  type FinesseAssistantPageKey,
} from "./finesse-assistant"
import type {
  FinesseAssistantMessages,
  FinesseDynamicSuggestionMessages,
} from "./i18n/types"

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

function overviewCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const delta = metricNumber(m, "ingresosDelta")
  const noComparison = metricFlag(m, "sinComparativa")

  if (noComparison) {
    out.push({
      id: "overview-first-period",
      label: d.overview.firstPeriod.label,
      prompt: d.overview.firstPeriod.prompt,
      reason: "no comparison period",
      priority: 90,
      source: "overview",
    })
  } else if (delta !== null && delta < -0.005) {
    out.push({
      id: "overview-earnings-drop",
      label: d.overview.earningsDrop.label,
      prompt: d.overview.earningsDrop.prompt,
      reason: "revenue decreased",
      priority: 100,
      source: "overview",
    })
  } else if (delta !== null && delta > 0.005) {
    out.push({
      id: "overview-earnings-growth",
      label: d.overview.earningsGrowth.label,
      prompt: d.overview.earningsGrowth.prompt,
      reason: "revenue increased",
      priority: 80,
      source: "overview",
    })
  }

  const retention = metricNumber(m, "tasaRetorno")
  if (retention !== null && retention < 0.6) {
    out.push({
      id: "overview-weak-rebooking",
      label: d.overview.weakRebooking.label,
      prompt: d.overview.weakRebooking.prompt,
      reason: "rebooking is weak",
      priority: 85,
      source: "clients",
    })
  }

  const pending = metricNumber(m, "cobrosPendientes")
  if (pending !== null && pending > 0) {
    out.push({
      id: "overview-pending-payments",
      label: d.overview.pendingPayments.label,
      prompt: d.overview.pendingPayments.prompt,
      reason: "payments pending",
      priority: 75,
      source: "billing",
    })
  }

  const peak = metricNumber(m, "ocupacionDiaPunta")
  if (peak !== null && peak >= 0.85) {
    out.push({
      id: "overview-peak-availability",
      label: d.overview.peakAvailability.label,
      prompt: d.overview.peakAvailability.prompt,
      reason: "peak day nearly full",
      priority: 70,
      source: "schedule",
    })
  }

  return out
}

function todayCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const gaps = metricNumber(m, "huecosLibres")
  const appointments = metricNumber(m, "citas")

  if (gaps !== null && gaps > 0) {
    out.push({
      id: "today-fill-gaps",
      label: d.today.fillGaps.label,
      prompt: d.today.fillGaps.prompt(gaps),
      reason: "open gaps today",
      priority: 90,
      source: "schedule",
    })
  }
  if (appointments !== null && appointments > 0) {
    out.push({
      id: "today-first-move",
      label: d.today.firstMove.label,
      prompt: d.today.firstMove.prompt(appointments),
      reason: "appointments today",
      priority: 80,
      source: "schedule",
    })
    out.push({
      id: "today-summary",
      label: d.today.summary.label,
      prompt: d.today.summary.prompt,
      reason: "appointments today",
      priority: 60,
      source: "schedule",
    })
  }

  return out
}

function agendaCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
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
      label: d.agenda.fillTomorrow.label,
      prompt: d.agenda.fillTomorrow.prompt(gapsTomorrow),
      reason: "gaps tomorrow",
      priority: 90,
      source: "schedule",
    })
  }
  if (pendingConfirm !== null && pendingConfirm > 0) {
    out.push({
      id: "agenda-pending-confirmation",
      label: d.agenda.pendingConfirmation.label,
      prompt: d.agenda.pendingConfirmation.prompt(pendingConfirm),
      reason: "appointments need confirmation",
      priority: 85,
      source: "schedule",
    })
  }
  if (cancellations !== null && cancellations > 0) {
    out.push({
      id: "agenda-cancelled-slot",
      label: d.agenda.cancelledSlot.label,
      prompt: d.agenda.cancelledSlot.prompt,
      reason: "cancellation today",
      priority: 80,
      source: "schedule",
    })
  }
  if (nearlyFull) {
    out.push({
      id: "agenda-fit-urgent",
      label: d.agenda.fitUrgent.label,
      prompt: d.agenda.fitUrgent.prompt,
      reason: "day nearly full",
      priority: 75,
      source: "schedule",
    })
  }

  return out
}

function clientsCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const overdue = metricNumber(m, "clientasSinVolver")

  if (context.selectedEntityType === "client" && context.selectedEntityId) {
    out.push({
      id: `clients-selected-summary:${context.selectedEntityId}`,
      label: d.clients.selectedSummary.label,
      prompt: d.clients.selectedSummary.prompt,
      reason: "client selected",
      priority: 95,
      source: "clients",
      entityType: "client",
      entityId: context.selectedEntityId,
    })
    out.push({
      id: `clients-selected-contact:${context.selectedEntityId}`,
      label: d.clients.selectedContact.label,
      prompt: d.clients.selectedContact.prompt,
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
      label: d.clients.overdueRebooking.label,
      prompt: d.clients.overdueRebooking.prompt(overdue),
      reason: "clients overdue for rebooking",
      priority: 90,
      source: "clients",
    })
  }

  return out
}

function messagesCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const unanswered = metricNumber(m, "mensajesSinResponder")

  if (context.selectedEntityType === "conversation" && context.selectedEntityId) {
    out.push({
      id: `messages-selected-summary:${context.selectedEntityId}`,
      label: d.messages.selectedSummary.label,
      prompt: d.messages.selectedSummary.prompt,
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
      label: d.messages.needReply.label,
      prompt: d.messages.needReply.prompt(unanswered),
      reason: "unanswered messages",
      priority: 90,
      source: "messages",
    })
  }

  return out
}

function marketingCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const works = metricNumber(m, "trabajosSubidos")
  const ready = metricNumber(m, "publicacionesListas")

  if (works !== null && works > 0) {
    out.push({
      id: "marketing-post-latest-work",
      label: d.marketing.postLatestWork.label,
      prompt: d.marketing.postLatestWork.prompt,
      reason: "recent unused photo",
      priority: 90,
      source: "marketing",
    })
  } else if (works === 0) {
    out.push({
      id: "marketing-no-media",
      label: d.marketing.noMedia.label,
      prompt: d.marketing.noMedia.prompt,
      reason: "no media exists",
      priority: 85,
      source: "marketing",
    })
  }
  if (ready !== null && ready > 0) {
    out.push({
      id: "marketing-review-ready",
      label: d.marketing.reviewReady.label,
      prompt: d.marketing.reviewReady.prompt(ready),
      reason: "posts ready for review",
      priority: 80,
      source: "marketing",
    })
  }

  return out
}

function billingCandidates(
  context: FinesseAssistantPageContext,
  d: FinesseDynamicSuggestionMessages,
): FinesseSuggestion[] {
  const m = context.visibleMetrics
  const out: FinesseSuggestion[] = []
  const overdue = metricNumber(m, "cobrosPendientes")
  const delta = metricNumber(m, "ingresosDelta")

  if (overdue !== null && overdue > 0) {
    out.push({
      id: "billing-follow-up",
      label: d.billing.followUp.label,
      prompt: d.billing.followUp.prompt,
      reason: "payments overdue",
      priority: 95,
      source: "billing",
    })
  } else if (overdue === 0) {
    out.push({
      id: "billing-collection-health",
      label: d.billing.collectionHealth.label,
      prompt: d.billing.collectionHealth.prompt,
      reason: "nothing overdue",
      priority: 60,
      source: "billing",
    })
  }
  if (delta !== null && Math.abs(delta) > 0.005) {
    out.push({
      id: "billing-revenue-change",
      label: d.billing.revenueChange.label,
      prompt: d.billing.revenueChange.prompt,
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
    (
      context: FinesseAssistantPageContext,
      d: FinesseDynamicSuggestionMessages,
    ) => FinesseSuggestion[]
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
}

/** Static page suggestions wrapped in the dynamic contract (fallback only). */
export function fallbackSuggestions(
  page: FinesseAssistantPageKey,
  messages: FinesseAssistantMessages,
): FinesseSuggestion[] {
  return messages.staticSuggestions[page]
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
export function buildFinesseSuggestions(
  input: FinesseSuggestionInput,
  messages: FinesseAssistantMessages,
): FinesseSuggestion[] {
  const generate = GENERATORS[input.page]
  const candidates =
    input.context && generate && input.context.page === input.page
      ? generate(input.context, messages.dynamicSuggestions)
      : []

  if (candidates.length === 0) return fallbackSuggestions(input.page, messages)

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
    for (const fb of fallbackSuggestions(input.page, messages)) {
      if (ranked.length >= MAX_SUGGESTIONS) break
      if (!labels.has(fb.label)) ranked.push(fb)
    }
  }

  return ranked.slice(0, MAX_SUGGESTIONS)
}
