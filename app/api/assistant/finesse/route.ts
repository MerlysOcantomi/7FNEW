import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@engines/ai"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { FINESSE_SYSTEM_PROMPT } from "@/agents/finesse/system-prompt"
import {
  FINESSE_MAX_QUESTION_LENGTH,
  sanitizeFinesseContext,
  type FinesseAssistantContext,
} from "@modules/assistant/finesse-assistant"

/**
 * POST /api/assistant/finesse — the global Ask Finesse endpoint.
 *
 * Mirrors the Fanny `/ask` route (read-only Q&A over `askMotorIA`, no tool
 * execution → the assistant CANNOT mutate business data), scoped by
 * `requireReadAccess`. The page context arrives from the client but is
 * re-scoped server-side: workspace id and vertical are taken from the
 * AUTHENTICATED workspace, never from the payload, so a tampered client can
 * never read across tenants.
 *
 * Honest availability: with no AI provider configured the route answers 503
 * `AI_UNAVAILABLE` and the panel shows its "not connected yet" state — the
 * assistant never fakes a response.
 */

const AI_TIMEOUT_MS = 25_000

function buildPrompt(
  question: string,
  context: Partial<FinesseAssistantContext>,
  workspaceName: string | null,
): string {
  const contextBlock = JSON.stringify(
    { workspace: workspaceName ?? undefined, ...context },
    null,
    2,
  )
  return `${FINESSE_SYSTEM_PROMPT}

CONTEXT (the only business data you may cite):
${contextBlock}

USER QUESTION:
${question}`
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)

    const body = await request.json().catch(() => ({}))
    const rawQuestion = (body as { question?: unknown }).question
    if (typeof rawQuestion !== "string" || rawQuestion.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "question is required")
    }
    const question = rawQuestion.trim()
    if (question.length > FINESSE_MAX_QUESTION_LENGTH) {
      return errorResponse(
        "VALIDATION_ERROR",
        `question exceeds ${FINESSE_MAX_QUESTION_LENGTH} character limit`,
      )
    }

    // Honest unavailable state — the UI maps 503 to "Finesse no está conectada".
    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      return errorResponse("AI_UNAVAILABLE", "AI service is not configured.", 503)
    }

    // Server-authoritative scope: the payload's workspace/vertical are ignored.
    const context = sanitizeFinesseContext((body as { context?: unknown }).context)
    const ws = await getWorkspaceWithResolvedConfig(workspaceId)

    const prompt = buildPrompt(question, context, ws?.nombre ?? null)

    // `operativo` runs on DeepSeek; fall back to the OpenAI general mode when
    // only that provider is configured (mirrors engines/ai key requirements).
    const mode = process.env.DEEPSEEK_API_KEY ? "operativo" : "general"

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    try {
      const answer = await Promise.race([
        askMotorIA(prompt, mode),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error("Finesse timed out. Please try again.")),
          )
        }),
      ])
      clearTimeout(timeout)

      if (typeof answer !== "string" || answer.trim().length === 0) {
        return errorResponse("AI_ERROR", "Empty answer from the AI service.", 502)
      }
      return successResponse({ answer: answer.trim() })
    } catch (aiErr) {
      clearTimeout(timeout)
      const message = aiErr instanceof Error ? aiErr.message : "AI request failed"
      return errorResponse("AI_ERROR", message, 502)
    }
  } catch (error) {
    return handleError(error, "FinesseAssistant")
  }
}
