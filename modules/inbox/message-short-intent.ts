import { askMotorIA } from "@engines/ai"
import { db } from "@core/db"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { formatSenderIntentPhrase } from "@/lib/inbox/format-sender-intent"
import { operatorLocalePromptName } from "@/lib/inbox-operator-i18n"
import { parseLocale, type SupportedLocale } from "@core/i18n"

const MODEL: "operativo" = "operativo"
/** Mínimo de caracteres en el cuerpo para pedir intent (evita ruido). */
export const MESSAGE_SHORT_INTENT_MIN_CONTENT_LENGTH = 8
const MAX_MESSAGE_CHARS_FOR_PROMPT = 8_000

/**
 * Reglas mínimas de elegibilidad: mensaje con cuerpo suficiente y no puramente de sistema.
 * (Dirección, interno/externo o customer/team no excluyen — el modelo acota ruido en el prompt.)
 */
export function shouldPersistMessageShortIntent(input: { content: string; role: string }): boolean {
  if (input.content.trim().length < MESSAGE_SHORT_INTENT_MIN_CONTENT_LENGTH) return false
  if (input.role.trim().toLowerCase() === "system") return false
  return true
}

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseIntentJson(response: string): { shortIntent?: string } | null {
  try {
    const cleaned = response
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const shortIntent = (parsed as { shortIntent?: unknown }).shortIntent
    if (typeof shortIntent !== "string") return null
    return { shortIntent }
  } catch {
    return null
  }
}

export function mergeMessageMetadataJson(
  existingJson: string | null | undefined,
  patch: Record<string, unknown>,
): string {
  const base = parseJson<Record<string, unknown>>(existingJson ?? null) ?? {}
  return JSON.stringify({ ...base, ...patch })
}

/**
 * Deriva una frase corta de intención comunicativa/operativa para este mensaje (no el resumen de conversación)
 * y la guarda en `metadata.shortIntent`.
 */
export async function persistShortIntentForMessage(input: {
  messageId: string
  workspaceId: string
  content: string
}): Promise<void> {
  const trimmed = input.content.trim()
  if (trimmed.length < MESSAGE_SHORT_INTENT_MIN_CONTENT_LENGTH) return

  const ws = await getWorkspaceWithResolvedConfig(input.workspaceId)
  const locale: SupportedLocale = ws?.locale ?? parseLocale(null)

  const latest = await db.message.findFirst({
    where: { id: input.messageId, workspaceId: input.workspaceId },
    select: { metadata: true },
  })
  if (!latest) return

  const body =
    trimmed.length > MAX_MESSAGE_CHARS_FOR_PROMPT
      ? `${trimmed.slice(0, MAX_MESSAGE_CHARS_FOR_PROMPT)}\n…`
      : trimmed

  const opLangName = operatorLocalePromptName(locale)

  const prompt = `You assign ONE short intent label for ONE message shown in an inbox sidebar (Smart Inbox).

The message may be from a customer or from your team; inbound or outbound; internal coordination or external. Capture real communicative or operational intent — what someone is requesting, notifying, coordinating, or deciding in THIS message — not what the whole thread is about.

Hard rules:
- Respond with ONLY valid JSON: {"shortIntent":"<phrase>"}
- shortIntent: at most 10 words, plain human language, grounded only in THIS message (e.g. requests, approvals, reports, schedules, pricing, updates that matter operationally).
- Must NOT be a paragraph, NOT a conversation-level summary, NOT pasted boilerplate with no substance.
- Do NOT reduce the message to a fake "internal task ticket" title unless that label truly reflects what is being communicated.
- Prefer the message's language when possible; otherwise ${opLangName}.
- If there is no substantive intent worth surfacing (spam, empty fluff, meaningless noise), use {"shortIntent":""}.

MESSAGE:
${body}`

  let raw: string
  try {
    raw = await askMotorIA(prompt, MODEL)
  } catch (err) {
    console.error(`[message-short-intent] askMotorIA failed msg=${input.messageId}:`, err)
    return
  }

  const parsed = parseIntentJson(raw)
  const clipped = formatSenderIntentPhrase(parsed?.shortIntent ?? "", 10)
  if (!clipped) return

  const merged = mergeMessageMetadataJson(latest.metadata, { shortIntent: clipped })

  await db.message.update({
    where: { id: input.messageId },
    data: { metadata: merged },
  })
}
