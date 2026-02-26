import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt"
import { AGENT_TOOLS } from "@/lib/agent/tools"
import { executeToolCall } from "@/lib/agent/executor"
import { db } from "@/lib/db"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"

const MAX_HISTORY = 20
const MAX_INPUT = 12000
const MAX_TOOL_ROUNDS = 5
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY no configurada")
  return key
}

async function gatherContext(workspaceId: string): Promise<string> {
  try {
    const [clientes, proyectos, tareasPendientes, facturasRecientes, campanasActivas, contenidoReciente] = await Promise.all([
      db.cliente.findMany({ where: { workspaceId }, take: 30, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, email: true, empresa: true } }),
      db.proyecto.findMany({ where: { workspaceId, estado: { not: "completado" } }, take: 20, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, estado: true, prioridad: true, clienteId: true } }),
      db.tarea.findMany({ where: { workspaceId, estado: { not: "completada" } }, take: 20, orderBy: { fechaLimite: "asc" }, select: { id: true, titulo: true, estado: true, prioridad: true, fechaLimite: true, proyectoId: true } }),
      db.factura.findMany({ where: { workspaceId }, take: 15, orderBy: { createdAt: "desc" }, select: { id: true, numero: true, estado: true, total: true, clienteId: true, fechaEmision: true, fechaVencimiento: true } }),
      db.campaign.findMany({ where: { workspaceId, estado: { in: ["activa", "planificacion"] } }, take: 10, orderBy: { updatedAt: "desc" }, select: { id: true, nombre: true, estado: true, marca: true } }),
      db.contentPiece.findMany({ where: { workspaceId }, take: 10, orderBy: { createdAt: "desc" }, select: { id: true, titulo: true, estado: true, plataforma: true, tipo: true } }),
    ])

    const parts: string[] = []
    const today = new Date()
    parts.push(`FECHA ACTUAL: ${today.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`)

    if (clientes.length > 0) {
      parts.push(`CLIENTES (${clientes.length}):\n${clientes.map((c) => `- [${c.id}] ${c.nombre}${c.empresa ? ` (${c.empresa})` : ""} — ${c.email || "sin email"}`).join("\n")}`)
    }
    if (proyectos.length > 0) {
      parts.push(`PROYECTOS ACTIVOS (${proyectos.length}):\n${proyectos.map((p) => `- [${p.id}] ${p.nombre} [${p.estado}] prioridad:${p.prioridad || "normal"}`).join("\n")}`)
    }
    if (tareasPendientes.length > 0) {
      const atrasadas = tareasPendientes.filter((t) => t.fechaLimite && new Date(t.fechaLimite) < today)
      parts.push(`TAREAS PENDIENTES (${tareasPendientes.length}, ${atrasadas.length} atrasadas):\n${tareasPendientes.map((t) => {
        const vencida = t.fechaLimite && new Date(t.fechaLimite) < today
        return `- [${t.id}] ${t.titulo} [${t.estado}] prioridad:${t.prioridad || "normal"}${t.fechaLimite ? ` vence:${new Date(t.fechaLimite).toLocaleDateString("es-MX")}` : ""}${vencida ? " ⚠ ATRASADA" : ""}`
      }).join("\n")}`)
    }
    if (facturasRecientes.length > 0) {
      const vencidas = facturasRecientes.filter((f) => f.fechaVencimiento && new Date(f.fechaVencimiento) < today && f.estado !== "pagada")
      parts.push(`FACTURAS (${facturasRecientes.length}, ${vencidas.length} vencidas):\n${facturasRecientes.map((f) => {
        const vencida = f.fechaVencimiento && new Date(f.fechaVencimiento) < today && f.estado !== "pagada"
        return `- [${f.id}] #${f.numero} [${f.estado}] $${f.total}${f.fechaVencimiento ? ` vence:${new Date(f.fechaVencimiento).toLocaleDateString("es-MX")}` : ""}${vencida ? " ⚠ VENCIDA" : ""}`
      }).join("\n")}`)
    }
    if (campanasActivas.length > 0) {
      parts.push(`CAMPANAS (${campanasActivas.length}):\n${campanasActivas.map((c) => `- [${c.id}] ${c.nombre} [${c.estado}] marca:${c.marca}`).join("\n")}`)
    }
    if (contenidoReciente.length > 0) {
      parts.push(`CONTENIDO RECIENTE (${contenidoReciente.length}):\n${contenidoReciente.map((c) => `- [${c.id}] ${c.titulo} [${c.estado}] ${c.plataforma}/${c.tipo}`).join("\n")}`)
    }

    return parts.join("\n\n")
  } catch (error) {
    console.error("[Agent] Context error:", error)
    return `FECHA ACTUAL: ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n(Error al cargar contexto)`
  }
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== "string") {
      return errorResponse("VALIDATION", "El mensaje es requerido", 400)
    }
    if (message.length > MAX_INPUT) {
      return errorResponse("VALIDATION", `Mensaje excede ${MAX_INPUT} caracteres`, 400)
    }

    const context = await gatherContext(workspaceId)
    const systemContent = `${AGENT_SYSTEM_PROMPT}\n\n═══════════════════════════════════════\nCONTEXTO ACTUAL DEL NEGOCIO\n═══════════════════════════════════════\n\n${context}`

    const cleanHistory: ChatMessage[] = (Array.isArray(history) ? history : [])
      .filter((m: any) => m.role && m.content && ["user", "assistant"].includes(m.role))
      .slice(-MAX_HISTORY)
      .map((m: any) => ({ role: m.role, content: (m.content as string).slice(0, 4000) }))

    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...cleanHistory,
      { role: "user", content: message },
    ]

    let finalText = ""
    const actions: Array<{ tool: string; args: any; result: any }> = []
    const images: string[] = []

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages,
          tools: AGENT_TOOLS,
          tool_choice: "auto",
          temperature: 0.6,
          max_tokens: 8192,
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.error("[Agent] OpenAI error:", res.status, errBody)
        throw new Error(`OpenAI error (${res.status})`)
      }

      const json = await res.json()
      const choice = json.choices?.[0]
      const assistantMsg = choice?.message

      if (!assistantMsg) throw new Error("Respuesta vacia de OpenAI")

      messages.push(assistantMsg)

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        for (const toolCall of assistantMsg.tool_calls) {
          const fnName = toolCall.function.name
          let fnArgs: Record<string, any> = {}
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}")
          } catch {
            fnArgs = {}
          }

          console.log(`[Agent] Tool call: ${fnName}`, fnArgs)
          const result = await executeToolCall(fnName, fnArgs)

          actions.push({ tool: fnName, args: fnArgs, result })
          if (result.imageUrl) images.push(result.imageUrl)

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }

        if (choice.finish_reason === "tool_calls") continue
      }

      finalText = assistantMsg.content || ""
      break
    }

    return successResponse({
      respuesta: finalText,
      actions: actions.length > 0 ? actions : undefined,
      images: images.length > 0 ? images : undefined,
    })
  } catch (error) {
    console.error("[Agent] Error:", error)
    return errorResponse("INTERNAL", error instanceof Error ? error.message : "Error del agente", (error as { status?: number })?.status || 500)
  }
}
