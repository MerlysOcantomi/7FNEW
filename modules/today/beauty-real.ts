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
  /** `Evento.descripcion` — the owner's own note on the cita (preparation), or `null`. */
  note: string | null
  /** `Cliente.telefono` as stored (no formatting/validation claims), or `null`. */
  clientPhone: string | null
  /** `Cliente.notas` — the owner's own notes about the client, or `null`. */
  clientNotes: string | null
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

/**
 * "Mi inspiración" item — a REAL workspace photo read from `PresenceMedia`
 * (the business media store Presence already owns). Read-only: the Today
 * surface never writes, uploads, reviews or reorders media.
 */
export interface BeautyInspirationItem {
  id: string
  url: string
  width: number | null
  height: number | null
  /** work_sample | gallery — editorial purpose as stored. */
  purpose: string
}

export interface BeautyTodayInspiration {
  /** Newest first, capped at `INSPIRATION_LIMIT`. */
  items: BeautyInspirationItem[]
  /** Total approved originals in the workspace (for the "N trabajos" count). */
  total: number
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
  /** Approved workspace photos for "Mi inspiración" (FINESSE-UI-02 Phase 2). */
  inspiration: BeautyTodayInspiration
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
/** Editorial purposes that count as "a work to remember/show". */
export const INSPIRATION_PURPOSES = ["work_sample", "gallery"] as const
/** Max photos on the Today strip — the full set stays a later surface. */
export const INSPIRATION_LIMIT = 6


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
    /**
     * "Mi inspiración": approved ORIGINAL photos (variants excluded) with an
     * editorial purpose that means "a work to show" — the same approval rule
     * the Presence renderer applies (`reviewStatus === "use"`).
     */
    inspirationMedia: {
      workspaceId,
      kind: "photo",
      purpose: { in: [...INSPIRATION_PURPOSES] },
      reviewStatus: "use",
      sourceMediaId: null,
    },
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
  descripcion?: string | null
  clienteTelefono?: string | null
  clienteNotas?: string | null
}

/** Trim free text; empty → `null` so the UI never renders a blank block. */
function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
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
      note: cleanText(row.descripcion),
      clientPhone: cleanText(row.clienteTelefono),
      clientNotes: cleanText(row.clienteNotas),
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

// ─── Focused appointment ("¿Quién viene ahora?") ─────────────────────────────

export type BeautyFocusMode = "current" | "upcoming" | "none"

export interface BeautyFocusedAppointment {
  /** The cita the top of "Hoy" is about, or `null`. */
  focus: BeautyTodayAppointment | null
  /** "current" = happening now (time-derived), "upcoming" = next to start. */
  mode: BeautyFocusMode
  /** The first not-yet-started cita AFTER the focus (shown as "Después"). */
  following: BeautyTodayAppointment | null
  /** Upcoming citas after the focus (count for "N citas más hoy"). */
  remainingAfterFocus: number
  /** True when the day had citas but they are all in the past. */
  allDone: boolean
}

/**
 * Pick the cita the operator is working with RIGHT NOW: a cita in progress
 * wins; otherwise the next one to start; `null` when none remain.
 *
 * `selectedEventoId` is the seam for the FUTURE manual switch ("I'm actually
 * with a different client"): when provided and found among today's citas it
 * takes precedence. Nothing sets it yet — no selector, no persistence, no
 * API (FINESSE-UI-02 Phase 2 leaves it undefined by contract).
 */
export function resolveFocusedAppointment(
  appointments: BeautyTodayAppointment[],
  now: Date,
  selectedEventoId?: string | null,
): BeautyFocusedAppointment {
  const nowMs = now.getTime()
  const selected = selectedEventoId
    ? appointments.find((a) => a.eventoId === selectedEventoId) ?? null
    : null
  const current = appointments.find((a) => appointmentPhase(new Date(a.startsAt), a.endsAt ? new Date(a.endsAt) : null, now) === "current") ?? null
  const next = findNextAppointment(appointments, now)
  const focus = selected ?? current ?? next
  const mode: BeautyFocusMode =
    focus === null ? "none" : new Date(focus.startsAt).getTime() <= nowMs ? "current" : "upcoming"
  const focusStart = focus ? new Date(focus.startsAt).getTime() : -Infinity
  const after = appointments.filter(
    (a) => a.eventoId !== focus?.eventoId && new Date(a.startsAt).getTime() > Math.max(nowMs, focusStart),
  )
  return {
    focus,
    mode,
    following: after[0] ?? null,
    remainingAfterFocus: after.length,
    allDone: focus === null && appointments.length > 0,
  }
}

// ─── "Lo que necesita atención" (a small, prioritized digest) ─────────────────

export type BeautyAttentionKind = "task" | "messages" | "overdue-invoices" | "pending-invoices"

export interface BeautyAttentionItem {
  id: string
  kind: BeautyAttentionKind
  /** Task rows carry their own title; count rows are composed by the UI catalog. */
  title: string | null
  count: number | null
  amount: number | null
  overdue: boolean
  dueAt: string | null
  clientName: string | null
  /** Real navigation target (task href, /inbox, /facturacion). */
  href: string
}

export interface BeautyAttentionDigest {
  items: BeautyAttentionItem[]
  /** Signals that did not fit in `items` (the full board is one link away). */
  hiddenCount: number
  /** Real AI proposals awaiting review — surfaced as one quiet line, not rows. */
  suggestedCount: number
}

/** Max rows on the digest — focus, not a second inbox. */
export const ATTENTION_LIMIT = 3

/**
 * Rank existing signals into ONE short list. No new scoring engine: it reuses
 * the buckets `categorizeBeautyActions` already produced (urgent = overdue,
 * high/critical priority or due today) and the overview's message/invoice
 * counts. Order of importance, then declared order:
 *   0 overdue tasks · 1 unanswered messages · 2 other urgent tasks ·
 *   3 overdue invoices · 4 invoices awaiting payment
 */
export function buildAttentionDigest(
  payload: Pick<
    BeautyTodayPayload,
    "urgentActions" | "suggestedActions" | "pendingConversations" | "overdueInvoices" | "pendingInvoices"
  >,
  limit: number = ATTENTION_LIMIT,
): BeautyAttentionDigest {
  const ranked: Array<{ rank: number; item: BeautyAttentionItem }> = []
  for (const action of payload.urgentActions) {
    ranked.push({
      rank: action.overdue ? 0 : 2,
      item: {
        id: action.itemId,
        kind: "task",
        title: action.title,
        count: null,
        amount: null,
        overdue: action.overdue,
        dueAt: action.dueAt,
        clientName: action.basis.clientName,
        href: action.href,
      },
    })
  }
  if (payload.pendingConversations !== null && payload.pendingConversations > 0) {
    ranked.push({
      rank: 1,
      item: {
        id: "messages",
        kind: "messages",
        title: null,
        count: payload.pendingConversations,
        amount: null,
        overdue: false,
        dueAt: null,
        clientName: null,
        href: "/inbox",
      },
    })
  }
  if (payload.overdueInvoices && payload.overdueInvoices.count > 0) {
    ranked.push({
      rank: 3,
      item: {
        id: "overdue-invoices",
        kind: "overdue-invoices",
        title: null,
        count: payload.overdueInvoices.count,
        amount: payload.overdueInvoices.amount,
        overdue: true,
        dueAt: null,
        clientName: null,
        href: "/facturacion",
      },
    })
  }
  if (payload.pendingInvoices && payload.pendingInvoices.count > 0) {
    ranked.push({
      rank: 4,
      item: {
        id: "pending-invoices",
        kind: "pending-invoices",
        title: null,
        count: payload.pendingInvoices.count,
        amount: payload.pendingInvoices.amount,
        overdue: false,
        dueAt: null,
        clientName: null,
        href: "/facturacion",
      },
    })
  }
  // Stable by rank (Array.prototype.sort is stable → declared order within a rank).
  ranked.sort((a, b) => a.rank - b.rank)
  const items = ranked.slice(0, limit).map((r) => r.item)
  return {
    items,
    hiddenCount: Math.max(0, ranked.length - items.length),
    suggestedCount: payload.suggestedActions.length,
  }
}

/**
 * Whether an attention item's `href` actually leads somewhere from the Finesse
 * "Hoy" (`/today`). WorkspaceTask rows inherit the aggregator's href, which is
 * the Today board itself — from `/today` that would be a no-op navigation, so
 * the UI renders such rows as informative (non-link) rows instead of showing a
 * misleading affordance. Query strings / sub-paths of `/today` count as the
 * same surface. Pure: no routing, no invented destinations.
 */
export function isAttentionHrefNavigable(href: string, currentPathname: string): boolean {
  const target = href.split(/[?#]/)[0]
  if (target === "") return false
  const onToday = currentPathname === "/today" || currentPathname.startsWith("/today/")
  const targetIsToday = target === "/today" || target.startsWith("/today/")
  return !(onToday && targetIsToday)
}
