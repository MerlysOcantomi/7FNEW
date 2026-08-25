# 7F — FOUND-01: Shared Capability & Tool Vocabulary

> **STATUS: IMPLEMENTED FOUNDATION — VOCABULARY AND TYPES ONLY.**
>
> FOUND-01 (2026-08-25) materializes the shared vocabulary required by
> [`7F-ENTITLEMENTS-CAPABILITIES-TOOLS.md`](7F-ENTITLEMENTS-CAPABILITIES-TOOLS.md)
> (ARCH-02, Phase 1) and
> [`7F-SEVENF-INTELLIGENCE-AI-GATEWAY.md`](7F-SEVENF-INTELLIGENCE-AI-GATEWAY.md)
> (ARCH-03, tool contract). It is impossible to confuse with enforcement:
> **no entitlement resolution, no capability/permission enforcement, no AI
> gateway, no tool discovery, no tool execution, no schema changes, no
> production access exist in FOUND-01.** Registering a key or a tool grants
> nothing.

## What was materialized

Canonical source: **`core/platform/`** (pure TypeScript + zod; no React, no
Next.js, no AI SDK, no `@core/db`; importable from server and domain logic).

| Concern | File | Content |
|---|---|---|
| Effects / execution policies / risk classes | `core/platform/vocabulary.ts` | `TOOL_EFFECTS` (read·navigate·draft·propose·write), `TOOL_EXECUTION_POLICIES` (immediate·controlled·confirmation_required) — adopted from voice, now canonical here; `TOOL_RISK_CLASSES` (read·write·external_side_effect·financial·communication·admin, ARCH-03 §6, lowercase snake per repo convention) |
| Product keys | `core/platform/products.ts` | `core` (always available), `smart_inbox`, `growth`, `finance` + display labels |
| Capability keys | `core/platform/capabilities.ts` | 28 `<domain>.<action>` keys, every one evidence-backed by an existing feature; single `person.*` domain (never `contact.*`/`cliente.*`) |
| Activity keys | `core/platform/activities.ts` | 7 `ai.*` attribution keys backed by the ARCH-03 inventory |
| Shared tool contract | `core/platform/tool-definition.ts` | `PlatformToolDefinition` (key, requiresCapabilities, requiresPermissions?, effect, riskClass, activity?, zod input/output schemas, handler binding, availability, executionPolicy), `defineTool`, `ToolHandlerFor` typed schema↔handler inference, strict `parseToolInput`/`parseToolOutput` (no `catch → {}`), declared-only `ToolExecutionContext` |
| Tool catalog | `core/platform/tool-catalog.ts` | 5 contract-demonstration tools over real operations (`search_client`, `create_task`, `summarize_conversation`, `draft_reply`, `send_reply`) — **all handlers `unbound`** |
| Declarative catalogs + invariants | `core/platform/catalog.ts` | `PRODUCT_CAPABILITIES` (product → capabilities), derived `getToolsForCapability` (capability → tools, never a second manual list), `ADDON_GRANTED_CAPABILITIES`, `validatePlatformFoundation()` / `validateToolDefinition()` |
| Public surface | `core/platform/index.ts` | controlled exports |
| Tests | `core/platform/foundation.test.ts` | 15 invariant/schema/typing/compatibility tests |

## Reused, not reinvented

- **Voice** (`core/voice/contracts.ts`): `TOOL_EFFECTS` / `TOOL_EXECUTION_POLICIES`
  moved to `core/platform/vocabulary.ts`; voice **re-exports** them, so exactly
  one canonical value set exists and every voice import path, value and test
  (55/55) is unchanged.
- **Forte**: untouched. The legacy `ToolDefinition` in `agents/forte/tools.ts`
  (OpenAI function-calling shape) keeps its name; the canonical platform
  contract is deliberately named `PlatformToolDefinition` to resolve the
  collision explicitly (ARCH-03: Forte re-lands on the shared contract in
  AI-04/AI-06, not now).
- **Freya / registry / plans**: untouched. `core/system/plans.ts` and
  `core/registry` remain as-is; their mapping onto this vocabulary is
  FOUND-02a / AI-04 work (ARCH-02 §21).

## Deliberately partial

All four key catalogs are partial by design and extend by appending only:

- Products: `finesse` (offering), `growth.presence` (add-on) and limit
  add-ons are entitlement-kind constructs → typed in FOUND-02a.
  `voice.session` is listed as a declared add-on-granted capability.
- No permission catalog exists yet: `requiresPermissions` uses capability
  keys (ARCH-02 §11 "stricter-only"); a finer permission vocabulary is an
  explicit future owner decision.
- Tool catalog holds contract demonstrations over real operations only; no
  speculative future tools.

## Explicitly left for the next missions

- **FOUND-02a** — read-only Entitlements → Capabilities resolver
  (`resolveWorkspaceCapabilities`, `canWorkspace`/`canUser`), reconciling
  `plans.ts` / `config.modules` / `PresenceSubscription` behind this
  vocabulary.
- **FOUND-02b (AI-01 → AI-03)** — usage-preserving shared execution contract
  over `engines/ai`.
- Later: tool registry runtime + handler binding (AI-04), capability-based
  tool discovery and execution authorization (AI-05), migrations of the
  legacy agent route and remaining paths, Usage Meter, telemetry, HITL
  engine, billing.
