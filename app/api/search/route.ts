import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/api"

const MAX_PER_GROUP = 5

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 2) {
      return successResponse({ clientes: [], proyectos: [], tareas: [], facturas: [], documentos: [] })
    }

    const search = q

    const [clientes, proyectos, tareas, facturas, documentos] = await Promise.all([
      db.cliente.findMany({
        where: {
          OR: [
            { nombre: { contains: search } },
            { email: { contains: search } },
            { empresa: { contains: search } },
          ],
        },
        select: { id: true, nombre: true, empresa: true, estado: true },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.proyecto.findMany({
        where: {
          OR: [
            { nombre: { contains: search } },
            { descripcion: { contains: search } },
          ],
        },
        select: { id: true, nombre: true, estado: true, cliente: { select: { nombre: true } } },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.tarea.findMany({
        where: {
          OR: [
            { titulo: { contains: search } },
            { descripcion: { contains: search } },
          ],
        },
        select: {
          id: true, titulo: true, estado: true, prioridad: true,
          proyecto: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.factura.findMany({
        where: {
          OR: [
            { numero: { contains: search } },
          ],
        },
        select: {
          id: true, numero: true, estado: true, total: true,
          cliente: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.documento.findMany({
        where: {
          OR: [
            { nombre: { contains: search } },
            { tipo: { contains: search } },
          ],
        },
        select: {
          id: true, nombre: true, tipo: true, tamano: true,
          proyecto: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { createdAt: "desc" },
      }),
    ])

    return successResponse({ clientes, proyectos, tareas, facturas, documentos })
  } catch (err) {
    return errorResponse("Error en búsqueda", 500)
  }
}
