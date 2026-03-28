import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { AGENT_SYSTEM_PROMPT } from "@/agents/forte/system-prompt"
import { getAgentToolsForContext } from "@/agents/forte/tools"
import { executeToolCall } from "@/agents/forte/executor"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { gatherBusinessContext } from "@tools/context/gather-business-context"
import { buildAssistantForteContext } from "@/agents/forte/runtime/agent-adapter"

const MAX_HISTORY = 20
const MAX_INPUT = 12000
const MAX_TOOL_ROUNDS = 5
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY no configurada")
  return key
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session, wsRole } = await requireReadAccess(request)
    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== "string") {
      return errorResponse("VALIDATION", "El mensaje es requerido", 400)
    }
    if (message.length > MAX_INPUT) {
      return errorResponse("VALIDATION", `Mensaje excede ${MAX_INPUT} caracteres`, 400)
    }

    const forteContext = buildAssistantForteContext({
      tenantId: request.headers.get("x-tenant-id") ?? workspaceId,
      workspaceId,
      userId: session.userId,
      wsRole,
      requestId: request.headers.get("x-request-id") ?? undefined,
    })
    const agentTools = await getAgentToolsForContext(forteContext)
    const context = await gatherBusinessContext(workspaceId)
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
          tools: agentTools,
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
          const result = await executeToolCall(fnName, fnArgs, {
            workspaceId,
            userId: session.userId,
            wsRole,
            tenantId: forteContext.tenantId,
            requestId: forteContext.requestId,
          })

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
