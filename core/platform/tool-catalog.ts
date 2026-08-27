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
 * platform really performs today (evidence noted per tool). Registration
 * never equals authorization. Since AI-06, tools migrated from the legacy
 * agent route carry a `reference` handler binding resolved by the canonical
 * agent binding registry (`agents/forte/canonical/agent-bindings.ts`);
 * definitions without a binding remain `unbound` and are NEVER executable
 * (FOUND-03 execution gate).
 */

import { z } from "zod"
import { defineTool, type PlatformToolDefinition } from "./tool-definition"

export const TOOL_KEYS = [
  "search_client",
  "get_client",
  "search_task",
  "search_invoice",
  "create_task",
  "create_content",
  "create_idea",
  "create_campaign",
  "summarize_conversation",
  "draft_reply",
  "send_reply",
] as const
export type ToolKey = (typeof TOOL_KEYS)[number]

/**
 * Existing operation: clientes search (legacy agent `buscar_clientes` /
 * Forte read handler `clientes.list`). AI-06 binds it to the canonical agent
 * handler and extends the result additively with the contact fields the
 * legacy operation always returned.
 */
const SEARCH_CLIENT = defineTool({
  key: "search_client",
  description:
    "Search the workspace's clients/people by name, email or company (free text).",
  requiresCapabilities: ["person.read"],
  effect: "read",
  riskClass: "read",
  inputSchema: z
    .object({
      query: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(50).optional(),
    })
    .strict(),
  outputSchema: z.object({
    results: z.array(
      z.object({
        personId: z.string().min(1),
        displayName: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      }),
    ),
  }),
  handler: { kind: "reference", ref: "forte.agent.search_client" },
  executionPolicy: "immediate",
})

/**
 * Existing operation: cliente detail with related proyectos/facturas (legacy
 * agent `detalle_cliente`). Output detail rows keep their storage shape
 * behind a permissive schema; normalizing them is structured-output work
 * (AI-07), not authorization work.
 */
const GET_CLIENT = defineTool({
  key: "get_client",
  description:
    "Get the full detail of one client by id, including projects and invoices.",
  requiresCapabilities: ["person.read"],
  effect: "read",
  riskClass: "read",
  inputSchema: z.object({ clientId: z.string().min(1).max(100) }).strict(),
  outputSchema: z.object({ client: z.object({ id: z.string().min(1) }).passthrough() }),
  handler: { kind: "reference", ref: "forte.agent.get_client" },
  executionPolicy: "immediate",
})

/**
 * Existing operation: tareas search with operational filters (legacy agent
 * `buscar_tareas`; modules/tareas). The task domain is one business noun —
 * legacy `Tarea` storage stays invisible behind `task.read`.
 */
const SEARCH_TASK = defineTool({
  key: "search_task",
  description:
    "Search the workspace's tasks with filters (status, priority, project, overdue, free text).",
  requiresCapabilities: ["task.read"],
  effect: "read",
  riskClass: "read",
  inputSchema: z
    .object({
      status: z.enum(["pendiente", "en-progreso", "completada", "cancelada"]).optional(),
      priority: z.enum(["baja", "media", "alta", "urgente"]).optional(),
      projectId: z.string().min(1).max(100).optional(),
      query: z.string().min(1).max(200).optional(),
      overdue: z.boolean().optional(),
    })
    .strict(),
  outputSchema: z.object({
    results: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  }),
  handler: { kind: "reference", ref: "forte.agent.search_task" },
  executionPolicy: "immediate",
})

/**
 * Existing operation: facturas search with filters (legacy agent
 * `buscar_facturas`; modules/facturacion).
 */
const SEARCH_INVOICE = defineTool({
  key: "search_invoice",
  description:
    "Search the workspace's invoices with filters (status, client, overdue).",
  requiresCapabilities: ["invoice.read"],
  effect: "read",
  riskClass: "read",
  inputSchema: z
    .object({
      status: z.enum(["pendiente", "pagada", "vencida", "borrador"]).optional(),
      clientId: z.string().min(1).max(100).optional(),
      overdue: z.boolean().optional(),
    })
    .strict(),
  outputSchema: z.object({
    results: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  }),
  handler: { kind: "reference", ref: "forte.agent.search_invoice" },
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

/**
 * AI-06 write tools (DECLARED, NOT EXECUTABLE). All three describe real
 * operations (ContentPiece, ContentIdea, Campaign creation — legacy agent
 * `crear_contenido`/`crear_idea`/`crear_campana`), and all three follow the
 * canonical write → `confirmation_required` policy (owner pre-push
 * correction, 2026-08-27: authorization is never automatic execution, and
 * legacy immediate-write behavior is not an owner decision to weaken it).
 * Because no surface has a server-verifiable confirmation contract yet,
 * they are deliberately UNBOUND: never offered to a model, never executable
 * — deferred until a trusted confirmation mechanism exists.
 */

/** Existing operation: ContentPiece creation (legacy agent `crear_contenido`). */
const CREATE_CONTENT = defineTool({
  key: "create_content",
  description:
    "Create a content piece in the editorial module (post, reel, blog, newsletter, ...).",
  requiresCapabilities: ["content.create"],
  effect: "write",
  riskClass: "write",
  inputSchema: z
    .object({
      title: z.string().min(1).max(300),
      copy: z.string().max(20000).optional(),
      platform: z
        .enum([
          "instagram",
          "tiktok",
          "facebook",
          "linkedin",
          "youtube",
          "twitter",
          "blog",
          "newsletter",
          "web",
          "otro",
        ])
        .optional(),
      type: z
        .enum([
          "post",
          "reel",
          "carrusel",
          "story",
          "video",
          "blog",
          "newsletter",
          "guion",
          "pieza-creativa",
          "otro",
        ])
        .optional(),
      status: z.enum(["idea", "borrador", "en-progreso", "programado"]).optional(),
      hashtags: z.string().max(1000).optional(),
      notes: z.string().max(4000).optional(),
      priority: z.enum(["baja", "media", "alta", "urgente"]).optional(),
      campaignId: z.string().min(1).max(100).optional(),
      clientId: z.string().min(1).max(100).optional(),
      projectId: z.string().min(1).max(100).optional(),
    })
    .strict(),
  outputSchema: z.object({ id: z.string().min(1), title: z.string() }).passthrough(),
  handler: { kind: "unbound" },
  executionPolicy: "confirmation_required",
})

/** Existing operation: ContentIdea creation (legacy agent `crear_idea`). */
const CREATE_IDEA = defineTool({
  key: "create_idea",
  description: "Save an idea in the creative idea bank.",
  requiresCapabilities: ["content.create"],
  effect: "write",
  riskClass: "write",
  inputSchema: z
    .object({
      title: z.string().min(1).max(300),
      description: z.string().max(4000).optional(),
      category: z.string().max(100).optional(),
      platform: z.string().max(100).optional(),
      tags: z.string().max(500).optional(),
      clientId: z.string().min(1).max(100).optional(),
      projectId: z.string().min(1).max(100).optional(),
    })
    .strict(),
  outputSchema: z.object({ id: z.string().min(1), title: z.string() }).passthrough(),
  handler: { kind: "unbound" },
  executionPolicy: "confirmation_required",
})

/** Existing operation: Campaign creation (legacy agent `crear_campana`). */
const CREATE_CAMPAIGN = defineTool({
  key: "create_campaign",
  description: "Create a marketing campaign (planning record).",
  requiresCapabilities: ["campaign.create"],
  effect: "write",
  riskClass: "write",
  inputSchema: z
    .object({
      name: z.string().min(1).max(300),
      description: z.string().max(4000).optional(),
      status: z.enum(["idea", "planificacion", "activa"]).optional(),
      brand: z.enum(["skina", "7f", "cliente", "general"]).optional(),
      startDate: z.string().max(30).optional(),
      endDate: z.string().max(30).optional(),
      objectives: z.string().max(4000).optional(),
      clientId: z.string().min(1).max(100).optional(),
      projectId: z.string().min(1).max(100).optional(),
    })
    .strict(),
  outputSchema: z.object({ id: z.string().min(1), name: z.string() }).passthrough(),
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
  get_client: GET_CLIENT,
  search_task: SEARCH_TASK,
  search_invoice: SEARCH_INVOICE,
  create_task: CREATE_TASK,
  create_content: CREATE_CONTENT,
  create_idea: CREATE_IDEA,
  create_campaign: CREATE_CAMPAIGN,
  summarize_conversation: SUMMARIZE_CONVERSATION,
  draft_reply: DRAFT_REPLY,
  send_reply: SEND_REPLY,
} as const satisfies Record<ToolKey, PlatformToolDefinition>

export type ToolCatalog = typeof TOOL_CATALOG
