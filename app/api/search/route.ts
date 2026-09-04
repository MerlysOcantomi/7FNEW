import { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { searchContains } from "@core/db-search"

const MAX_PER_GROUP = 5
const MAX_TOKENS = 4

function tokenize(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, MAX_TOKENS)
}

const EMPTY_PAYLOAD = {
  clientes: [],
  proyectos: [],
  tareas: [],
  facturas: [],
  documentos: [],
  notas: [],
  archivos: [],
  conversations: [],
  workspaceTasks: [],
  eventos: [],
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const q = request.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 2) {
      return successResponse(EMPTY_PAYLOAD)
    }

    const search = q
    const tokens = tokenize(search)
    const useMultiTokenAnd = tokens.length > 1

    const clienteWhere: Prisma.ClienteWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { nombre: searchContains(t) },
                { email: searchContains(t) },
                { empresa: searchContains(t) },
                { telefono: searchContains(t) },
              ],
            })),
          }
        : {
            OR: [
              { nombre: searchContains(search) },
              { email: searchContains(search) },
              { empresa: searchContains(search) },
              { telefono: searchContains(search) },
            ],
          }),
    }

    const proyectoWhere: Prisma.ProyectoWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ nombre: searchContains(t) }, { descripcion: searchContains(t) }],
            })),
          }
        : {
            OR: [{ nombre: searchContains(search) }, { descripcion: searchContains(search) }],
          }),
    }

    const tareaWhere: Prisma.TareaWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ titulo: searchContains(t) }, { descripcion: searchContains(t) }],
            })),
          }
        : {
            OR: [{ titulo: searchContains(search) }, { descripcion: searchContains(search) }],
          }),
    }

    const facturaWhere: Prisma.FacturaWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { numero: searchContains(t) },
                { items: searchContains(t) },
                { cliente: { is: { nombre: searchContains(t) } } },
              ],
            })),
          }
        : {
            OR: [
              { numero: searchContains(search) },
              { items: searchContains(search) },
              { cliente: { is: { nombre: searchContains(search) } } },
            ],
          }),
    }

    const documentoWhere: Prisma.DocumentoWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ nombre: searchContains(t) }, { tipo: searchContains(t) }],
            })),
          }
        : {
            OR: [{ nombre: searchContains(search) }, { tipo: searchContains(search) }],
          }),
    }

    const notaWhere: Prisma.NotaWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ titulo: searchContains(t) }, { contenido: searchContains(t) }],
            })),
          }
        : {
            OR: [{ titulo: searchContains(search) }, { contenido: searchContains(search) }],
          }),
    }

    const archivoWhere: Prisma.AttachmentWhereInput =
      useMultiTokenAnd
        ? { AND: tokens.map((t) => ({ nombre: searchContains(t) })) }
        : { nombre: searchContains(search) }

    const conversationWhere: Prisma.ConversationWhereInput = {
      workspaceId,
      trashedAt: null,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { subject: searchContains(t) },
                { summary: searchContains(t) },
                { category: searchContains(t) },
                {
                  contact: {
                    OR: [
                      { nombre: searchContains(t) },
                      { email: searchContains(t) },
                      { empresa: searchContains(t) },
                    ],
                  },
                },
              ],
            })),
          }
        : {
            OR: [
              { subject: searchContains(search) },
              { summary: searchContains(search) },
              { category: searchContains(search) },
              {
                contact: {
                  OR: [
                    { nombre: searchContains(search) },
                    { email: searchContains(search) },
                    { empresa: searchContains(search) },
                  ],
                },
              },
            ],
          }),
    }

    const workspaceTaskWhere: Prisma.WorkspaceTaskWhereInput = {
      workspaceId,
      dismissedAt: null,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { title: searchContains(t) },
                { description: searchContains(t) },
                { sourceLabel: searchContains(t) },
              ],
            })),
          }
        : {
            OR: [
              { title: searchContains(search) },
              { description: searchContains(search) },
              { sourceLabel: searchContains(search) },
            ],
          }),
    }

    const eventoWhere: Prisma.EventoWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ titulo: searchContains(t) }, { descripcion: searchContains(t) }],
            })),
          }
        : {
            OR: [{ titulo: searchContains(search) }, { descripcion: searchContains(search) }],
          }),
    }

    const [
      clientes,
      proyectos,
      tareas,
      facturas,
      documentos,
      notas,
      archivos,
      conversations,
      workspaceTasks,
      eventos,
    ] = await Promise.all([
      db.cliente.findMany({
        where: clienteWhere,
        select: { id: true, nombre: true, empresa: true, estado: true },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.proyecto.findMany({
        where: proyectoWhere,
        select: {
          id: true,
          nombre: true,
          estado: true,
          cliente: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.tarea.findMany({
        where: tareaWhere,
        select: {
          id: true,
          titulo: true,
          estado: true,
          prioridad: true,
          proyecto: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.factura.findMany({
        where: facturaWhere,
        select: {
          id: true,
          numero: true,
          estado: true,
          total: true,
          cliente: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.documento.findMany({
        where: documentoWhere,
        select: {
          id: true,
          nombre: true,
          tipo: true,
          tamano: true,
          proyecto: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { createdAt: "desc" },
      }),

      db.nota.findMany({
        where: notaWhere,
        select: {
          id: true,
          titulo: true,
          clienteId: true,
          proyectoId: true,
          cliente: { select: { nombre: true } },
          proyecto: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { updatedAt: "desc" },
      }),

      db.attachment.findMany({
        where: { workspaceId, ...archivoWhere },
        select: { id: true, nombre: true, module: true, recordId: true },
        take: MAX_PER_GROUP,
        orderBy: { createdAt: "desc" },
      }),

      db.conversation.findMany({
        where: conversationWhere,
        select: {
          id: true,
          channel: true,
          status: true,
          subject: true,
          summary: true,
          lastMessageAt: true,
          category: true,
          contact: { select: { nombre: true, email: true, empresa: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { lastMessageAt: "desc" },
      }),

      db.workspaceTask.findMany({
        where: workspaceTaskWhere,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueAt: true,
          conversationId: true,
          clienteId: true,
          proyectoId: true,
          completedAt: true,
          sourceLabel: true,
        },
        take: MAX_PER_GROUP,
        orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
      }),

      db.evento.findMany({
        where: eventoWhere,
        select: {
          id: true,
          titulo: true,
          tipo: true,
          fechaInicio: true,
          cliente: { select: { nombre: true } },
        },
        take: MAX_PER_GROUP,
        orderBy: { fechaInicio: "desc" },
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
      conversations,
      workspaceTasks,
      eventos,
    })
  } catch (err) {
    return errorResponse("SEARCH_ERROR", "Error en búsqueda", (err as { status?: number })?.status || 500)
  }
}
