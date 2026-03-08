import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    // KPIs
    const [
      totalClientes,
      proyectosActivos,
      proyectosAtrasados,
      tareasVencidas,
      facturasPendientesCount,
      facturasPendientesAgg,
      facturacionMesAgg,
      ingresosMesAgg,
      gastosMesAgg,
      activities,
      overdueTasks,
      overdueInvoices,
      nearDeadlineProjects,
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
          estado: { in: ["enviada", "vencida"] },
        },
        _sum: { total: true },
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
      db.activity.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      db.tarea.findMany({
        where: {
          workspaceId,
          fechaLimite: { lt: now },
          estado: { notIn: ["completada", "cancelada"] },
        },
        take: 5,
        orderBy: { fechaLimite: "asc" },
      }),
      db.factura.findMany({
        where: {
          workspaceId,
          estado: "vencida",
        },
        take: 5,
        orderBy: { fechaVencimiento: "asc" },
        include: { cliente: true },
      }),
      db.proyecto.findMany({
        where: {
          workspaceId,
          fechaFin: { gte: now, lte: sevenDaysFromNow },
          estado: { in: ["en_progreso", "planificacion"] },
        },
        take: 5,
        orderBy: { fechaFin: "asc" },
        include: { cliente: true },
      }),
    ])

    const facturacionMes = facturacionMesAgg._sum.total ?? 0
    const ingresosMes = ingresosMesAgg._sum.monto ?? 0
    const gastosMes = gastosMesAgg._sum.monto ?? 0
    const montoFacturasPendientes = facturasPendientesAgg._sum.total ?? 0

    const activityFormatted = activities.map((a) => {
      const data = a.data ? JSON.parse(a.data) : null
      let label = ""
      let detalle = ""
      switch (a.type) {
        case "created":
          label = "Creado"
          detalle = data?.label ?? `${a.module}`
          break
        case "comment":
          label = "Comentario"
          detalle = data?.comment?.slice(0, 80) ?? "Comentario agregado"
          break
        case "updated":
          label = "Actualizado"
          detalle = data?.label ?? data?.changes ? "Cambios realizados" : `${a.module}`
          break
        case "deleted":
          label = "Eliminado"
          detalle = data?.label ?? `${a.module}`
          break
        case "status_change":
          label = "Cambio de estado"
          detalle = data?.field
            ? `${data.field}: ${data.oldValue} → ${data.newValue}`
            : "Estado actualizado"
          break
        default:
          label = a.type
          detalle = data?.label ?? a.module
      }
      return {
        id: a.id,
        module: a.module,
        recordId: a.recordId,
        type: a.type,
        label,
        detalle,
        userName: a.userName,
        createdAt: a.createdAt,
      }
    })

    const kpis = {
      totalClientes,
      proyectosActivos,
      proyectosEnRiesgo: proyectosAtrasados,
      tareasVencidas,
      facturasPendientes: facturasPendientesCount,
      facturacionMes,
      ingresosMes,
      gastosMes,
    }

    const finance = {
      ingresosMes,
      gastosMes,
      facturasPendientes: facturasPendientesCount,
      montoFacturasPendientes,
      desviacion: null as number | null,
    }

    const alerts = {
      overdueTasks,
      overdueInvoices,
      nearDeadlineProjects,
    }

    return successResponse({
      kpis,
      activity: activityFormatted,
      finance,
      alerts,
    })
  } catch (error) {
    return handleError(error, "Dashboard")
  }
}
