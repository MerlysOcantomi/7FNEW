/**
 * FOUND-01 — Canonical tool catalog (contract demonstration).
 *
 * A TOOL is one executable operation (ARCH-02 §1). A tool is not a
 * capability: several tools may require the same capability, and one tool may
 * require several. Keys are stable snake_case verbs, independent of any AI
 * provider; the Spanish legacy tool names in `agents/forte/tools.ts`
 * (`buscar_clientes`, …) remain untouched and get re-expressed on this
 * catalog in AI-04.
 *
 * DELIBERATELY PARTIAL: each entry below corresponds to an operation the
 * platform really performs today (evidence noted per tool). Every handler is
 * `unbound` — FOUND-01 declares contracts; nothing here is discoverable by an
 * agent or executable, and registration never equals authorization.
 */

import { z } from "zod"
import { defineTool, type PlatformToolDefinition } from "./tool-definition"

export const TOOL_KEYS = [
  "search_client",
  "create_task",
  "summarize_conversation",
  "draft_reply",
  "send_reply",
] as const
export type ToolKey = (typeof TOOL_KEYS)[number]

/** Existing operation: clientes list (Forte read handler `clientes.list`). */
const SEARCH_CLIENT = defineTool({
  key: "search_client",
  description: "Search the workspace's clients/people by name or free text.",
  requiresCapabilities: ["person.read"],
  effect: "read",
  riskClass: "read",
  inputSchema: z.object({
    query: z.string().min(1).max(200),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        personId: z.string().min(1),
        displayName: z.string(),
      }),
    ),
  }),
  handler: { kind: "unbound" },
  executionPolicy: "immediate",
})

/**
 * Existing operation: WorkspaceTask creation (canonical write layer; the one
 * Forte-approved write action `tareas.create`). Proposed work must be
 * approved — hence confirmation_required.
 */
const CREATE_TASK = defineTool({
  key: "create_task",
  description: "Create a workspace task (proposed work requires approval).",
  requiresCapabilities: ["task.write"],
  effect: "write",
  riskClass: "write",
  inputSchema: z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(4000).optional(),
    personId: z.string().min(1).optional(),
  }),
  outputSchema: z.object({
    taskId: z.string().min(1),
  }),
  handler: { kind: "unbound" },
  executionPolicy: "confirmation_required",
})

/** Existing operation: Fanny conversation summary (inbox intelligence). */
const SUMMARIZE_CONVERSATION = defineTool({
  key: "summarize_conversation",
  description: "Summarize a conversation for the operator.",
  requiresCapabilities: ["conversation.read", "ai.summarize"],
  effect: "read",
  riskClass: "read",
  activity: "ai.conversation_summary",
  inputSchema: z.object({
    conversationId: z.string().min(1),
  }),
  outputSchema: z.object({
    summary: z.string().min(1),
  }),
  handler: { kind: "unbound" },
  executionPolicy: "immediate",
})

/** Existing operation: Fanny/composer reply drafting. Draft ≠ send. */
const DRAFT_REPLY = defineTool({
  key: "draft_reply",
  description: "Draft a reply to a conversation for operator review.",
  requiresCapabilities: ["conversation.read", "ai.draft"],
  effect: "draft",
  riskClass: "read",
  activity: "ai.reply_draft",
  inputSchema: z.object({
    conversationId: z.string().min(1),
    instructions: z.string().max(2000).optional(),
  }),
  outputSchema: z.object({
    draft: z.string().min(1),
  }),
  handler: { kind: "unbound" },
  executionPolicy: "controlled",
})

/**
 * Existing operation: outbound send (inbox outbound-service). Reaches a
 * customer → communication risk, confirmation required. Not AI-metered
 * itself, so no activity key.
 */
const SEND_REPLY = defineTool({
  key: "send_reply",
  description: "Send a reply to the customer on the conversation's channel.",
  requiresCapabilities: ["conversation.reply"],
  effect: "write",
  riskClass: "communication",
  inputSchema: z.object({
    conversationId: z.string().min(1),
    body: z.string().min(1).max(10000),
  }),
  outputSchema: z.object({
    messageId: z.string().min(1),
  }),
  handler: { kind: "unbound" },
  executionPolicy: "confirmation_required",
})

export const TOOL_CATALOG = {
  search_client: SEARCH_CLIENT,
  create_task: CREATE_TASK,
  summarize_conversation: SUMMARIZE_CONVERSATION,
  draft_reply: DRAFT_REPLY,
  send_reply: SEND_REPLY,
} as const satisfies Record<ToolKey, PlatformToolDefinition>

export type ToolCatalog = typeof TOOL_CATALOG
