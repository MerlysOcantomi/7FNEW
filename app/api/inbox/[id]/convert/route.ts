import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const entry = await db.inboxEntry.findFirst({ where: { id, workspaceId } })
    if (!entry) return errorResponse("NOT_FOUND", "Entrada no encontrada", 404)

    let datosCliente: Record<string, string> = {}
    let datosProyecto: Record<string, string> = {}
    try {
      if (entry.datosCliente) datosCliente = JSON.parse(entry.datosCliente)
    } catch { /* ignore */ }
    try {
      if (entry.datosProyecto) datosProyecto = JSON.parse(entry.datosProyecto)
    } catch { /* ignore */ }

    const results: Record<string, unknown> = {}

    if (action === "cliente" || action === "todo") {
      const cliente = await db.cliente.create({
        data: {
          nombre: datosCliente.nombre || entry.nombre || "Cliente desde Inbox",
          email: datosCliente.email || entry.email || null,
          telefono: datosCliente.telefono || entry.telefono || null,
          empresa: datosCliente.empresa || null,
          notas: `Origen: Inbox (${entry.fuente})\n${entry.resumen || entry.mensaje.slice(0, 200)}`,
          estado: "activo",
          workspaceId,
        },
      })

      await db.inboxEntry.update({
        where: { id },
        data: { clienteId: cliente.id },
      })

      results.cliente = cliente
    }

    const clienteIdForRelations = entry.clienteId ||
      (results.cliente as { id: string } | undefined)?.id || null

    if (action === "proyecto" || action === "todo") {
      const proyecto = await db.proyecto.create({
        data: {
          nombre: datosProyecto.nombre || entry.resumen || `Proyecto desde Inbox`,
          descripcion: datosProyecto.descripcion || entry.mensaje.slice(0, 500),
          estado: "planificacion",
          prioridad: entry.urgencia === "critica" ? "alta" : entry.urgencia || "media",
          clienteId: clienteIdForRelations,
          workspaceId,
        },
      })

      await db.inboxEntry.update({
        where: { id },
        data: { proyectoId: proyecto.id },
      })

      results.proyecto = proyecto
    }

    if (action === "tarea" || action === "todo") {
      const proyectoId = entry.proyectoId ||
        (results.proyecto as { id: string } | undefined)?.id || null

      const tarea = await db.tarea.create({
        data: {
          titulo: entry.intencion || entry.resumen || `Tarea desde Inbox`,
          descripcion: entry.mensaje.slice(0, 1000),
          estado: "pendiente",
          prioridad: entry.urgencia === "critica" ? "urgente" : entry.urgencia || "media",
          clienteId: clienteIdForRelations,
          proyectoId,
          workspaceId,
        },
      })

      await db.inboxEntry.update({
        where: { id },
        data: { tareaId: tarea.id },
      })

      results.tarea = tarea
    }

    await db.inboxEntry.update({
      where: { id },
      data: {
        estado: "procesado",
        processedAt: new Date(),
      },
    })

    return successResponse(results)
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}
