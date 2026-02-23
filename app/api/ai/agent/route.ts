import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { chatCompletion } from "@/lib/openai"
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt"
import { db } from "@/lib/db"

const MAX_HISTORY = 20
const MAX_INPUT = 12000

interface ContextData {
  clientes?: any[]
  proyectos?: any[]
  tareas?: any[]
  facturas?: any[]
  campanas?: any[]
  calendario?: any[]
}

async function gatherContext(): Promise<string> {
  try {
    const [clientes, proyectos, tareasPendientes, facturasRecientes, campanasActivas] = await Promise.all([
      db.cliente.findMany({ take: 30, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, email: true, empresa: true } }),
      db.proyecto.findMany({ where: { estado: { not: "completado" } }, take: 20, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, estado: true, prioridad: true, clienteId: true, fechaEntrega: true } }),
      db.tarea.findMany({ where: { estado: { not: "completada" } }, take: 20, orderBy: { fechaVencimiento: "asc" }, select: { id: true, titulo: true, estado: true, prioridad: true, fechaVencimiento: true, proyectoId: true } }),
      db.factura.findMany({ take: 15, orderBy: { createdAt: "desc" }, select: { id: true, numero: true, estado: true, total: true, clienteId: true, fechaEmision: true, fechaVencimiento: true } }),
      db.campaign.findMany({ where: { estado: { in: ["activa", "planificacion"] } }, take: 10, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, estado: true, marca: true, fechaInicio: true, fechaFin: true } }),
    ])

    const parts: string[] = []

    if (clientes.length > 0) {
      parts.push(`CLIENTES ACTIVOS (${clientes.length}):\n${clientes.map((c) => `- ${c.nombre}${c.empresa ? ` (${c.empresa})` : ""} — ${c.email || "sin email"}`).join("\n")}`)
    }

    if (proyectos.length > 0) {
      parts.push(`PROYECTOS EN CURSO (${proyectos.length}):\n${proyectos.map((p) => `- ${p.nombre} [${p.estado}] prioridad:${p.prioridad || "normal"}${p.fechaEntrega ? ` entrega:${new Date(p.fechaEntrega).toLocaleDateString("es-MX")}` : ""}`).join("\n")}`)
    }

    if (tareasPendientes.length > 0) {
      parts.push(`TAREAS PENDIENTES (${tareasPendientes.length}):\n${tareasPendientes.map((t) => `- ${t.titulo} [${t.estado}] prioridad:${t.prioridad || "normal"}${t.fechaVencimiento ? ` vence:${new Date(t.fechaVencimiento).toLocaleDateString("es-MX")}` : ""}`).join("\n")}`)
    }

    if (facturasRecientes.length > 0) {
      parts.push(`FACTURAS RECIENTES (${facturasRecientes.length}):\n${facturasRecientes.map((f) => `- #${f.numero} [${f.estado}] $${f.total}${f.fechaVencimiento ? ` vence:${new Date(f.fechaVencimiento).toLocaleDateString("es-MX")}` : ""}`).join("\n")}`)
    }

    if (campanasActivas.length > 0) {
      parts.push(`CAMPANAS ACTIVAS (${campanasActivas.length}):\n${campanasActivas.map((c) => `- ${c.nombre} [${c.estado}] marca:${c.marca}`).join("\n")}`)
    }

    parts.push(`FECHA ACTUAL: ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`)

    return parts.join("\n\n")
  } catch (error) {
    console.error("[Agent] Error gathering context:", error)
    return `FECHA ACTUAL: ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n(No se pudo cargar contexto de la base de datos)`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== "string") {
      return errorResponse("VALIDATION", "El mensaje es requerido", 400)
    }
    if (message.length > MAX_INPUT) {
      return errorResponse("VALIDATION", `El mensaje excede el limite de ${MAX_INPUT} caracteres`, 400)
    }

    const context = await gatherContext()
    const systemMessage = `${AGENT_SYSTEM_PROMPT}\n\n═══════════════════════════════════════════\nCONTEXTO ACTUAL DEL NEGOCIO\n═══════════════════════════════════════════\n\n${context}`

    const cleanHistory = (Array.isArray(history) ? history : [])
      .filter((m: any) => m.role && m.content && ["user", "assistant"].includes(m.role))
      .slice(-MAX_HISTORY)
      .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }))

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemMessage },
      ...cleanHistory,
      { role: "user", content: message },
    ]

    const response = await chatCompletion(messages, {
      temperature: 0.6,
      maxTokens: 8192,
    })

    return successResponse({ respuesta: response })
  } catch (error) {
    console.error("[Agent] Error:", error)
    return errorResponse("INTERNAL", error instanceof Error ? error.message : "Error del agente", 500)
  }
}
