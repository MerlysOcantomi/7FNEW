import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { getConversationById, parseConversationJsonFields } from "@modules/inbox/service"
import { askMotorIA } from "@engines/ai"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { DEFAULT_LOCALE, type SupportedLocale } from "@core/i18n"
import { operatorLocalePromptName } from "@/lib/inbox-operator-i18n"
import { FANNY_SYSTEM_PROMPT } from "@/agents/fanny/system-prompt"

type Params = { params: Promise<{ id: string }> }

const MAX_QUESTION_LENGTH = 1000
const MAX_RECENT_MESSAGES = 12
const MAX_MESSAGE_CHARS = 1500
const AI_TIMEOUT_MS = 25_000

interface ConversationMessageLite {
  id: string
  role: string
  direction: string
  content: string
  isInternal: boolean
}

interface ConversationContactLite {
  nombre?: string | null
  email?: string | null
  empresa?: string | null
  tipo?: string | null
}

interface ConversationHandoffLite {
  headline?: string | null
  summary?: string | null
  nextRecommendedAction?: string | null
  pendingItems?: string[] | null
  risks?: string[] | null
}

/**
 * Trim message body for the prompt to keep token usage bounded. We never quote more than
 * MAX_MESSAGE_CHARS per message; the selected message is allowed to be slightly longer.
 */
function clipText(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

function bulletList(items: unknown): string | null {
  if (!Array.isArray(items)) return null
  const cleaned = items
    .filter((it): it is string => typeof it === "string" && it.trim().length > 0)
    .map((it) => `- ${it.trim()}`)
  if (cleaned.length === 0) return null
  return cleaned.join("\n")
}

function buildContextBlock(input: {
  conversation: {
    id: string
    channel: string
    status: string
    subject?: string | null
    contact?: ConversationContactLite | null
    handoff?: ConversationHandoffLite | null
    messages: ConversationMessageLite[]
  }
  selectedMessageId: string | null
  mode: "message" | "conversation"
}): string {
  const lines: string[] = []
  const c = input.conversation.contact ?? null

  lines.push(`CONVERSATION_ID: ${input.conversation.id}`)
  lines.push(`CHANNEL: ${input.conversation.channel}`)
  lines.push(`STATUS: ${input.conversation.status}`)
  if (input.conversation.subject) lines.push(`SUBJECT: ${input.conversation.subject}`)

  if (c) {
    const contactBits = [
      c.nombre ? `name=${c.nombre}` : null,
      c.email ? `email=${c.email}` : null,
      c.empresa ? `company=${c.empresa}` : null,
      c.tipo ? `type=${c.tipo}` : null,
    ].filter(Boolean)
    if (contactBits.length > 0) lines.push(`CONTACT: ${contactBits.join(" | ")}`)
  }

  const h = input.conversation.handoff ?? null
  if (h) {
    if (h.headline) lines.push(`HEADLINE: ${h.headline}`)
    if (h.summary) lines.push(`SUMMARY: ${h.summary}`)
    if (h.nextRecommendedAction) lines.push(`NEXT_RECOMMENDED_ACTION: ${h.nextRecommendedAction}`)
    const pending = bulletList(h.pendingItems)
    if (pending) lines.push(`PENDING_ITEMS:\n${pending}`)
    const risks = bulletList(h.risks)
    if (risks) lines.push(`RISKS:\n${risks}`)
  }

  /** Selected message (if message mode) — always quoted in full for grounding precision. */
  const selected = input.selectedMessageId
    ? input.conversation.messages.find((m) => m.id === input.selectedMessageId) ?? null
    : null

  if (input.mode === "message" && selected) {
    const visibility = selected.isInternal ? " [INTERNAL]" : ""
    lines.push(
      `\nSELECTED_MESSAGE [${selected.direction}/${selected.role}]${visibility} (id=${selected.id}):`,
    )
    lines.push(clipText(selected.content, MAX_MESSAGE_CHARS * 2))
  }

  /** Last N messages for context. The selected one stays in the list with a marker. */
  const recent = input.conversation.messages.slice(-MAX_RECENT_MESSAGES)
  const transcript = recent
    .map((m, i) => {
      const visibility = m.isInternal ? " [INTERNAL]" : ""
      const isSelectedMark = m.id === input.selectedMessageId ? " *SELECTED*" : ""
      return `${i + 1}. [${m.direction}/${m.role}]${visibility}${isSelectedMark}: ${clipText(m.content, MAX_MESSAGE_CHARS)}`
    })
    .join("\n")
  lines.push(`\nRECENT_MESSAGES:\n${transcript || "(none)"}`)

  return lines.join("\n")
}

function buildPrompt(input: {
  question: string
  contextBlock: string
  mode: "message" | "conversation"
  operatorLocaleName: string
}): string {
  const scopeLine =
    input.mode === "message"
      ? "The operator is asking about the SELECTED_MESSAGE first; use the rest as supporting context."
      : "The operator is asking about the WHOLE conversation; weight the most recent customer message."

  return `${FANNY_SYSTEM_PROMPT}

OPERATOR_UI_LANGUAGE: ${input.operatorLocaleName}
Answer in ${input.operatorLocaleName} unless the question explicitly requests another language.

You are answering an operator's question while they are working on an inbox conversation.
${scopeLine}

Knowledge sources (read carefully):
- The CONTEXT below is the source of truth for anything specific to THIS conversation,
  customer, message, project, history, or operational state. Never invent facts about
  these — if the CONTEXT doesn't say it, you don't know it for THIS case.
- For general knowledge — definitions, concepts, vocabulary, business or domain terms,
  language meaning, common practices — you MAY answer using your general knowledge.
  Do NOT refuse to define a term just because it isn't mentioned in CONTEXT.
- For mixed questions ("what does X mean here?", "is this normal?"), give the general
  meaning first, then apply it to whatever the CONTEXT actually says about it. If the
  CONTEXT doesn't mention it, state that ONLY for the conversation-specific part — not
  for the general definition.
- When you mix general knowledge with conversation context, separate them clearly
  (e.g. "In general, … In this conversation, …").

Output rules:
- Keep the answer focused and operationally useful (typically 1–4 sentences). Bullets allowed for short lists.
- Do not include preambles like "Sure" or "Of course".
- Do not act on the operator's behalf and do not promise to send anything.
- If the operator asks you to "draft" / "rewrite" a reply, return the customer-facing reply text only, in the customer's language.
- Lines tagged [INTERNAL] are PRIVATE operator notes the customer never sees. You may use
  them as context to answer the operator's question, but NEVER quote them verbatim in a
  customer-facing draft or reply, and never reveal their content to the customer.
- When the operator asks you to draft/rewrite a reply, you may USE facts from [INTERNAL]
  notes implicitly to shape the reply, but you MUST NOT attribute them to the customer
  ("as you mentioned…", "you said…") if the customer never wrote them, and you MUST NOT
  use phrases like "according to the internal note", "as per the internal note", or any
  reference to internal/private notes — the customer must not be able to tell those notes
  exist. Phrase those facts as your own paraphrase or as a question to the customer.
- When you answer the operator (not draft), you may reference internal notes explicitly
  ("based on your internal note: …"). Do not blur internal-note facts and customer-stated
  facts: don't say "the customer mentioned X" if X actually came from an [INTERNAL] line.

CONTEXT:
${input.contextBlock}

OPERATOR_QUESTION:
${input.question}

ANSWER:`
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const { id } = await params

    const ws = await getWorkspaceWithResolvedConfig(workspaceId)
    const operatorLocale: SupportedLocale = ws?.locale ?? DEFAULT_LOCALE
    const operatorLocaleName = operatorLocalePromptName(operatorLocale)

    const body = await request.json().catch(() => ({}))
    const rawQuestion = (body as { question?: unknown }).question
    const rawMessageId = (body as { messageId?: unknown }).messageId
    const rawMode = (body as { mode?: unknown }).mode

    if (typeof rawQuestion !== "string" || rawQuestion.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "question is required")
    }
    const question = rawQuestion.trim()
    if (question.length > MAX_QUESTION_LENGTH) {
      return errorResponse("VALIDATION_ERROR", `question exceeds ${MAX_QUESTION_LENGTH} character limit`)
    }

    const mode: "message" | "conversation" =
      rawMode === "message" || rawMode === "conversation" ? rawMode : "conversation"
    const messageId =
      typeof rawMessageId === "string" && rawMessageId.trim().length > 0 ? rawMessageId.trim() : null

    if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
      return errorResponse("AI_ERROR", "AI service is not configured.", 503)
    }

    const conversation = await getConversationById(id, workspaceId)
    if (!conversation) {
      return errorResponse("NOT_FOUND", "Conversation not found", 404)
    }

    /**
     * Use the same JSON-parsing helper the detail endpoint uses so handoff/messages arrays come
     * pre-normalized (pendingItems/risks as actual arrays, not strings). No schema work needed.
     */
    const parsed = parseConversationJsonFields(conversation) as unknown as {
      id: string
      channel: string
      status: string
      subject?: string | null
      contact?: ConversationContactLite | null
      handoff?: ConversationHandoffLite | null
      messages: ConversationMessageLite[]
    }

    /** If the operator claims a messageId in `message` mode but it doesn't belong, we degrade to conversation mode. */
    const messageIdBelongs =
      messageId && Array.isArray(parsed.messages)
        ? parsed.messages.some((m) => m.id === messageId)
        : false
    const effectiveMode: "message" | "conversation" = messageIdBelongs ? mode : "conversation"
    const effectiveMessageId = messageIdBelongs ? messageId : null

    const contextBlock = buildContextBlock({
      conversation: parsed,
      selectedMessageId: effectiveMessageId,
      mode: effectiveMode,
    })

    const prompt = buildPrompt({
      question,
      contextBlock,
      mode: effectiveMode,
      operatorLocaleName,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

    try {
      /**
       * `operativo` mode runs against DeepSeek and is fast/concise — same model used by the
       * intelligence pipeline. We keep the entire prompt under our control (FANNY_SYSTEM_PROMPT
       * is embedded), no chat history is persisted server-side.
       */
      const result = await Promise.race([
        askMotorIA(prompt, "operativo"),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("AI request timed out")))
        }),
      ])
      clearTimeout(timeout)

      if (typeof result !== "string" || result.trim().length === 0) {
        return errorResponse("AI_ERROR", "AI returned an empty answer. Please try again.", 502)
      }

      return successResponse({
        answer: result.trim(),
        mode: effectiveMode,
        messageId: effectiveMessageId,
      })
    } catch (aiErr) {
      clearTimeout(timeout)
      const message = aiErr instanceof Error ? aiErr.message : "AI processing failed"
      return errorResponse("AI_ERROR", message, 502)
    }
  } catch (error) {
    return handleError(error, "ConversationAsk")
  }
}
