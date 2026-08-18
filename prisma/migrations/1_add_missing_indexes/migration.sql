-- 1_add_missing_indexes — CORE-03C-2B (C4).
--
-- The 21 Prisma-declared indexes that were never deployed (CORE-03B §11 LOW;
-- decisions doc §9). Additive only: no table, column, constraint or data
-- change. Statements are extracted verbatim from the canonical SQLite DDL
-- generated from the current prisma/schema.prisma.
--
-- The two column-dependent indexes (InboxTodo_workspaceId_workspaceTaskId_idx,
-- QRCode_workspaceId_module_recordId_idx) are deliberately NOT here: their
-- columns do not exist yet. They land in 2_add_link_columns.
--
-- No IF NOT EXISTS on purpose: a failure must stay visible, not be skipped.
--
-- Rollback (non-executable reference — do not run as part of this migration):
--   each statement below reverses with the corresponding
--   DROP INDEX "<index name>";
--   in any order; index drops touch no data.

CREATE INDEX "Contact_workspaceId_email_idx" ON "Contact"("workspaceId", "email");

CREATE INDEX "Contact_workspaceId_telefono_idx" ON "Contact"("workspaceId", "telefono");

CREATE INDEX "Contact_workspaceId_clienteId_idx" ON "Contact"("workspaceId", "clienteId");

CREATE INDEX "Conversation_workspaceId_status_idx" ON "Conversation"("workspaceId", "status");

CREATE INDEX "Conversation_workspaceId_lastMessageAt_idx" ON "Conversation"("workspaceId", "lastMessageAt");

CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

CREATE INDEX "Conversation_clienteId_idx" ON "Conversation"("clienteId");

CREATE INDEX "Conversation_proyectoId_idx" ON "Conversation"("proyectoId");

CREATE INDEX "Conversation_connectionId_idx" ON "Conversation"("connectionId");

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

CREATE INDEX "Message_workspaceId_createdAt_idx" ON "Message"("workspaceId", "createdAt");

CREATE INDEX "ConversationAction_conversationId_createdAt_idx" ON "ConversationAction"("conversationId", "createdAt");

CREATE INDEX "ConversationAction_workspaceId_status_idx" ON "ConversationAction"("workspaceId", "status");

CREATE INDEX "ConversationAction_workspaceId_source_idx" ON "ConversationAction"("workspaceId", "source");

CREATE INDEX "ConversationAction_workspaceId_sourceMessageId_idx" ON "ConversationAction"("workspaceId", "sourceMessageId");

CREATE INDEX "AIClassification_workspaceId_leadScore_idx" ON "AIClassification"("workspaceId", "leadScore");

CREATE INDEX "ConversationHandoff_workspaceId_status_idx" ON "ConversationHandoff"("workspaceId", "status");

CREATE INDEX "ConversationDraft_conversationId_createdAt_idx" ON "ConversationDraft"("conversationId", "createdAt");

CREATE INDEX "ConversationDraft_workspaceId_status_idx" ON "ConversationDraft"("workspaceId", "status");

CREATE INDEX "InboxEntry_workspaceId_conversationId_idx" ON "InboxEntry"("workspaceId", "conversationId");

CREATE INDEX "InboxEntry_workspaceId_contactId_idx" ON "InboxEntry"("workspaceId", "contactId");

