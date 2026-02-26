import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { db } from "@/lib/db"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const view = searchParams.get("view") ?? "month"
    const dateStr = searchParams.get("date") ?? new Date().toISOString().slice(0, 10)

    const baseDate = new Date(dateStr + "T00:00:00.000Z")
    if (isNaN(baseDate.getTime())) {
      return errorResponse("VALIDATION_ERROR", "Fecha invalida. Use formato YYYY-MM-DD")
    }

    let rangeStart: Date
    let rangeEnd: Date

    switch (view) {
      case "day":
        rangeStart = new Date(baseDate)
        rangeEnd = new Date(baseDate)
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)
        break
      case "week": {
        const day = baseDate.getUTCDay()
        rangeStart = new Date(baseDate)
        rangeStart.setUTCDate(rangeStart.getUTCDate() - ((day + 6) % 7))
        rangeEnd = new Date(rangeStart)
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7)
        break
      }
      case "month":
      default: {
        rangeStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1))
        rangeEnd = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1))
        break
      }
    }

    const [tareas, proyectos, facturas, eventos] = await Promise.all([
      db.tarea.findMany({
        where: {
          workspaceId,
          fechaLimite: { gte: rangeStart, lt: rangeEnd },
        },
        include: { proyecto: true, cliente: true, usuario: true },
        orderBy: { fechaLimite: "asc" },
      }),
      db.proyecto.findMany({
        where: {
          workspaceId,
          OR: [
            { fechaInicio: { gte: rangeStart, lt: rangeEnd } },
            { fechaFin: { gte: rangeStart, lt: rangeEnd } },
            {
              AND: [
                { fechaInicio: { lt: rangeEnd } },
                { fechaFin: { gte: rangeStart } },
              ],
            },
          ],
        },
        include: { cliente: true },
        orderBy: { fechaInicio: "asc" },
      }),
      db.factura.findMany({
        where: {
          workspaceId,
          fechaVencimiento: { gte: rangeStart, lt: rangeEnd },
        },
        include: { cliente: true },
        orderBy: { fechaVencimiento: "asc" },
      }),
      db.evento.findMany({
        where: {
          workspaceId,
          fechaInicio: { gte: rangeStart, lt: rangeEnd },
        },
        include: { cliente: true, proyecto: true },
        orderBy: { fechaInicio: "asc" },
      }),
    ])

    return successResponse({
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      view,
      tareas,
      proyectos,
      facturas: facturas.map((f) => ({ ...f, items: JSON.parse(f.items) })),
      eventos,
    })
  } catch (error) {
    console.error("[7F Calendario] Feed error:", error)
    return errorResponse("INTERNAL_ERROR", "Error al cargar calendario", (error as { status?: number })?.status || 500)
  }
}
