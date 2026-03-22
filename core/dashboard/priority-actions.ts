import { db } from "@core/db"
import type { DashboardPriorityAction } from "./types"

type PriorityCandidate = {
  action: DashboardPriorityAction
  dedupeKey: string
}

function scorePriority(severity: DashboardPriorityAction["severity"], value: number, impact = 0) {
  const base =
    severity === "critical" ? 100 :
    severity === "high" ? 70 :
    severity === "medium" ? 40 :
    0

  return base + Math.min(value, 10) + impact
}

export async function getDashboardPriorityActions(
  workspaceId: string,
  now = new Date(),
  limit = 3,
): Promise<DashboardPriorityAction[]> {
  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const [overdueProjectsCount, nearDeadlineProjectsCount, overdueTasksCount, overdueInvoices, pendingInvoices] =
    await Promise.all([
      db.proyecto.count({
        where: {
          workspaceId,
          fechaFin: { lt: now },
          estado: { not: "completado" },
        },
      }),
      db.proyecto.count({
        where: {
          workspaceId,
          fechaFin: { gte: now, lte: sevenDaysFromNow },
          estado: { in: ["en_progreso", "planificacion"] },
        },
      }),
      db.tarea.count({
        where: {
          workspaceId,
          fechaLimite: { lt: now },
          estado: { notIn: ["completada", "cancelada"] },
        },
      }),
      db.factura.aggregate({
        where: {
          workspaceId,
          estado: "vencida",
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      db.factura.aggregate({
        where: {
          workspaceId,
          estado: { in: ["enviada", "vencida"] },
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ])

  const candidates: PriorityCandidate[] = []
  const detectedAt = now.toISOString()

  if (overdueProjectsCount > 0) {
    candidates.push({
      dedupeKey: "project-risk",
      action: {
        id: "projects-at-risk",
        kind: "project-risk",
        severity: "critical",
        title: "Projects at risk",
        value: overdueProjectsCount,
        summary: "Review ownership, scope, and timing before delivery slips further.",
        href: "/proyectos",
        sourceModule: "projects",
        score: scorePriority("critical", overdueProjectsCount, 10),
        detectedAt,
      },
    })
  } else if (nearDeadlineProjectsCount > 0) {
    candidates.push({
      dedupeKey: "project-risk",
      action: {
        id: "projects-near-deadline",
        kind: "project-risk",
        severity: "medium",
        title: "Projects nearing deadline",
        value: nearDeadlineProjectsCount,
        summary: "Review timeline risk before the next delivery window closes.",
        href: "/proyectos",
        sourceModule: "projects",
        score: scorePriority("medium", nearDeadlineProjectsCount, 4),
        detectedAt,
      },
    })
  }

  if (overdueTasksCount > 0) {
    candidates.push({
      dedupeKey: "task-overdue",
      action: {
        id: "overdue-tasks",
        kind: "task-overdue",
        severity: "high",
        title: "Overdue tasks",
        value: overdueTasksCount,
        summary: "Resolve the blocked work first to keep delivery moving.",
        href: "/tareas",
        sourceModule: "tasks",
        score: scorePriority("high", overdueTasksCount, 6),
        detectedAt,
      },
    })
  }

  const overdueInvoicesCount = overdueInvoices._count._all ?? 0
  const overdueInvoicesAmount = overdueInvoices._sum.total ?? 0
  if (overdueInvoicesCount > 0) {
    candidates.push({
      dedupeKey: "invoice-status",
      action: {
        id: "overdue-invoices",
        kind: "invoice-overdue",
        severity: "critical",
        title: "Overdue invoices",
        value: overdueInvoicesCount,
        summary: `${overdueInvoicesAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })} requires collection follow-up.`,
        href: "/facturacion",
        sourceModule: "billing",
        score: scorePriority("critical", overdueInvoicesCount, overdueInvoicesAmount > 0 ? 8 : 0),
        detectedAt,
      },
    })
  } else {
    const pendingInvoicesCount = pendingInvoices._count._all ?? 0
    const pendingInvoicesAmount = pendingInvoices._sum.total ?? 0
    if (pendingInvoicesCount > 0) {
      candidates.push({
        dedupeKey: "invoice-status",
        action: {
          id: "pending-invoices",
          kind: "invoice-pending",
          severity: "high",
          title: "Pending invoices",
          value: pendingInvoicesCount,
          summary: `${pendingInvoicesAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })} is still waiting to be collected.`,
          href: "/facturacion",
          sourceModule: "billing",
          score: scorePriority("high", pendingInvoicesCount, pendingInvoicesAmount > 0 ? 5 : 0),
          detectedAt,
        },
      })
    }
  }

  const deduped = new Map<string, DashboardPriorityAction>()
  for (const candidate of candidates.sort((a, b) => b.action.score - a.action.score)) {
    if (!deduped.has(candidate.dedupeKey)) {
      deduped.set(candidate.dedupeKey, candidate.action)
    }
  }

  const actions = Array.from(deduped.values()).sort((a, b) => b.score - a.score).slice(0, Math.min(limit, 5))

  if (actions.length > 0) {
    return actions
  }

  return [
    {
      id: "workspace-stable",
      kind: "workspace-stable",
      severity: "positive",
      title: "Workspace is on track",
      value: 0,
      summary: "No urgent delivery or billing issues were detected for this workspace.",
      href: "/",
      sourceModule: "system",
      score: 0,
      detectedAt,
    },
  ]
}
