import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@engines/ai"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { FINESSE_SYSTEM_PROMPT } from "@/agents/finesse/system-prompt"
import {
  FINESSE_MAX_QUESTION_LENGTH,
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

/** Whitelist-sanitize the client-published page context (serializable, small). */
function sanitizeContext(raw: unknown): Partial<FinesseAssistantContext> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const out: Partial<FinesseAssistantContext> = {}

  const str = (v: unknown, max = 120): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : undefined

  out.page = str(source.page) as FinesseAssistantContext["page"] | undefined
  out.route = str(source.route)
  out.section = str(source.section)
  out.selectedEntityType = str(source.selectedEntityType)
  out.selectedEntityId = str(source.selectedEntityId)
  out.locale = str(source.locale, 20)
  out.currency = str(source.currency, 8)

  const period = source.period
  if (period && typeof period === "object" && !Array.isArray(period)) {
    const p = period as Record<string, unknown>
    const preset = str(p.preset, 12)
    const start = str(p.start, 12)
    const end = str(p.end, 12)
    if (preset && start && end) {
      out.period = { preset: preset as NonNullable<FinesseAssistantContext["period"]>["preset"], start, end }
    }
  }

  const metrics = source.visibleMetrics
  if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
    const entries = Object.entries(metrics as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" || typeof v === "string" || v === null)
      .slice(0, 24) as Array<[string, number | string | null]>
    if (entries.length > 0) out.visibleMetrics = Object.fromEntries(entries)
  }

  return out
}

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
    const context = sanitizeContext((body as { context?: unknown }).context)
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
