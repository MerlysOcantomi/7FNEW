import { db } from "@core/db"
import type { DashboardFinanceSummary } from "./types"

export async function getDashboardFinanceSummary(
  workspaceId: string,
  now = new Date(),
): Promise<DashboardFinanceSummary> {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [pendingInvoicesAgg, pendingInvoicesCount, billedThisMonthAgg, revenueMonthAgg, expensesMonthAgg] =
    await Promise.all([
      db.factura.aggregate({
        where: {
          workspaceId,
          estado: { in: ["enviada", "vencida"] },
        },
        _sum: { total: true },
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
    billedThisMonth: billedThisMonthAgg._sum.total ?? 0,
    revenueMonth: revenueMonthAgg._sum.monto ?? 0,
    expensesMonth: expensesMonthAgg._sum.monto ?? 0,
    pendingInvoicesCount,
    pendingInvoicesAmount: pendingInvoicesAgg._sum.total ?? 0,
    budgetVariancePct: null,
  }
}
