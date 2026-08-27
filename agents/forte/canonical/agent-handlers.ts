/**
 * AI-06 — Canonical agent tool handlers (execution code only).
 *
 * These are the READ operations the legacy agent executor performed,
 * re-expressed behind canonical ToolKey inputs (English field names from the
 * canonical input schemas; the Spanish column names below are private
 * storage details). Every query is scoped to `context.workspaceId`, which
 * comes exclusively from the authenticated server context — never from tool
 * input.
 *
 * READ-ONLY: no handler here persists anything. Write tools follow the
 * canonical `confirmation_required` policy and stay unbound until a trusted
 * confirmation contract exists (see `agent-bindings.ts`).
 *
 * No authorization here: FOUND-03 authorization + canonical input validation
 * happen in the agent loop BEFORE a handler runs. Handlers must stay thin.
 */

import { db } from "@/lib/db"
import type { ToolExecutionContext } from "@core/platform/tool-definition"

// ── READ ──

export async function searchClient(
  input: { query: string; limit?: number },
  context: ToolExecutionContext,
) {
  const clientes = await db.cliente.findMany({
    where: {
      workspaceId: context.workspaceId,
      OR: [
        { nombre: { contains: input.query } },
        { email: { contains: input.query } },
        { empresa: { contains: input.query } },
      ],
    },
    take: input.limit ?? 10,
    select: { id: true, nombre: true, email: true, telefono: true, empresa: true, notas: true },
  })
  return {
    results: clientes.map((cliente) => ({
      personId: cliente.id,
      displayName: cliente.nombre,
      email: cliente.email ?? undefined,
      phone: cliente.telefono ?? undefined,
      company: cliente.empresa ?? undefined,
      notes: cliente.notas ?? undefined,
    })),
  }
}

export async function getClient(input: { clientId: string }, context: ToolExecutionContext) {
  const cliente = await db.cliente.findFirst({
    where: { id: input.clientId, workspaceId: context.workspaceId },
    include: {
      proyectos: { select: { id: true, nombre: true, estado: true, prioridad: true } },
      facturas: { select: { id: true, numero: true, estado: true, total: true, fechaEmision: true } },
    },
  })
  if (!cliente) throw new Error("Cliente no encontrado")
  return { client: cliente }
}

export async function searchTask(
  input: {
    status?: string
    priority?: string
    projectId?: string
    query?: string
    overdue?: boolean
  },
  context: ToolExecutionContext,
) {
  const where: Record<string, unknown> = { workspaceId: context.workspaceId }
  if (input.status) where.estado = input.status
  if (input.priority) where.prioridad = input.priority
  if (input.projectId) where.proyectoId = input.projectId
  if (input.query) where.titulo = { contains: input.query }
  if (input.overdue) {
    where.fechaLimite = { lt: new Date() }
    where.estado = { not: "completada" }
  }

  const tareas = await db.tarea.findMany({
    where,
    take: 25,
    orderBy: { fechaLimite: "asc" },
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      fechaLimite: true,
      proyectoId: true,
      descripcion: true,
    },
  })
  return { results: tareas }
}

export async function searchInvoice(
  input: { status?: string; clientId?: string; overdue?: boolean },
  context: ToolExecutionContext,
) {
  const where: Record<string, unknown> = { workspaceId: context.workspaceId }
  if (input.status) where.estado = input.status
  if (input.clientId) where.clienteId = input.clientId
  if (input.overdue) {
    where.fechaVencimiento = { lt: new Date() }
    where.estado = { not: "pagada" }
  }

  const facturas = await db.factura.findMany({
    where,
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { cliente: { select: { id: true, nombre: true } } },
  })
  return { results: facturas }
}
