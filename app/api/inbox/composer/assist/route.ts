import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@/lib/ai"

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

function buildPrompt(action: AssistAction, text: string, targetLanguage?: string, detectedLanguage?: string): string {
  const langNote = detectedLanguage
    ? `The conversation is in ${detectedLanguage.toUpperCase()}.`
    : ""

  switch (action) {
    case "proofread":
      return `Fix spelling, grammar, and punctuation in the following text. Keep the same language, tone, and meaning. Return ONLY the corrected text, no explanations.\n\n${langNote}\n\nText:\n${text}`

    case "shorter":
      return `Make the following text shorter and more concise while keeping the same meaning and tone. Remove filler and redundancy. Return ONLY the shortened text.\n\n${langNote}\n\nText:\n${text}`

    case "clearer":
      return `Rewrite the following text to be clearer and easier to understand. Keep the same language and intent. Return ONLY the improved text.\n\n${langNote}\n\nText:\n${text}`

    case "professional":
      return `Rewrite the following text in a more professional and polished tone. Keep the same language and meaning. Return ONLY the rewritten text.\n\n${langNote}\n\nText:\n${text}`

    case "warmer":
      return `Rewrite the following text in a warmer, friendlier tone while keeping it professional. Keep the same language and meaning. Return ONLY the rewritten text.\n\n${langNote}\n\nText:\n${text}`

    case "direct":
      return `Rewrite the following text to be more direct and action-oriented. Remove hedging and unnecessary politeness. Keep the same language. Return ONLY the rewritten text.\n\n${langNote}\n\nText:\n${text}`

    case "translate": {
      const target = targetLanguage || "English"
      return `Translate the following text to ${target}. Maintain the original tone and intent. Return ONLY the translated text.\n\nText:\n${text}`
    }

    case "compose_from_intent":
      return `You are a professional communication assistant helping an operator reply to a customer conversation.

${langNote}

The operator described what they want to communicate in their own words (possibly informal or as a voice note). Transform this into a well-written, professional reply that the operator can send directly to the customer.

Rules:
- Write in the same language as the operator's intent description${detectedLanguage ? `, or in ${detectedLanguage.toUpperCase()} if the conversation is in that language` : ""}
- Keep it natural and professional
- Do not add greetings or signatures unless the intent implies them
- Return ONLY the ready-to-send reply text

Operator's intent:
${text}`
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireWriteAccess(request)

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

    const prompt = buildPrompt(typedAction, trimmedText, targetLanguage, detectedLanguage)
    const mode = typedAction === "proofread" ? "correccion" : "editorial"

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
