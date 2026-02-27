/**
 * Tool executor — runs agent tool calls against the database and external APIs.
 */

import { db } from "@/lib/db"
import { generateImage } from "@/lib/agent/image-generator"

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  imageUrl?: string
}

export async function executeToolCall(name: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    switch (name) {
      case "buscar_clientes":
        return await searchClientes(args as { search: string })
      case "detalle_cliente":
        return await getClienteDetail(args as { clienteId: string })
      case "detalle_proyecto":
        return await getProyectoDetail(args as { proyectoId: string })
      case "buscar_tareas":
        return await searchTareas(args)
      case "buscar_facturas":
        return await searchFacturas(args)
      case "crear_contenido":
        return await createContenido(args)
      case "crear_idea":
        return await createIdea(args)
      case "crear_tarea":
        return await createTarea(args)
      case "crear_campana":
        return await createCampana(args)
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

async function searchClientes(args: { search: string }): Promise<ToolResult> {
  const clientes = await db.cliente.findMany({
    where: {
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

async function getClienteDetail(args: { clienteId: string }): Promise<ToolResult> {
  const cliente = await db.cliente.findUnique({
    where: { id: args.clienteId },
    include: {
      proyectos: { select: { id: true, nombre: true, estado: true, prioridad: true } },
      facturas: { select: { id: true, numero: true, estado: true, total: true, fechaEmision: true } },
    },
  })
  if (!cliente) return { success: false, error: "Cliente no encontrado" }
  return { success: true, data: cliente }
}

async function getProyectoDetail(args: { proyectoId: string }): Promise<ToolResult> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: args.proyectoId },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true } },
      tareas: { select: { id: true, titulo: true, estado: true, prioridad: true, fechaLimite: true } },
    },
  })
  if (!proyecto) return { success: false, error: "Proyecto no encontrado" }
  return { success: true, data: proyecto }
}

async function searchTareas(args: { estado?: string; prioridad?: string; proyectoId?: string; search?: string; atrasadas?: boolean }): Promise<ToolResult> {
  const where: any = {}
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

async function searchFacturas(args: { estado?: string; clienteId?: string; vencidas?: boolean }): Promise<ToolResult> {
  const where: any = {}
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

async function createContenido(args: any): Promise<ToolResult> {
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
      campaignId: args.campaignId || null,
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: piece.id, titulo: piece.titulo, plataforma: piece.plataforma, tipo: piece.tipo, estado: piece.estado } }
}

async function createIdea(args: any): Promise<ToolResult> {
  const idea = await db.contentIdea.create({
    data: {
      titulo: args.titulo,
      descripcion: args.descripcion || null,
      categoria: args.categoria || null,
      plataforma: args.plataforma || null,
      tags: args.tags || null,
      fuente: "ia",
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: idea.id, titulo: idea.titulo } }
}

async function createTarea(args: any): Promise<ToolResult> {
  const tarea = await db.tarea.create({
    data: {
      titulo: args.titulo,
      descripcion: args.descripcion || null,
      estado: args.estado || "pendiente",
      prioridad: args.prioridad || "media",
      proyectoId: args.proyectoId || null,
      fechaLimite: args.fechaLimite ? new Date(args.fechaLimite) : null,
      updatedAt: new Date(),
    },
  })
  return { success: true, data: { id: tarea.id, titulo: tarea.titulo, estado: tarea.estado } }
}

async function createCampana(args: any): Promise<ToolResult> {
  const campaign = await db.campaign.create({
    data: {
      nombre: args.nombre,
      descripcion: args.descripcion || null,
      estado: args.estado || "planificacion",
      marca: args.marca || "general",
      fechaInicio: args.fechaInicio ? new Date(args.fechaInicio) : null,
      fechaFin: args.fechaFin ? new Date(args.fechaFin) : null,
      objetivos: args.objetivos || null,
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
