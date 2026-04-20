import type { ReadonlyURLSearchParams } from "next/navigation"

export type FocusedMessageValidationInput = {
  conversationId: string
  messageId: string | null | undefined
  messageIdsInThread: Set<string> | null | undefined
}

/**
 * El mensaje enfocado pertenece a la conversación y existe en el hilo cargado.
 */
export function isValidFocusedMessageForConversation(input: FocusedMessageValidationInput): boolean {
  const mid = input.messageId?.trim()
  if (!mid) return false
  const ids = input.messageIdsInThread
  if (!ids || ids.size === 0) return false
  return ids.has(mid)
}

export function parseFocusedMessageFromSearchParams(searchParams: ReadonlyURLSearchParams): {
  conversationId: string | null
  messageId: string | null
} {
  return {
    conversationId: searchParams.get("id"),
    messageId: searchParams.get("messageId"),
  }
}

/** Construye query conservando otros parámetros (filter, etc.). */
export function buildInboxSearchParamsWithMessageFocus(
  current: URLSearchParams | ReadonlyURLSearchParams,
  next: {
    conversationId?: string | null
    messageId?: string | null
  },
): URLSearchParams {
  const params = new URLSearchParams(current.toString())

  if (next.conversationId !== undefined) {
    if (next.conversationId) params.set("id", next.conversationId)
    else params.delete("id")
  }

  if (next.messageId !== undefined) {
    if (next.messageId) params.set("messageId", next.messageId)
    else params.delete("messageId")
  }

  return params
}
