import { db } from "@core/db"
import type { DashboardModulesSummary } from "./types"

export async function getDashboardModulesSummary(
  workspaceId: string,
  now = new Date(),
): Promise<DashboardModulesSummary> {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [
    totalClients,
    activeProjects,
    atRiskProjects,
    overdueTasks,
    pendingInvoices,
    billedThisMonthAgg,
    revenueMonthAgg,
    expensesMonthAgg,
  ] = await Promise.all([
    db.cliente.count({ where: { workspaceId } }),
    db.proyecto.count({
      where: {
        workspaceId,
        estado: { in: ["en_progreso", "planificacion", "revision"] },
      },
    }),
    db.proyecto.count({
      where: {
        workspaceId,
        fechaFin: { lt: now },
        estado: { not: "completado" },
      },
    }),
    db.tarea.count({
      where: {
        workspaceId,
        fechaLimite: { lt: now },
        estado: { notIn: ["completada", "cancelada"] },
      },
    }),
    db.factura.count({
      where: {
        workspaceId,
        estado: { in: ["enviada", "vencida"] },
      },
    }),
    db.factura.aggregate({
      where: {
        workspaceId,
        fechaEmision: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { total: true },
    }),
    db.transaccion.aggregate({
      where: {
        workspaceId,
        tipo: "ingreso",
        fecha: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { monto: true },
    }),
    db.transaccion.aggregate({
      where: {
        workspaceId,
        tipo: "gasto",
        fecha: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { monto: true },
    }),
  ])

  return {
    totalClients,
    activeProjects,
    atRiskProjects,
    overdueTasks,
    pendingInvoices,
    billedThisMonth: billedThisMonthAgg._sum.total ?? 0,
    revenueThisMonth: revenueMonthAgg._sum.monto ?? 0,
    expensesThisMonth: expensesMonthAgg._sum.monto ?? 0,
  }
}
