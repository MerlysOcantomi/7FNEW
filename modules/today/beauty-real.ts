/**
 * Beauty "Hoy" — REAL data contract + pure builder.
 *
 * The typed reality the appointment-first Beauty Today renders. Built ON TOP
 * of existing sources — never a parallel truth:
 *   - tasks arrive as the SAME `TodayItem`s the work-first workboard shows
 *     (produced by `aggregateToday`), so the two Todays can never disagree
 *     about what work exists;
 *   - citas are real `Evento` rows (tipo "cita") with their real `Cliente`;
 *   - pending messages come from `Conversation`, urgent collections from
 *     `Factura` — same filters the business overview uses.
 *
 * TRUTH RULES (enforced here, tested in beauty-real.test.ts):
 *   - `Evento` has NO attendance/confirmation state → appointments carry only
 *     a time-derived `phase` (past/current/upcoming). We never claim a cita
 *     was completed, confirmed or a no-show.
 *   - `Evento` has no price → no "booked value" figure anywhere.
 *   - A free gap is shown ONLY between two consecutive citas whose end times
 *     are known (fechaFin present, no overlap) — never derived from the
 *     free-text working-hours profile, never invented.
 *   - Every suggested action IS a real `WorkspaceTask`/`Tarea` row and carries
 *     its `basis` (source label + linked client/cita/conversation) so the UI
 *     can state which real fact it rests on.
 *
 * Pure and DB-free — the Prisma layer lives in `beauty-aggregator.ts`.
 */

import type { TodayItem, TodayPriority } from "./types"

// ─── Contract ────────────────────────────────────────────────────────────────

/** Time-derived only — never an attendance claim. */
export type BeautyAppointmentPhase = "past" | "current" | "upcoming"

export interface BeautyTodayAppointment {
  eventoId: string
  /** `Evento.titulo` — the owner's own text (often the service name). */
  title: string
  startsAt: string
  /** `null` when the cita has no known end — gaps around it are not computed. */
  endsAt: string | null
  clientId: string | null
  clientName: string | null
  phase: BeautyAppointmentPhase
}

/** A free stretch between two consecutive citas with known bounds. */
export interface BeautyTodayGap {
  /** Deterministic: `gap:<previous eventoId>` — stable across refetches. */
  id: string
  startsAt: string
  endsAt: string
  minutes: number
}

/** The real fact(s) an action rests on. */
export interface BeautyTodayActionBasis {
  /** Short origin label cached on the task (e.g. "Agenda", "Inbox"). */
  sourceLabel: string | null
  clientId: string | null
  clientName: string | null
  eventoId: string | null
  conversationId: string | null
}

export interface BeautyTodayAction {
  /** Prefixed TodayItem id (`task:…` / `tarea:…`) — same identity as the workboard. */
  itemId: string
  title: string
  description: string | null
  priority: TodayPriority | null
  dueAt: string | null
  /** True when the row is an AI proposal awaiting the operator (status "proposed"). */
  suggestedByAi: boolean
  /** True when the row is blocked on an external dependency (status "waiting"). */
  isWaiting: boolean
  /** True when the task's due date is before today (overdue bucket). */
  overdue: boolean
  /** Real navigation target computed by the Today aggregator (relative path). */
  href: string
  basis: BeautyTodayActionBasis
}

export interface BeautyTodayPayload {
  /** Viewer-local calendar day, `yyyy-mm-dd`. */
  date: string
  timezone: string
  generatedAt: string
  /** ISO 4217 — from workspace configuration (EUR fallback), never invented. */
  currency: string
  nextAppointment: BeautyTodayAppointment | null
  appointments: BeautyTodayAppointment[]
  gaps: BeautyTodayGap[]
  /** Real open work needing the operator: overdue, due today, or high priority. */
  urgentActions: BeautyTodayAction[]
  /** Real AI proposals (WorkspaceTask status "proposed") awaiting review. */
  suggestedActions: BeautyTodayAction[]
  /** Open task rows visible in the workboard beyond the two lists above. */
  otherOpenTaskCount: number
  /** Conversations awaiting a first response — `null` when inbox has no rows. */
  pendingConversations: number | null
  overdueInvoices: { count: number; amount: number } | null
  pendingInvoices: { count: number; amount: number } | null
  dataQuality: {
    appointments: boolean
    tasks: boolean
    conversations: boolean
    finance: boolean
  }
  source: "real"
}

// ─── Data-source policy (real vs mock) ───────────────────────────────────────

export type BeautyTodayDataSource = "real" | "mock"

/**
 * The fallback policy, stated once and tested so the layout can never slip
 * back to mocks by default:
 *   - a real Beauty workspace ALWAYS gets the real surface;
 *   - the mock Studio preview survives ONLY behind the explicit QA param
 *     (`?todayData=mock`) or the `?vertical=beauty` forced design preview
 *     (a non-Beauty workspace reviewing the Beauty skin has no Beauty reality
 *     to show).
 */
export function resolveBeautyTodayDataSource(input: {
  /** Raw `?todayData=` query param. */
  todayDataParam: string | null
  /** `?vertical=beauty` forced onto a workspace that is not Beauty. */
  isForcedPreview: boolean
}): BeautyTodayDataSource {
  if (input.todayDataParam === "mock") return "mock"
  if (input.isForcedPreview) return "mock"
  return "real"
}

// ─── Query filters (pure — the aggregator feeds these to Prisma) ─────────────

/**
 * Every extra `where` clause Beauty Today uses beyond `aggregateToday`,
 * workspace-stamped in ONE place and asserted by the tenant-isolation test.
 */
export function buildBeautyTodayQueryFilters(
  workspaceId: string,
  window: { startOfToday: Date; startOfTomorrow: Date },
) {
  return {
    /** Today's citas (the agenda). */
    todayCitas: {
      workspaceId,
      tipo: "cita",
      fechaInicio: { gte: window.startOfToday, lt: window.startOfTomorrow },
    },
    /** Any cita ever — existence check for the honest empty state. */
    anyCita: { workspaceId, tipo: "cita" },
    /** Enrichment lookup for the tasks the workboard already selected. */
    taskEnrichment: (taskIds: string[]) => ({ workspaceId, id: { in: taskIds } }),
    pendingConversations: { workspaceId, status: "new" },
    anyConversation: { workspaceId },
    overdueInvoices: { workspaceId, estado: "vencida" },
    pendingInvoices: { workspaceId, estado: "enviada" },
    anyInvoice: { workspaceId },
  }
}

// ─── Pure building blocks ────────────────────────────────────────────────────

/** Gaps shorter than this are turnaround time, not a bookable hole. */
export const GAP_MIN_MINUTES = 30

export interface BeautyEventRow {
  id: string
  titulo: string
  fechaInicio: Date
  fechaFin: Date | null
  clienteId: string | null
  clienteNombre: string | null
}

export function appointmentPhase(
  startsAt: Date,
  endsAt: Date | null,
  now: Date,
): BeautyAppointmentPhase {
  if (startsAt.getTime() > now.getTime()) return "upcoming"
  if (endsAt !== null && endsAt.getTime() > now.getTime()) return "current"
  // Started with no known end, or already ended → "past" (a time statement,
  // never an attendance claim — guessing an ongoing state would be invention).
  return "past"
}

export function buildAppointments(
  rows: BeautyEventRow[],
  now: Date,
): BeautyTodayAppointment[] {
  return [...rows]
    .sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())
    .map((row) => ({
      eventoId: row.id,
      title: row.titulo,
      startsAt: row.fechaInicio.toISOString(),
      endsAt: row.fechaFin ? row.fechaFin.toISOString() : null,
      clientId: row.clienteId,
      clientName: row.clienteNombre,
      phase: appointmentPhase(row.fechaInicio, row.fechaFin, now),
    }))
}

/** First cita that has not started yet (strictly after `now`), else `null`. */
export function findNextAppointment(
  appointments: BeautyTodayAppointment[],
  now: Date,
): BeautyTodayAppointment | null {
  for (const appt of appointments) {
    if (new Date(appt.startsAt).getTime() > now.getTime()) return appt
  }
  return null
}

/**
 * Free gaps between consecutive citas. Honest by construction:
 *   - both neighbours need a known end/start (a cita without `fechaFin`
 *     breaks the chain — no gap is derived across it);
 *   - overlapping or back-to-back citas yield nothing;
 *   - gaps entirely in the past are not offered (nothing bookable there);
 *   - below `GAP_MIN_MINUTES` is turnaround, not a hole.
 */
export function computeGaps(
  appointments: BeautyTodayAppointment[],
  now: Date,
): BeautyTodayGap[] {
  const gaps: BeautyTodayGap[] = []
  for (let i = 0; i < appointments.length - 1; i++) {
    const prev = appointments[i]
    const next = appointments[i + 1]
    if (prev.endsAt === null) continue
    const gapStart = new Date(prev.endsAt).getTime()
    const gapEnd = new Date(next.startsAt).getTime()
    if (gapEnd <= gapStart) continue
    if (gapEnd <= now.getTime()) continue
    const minutes = Math.round((gapEnd - gapStart) / 60000)
    if (minutes < GAP_MIN_MINUTES) continue
    gaps.push({
      id: `gap:${prev.eventoId}`,
      startsAt: new Date(gapStart).toISOString(),
      endsAt: new Date(gapEnd).toISOString(),
      minutes,
    })
  }
  return gaps
}

// ─── Task categorization (from the workboard's own TodayItems) ───────────────

export interface BeautyTaskEnrichment {
  /** Raw WorkspaceTask id → links (basis). */
  byTaskId: Map<
    string,
    {
      sourceLabel: string | null
      clienteId: string | null
      eventoId: string | null
      conversationId: string | null
    }
  >
  /** clienteId → display name. */
  clientNames: Map<string, string>
}

const URGENT_PRIORITIES: ReadonlySet<TodayPriority> = new Set(["high", "critical"])

/** Max rows per list — the full board stays one link away. */
export const URGENT_ACTIONS_LIMIT = 5
export const SUGGESTED_ACTIONS_LIMIT = 3

function toAction(
  item: TodayItem,
  overdue: boolean,
  enrichment: BeautyTaskEnrichment,
): BeautyTodayAction {
  const rawTaskId = item.id.startsWith("task:") ? item.id.slice("task:".length) : null
  const links = rawTaskId ? enrichment.byTaskId.get(rawTaskId) : undefined
  const clientId = links?.clienteId ?? null
  return {
    itemId: item.id,
    title: item.title,
    description: item.description,
    priority: item.priority,
    dueAt: item.dueAt,
    suggestedByAi: item.isProposed,
    isWaiting: item.isWaiting,
    overdue,
    href: item.source.href,
    basis: {
      sourceLabel: links?.sourceLabel ?? null,
      clientId,
      clientName: clientId ? enrichment.clientNames.get(clientId) ?? null : null,
      eventoId: links?.eventoId ?? null,
      conversationId: links?.conversationId ?? null,
    },
  }
}

export interface CategorizedBeautyActions {
  urgent: BeautyTodayAction[]
  suggested: BeautyTodayAction[]
  otherOpenTaskCount: number
}

/**
 * Split the workboard's task items into the Beauty lists. Input is the SAME
 * `TodayBuckets` the workboard renders — identical visibility, zero drift.
 */
export function categorizeBeautyActions(
  buckets: { overdue: TodayItem[]; today: TodayItem[]; undated: TodayItem[] },
  enrichment: BeautyTaskEnrichment,
): CategorizedBeautyActions {
  const urgent: BeautyTodayAction[] = []
  const suggested: BeautyTodayAction[] = []
  let otherOpenTaskCount = 0

  const consider = (item: TodayItem, bucket: "overdue" | "today" | "undated") => {
    if (item.kind !== "task") return
    const action = toAction(item, bucket === "overdue", enrichment)
    if (action.suggestedByAi) {
      if (suggested.length < SUGGESTED_ACTIONS_LIMIT) suggested.push(action)
      else otherOpenTaskCount += 1
      return
    }
    const isUrgent =
      bucket === "overdue" ||
      (action.priority !== null && URGENT_PRIORITIES.has(action.priority)) ||
      (bucket === "today" && action.dueAt !== null)
    if (isUrgent && urgent.length < URGENT_ACTIONS_LIMIT) {
      urgent.push(action)
    } else {
      otherOpenTaskCount += 1
    }
  }

  for (const item of buckets.overdue) consider(item, "overdue")
  for (const item of buckets.today) consider(item, "today")
  for (const item of buckets.undated) consider(item, "undated")

  return { urgent, suggested, otherOpenTaskCount }
}
