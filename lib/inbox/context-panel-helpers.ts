import { getShortIntentFromMessageMetadata } from "@/lib/inbox/parse-message-metadata"

export type IntentOperationalStatus = "open" | "in_progress" | "done"

export interface ThreadMessageLite {
  id: string
  content: string
  role: string
  direction: string
  isInternal: boolean
  createdAt: string
  metadata?: string | null
}

export function getFocusedThreadMessage(
  messages: ThreadMessageLite[] | undefined,
  focusedMessageId: string | null,
): ThreadMessageLite | null {
  if (!focusedMessageId || !messages?.length) return null
  return messages.find((m) => m.id === focusedMessageId) ?? null
}

/** Returns null if focus id is stale (not in list). */
export function resolveValidFocusedMessageId(
  messages: ThreadMessageLite[] | undefined,
  focusedMessageId: string | null,
): string | null {
  if (!focusedMessageId) return null
  if (!messages?.some((m) => m.id === focusedMessageId)) return null
  return focusedMessageId
}

export function filterActionsBySourceMessage<T extends { sourceMessageId?: string | null }>(
  actions: T[] | undefined,
  focusedMessageId: string | null,
): T[] {
  if (!focusedMessageId || !actions?.length) return []
  return actions.filter((a) => a.sourceMessageId === focusedMessageId)
}

export function excludeActionsBySourceMessage<T extends { sourceMessageId?: string | null }>(
  actions: T[] | undefined,
  focusedMessageId: string | null,
): T[] {
  if (!actions?.length) return []
  if (!focusedMessageId) return actions
  return actions.filter((a) => !a.sourceMessageId || a.sourceMessageId !== focusedMessageId)
}

export function findDraftForSourceMessage<T extends { sourceMessageId?: string | null }>(
  drafts: T[] | undefined,
  focusedMessageId: string | null,
): T | null {
  if (!focusedMessageId || !drafts?.length) return null
  return drafts.find((d) => d.sourceMessageId === focusedMessageId) ?? null
}

export function shortIntentFromThreadMessage(m: ThreadMessageLite): string | null {
  return getShortIntentFromMessageMetadata(m.metadata ?? null)
}

/** Honest derived summary: trimmed content clip, no AI claims. */
export function deriveMessageSummaryPlain(content: string, maxChars = 280): string {
  const t = content.trim().replace(/\s+/g, " ")
  if (!t) return ""
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars).trim()}…`
}

export function intentStatusLabel(status: IntentOperationalStatus): string {
  switch (status) {
    case "open":
      return "Open"
    case "in_progress":
      return "In progress"
    case "done":
      return "Done"
    default:
      return status
  }
}
