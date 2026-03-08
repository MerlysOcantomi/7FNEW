import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

const MAX_PER_GROUP = 5

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const q = request.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 2) {
      return successResponse({
        clientes: [],
        proyectos: [],
        tareas: [],
        facturas: [],
        documentos: [],
        notas: [],
        archivos: [],
      })
    }

    const search = q

    const [clientes, proyectos, tareas, facturas, documentos, notas, archivos] = await Promise.all([
      db.cliente.findMany({
        where: {
          workspaceId,
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
          workspaceId,
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
          workspaceId,
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
          workspaceId,
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
          workspaceId,
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

      db.nota.findMany({
        where: {
          workspaceId,
          OR: [
            { titulo: { contains: search } },
            { contenido: { contains: search } },
          ],
        },
        select: {
          id: true, titulo: true, clienteId: true, proyectoId: true,
          cliente: { select: { nombre: true } },
          proyecto: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.attachment.findMany({
        where: {
          workspaceId,
          nombre: { contains: search },
        },
        select: {
          id: true, nombre: true, module: true, recordId: true,
        },
        take: MAX_PER_GROUP,
        orderBy: { createdAt: "desc" },
      }),
    ])

    return successResponse({
      clientes,
      proyectos,
      tareas,
      facturas,
      documentos,
      notas,
      archivos,
    })
  } catch (err) {
    return errorResponse("SEARCH_ERROR", "Error en búsqueda", (err as { status?: number })?.status || 500)
  }
}
