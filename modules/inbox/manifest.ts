import type { ModuleManifest } from "@core/registry"
import { moduleProgression } from "./levels"

export const manifest: ModuleManifest = {
  id: "inbox",
  name: "Inbox",
  description: "Modulo conversacional para entrada, seguimiento, clasificacion y conversion operativa de mensajes.",
  version: "1.0.0",
  kind: "core",
  namespace: "core.inbox",
  dependencies: ["core/db", "engines/ai"],
  capabilities: {
    crud: true,
    search: true,
    export: false,
    ai: true,
    portal: false,
  },
  models: [
    "InboxEntry",
    "Conversation",
    "Message",
    "ConversationAction",
    "ConversationHandoff",
    "ConversationDraft",
    "AIClassification",
  ],
  provides: [
    "inbox-entries",
    "conversations",
    "conversation-intelligence",
    "conversation-actions",
    "conversation-drafts",
    "handoff",
  ],
  optional: false,
  progression: moduleProgression,
}
