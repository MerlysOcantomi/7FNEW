/**
 * My Salon (Finesse Business Overview) — data contracts.
 *
 * Pure types for the Beauty vertical's business overview: one workspace-scoped
 * snapshot that every section of the page derives from (KPIs, revenue trend,
 * performance drivers, services, demand, client mix, top clients, booking
 * sources and recommendations). DB-free and framework-free so they are safe on
 * the client, the server and in tests — mirrors `modules/marketing/types.ts`.
 *
 * These interfaces are the seam for the future backend: a Prisma aggregation /
 * API route can map 1:1 onto them (`workspaceId` + the resolved period travel
 * with the snapshot so multi-tenant scope and time scope are part of the
 * contract). Until that backend exists, `demo-data.ts` produces values of
 * these same types, clearly isolated from the UI components.
 *
 * METRIC DEFINITIONS (explicit, so sections never mix them):
 *   - `visits`       → COMPLETED appointments inside the period.
 *   - `clientMix`    → UNIQUE clients seen in the period, split into new
 *                      (first ever visit inside the period) vs returning.
 *   - `newClients`   → the `clientMix.newClients` count (unique clients).
 *   - `returningRate`→ returning unique clients / total unique clients (0..1).
 *   - `earnings`     → collected revenue from completed visits in the period.
 */

// ─── Period ──────────────────────────────────────────────────────────────────

export type OverviewPeriodPreset = "week" | "month" | "quarter" | "year"

/**
 * A resolved reporting period. All dates are LOCAL calendar dates encoded as
 * `yyyy-mm-dd` (no timezone math on the wire). The comparison range is the
 * previous equivalent period; `hasComparison` is false for a business's first
 * period (no baseline → the UI hides deltas instead of showing fake zeros).
 */
export interface OverviewPeriod {
  preset: OverviewPeriodPreset
  /** Inclusive period start, `yyyy-mm-dd`. */
  start: string
  /** Inclusive period end, `yyyy-mm-dd`. */
  end: string
  /** Inclusive comparison start (previous equivalent period). */
  comparisonStart: string
  /** Inclusive comparison end. */
  comparisonEnd: string
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

/**
 * One KPI as raw numbers. `previous` is `null` when no comparison data exists
 * (first period, or the metric was not tracked then) — the UI must render an
 * honest "sin comparativa" state instead of a delta. `spark` is a short recent
 * series (oldest → newest) for the mini trend visual; empty = no sparkline.
 */
export interface OverviewKpiValue {
  current: number
  previous: number | null
  spark: number[]
}

/**
 * Each KPI is independently nullable so partial data stays honest: a workspace
 * with appointments but no finance module renders visits while the earnings
 * card shows its own "sin datos" state (never a fake 0).
 */
export interface OverviewKpis {
  /** Collected revenue in workspace currency. */
  earnings: OverviewKpiValue | null
  /** Completed visits (appointments), NOT unique clients. */
  visits: OverviewKpiValue | null
  /** Unique clients whose first ever visit falls inside the period. */
  newClients: OverviewKpiValue | null
  /** Returning unique clients / total unique clients, as a 0..1 ratio. */
  returningRate: OverviewKpiValue | null
}

// ─── Revenue trend ───────────────────────────────────────────────────────────

/**
 * One aggregated bucket of the revenue trend. Bucket granularity depends on
 * the preset: week → 7 days, month → calendar weeks, quarter → 3 months,
 * year → 12 months. `start` is the bucket's first day (`yyyy-mm-dd`); the UI
 * derives the human label from it with the workspace locale.
 */
export interface RevenuePoint {
  /** Bucket start date, `yyyy-mm-dd`. */
  start: string
  /** Bucket kind — lets the UI pick a label shape without re-deriving. */
  bucket: "day" | "week" | "month"
  /** 1-based index inside the period (Week 1, Week 2, …). */
  index: number
  amount: number
}

// ─── Performance drivers ("why it changed") ──────────────────────────────────

/**
 * HONESTY CONTRACT: `confidence` distinguishes confirmed business data from
 * calculated correlation and from inference/hypothesis. The UI must label
 * non-confirmed drivers ("posible influencia", "según datos de reserva") and
 * never present a correlation as fact.
 */
export type DriverConfidence = "confirmed" | "correlation" | "inference"

export type DriverTone = "up" | "down" | "flat"

export interface PerformanceDriver {
  id: string
  /** Source/category key — maps to a label + chip in the config. */
  source: "services" | "bookings" | "new-clients" | "rebooking" | "cancellations" | "walk-ins" | "campaign" | "schedule" | "weather"
  /** Estimated contribution in workspace currency (negative = drag). */
  amount: number
  tone: DriverTone
  confidence: DriverConfidence
  /** Optional detail the config's label template can interpolate (e.g. a channel name). */
  detail?: string | null
}

// ─── Services ────────────────────────────────────────────────────────────────

export interface ServicePerformance {
  /** Real service id when backed by the catalog; demo ids otherwise. */
  serviceId: string
  name: string
  /** Completed visits for this service inside the period. */
  visits: number
  /** Revenue in workspace currency; `null` when finance data is unavailable. */
  revenue: number | null
  /** Share of the period's completed visits, 0..1. */
  visitShare: number
  /** True when the service no longer exists in the catalog (renamed/archived). */
  archived?: boolean
}

// ─── Demand (busiest days & times) ───────────────────────────────────────────

export interface DemandDay {
  /** 0 = Monday … 6 = Sunday (ISO weekday order, Spain-first UI). */
  weekday: number
  visits: number
  peak: boolean
}

export interface DemandPattern {
  days: DemandDay[]
  /**
   * Peak time range (e.g. { startHour: 16, endHour: 19 }) ONLY when the data
   * source actually supports hourly analysis; `null` → the UI must not invent
   * an hour range.
   */
  peakHours: { startHour: number; endHour: number } | null
}

// ─── Client mix ──────────────────────────────────────────────────────────────

/** Counts UNIQUE clients (not visits, not appointments) — see header note. */
export interface ClientMix {
  uniqueClients: number
  returningClients: number
  newClients: number
}

// ─── Top clients ─────────────────────────────────────────────────────────────

export interface ClientPerformance {
  /** Real client id when available — drives navigation to the client profile. */
  clientId: string
  name: string
  /** Completed visits inside the period. */
  visits: number
  /** Spend inside the period, workspace currency. `null` when the viewer lacks finance permission. */
  spend: number | null
  vip: boolean
}

// ─── Booking sources ─────────────────────────────────────────────────────────

export type BookingSourceKind =
  | "instagram"
  | "whatsapp"
  | "google"
  | "website"
  | "direct"
  | "walk-in"
  | "referral"
  | "phone"
  | "unknown"

export interface BookingSourcePerformance {
  source: BookingSourceKind
  /** Bookings attributed to this source inside the period. */
  bookings: number
  /** Share of attributed + unattributed bookings, 0..1. Shares sum to 1. */
  share: number
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export type RecommendationAgent = "fiona" | "felix" | "fanny" | "finesse"

/**
 * A recommendation derived from the snapshot's own signals (never hardcoded
 * independently of the data). `kind` maps to the config's text template and
 * the action target; `value` is the relevant number the template interpolates.
 */
export interface BusinessRecommendation {
  id: string
  agent: RecommendationAgent
  kind: "reactivation" | "pending-payments" | "availability" | "quiet-period"
  /** The relevant number (clients to reactivate, pending amount, …). */
  value: number
  /** Existing 7F route the action navigates to. */
  actionHref: string
}

// ─── Looking ahead ───────────────────────────────────────────────────────────

export interface LookingAheadNote {
  /** Template key in the config (e.g. "quiet-month-coming"). */
  kind: "quiet-period" | "peak-nearly-full" | "service-growing" | "rebooking-falling"
  /** Optional detail for interpolation (month name, service name…). */
  detail?: string | null
  /** Optional safe CTA — existing route only. `null` → no action button. */
  actionHref: string | null
}

// ─── Signals (inputs recommendations derive from) ────────────────────────────

/**
 * Cross-module business signals that feed recommendations and the forward
 * look. Each is `null` when the underlying module has no data (→ the derived
 * recommendation simply doesn't exist; nothing is invented).
 */
export interface OverviewSignals {
  /** Clients with no visit in the last ~60 days. */
  inactiveClients: number | null
  /** Completed visits with an uncollected payment. */
  pendingPayments: { count: number; amount: number } | null
  /** Occupancy ratio 0..1 of the busiest weekday. */
  peakDayOccupancy: number | null
  /** True when the NEXT equivalent period is historically quieter. */
  quietPeriodAhead: boolean | null
}

// ─── Data quality ────────────────────────────────────────────────────────────

/**
 * Which underlying sources actually produced data for this snapshot. The page
 * uses this to render honest per-section empty states while keeping the rest
 * of the overview useful (one missing module never blanks the page).
 */
export interface OverviewDataQuality {
  finance: boolean
  appointments: boolean
  clients: boolean
  services: boolean
  bookingSources: boolean
  /** False on a business's first period — comparisons/deltas are hidden. */
  comparison: boolean
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/** Everything My Salon needs, in one workspace-scoped, period-scoped snapshot. */
export interface BusinessOverviewSnapshot {
  workspaceId: string
  period: OverviewPeriod
  /** ISO 4217 — from workspace configuration, never derived from language. */
  currency: string
  kpis: OverviewKpis | null
  revenueTrend: RevenuePoint[]
  drivers: PerformanceDriver[]
  lookingAhead: LookingAheadNote | null
  topServices: ServicePerformance[]
  demand: DemandPattern | null
  clientMix: ClientMix | null
  topClients: ClientPerformance[]
  bookingSources: BookingSourcePerformance[]
  signals: OverviewSignals
  dataQuality: OverviewDataQuality
}

// ─── Salon profile & operational "today" (real backend additions) ────────────

/**
 * The salon's identity as read from the canonical source
 * (`Workspace.config.businessProfile` + the resolved service catalog). Values
 * are the owner's own business data — never translated, never invented; every
 * field is `null`/empty when the owner has not filled it.
 */
export interface SalonProfile {
  businessName: string | null
  description: string | null
  region: string | null
  workingHours: string | null
  /** Active service names from the resolved catalog (vertical seed or workspace override). */
  activeServices: string[]
  /** Profile fields filled over the canonical field set, 0..1. */
  completeness: number
  completedFields: number
  totalFields: number
}

/** One of today's appointments (an `Evento` of tipo "cita"). */
export interface SalonTodayAppointment {
  eventoId: string
  clientId: string | null
  /** Client display name — real business data, `null` when unlinked. */
  clientName: string | null
  title: string
  /** ISO instant — the UI formats it with the viewer's locale. */
  startsAt: string
  endsAt: string | null
}

/**
 * Operational cross-module counts for the salon's day. Each is `null` when the
 * underlying module has no data yet — the UI hides that row instead of showing
 * an invented zero.
 */
export interface SalonToday {
  appointments: SalonTodayAppointment[]
  /** Conversations awaiting a first response (`status: "new"`). */
  pendingConversations: number | null
  /** Open work items that are high priority or due today/overdue. */
  priorityTasks: number | null
  /** Clients currently marked active. */
  activeClients: number | null
  /** Sent, uncollected invoices. */
  pendingInvoices: { count: number; amount: number } | null
  /** Overdue invoices. */
  overdueInvoices: { count: number; amount: number } | null
}

/**
 * The full "Mi salón" payload the real backend returns: the period-scoped
 * analytics snapshot plus the salon identity and today's operations. `source`
 * makes the honesty policy explicit — the UI shows the preview chip ONLY when
 * a payload is not `"real"`.
 */
export interface SalonOverviewPayload {
  snapshot: BusinessOverviewSnapshot
  salon: SalonProfile
  today: SalonToday
  source: "real"
}
