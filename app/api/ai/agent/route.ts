/**
 * AI-06 — Mr. Forte agent route as a thin transport boundary.
 *
 * authenticate → resolve workspace/user context (server-side only) → invoke
 * the shared agent-turn use case (`runAgentToolLoop`) → return the
 * compatible response. Everything provider-shaped lives in the shared
 * FOUND-02b adapter; everything authorization-shaped lives in FOUND-03; the
 * loop lives in `engines/ai/agent-loop.ts`. This file must never own an AI
 * client, a tool vocabulary or an authorization decision.
 */

import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { AGENT_SYSTEM_PROMPT } from "@/agents/forte/system-prompt"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { gatherBusinessContext } from "@tools/context/gather-business-context"
import { getWorkspaceCapabilitySources } from "@core/workspace"
import { resolveWorkspaceCapabilitySnapshot } from "@core/platform/workspace-capabilities"
import { AIExecutionError, runAgentToolLoop, type AIChatMessage } from "@/engines/ai"
import { getAgentToolBindings } from "@/agents/forte/canonical/agent-bindings"

const MAX_HISTORY = 20
const MAX_INPUT = 12000

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

    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()

    // FOUND-03 evidence, constructed exclusively from authenticated
    // server-side state: persisted workspace sources + the strict-parsed
    // membership role from `requireReadAccess`. Client input cannot widen it.
    const sources = await getWorkspaceCapabilitySources(workspaceId)
    const snapshot = resolveWorkspaceCapabilitySnapshot(sources)
    const resolution = { snapshot, membership: { role: wsRole } }

    const context = await gatherBusinessContext(workspaceId)
    const systemContent = `${AGENT_SYSTEM_PROMPT}\n\n═══════════════════════════════════════\nCONTEXTO ACTUAL DEL NEGOCIO\n═══════════════════════════════════════\n\n${context}`

    const cleanHistory: AIChatMessage[] = (Array.isArray(history) ? history : [])
      .filter(
        (m: { role?: unknown; content?: unknown }) =>
          m.role && m.content && ["user", "assistant"].includes(m.role as string),
      )
      .slice(-MAX_HISTORY)
      .map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, 4000),
      }))

    const result = await runAgentToolLoop({
      system: systemContent,
      history: cleanHistory,
      message,
      resolution,
      bindings: getAgentToolBindings(),
      toolContext: { workspaceId, userId: session.userId, requestId },
      attribution: { workspaceId },
      activity: "ai.agent_turn",
      // Legacy provider/model/sampling preserved exactly.
      provider: "openai",
      model: "gpt-4.1",
      temperature: 0.6,
      maxTokens: 8192,
      requestMetadata: { requestId, caller: "api.ai.agent" },
    })

    const actions = result.toolExecutions.map((record) => ({
      tool: record.requestedTool,
      args: record.input ?? null,
      result:
        record.status === "executed"
          ? { success: true, data: record.result }
          : { success: false, error: record.error },
    }))

    return successResponse({
      respuesta: result.finalText,
      actions: actions.length > 0 ? actions : undefined,
    })
  } catch (error) {
    console.error("[Agent] Error:", error)
    if (error instanceof AIExecutionError) {
      // Provider failures are always a 500 here — a provider status code is
      // not an HTTP status for this route, and adapter messages are safe
      // (no secrets, no provider bodies for OpenAI).
      return errorResponse("INTERNAL", error.message, 500)
    }
    return errorResponse(
      "INTERNAL",
      error instanceof Error ? error.message : "Error del agente",
      (error as { status?: number })?.status || 500,
    )
  }
}
