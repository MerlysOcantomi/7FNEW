/**
 * Beauty "Hoy" — REAL data aggregation (server side).
 *
 * Option chosen (mission 7F-P01.B3, Bloque C): a Beauty aggregator ON TOP of
 * existing sources — NOT a parallel implementation:
 *   - tasks come from `aggregateToday(...)` itself (the exact service behind
 *     `/api/today`), so the Beauty surface and the work-first workboard read
 *     the SAME bucket reality (visibility rules, dedup, tz handling) and can
 *     never contradict each other;
 *   - the agenda re-queries today's citas WITH their `Cliente` (the
 *     `TodayItem` event shape deliberately carries no client link) using the
 *     SAME `startOfDayInTZ` window the aggregator uses;
 *   - messages/collections reuse the overview's filter semantics
 *     (`Conversation.status = "new"`, `Factura.estado enviada|vencida`).
 *
 * Multi-tenant safety: every extra `where` comes from
 * `buildBeautyTodayQueryFilters(workspaceId)` in the pure module, asserted by
 * `beauty-real.test.ts`; `workspaceId`/`userId` always arrive from
 * `requireReadAccess` at the route boundary.
 */

import { db } from "@core/db"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { aggregateToday, startOfDayInTZ } from "./aggregator"
import {
  buildAppointments,
  buildBeautyTodayQueryFilters,
  categorizeBeautyActions,
  computeGaps,
  findNextAppointment,
  type BeautyEventRow,
  type BeautyTaskEnrichment,
  type BeautyTodayPayload,
} from "./beauty-real"

function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Viewer-local `yyyy-mm-dd` of an instant (en-CA gives ISO ordering). */
function isoDateInTimezone(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
}

export async function loadBeautyToday(input: {
  workspaceId: string
  userId: string
  timezone: string
  now?: Date
}): Promise<BeautyTodayPayload> {
  const tz = isValidTimezone(input.timezone) ? input.timezone : "UTC"
  const now = input.now ?? new Date()

  const startOfToday = startOfDayInTZ(now, tz)
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
  const filters = buildBeautyTodayQueryFilters(input.workspaceId, {
    startOfToday,
    startOfTomorrow,
  })

  // The workboard's own reality (tasks + events buckets) — same service,
  // same rows, same visibility rules as GET /api/today.
  const [workspace, payload, citas, anyCitaCount, pendingConversations, anyConversationCount, overdue, pending, anyInvoiceCount] =
    await Promise.all([
      getWorkspaceWithResolvedConfig(input.workspaceId),
      aggregateToday({
        workspaceId: input.workspaceId,
        userId: input.userId,
        timezone: tz,
        now,
      }),
      db.evento.findMany({
        where: filters.todayCitas,
        select: {
          id: true,
          titulo: true,
          fechaInicio: true,
          fechaFin: true,
          clienteId: true,
          cliente: { select: { nombre: true } },
        },
        orderBy: { fechaInicio: "asc" },
      }),
      db.evento.count({ where: filters.anyCita }),
      db.conversation.count({ where: filters.pendingConversations }),
      db.conversation.count({ where: filters.anyConversation }),
      db.factura.aggregate({
        where: filters.overdueInvoices,
        _count: true,
        _sum: { total: true },
      }),
      db.factura.aggregate({
        where: filters.pendingInvoices,
        _count: true,
        _sum: { total: true },
      }),
      db.factura.count({ where: filters.anyInvoice }),
    ])

  // Enrich the workboard's WorkspaceTask rows with their links so every
  // suggested/urgent action can state the real fact it rests on.
  const taskIds = [...payload.buckets.overdue, ...payload.buckets.today, ...payload.buckets.undated]
    .filter((item) => item.kind === "task" && item.id.startsWith("task:"))
    .map((item) => item.id.slice("task:".length))

  const taskRows =
    taskIds.length > 0
      ? await db.workspaceTask.findMany({
          where: filters.taskEnrichment(taskIds),
          select: {
            id: true,
            sourceLabel: true,
            clienteId: true,
            eventoId: true,
            conversationId: true,
          },
        })
      : []

  const clientIds = new Set<string>()
  for (const row of taskRows) if (row.clienteId) clientIds.add(row.clienteId)
  for (const cita of citas) if (cita.clienteId) clientIds.add(cita.clienteId)

  const clientRows =
    clientIds.size > 0
      ? await db.cliente.findMany({
          where: { workspaceId: input.workspaceId, id: { in: [...clientIds] } },
          select: { id: true, nombre: true },
        })
      : []

  const enrichment: BeautyTaskEnrichment = {
    byTaskId: new Map(
      taskRows.map((row) => [
        row.id,
        {
          sourceLabel: row.sourceLabel,
          clienteId: row.clienteId,
          eventoId: row.eventoId,
          conversationId: row.conversationId,
        },
      ]),
    ),
    clientNames: new Map(clientRows.map((row) => [row.id, row.nombre])),
  }

  const eventRows: BeautyEventRow[] = citas.map((cita) => ({
    id: cita.id,
    titulo: cita.titulo,
    fechaInicio: cita.fechaInicio,
    fechaFin: cita.fechaFin,
    clienteId: cita.clienteId,
    clienteNombre: cita.cliente?.nombre ?? null,
  }))

  const appointments = buildAppointments(eventRows, now)
  const actions = categorizeBeautyActions(payload.buckets, enrichment)

  const hasTasks =
    actions.urgent.length > 0 || actions.suggested.length > 0 || actions.otherOpenTaskCount > 0
  const hasFinance = anyInvoiceCount > 0

  const resolvedConfig = (workspace?.resolvedConfig ?? {}) as Record<string, unknown>
  const currency =
    typeof resolvedConfig.currency === "string" && resolvedConfig.currency.trim() !== ""
      ? resolvedConfig.currency
      : "EUR"

  return {
    date: isoDateInTimezone(now, tz),
    timezone: tz,
    generatedAt: now.toISOString(),
    currency,
    nextAppointment: findNextAppointment(appointments, now),
    appointments,
    gaps: computeGaps(appointments, now),
    urgentActions: actions.urgent,
    suggestedActions: actions.suggested,
    otherOpenTaskCount: actions.otherOpenTaskCount,
    pendingConversations: anyConversationCount > 0 ? pendingConversations : null,
    overdueInvoices: hasFinance
      ? { count: overdue._count, amount: Math.round((overdue._sum.total ?? 0) * 100) / 100 }
      : null,
    pendingInvoices: hasFinance
      ? { count: pending._count, amount: Math.round((pending._sum.total ?? 0) * 100) / 100 }
      : null,
    dataQuality: {
      appointments: anyCitaCount > 0,
      tasks: hasTasks,
      conversations: anyConversationCount > 0,
      finance: hasFinance,
    },
    source: "real",
  }
}
