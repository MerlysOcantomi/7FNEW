// Re-export from new location — will be removed after full migration
export {
  CONVERSATION_ACTIVE_STATUSES,
  CONVERSATION_TERMINAL_STATUSES,
  isReusableConversationStatus,
  isTerminalConversationStatus,
  canTransitionConversationStatus,
  transitionConversationStatus,
  normalizeLegacyInboxStatus,
  getReopenStatusFrom,
} from "@modules/inbox/state"
export type {
  ConversationActiveStatus,
  ConversationTerminalStatus,
  ConversationStatus,
} from "@modules/inbox/state"
