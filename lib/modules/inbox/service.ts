// Re-export from new location — will be removed after full migration
export {
  createConversationFromInboxEntry,
  listConversations,
  listConversationActions,
  getConversationById,
  addMessage,
  transitionConversation,
  updateConversationHandoff,
  updateConversationDraft,
  createConversationAction,
  approveConversationAction,
  dismissConversationAction,
  getConversationAction,
  executeConversationAction,
  convertConversationToRecords,
  parseConversationJsonFields,
} from "@modules/inbox/service"
