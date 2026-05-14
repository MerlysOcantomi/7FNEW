import { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

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
                { nombre: { contains: t } },
                { email: { contains: t } },
                { empresa: { contains: t } },
                { telefono: { contains: t } },
              ],
            })),
          }
        : {
            OR: [
              { nombre: { contains: search } },
              { email: { contains: search } },
              { empresa: { contains: search } },
              { telefono: { contains: search } },
            ],
          }),
    }

    const proyectoWhere: Prisma.ProyectoWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ nombre: { contains: t } }, { descripcion: { contains: t } }],
            })),
          }
        : {
            OR: [{ nombre: { contains: search } }, { descripcion: { contains: search } }],
          }),
    }

    const tareaWhere: Prisma.TareaWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ titulo: { contains: t } }, { descripcion: { contains: t } }],
            })),
          }
        : {
            OR: [{ titulo: { contains: search } }, { descripcion: { contains: search } }],
          }),
    }

    const facturaWhere: Prisma.FacturaWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { numero: { contains: t } },
                { items: { contains: t } },
                { cliente: { is: { nombre: { contains: t } } } },
              ],
            })),
          }
        : {
            OR: [
              { numero: { contains: search } },
              { items: { contains: search } },
              { cliente: { is: { nombre: { contains: search } } } },
            ],
          }),
    }

    const documentoWhere: Prisma.DocumentoWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ nombre: { contains: t } }, { tipo: { contains: t } }],
            })),
          }
        : {
            OR: [{ nombre: { contains: search } }, { tipo: { contains: search } }],
          }),
    }

    const notaWhere: Prisma.NotaWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ titulo: { contains: t } }, { contenido: { contains: t } }],
            })),
          }
        : {
            OR: [{ titulo: { contains: search } }, { contenido: { contains: search } }],
          }),
    }

    const archivoWhere: Prisma.AttachmentWhereInput =
      useMultiTokenAnd
        ? { AND: tokens.map((t) => ({ nombre: { contains: t } })) }
        : { nombre: { contains: search } }

    const conversationWhere: Prisma.ConversationWhereInput = {
      workspaceId,
      trashedAt: null,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { subject: { contains: t } },
                { summary: { contains: t } },
                { category: { contains: t } },
                {
                  contact: {
                    OR: [
                      { nombre: { contains: t } },
                      { email: { contains: t } },
                      { empresa: { contains: t } },
                    ],
                  },
                },
              ],
            })),
          }
        : {
            OR: [
              { subject: { contains: search } },
              { summary: { contains: search } },
              { category: { contains: search } },
              {
                contact: {
                  OR: [
                    { nombre: { contains: search } },
                    { email: { contains: search } },
                    { empresa: { contains: search } },
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
                { title: { contains: t } },
                { description: { contains: t } },
                { sourceLabel: { contains: t } },
              ],
            })),
          }
        : {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { sourceLabel: { contains: search } },
            ],
          }),
    }

    const eventoWhere: Prisma.EventoWhereInput = {
      workspaceId,
      ...(useMultiTokenAnd
        ? {
            AND: tokens.map((t) => ({
              OR: [{ titulo: { contains: t } }, { descripcion: { contains: t } }],
            })),
          }
        : {
            OR: [{ titulo: { contains: search } }, { descripcion: { contains: search } }],
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
