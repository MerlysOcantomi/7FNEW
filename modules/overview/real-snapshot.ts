/**
 * My Salon — REAL data aggregation (pure part).
 *
 * Builds the `SalonOverviewPayload` from workspace-scoped rows that the
 * server-side service (`modules/overview/service.ts`) fetches with Prisma.
 * This module is deliberately DB-free and framework-free so every mapping
 * rule is testable: rows in → snapshot out.
 *
 * HONESTY RULES (the difference vs `demo-data.ts`):
 *   - A metric exists ONLY when its source module has real rows; otherwise it
 *     is `null` / empty and the UI renders its per-section empty state.
 *   - Sections with no backend yet (performance drivers, per-service visits,
 *     booking-source attribution, hourly occupancy, seasonality) return
 *     empty/`null` — they are NEVER filled with invented numbers, and real and
 *     demo figures are never mixed in one payload.
 *   - Metric definitions follow `types.ts`: visits = citas that have already
 *     started (`fechaInicio <= now`) inside the period; new clients = unique
 *     clients whose first ever visit falls inside the period; earnings =
 *     collected (paid) invoices inside the period.
 *
 * Timezone: all "which local day does this instant belong to" decisions go
 * through `isoDateInTimezone` (IANA tz from the viewer, validated with a UTC
 * fallback), so period membership matches what the user sees on their clock.
 */

import { resolveServiceCatalog } from "../../core/services/catalog"
import { buildTrendBuckets } from "./period"
import { deriveLookingAhead } from "./derive"
import type {
  BusinessOverviewSnapshot,
  ClientPerformance,
  DemandDay,
  OverviewKpis,
  OverviewKpiValue,
  OverviewPeriod,
  OverviewSignals,
  SalonOverviewPayload,
  SalonProfile,
  SalonToday,
  SalonTodayAppointment,
} from "./types"

// ─── Input row shapes (mirror the Prisma selects, no Prisma import) ──────────

export interface OverviewEventRow {
  id: string
  clienteId: string | null
  titulo: string
  fechaInicio: Date
  fechaFin: Date | null
}

/** First/last COMPLETED visit per client, over all time (not just the window). */
export interface OverviewVisitBounds {
  clienteId: string
  firstVisit: Date
  lastVisit: Date
}

export interface OverviewInvoiceRow {
  estado: string
  total: number
  fechaEmision: Date
  paidAt: Date | null
  clienteId: string | null
}

export interface OverviewClientRow {
  id: string
  nombre: string
  estado: string | null
}

export interface OverviewTaskRow {
  status: string
  priority: string
  dueAt: Date | null
}

export interface RealOverviewInput {
  workspaceId: string
  period: OverviewPeriod
  /** IANA timezone of the viewer; invalid values fall back to UTC. */
  timezone: string
  now: Date
  /** ISO 4217, resolved from workspace config by the service. */
  currency: string
  /** Citas inside the fetch window (comparison start → period end, padded). */
  events: OverviewEventRow[]
  visitBounds: OverviewVisitBounds[]
  /** Invoices relevant to the window plus every uncollected one. */
  invoices: OverviewInvoiceRow[]
  clients: OverviewClientRow[]
  /** Conversations awaiting first response; `null` when inbox never had rows. */
  pendingConversationCount: number | null
  /** Open/in-progress/proposed/waiting workspace tasks. */
  openTasks: OverviewTaskRow[]
  /** All-time existence counts — they drive the dataQuality flags. */
  totals: { events: number; invoices: number; clients: number; tasks: number }
  /** Resolved `Workspace.config.businessProfile` (defaults + overrides). */
  businessProfile: Record<string, unknown> | null
  /** Resolved raw `serviceCatalog` value (defaults + overrides). */
  serviceCatalog: unknown
}

// ─── Query filters (pure — the service feeds these to Prisma) ────────────────

/** Task statuses that count as open work (mirrors modules/today/aggregator). */
export const OVERVIEW_OPEN_TASK_STATUSES = ["proposed", "open", "in_progress", "waiting"]

/**
 * Every `where` clause the overview service uses, workspace-stamped in ONE
 * place. Lives in this pure module so the tenant-isolation test can assert —
 * without a database — that no overview query ships unscoped.
 */
export function buildOverviewQueryFilters(
  workspaceId: string,
  window: { fetchStart: Date; fetchEnd: Date },
) {
  return {
    /** Citas inside the fetch window (period + comparison, padded). */
    eventsInWindow: {
      workspaceId,
      tipo: "cita",
      fechaInicio: { gte: window.fetchStart, lt: window.fetchEnd },
    },
    /** All-time completed citas per client (first/last visit bounds). */
    completedEvents: (now: Date) => ({
      workspaceId,
      tipo: "cita",
      clienteId: { not: null },
      fechaInicio: { lte: now },
    }),
    /** Any cita ever — existence check for dataQuality.appointments. */
    anyEvent: { workspaceId, tipo: "cita" },
    /** Invoices in the window plus every uncollected one. */
    invoices: {
      workspaceId,
      OR: [
        { fechaEmision: { gte: window.fetchStart } },
        { paidAt: { gte: window.fetchStart } },
        { estado: { in: ["enviada", "vencida"] } },
      ],
    },
    anyInvoice: { workspaceId },
    clients: { workspaceId },
    pendingConversations: { workspaceId, status: "new" },
    anyConversation: { workspaceId },
    openTasks: { workspaceId, status: { in: OVERVIEW_OPEN_TASK_STATUSES } },
    anyTask: { workspaceId },
  }
}

// ─── Timezone-aware calendar helpers ─────────────────────────────────────────

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * The `yyyy-mm-dd` local calendar date of an instant in a timezone. en-CA
 * gives ISO ordering directly, so period membership is a string comparison.
 */
export function isoDateInTimezone(instant: Date, timezone: string): string {
  const tz = isValidTimezone(timezone) ? timezone : "UTC"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
}

/** ISO weekday index 0=Monday…6=Sunday for a `yyyy-mm-dd` string. */
export function isoWeekdayOfDate(isoDate: string): number {
  const utc = new Date(`${isoDate}T00:00:00Z`)
  return (utc.getUTCDay() + 6) % 7
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}

// ─── Salon profile ───────────────────────────────────────────────────────────

/** The canonical `WorkspaceBusinessProfile` fields completeness is measured on. */
const PROFILE_FIELDS = [
  "businessName",
  "businessDescription",
  "services",
  "tone",
  "region",
  "languages",
  "workingHours",
  "attentionRules",
] as const

function profileString(profile: Record<string, unknown> | null, key: string): string | null {
  const value = profile?.[key]
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function fieldIsFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0
  return false
}

export function buildSalonProfile(
  businessProfile: Record<string, unknown> | null,
  serviceCatalog: unknown,
): SalonProfile {
  const completedFields = PROFILE_FIELDS.filter((key) =>
    fieldIsFilled(businessProfile?.[key]),
  ).length

  const activeServices = resolveServiceCatalog(serviceCatalog)
    .filter((item) => item.active)
    .map((item) => item.name)

  return {
    businessName: profileString(businessProfile, "businessName"),
    description: profileString(businessProfile, "businessDescription"),
    region: profileString(businessProfile, "region"),
    workingHours: profileString(businessProfile, "workingHours"),
    activeServices,
    completeness: completedFields / PROFILE_FIELDS.length,
    completedFields,
    totalFields: PROFILE_FIELDS.length,
  }
}

// ─── Snapshot building ───────────────────────────────────────────────────────

const INACTIVE_AFTER_DAYS = 60
const TOP_CLIENTS_LIMIT = 4
const OPEN_TASK_STATUSES = new Set(["proposed", "open", "in_progress", "waiting"])
const PENDING_INVOICE_STATES = new Set(["enviada", "vencida"])

function kpi(current: number, previous: number | null): OverviewKpiValue {
  // No precomputed historical series exists — sparklines stay empty rather
  // than being fabricated (the UI hides sparks with fewer than 2 points).
  return { current, previous, spark: [] }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** The instant an invoice counts as collected. */
function paidDate(invoice: OverviewInvoiceRow): Date | null {
  if (invoice.estado !== "pagada") return null
  return invoice.paidAt ?? invoice.fechaEmision
}

interface PeriodVisitStats {
  visits: number
  uniqueClients: Set<string>
  newClients: Set<string>
}

function visitStats(
  events: OverviewEventRow[],
  bounds: Map<string, OverviewVisitBounds>,
  start: string,
  end: string,
  timezone: string,
  now: Date,
): PeriodVisitStats {
  const uniqueClients = new Set<string>()
  const newClients = new Set<string>()
  let visits = 0

  for (const event of events) {
    if (event.fechaInicio.getTime() > now.getTime()) continue // not completed yet
    const iso = isoDateInTimezone(event.fechaInicio, timezone)
    if (!inRange(iso, start, end)) continue
    visits += 1
    if (!event.clienteId) continue
    uniqueClients.add(event.clienteId)

    const firstVisit = bounds.get(event.clienteId)?.firstVisit
    if (firstVisit && inRange(isoDateInTimezone(firstVisit, timezone), start, end)) {
      newClients.add(event.clienteId)
    }
  }

  return { visits, uniqueClients, newClients }
}

export function buildRealOverviewPayload(input: RealOverviewInput): SalonOverviewPayload {
  const { period, timezone, now, workspaceId } = input
  const todayIso = isoDateInTimezone(now, timezone)

  const hasAppointments = input.totals.events > 0
  const hasFinance = input.totals.invoices > 0
  const hasClients = input.totals.clients > 0

  const bounds = new Map(input.visitBounds.map((b) => [b.clienteId, b]))
  const clientsById = new Map(input.clients.map((c) => [c.id, c]))

  // ── Visits / client mix (current + comparison) ────────────────────────────
  const current = visitStats(input.events, bounds, period.start, period.end, timezone, now)
  const previous = visitStats(
    input.events,
    bounds,
    period.comparisonStart,
    period.comparisonEnd,
    timezone,
    now,
  )

  // ── Earnings (collected invoices) ─────────────────────────────────────────
  let earningsCurrent = 0
  let earningsPrevious = 0
  for (const invoice of input.invoices) {
    const collectedAt = paidDate(invoice)
    if (!collectedAt) continue
    const iso = isoDateInTimezone(collectedAt, timezone)
    if (inRange(iso, period.start, period.end)) earningsCurrent += invoice.total
    else if (inRange(iso, period.comparisonStart, period.comparisonEnd)) {
      earningsPrevious += invoice.total
    }
  }

  const hasComparison = previous.visits > 0 || earningsPrevious > 0

  // ── KPIs (each null when its module has no data at all) ───────────────────
  const returningCurrent = current.uniqueClients.size - current.newClients.size
  const returningPrevious = previous.uniqueClients.size - previous.newClients.size

  const kpis: OverviewKpis | null =
    hasAppointments || hasFinance
      ? {
          earnings: hasFinance
            ? kpi(round2(earningsCurrent), hasComparison ? round2(earningsPrevious) : null)
            : null,
          visits: hasAppointments
            ? kpi(current.visits, hasComparison ? previous.visits : null)
            : null,
          newClients: hasAppointments
            ? kpi(current.newClients.size, hasComparison ? previous.newClients.size : null)
            : null,
          returningRate:
            hasAppointments && current.uniqueClients.size > 0
              ? kpi(
                  returningCurrent / current.uniqueClients.size,
                  hasComparison && previous.uniqueClients.size > 0
                    ? returningPrevious / previous.uniqueClients.size
                    : null,
                )
              : null,
        }
      : null

  // ── Revenue trend (collected invoices bucketed over the period) ───────────
  const revenueTrend = hasFinance ? buildTrendBuckets(period) : []
  if (revenueTrend.length > 0) {
    for (const invoice of input.invoices) {
      const collectedAt = paidDate(invoice)
      if (!collectedAt) continue
      const iso = isoDateInTimezone(collectedAt, timezone)
      if (!inRange(iso, period.start, period.end)) continue
      // Buckets are ordered by start date; the invoice belongs to the last
      // bucket that starts on or before its collection day.
      for (let i = revenueTrend.length - 1; i >= 0; i--) {
        if (revenueTrend[i].start <= iso) {
          revenueTrend[i].amount = round2(revenueTrend[i].amount + invoice.total)
          break
        }
      }
    }
  }

  // ── Demand (completed visits per ISO weekday) ─────────────────────────────
  let demand: { days: DemandDay[]; peakHours: null } | null = null
  if (current.visits > 0) {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (const event of input.events) {
      if (event.fechaInicio.getTime() > now.getTime()) continue
      const iso = isoDateInTimezone(event.fechaInicio, timezone)
      if (!inRange(iso, period.start, period.end)) continue
      counts[isoWeekdayOfDate(iso)] += 1
    }
    const max = Math.max(...counts)
    demand = {
      days: counts.map((visits, weekday) => ({
        weekday,
        visits,
        peak: max > 0 && visits === max,
      })),
      // No capacity/hourly model exists — never invent a peak-hour range.
      peakHours: null,
    }
  }

  // ── Top clients (visits in period; spend from collected invoices) ─────────
  const visitsByClient = new Map<string, number>()
  for (const event of input.events) {
    if (event.fechaInicio.getTime() > now.getTime()) continue
    if (!event.clienteId) continue
    const iso = isoDateInTimezone(event.fechaInicio, timezone)
    if (!inRange(iso, period.start, period.end)) continue
    visitsByClient.set(event.clienteId, (visitsByClient.get(event.clienteId) ?? 0) + 1)
  }
  const spendByClient = new Map<string, number>()
  for (const invoice of input.invoices) {
    const collectedAt = paidDate(invoice)
    if (!collectedAt || !invoice.clienteId) continue
    const iso = isoDateInTimezone(collectedAt, timezone)
    if (!inRange(iso, period.start, period.end)) continue
    spendByClient.set(
      invoice.clienteId,
      round2((spendByClient.get(invoice.clienteId) ?? 0) + invoice.total),
    )
  }

  const topClients: ClientPerformance[] = [...visitsByClient.entries()]
    .map(([clientId, visits]) => ({
      clientId,
      name: clientsById.get(clientId)?.nombre ?? null,
      visits,
      spend: hasFinance ? spendByClient.get(clientId) ?? 0 : null,
      // No VIP flag exists on Cliente — never invent one.
      vip: false,
    }))
    .filter((c): c is ClientPerformance & { name: string } => c.name !== null)
    .sort((a, b) => b.visits - a.visits || (b.spend ?? 0) - (a.spend ?? 0))
    .slice(0, TOP_CLIENTS_LIMIT)

  // ── Signals ───────────────────────────────────────────────────────────────
  const inactiveThreshold = now.getTime() - INACTIVE_AFTER_DAYS * 24 * 3600 * 1000
  const inactiveClients = hasAppointments
    ? input.visitBounds.filter((b) => b.lastVisit.getTime() < inactiveThreshold).length
    : null

  let pendingCount = 0
  let pendingAmount = 0
  for (const invoice of input.invoices) {
    if (!PENDING_INVOICE_STATES.has(invoice.estado)) continue
    pendingCount += 1
    pendingAmount += invoice.total
  }

  const signals: OverviewSignals = {
    inactiveClients,
    pendingPayments: hasFinance ? { count: pendingCount, amount: round2(pendingAmount) } : null,
    // No capacity model / seasonal history exists — honest nulls.
    peakDayOccupancy: null,
    quietPeriodAhead: null,
  }

  const snapshot: BusinessOverviewSnapshot = {
    workspaceId,
    period,
    currency: input.currency,
    kpis,
    revenueTrend,
    // No attribution backend — never fabricate "why it changed" stories.
    drivers: [],
    lookingAhead: deriveLookingAhead(signals),
    // No service↔appointment link exists yet — per-service performance would
    // be guesswork (matching by title is not honest data).
    topServices: [],
    demand,
    clientMix: hasAppointments
      ? {
          uniqueClients: current.uniqueClients.size,
          returningClients: returningCurrent,
          newClients: current.newClients.size,
        }
      : null,
    topClients,
    // No booking-source attribution exists.
    bookingSources: [],
    signals,
    dataQuality: {
      finance: hasFinance,
      appointments: hasAppointments,
      clients: hasClients,
      services: false,
      bookingSources: false,
      comparison: hasComparison,
    },
  }

  // ── Today's operations ────────────────────────────────────────────────────
  const appointments: SalonTodayAppointment[] = input.events
    .filter((event) => isoDateInTimezone(event.fechaInicio, timezone) === todayIso)
    .sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())
    .map((event) => ({
      eventoId: event.id,
      clientId: event.clienteId,
      clientName: event.clienteId ? clientsById.get(event.clienteId)?.nombre ?? null : null,
      title: event.titulo,
      startsAt: event.fechaInicio.toISOString(),
      endsAt: event.fechaFin ? event.fechaFin.toISOString() : null,
    }))

  const priorityTasks = input.openTasks.filter(
    (task) =>
      OPEN_TASK_STATUSES.has(task.status) &&
      (task.priority === "high" ||
        task.priority === "urgent" ||
        (task.dueAt !== null && isoDateInTimezone(task.dueAt, timezone) <= todayIso)),
  ).length

  let pendingInvoiceCount = 0
  let pendingInvoiceAmount = 0
  let overdueInvoiceCount = 0
  let overdueInvoiceAmount = 0
  for (const invoice of input.invoices) {
    if (invoice.estado === "enviada") {
      pendingInvoiceCount += 1
      pendingInvoiceAmount += invoice.total
    } else if (invoice.estado === "vencida") {
      overdueInvoiceCount += 1
      overdueInvoiceAmount += invoice.total
    }
  }

  const today: SalonToday = {
    appointments,
    pendingConversations: input.pendingConversationCount,
    priorityTasks: input.totals.tasks > 0 ? priorityTasks : null,
    activeClients: hasClients
      ? input.clients.filter((c) => c.estado === "activo").length
      : null,
    pendingInvoices: hasFinance
      ? { count: pendingInvoiceCount, amount: round2(pendingInvoiceAmount) }
      : null,
    overdueInvoices: hasFinance
      ? { count: overdueInvoiceCount, amount: round2(overdueInvoiceAmount) }
      : null,
  }

  return {
    snapshot,
    salon: buildSalonProfile(input.businessProfile, input.serviceCatalog),
    today,
    source: "real",
  }
}
