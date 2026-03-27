/**
 * Tool executor — runs agent tool calls against the database and external APIs.
 */

import { db } from "@/lib/db"
import { generateImage } from "@tools/image-generator"

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  imageUrl?: string
}

export interface ToolExecutionContext {
  workspaceId: string
  userId: string
}

export async function executeToolCall(
  name: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case "buscar_clientes":
        return await searchClientes(args as { search: string }, context)
      case "detalle_cliente":
        return await getClienteDetail(args as { clienteId: string }, context)
      case "detalle_proyecto":
        return await getProyectoDetail(args as { proyectoId: string }, context)
      case "buscar_tareas":
        return await searchTareas(args, context)
      case "buscar_facturas":
        return await searchFacturas(args, context)
      case "crear_contenido":
        return await createContenido(args, context)
      case "crear_idea":
        return await createIdea(args, context)
      case "crear_tarea":
        return await createTarea(args, context)
      case "crear_campana":
        return await createCampana(args, context)
      case "generar_imagen":
        return await handleGenerateImage(args as { prompt: string; size?: string; style?: string })
      default:
        return { success: false, error: `Herramienta desconocida: ${name}` }
    }
  } catch (error) {
    console.error(`[Agent Executor] Error in ${name}:`, error)
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

// ── READ TOOLS ──

async function searchClientes(
  args: { search: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const clientes = await db.cliente.findMany({
    where: {
      workspaceId: context.workspaceId,
      OR: [
        { nombre: { contains: args.search } },
        { email: { contains: args.search } },
        { empresa: { contains: args.search } },
      ],
    },
    take: 10,
    select: { id: true, nombre: true, email: true, telefono: true, empresa: true, notas: true, createdAt: true },
  })
  return { success: true, data: clientes }
}

async function getClienteDetail(
  args: { clienteId: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const cliente = await db.cliente.findFirst({
    where: { id: args.clienteId, workspaceId: context.workspaceId },
    include: {
      proyectos: { select: { id: true, nombre: true, estado: true, prioridad: true } },
      facturas: { select: { id: true, numero: true, estado: true, total: true, fechaEmision: true } },
    },
  })
  if (!cliente) return { success: false, error: "Cliente no encontrado" }
  return { success: true, data: cliente }
}

async function getProyectoDetail(
  args: { proyectoId: string },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const proyecto = await db.proyecto.findFirst({
    where: { id: args.proyectoId, workspaceId: context.workspaceId },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true } },
      tareas: { select: { id: true, titulo: true, estado: true, prioridad: true, fechaLimite: true } },
    },
  })
  if (!proyecto) return { success: false, error: "Proyecto no encontrado" }
  return { success: true, data: proyecto }
}

async function searchTareas(
  args: { estado?: string; prioridad?: string; proyectoId?: string; search?: string; atrasadas?: boolean },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const where: any = { workspaceId: context.workspaceId }
  if (args.estado) where.estado = args.estado
  if (args.prioridad) where.prioridad = args.prioridad
  if (args.proyectoId) where.proyectoId = args.proyectoId
  if (args.search) where.titulo = { contains: args.search }
  if (args.atrasadas) {
    where.fechaLimite = { lt: new Date() }
    where.estado = { not: "completada" }
  }

  const tareas = await db.tarea.findMany({
    where,
    take: 25,
    orderBy: { fechaLimite: "asc" },
    select: { id: true, titulo: true, estado: true, prioridad: true, fechaLimite: true, proyectoId: true, descripcion: true },
  })
  return { success: true, data: tareas }
}

async function searchFacturas(
  args: { estado?: string; clienteId?: string; vencidas?: boolean },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const where: any = { workspaceId: context.workspaceId }
  if (args.estado) where.estado = args.estado
  if (args.clienteId) where.clienteId = args.clienteId
  if (args.vencidas) {
    where.fechaVencimiento = { lt: new Date() }
    where.estado = { not: "pagada" }
  }

  const facturas = await db.factura.findMany({
    where,
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { cliente: { select: { id: true, nombre: true } } },
  })
  return { success: true, data: facturas }
}

// ── WRITE TOOLS ──

async function createContenido(args: any, context: ToolExecutionContext): Promise<ToolResult> {
  const clienteId = await resolveClienteId(args.clienteId, context.workspaceId)
  const proyectoId = await resolveProyectoId(args.proyectoId, context.workspaceId)
  const campaignId = await resolveCampaignId(args.campaignId, context.workspaceId)

  const piece = await db.contentPiece.create({
    data: {
      titulo: args.titulo,
      copy: args.copy || null,
      plataforma: args.plataforma || "instagram",
      tipo: args.tipo || "post",
      estado: args.estado || "borrador",
      hashtags: args.hashtags || null,
      notas: args.notas || null,
      prioridad: args.prioridad || "media",
      campaignId,
      clienteId,
      proyectoId,
      createdBy: context.userId,
      workspaceId: context.workspaceId,
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: piece.id, titulo: piece.titulo, plataforma: piece.plataforma, tipo: piece.tipo, estado: piece.estado } }
}

async function createIdea(args: any, context: ToolExecutionContext): Promise<ToolResult> {
  const clienteId = await resolveClienteId(args.clienteId, context.workspaceId)
  const proyectoId = await resolveProyectoId(args.proyectoId, context.workspaceId)

  const idea = await db.contentIdea.create({
    data: {
      titulo: args.titulo,
      descripcion: args.descripcion || null,
      categoria: args.categoria || null,
      plataforma: args.plataforma || null,
      tags: args.tags || null,
      fuente: "ia",
      clienteId,
      proyectoId,
      createdBy: context.userId,
      workspaceId: context.workspaceId,
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: idea.id, titulo: idea.titulo } }
}

async function createTarea(args: any, context: ToolExecutionContext): Promise<ToolResult> {
  const proyectoId = await resolveProyectoId(args.proyectoId, context.workspaceId)
  const clienteId = await resolveClienteId(args.clienteId, context.workspaceId)

  const tarea = await db.tarea.create({
    data: {
      titulo: args.titulo,
      descripcion: args.descripcion || null,
      estado: args.estado || "pendiente",
      prioridad: args.prioridad || "media",
      proyectoId,
      clienteId,
      workspaceId: context.workspaceId,
      fechaLimite: args.fechaLimite ? new Date(args.fechaLimite) : null,
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: tarea.id, titulo: tarea.titulo, estado: tarea.estado } }
}

async function createCampana(args: any, context: ToolExecutionContext): Promise<ToolResult> {
  const clienteId = await resolveClienteId(args.clienteId, context.workspaceId)
  const proyectoId = await resolveProyectoId(args.proyectoId, context.workspaceId)

  const campaign = await db.campaign.create({
    data: {
      nombre: args.nombre,
      descripcion: args.descripcion || null,
      estado: args.estado || "planificacion",
      marca: args.marca || "general",
      fechaInicio: args.fechaInicio ? new Date(args.fechaInicio) : null,
      fechaFin: args.fechaFin ? new Date(args.fechaFin) : null,
      objetivos: args.objetivos || null,
      clienteId,
      proyectoId,
      createdBy: context.userId,
      workspaceId: context.workspaceId,
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: campaign.id, nombre: campaign.nombre, estado: campaign.estado } }
}

// ── GENERATE TOOLS ──

async function handleGenerateImage(args: { prompt: string; size?: string; style?: string }): Promise<ToolResult> {
  const result = await generateImage(args.prompt, args.size as any, args.style as any)
  return result
}

async function resolveClienteId(clienteId: unknown, workspaceId: string): Promise<string | null> {
  if (!clienteId || typeof clienteId !== "string") return null

  const cliente = await db.cliente.findFirst({
    where: { id: clienteId, workspaceId },
    select: { id: true },
  })

  if (!cliente) {
    throw new Error("Cliente no encontrado en el workspace activo")
  }

  return cliente.id
}

async function resolveProyectoId(proyectoId: unknown, workspaceId: string): Promise<string | null> {
  if (!proyectoId || typeof proyectoId !== "string") return null

  const proyecto = await db.proyecto.findFirst({
    where: { id: proyectoId, workspaceId },
    select: { id: true },
  })

  if (!proyecto) {
    throw new Error("Proyecto no encontrado en el workspace activo")
  }

  return proyecto.id
}

async function resolveCampaignId(campaignId: unknown, workspaceId: string): Promise<string | null> {
  if (!campaignId || typeof campaignId !== "string") return null

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { id: true },
  })

  if (!campaign) {
    throw new Error("Campana no encontrada en el workspace activo")
  }

  return campaign.id
}
