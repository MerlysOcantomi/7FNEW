/**
 * My Salon — REAL data aggregation (server side).
 *
 * The thin Prisma layer for the business overview: a handful of
 * workspace-scoped queries whose rows feed the pure builder in
 * `real-snapshot.ts`. Server-only (imports `@core/db`) — presentation
 * components never call this directly; the `/api/overview` route does.
 *
 * Multi-tenant safety: every query's `where` comes from
 * `buildOverviewQueryFilters(workspaceId)` (in `real-snapshot.ts`), which
 * stamps the `workspaceId` on ALL of them in one place.
 * `real-snapshot.test.ts` asserts each filter carries the workspaceId, so a
 * new query can't silently ship without tenant scoping. `workspaceId` itself
 * always arrives from `requireReadAccess` at the route boundary.
 */

import { db } from "@core/db"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { resolveOverviewPeriod, fromIsoDate } from "./period"
import {
  buildOverviewQueryFilters,
  buildRealOverviewPayload,
  isoDateInTimezone,
  type OverviewVisitBounds,
} from "./real-snapshot"
import type { OverviewPeriodPreset, SalonOverviewPayload } from "./types"

/** ISO 4217 fallback for workspaces without an explicit currency (Spain-first). */
const DEFAULT_OVERVIEW_CURRENCY = "EUR"

/** Padding around the fetch window so any tz offset (±14h) stays inside it. */
const WINDOW_PADDING_MS = 2 * 24 * 3600 * 1000

/**
 * Load the full "Mi salón" payload for a workspace. Returns `null` when the
 * workspace does not exist (the route turns that into a 404).
 */
export async function loadSalonOverview(
  workspaceId: string,
  preset: OverviewPeriodPreset,
  timezone: string,
  now: Date = new Date(),
): Promise<SalonOverviewPayload | null> {
  const workspace = await getWorkspaceWithResolvedConfig(workspaceId)
  if (!workspace) return null

  // Resolve the period on the VIEWER's calendar day (their tz), then build a
  // padded UTC fetch window around it for the queries; exact membership is
  // re-checked per row in the pure builder with the same tz.
  const todayIso = isoDateInTimezone(now, timezone)
  const period = resolveOverviewPeriod(preset, fromIsoDate(todayIso))
  const fetchStart = new Date(
    new Date(`${period.comparisonStart}T00:00:00Z`).getTime() - WINDOW_PADDING_MS,
  )
  const fetchEnd = new Date(new Date(`${period.end}T00:00:00Z`).getTime() + WINDOW_PADDING_MS)

  const filters = buildOverviewQueryFilters(workspaceId, { fetchStart, fetchEnd })

  const [
    events,
    visitBoundsRaw,
    invoices,
    clients,
    pendingConversationCount,
    anyConversationCount,
    openTasks,
    eventTotal,
    invoiceTotal,
    taskTotal,
  ] = await Promise.all([
    db.evento.findMany({
      where: filters.eventsInWindow,
      select: { id: true, clienteId: true, titulo: true, fechaInicio: true, fechaFin: true },
      orderBy: { fechaInicio: "asc" },
    }),
    db.evento.groupBy({
      by: ["clienteId"],
      where: filters.completedEvents(now),
      _min: { fechaInicio: true },
      _max: { fechaInicio: true },
    }),
    db.factura.findMany({
      where: filters.invoices,
      select: {
        estado: true,
        total: true,
        fechaEmision: true,
        paidAt: true,
        clienteId: true,
      },
    }),
    db.cliente.findMany({
      where: filters.clients,
      select: { id: true, nombre: true, estado: true },
    }),
    db.conversation.count({ where: filters.pendingConversations }),
    db.conversation.count({ where: filters.anyConversation }),
    db.workspaceTask.findMany({
      where: filters.openTasks,
      select: { status: true, priority: true, dueAt: true },
    }),
    db.evento.count({ where: filters.anyEvent }),
    db.factura.count({ where: filters.anyInvoice }),
    db.workspaceTask.count({ where: filters.anyTask }),
  ])

  const visitBounds: OverviewVisitBounds[] = visitBoundsRaw
    .filter((b) => b.clienteId !== null && b._min.fechaInicio !== null && b._max.fechaInicio !== null)
    .map((b) => ({
      clienteId: b.clienteId as string,
      firstVisit: b._min.fechaInicio as Date,
      lastVisit: b._max.fechaInicio as Date,
    }))

  const resolvedConfig = workspace.resolvedConfig as Record<string, unknown>
  const businessProfile =
    typeof resolvedConfig.businessProfile === "object" &&
    resolvedConfig.businessProfile !== null &&
    !Array.isArray(resolvedConfig.businessProfile)
      ? (resolvedConfig.businessProfile as Record<string, unknown>)
      : null
  const currency =
    typeof resolvedConfig.currency === "string" && resolvedConfig.currency.trim() !== ""
      ? resolvedConfig.currency
      : DEFAULT_OVERVIEW_CURRENCY

  return buildRealOverviewPayload({
    workspaceId,
    period,
    timezone,
    now,
    currency,
    events,
    visitBounds,
    invoices,
    clients,
    pendingConversationCount: anyConversationCount > 0 ? pendingConversationCount : null,
    openTasks,
    totals: {
      events: eventTotal,
      invoices: invoiceTotal,
      clients: clients.length,
      tasks: taskTotal,
    },
    businessProfile,
    serviceCatalog: resolvedConfig.serviceCatalog,
  })
}
