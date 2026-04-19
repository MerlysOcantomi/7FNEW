import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA, type AIMode } from "@/lib/ai"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { DEFAULT_LOCALE, type SupportedLocale } from "@core/i18n"
import { operatorLocalePromptName } from "@/lib/inbox-operator-i18n"

const VALID_ACTIONS = [
  "proofread",
  "shorter",
  "clearer",
  "professional",
  "warmer",
  "direct",
  "translate",
  "compose_from_intent",
] as const

type AssistAction = (typeof VALID_ACTIONS)[number]

const MAX_TEXT_LENGTH = 8000
const MIN_TEXT_LENGTH_FOR_REWRITE = 6
const AI_TIMEOUT_MS = 25_000

function buildPrompt(
  action: AssistAction,
  text: string,
  targetLanguage: string | undefined,
  detectedLanguage: string | undefined,
  operatorLocale: SupportedLocale,
): string {
  const opUiName = operatorLocalePromptName(operatorLocale)
  const langNote = detectedLanguage
    ? `Customer thread language hint: ${detectedLanguage.toUpperCase()}.`
    : ""

  const operatorContext = `Operator UI language: ${opUiName} (for your orientation only).`

  switch (action) {
    case "proofread":
      return `${operatorContext}
Fix spelling, grammar, and punctuation in the following text. Keep the same language as the text (customer reply may differ from ${opUiName}). Return ONLY the corrected text, no explanations.

${langNote}

Text:
${text}`

    case "shorter":
      return `${operatorContext}
Make the following text shorter while keeping the same meaning and tone. Keep the same language as the input. Return ONLY the shortened text.

${langNote}

Text:
${text}`

    case "clearer":
      return `${operatorContext}
Rewrite the following text to be clearer. Keep the same language as the input. Return ONLY the improved text.

${langNote}

Text:
${text}`

    case "professional":
      return `${operatorContext}
Rewrite in a more professional tone. Keep the same language as the input. Return ONLY the rewritten text.

${langNote}

Text:
${text}`

    case "warmer":
      return `${operatorContext}
Rewrite in a warmer, friendlier professional tone. Keep the same language as the input. Return ONLY the rewritten text.

${langNote}

Text:
${text}`

    case "direct":
      return `${operatorContext}
Rewrite to be more direct and action-oriented. Keep the same language as the input. Return ONLY the rewritten text.

${langNote}

Text:
${text}`

    case "translate": {
      const target = targetLanguage || "English"
      return `Translate the following text to ${target}. Maintain tone and intent. Return ONLY the translated text.

Text:
${text}`
    }

    case "compose_from_intent":
      return `You help an operator compose a reply to a customer.

${operatorContext}
${langNote}

The operator wrote what they want to say (voice note / rough notes). Produce a single ready-to-send message for the CUSTOMER.

Rules (order of priority):
1) The outbound message MUST be in the same language the customer uses in inbound messages — primary reference: ${detectedLanguage ? detectedLanguage.toUpperCase() : "infer from the conversation / thread context"}.
2) Do not mirror ${opUiName} in the customer message unless the customer actually writes in that language.
3) Natural, professional, concise. No meta-commentary.
4) Return ONLY the customer-facing reply text.

Operator intent / notes:
${text}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const ws = await getWorkspaceWithResolvedConfig(workspaceId)
    const operatorLocale: SupportedLocale = ws?.locale ?? DEFAULT_LOCALE

    const body = await request.json()
    const { action, text, targetLanguage, detectedLanguage } = body as {
      action?: string
      text?: string
      targetLanguage?: string
      detectedLanguage?: string
    }

    if (!action || !VALID_ACTIONS.includes(action as AssistAction)) {
      return errorResponse("VALIDATION_ERROR", `action must be one of: ${VALID_ACTIONS.join(", ")}`)
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "text is required")
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return errorResponse("VALIDATION_ERROR", `text exceeds ${MAX_TEXT_LENGTH} character limit`)
    }

    const typedAction = action as AssistAction

    if (!process.env.OPENAI_API_KEY) {
      console.warn("[composer-assist] OPENAI_API_KEY not configured, cannot process request")
      return errorResponse("AI_ERROR", "AI service is not configured. Please set OPENAI_API_KEY.", 503)
    }

    const trimmedText = text.trim()

    if (typedAction !== "compose_from_intent" && typedAction !== "translate" && trimmedText.length < MIN_TEXT_LENGTH_FOR_REWRITE) {
      return successResponse({ result: trimmedText, action, skipped: true })
    }

    const prompt = buildPrompt(typedAction, trimmedText, targetLanguage, detectedLanguage, operatorLocale)
    const mode: AIMode = typedAction === "proofread" ? "assist_proofread" : "assist_rewrite"

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

    try {
      const result = await Promise.race([
        askMotorIA(prompt, mode),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("AI request timed out")))
        }),
      ])

      clearTimeout(timeout)

      if (!result || typeof result !== "string" || result.trim().length === 0) {
        console.error(`[composer-assist] Empty result for action=${action}`)
        return errorResponse("AI_ERROR", "AI returned an empty result. Please try again.", 502)
      }

      console.log(`[composer-assist] OK action=${action} chars_in=${trimmedText.length} chars_out=${result.length}`)
      return successResponse({ result: result.trim(), action })
    } catch (aiErr) {
      clearTimeout(timeout)
      const message = aiErr instanceof Error ? aiErr.message : "AI processing failed"
      console.error(`[composer-assist] AI error action=${action}: ${message}`)
      return errorResponse("AI_ERROR", message, 502)
    }
  } catch (error) {
    return handleError(error, "ComposerAssist")
  }
}
