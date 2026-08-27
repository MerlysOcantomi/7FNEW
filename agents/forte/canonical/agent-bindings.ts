/**
 * AI-06 — Canonical agent binding registry.
 *
 * The ONLY thing this registry knows is which server-side handler executes a
 * canonical ToolKey. It deliberately duplicates NOTHING from the canonical
 * catalog: no descriptions, no capabilities, no permissions, no effects, no
 * confirmation policy, no product ownership — those stay authoritative in
 * `core/platform/tool-catalog.ts`, and FOUND-03 authorization + canonical
 * input validation run in the agent loop before any handler here executes.
 *
 * Only tools whose catalog definition carries a `reference` handler may be
 * registered (asserted by tests); an unbound definition is never executable.
 *
 * READ-ONLY BY DESIGN (owner pre-push correction, 2026-08-27): every tool
 * that persists a write follows the canonical `confirmation_required`
 * policy, and this surface has no server-verifiable confirmation contract —
 * so NO write tool has a runtime binding here. Deliberately absent:
 *   - `create_task`, `create_content`, `create_idea`, `create_campaign`:
 *     confirmation_required without a trusted confirmation mechanism —
 *     deferred, unbound, fail closed (a model-invented call never reaches a
 *     handler).
 *   - image generation: no usage-preserving image adapter exists; the legacy
 *     DALL·E path (`tools/image-generator.ts`) must not survive as a hidden
 *     provider/cost bypass. Needs its own bounded image-adapter mission.
 *   - project detail: the project domain has no canonical capability/product
 *     mapping yet (FOUND-02a maps it to null) — an owner product decision.
 */

import type { ToolKey } from "@core/platform/tool-catalog"
import type { AgentToolBinding } from "@/engines/ai/agent-loop"
import { getClient, searchClient, searchInvoice, searchTask } from "./agent-handlers"

/* eslint-disable @typescript-eslint/no-explicit-any -- inputs are validated
 * against each tool's canonical zod schema in the loop before dispatch; the
 * registry's public surface stays `unknown`. */
const BINDINGS: ReadonlyMap<ToolKey, AgentToolBinding> = new Map<ToolKey, AgentToolBinding>([
  ["search_client", { run: (input, context) => searchClient(input as any, context) }],
  ["get_client", { run: (input, context) => getClient(input as any, context) }],
  ["search_task", { run: (input, context) => searchTask(input as any, context) }],
  ["search_invoice", { run: (input, context) => searchInvoice(input as any, context) }],
])
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getAgentToolBindings(): ReadonlyMap<ToolKey, AgentToolBinding> {
  return BINDINGS
}
