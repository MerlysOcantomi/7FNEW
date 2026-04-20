export const CONVERSATION_ACTIVE_STATUSES = [
  "new",
  "triaged",
  "assigned",
  "awaiting_response",
  "lead_detected",
] as const

export const CONVERSATION_TERMINAL_STATUSES = [
  "converted",
  "closed",
  "archived",
  "trashed",
] as const

export type ConversationActiveStatus = (typeof CONVERSATION_ACTIVE_STATUSES)[number]
export type ConversationTerminalStatus = (typeof CONVERSATION_TERMINAL_STATUSES)[number]
export type ConversationStatus = ConversationActiveStatus | ConversationTerminalStatus

const TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  new: ["triaged", "assigned", "awaiting_response", "converted", "closed", "archived", "trashed"],
  triaged: ["assigned", "awaiting_response", "lead_detected", "converted", "closed", "archived", "trashed"],
  assigned: ["awaiting_response", "converted", "closed", "archived", "trashed"],
  awaiting_response: ["assigned", "converted", "closed", "archived", "trashed"],
  lead_detected: ["assigned", "awaiting_response", "converted", "closed", "archived", "trashed"],
  converted: ["assigned", "closed", "archived", "trashed"],
  closed: ["assigned", "triaged", "archived", "trashed"],
  archived: ["triaged", "closed", "trashed"],
  trashed: ["triaged"],
}

export function isReusableConversationStatus(status?: string | null): status is ConversationActiveStatus {
  return CONVERSATION_ACTIVE_STATUSES.includes((status ?? "") as ConversationActiveStatus)
}

export function isTerminalConversationStatus(status?: string | null): status is ConversationTerminalStatus {
  return CONVERSATION_TERMINAL_STATUSES.includes((status ?? "") as ConversationTerminalStatus)
}

export function canTransitionConversationStatus(
  from: string | null | undefined,
  to: string | null | undefined,
) {
  if (!from || !to) return false
  if (from === to) return true
  const allowed = TRANSITIONS[from as ConversationStatus] ?? []
  return allowed.includes(to as ConversationStatus)
}

export function transitionConversationStatus(
  current: string | null | undefined,
  next: string,
) {
  if (!current) return next
  return canTransitionConversationStatus(current, next) ? next : current
}

export function normalizeLegacyInboxStatus(status?: string | null): ConversationStatus | null {
  switch (status) {
    case "nuevo":
      return "new"
    case "clasificado":
      return "triaged"
    case "procesado":
      return "converted"
    case "archivado":
      return "archived"
    case "new":
    case "triaged":
    case "assigned":
    case "awaiting_response":
    case "lead_detected":
    case "converted":
    case "closed":
    case "archived":
    case "trashed":
      return status
    default:
      return null
  }
}

export function getReopenStatusFrom(current: string | null | undefined): ConversationStatus {
  if (current === "archived" || current === "closed" || current === "trashed") return "triaged"
  return "triaged"
}
