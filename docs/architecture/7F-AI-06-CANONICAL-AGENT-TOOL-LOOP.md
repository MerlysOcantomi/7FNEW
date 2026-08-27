# 7F — AI-06: Canonical Agent Route & Tool Loop Migration

> **STATUS: IMPLEMENTED — `app/api/ai/agent/route.ts` runs on the shared
> SevenF Intelligence foundations.** One route enforced; NOT platform-wide
> enforcement. Zero schema/migration/production changes.
>
> AI-06 (2026-08-26) migrates the repo's only tool-loop agent path onto
> FOUND-02b (usage-preserving execution) and FOUND-03 (canonical tool
> authorization), removes the route's duplicated OpenAI client and retires
> the legacy `AGENT_TOOLS` provider-facing vocabulary.

## Previous (duplicated) architecture

The agent route owned: an inline OpenAI chat-completions fetch (hardcoded
`gpt-4.1`, usage discarded), the repo's only tool loop, the Spanish
`AGENT_TOOLS` vocabulary (10 tools), an executor switch with permissive
`catch → {}` argument parsing, and a separate DALL·E Images fetch. FOUND-03
had bounded the confirmed VIEWER write bypass with a temporary role
guardrail on that path. The route had **no UI or external callers**
(verified again at the audited SHA), which made it the designated first
migration (ARCH-03 §27).

## New request & execution flow

```txt
POST /api/ai/agent
  requireReadAccess(request)                         (unchanged auth: session +
                                                      strict-parsed membership)
  getWorkspaceCapabilitySources(workspaceId)          persisted evidence (status,
    → resolveWorkspaceCapabilitySnapshot              plan, config.modules,
  membership = { role: wsRole }                       Presence standalone)
  gatherBusinessContext(workspaceId)                  (unchanged context block)
  runAgentToolLoop(...)                               shared use case
  → { respuesta, actions? }                           compatible response
```

`runAgentToolLoop` (`engines/ai/agent-loop.ts`) per turn:

```txt
resolveAvailableTools(context)              FOUND-03 discovery (full decision)
  → executable ∩ bound ∩ not-confirmation   provider tool defs derived from
  ∩ not-write-effect ∩ schema-convertible   canonical metadata + zod schemas
loop (≤ maxRounds):
  executeAIToolTurn(...)                    FOUND-02b: ONE normalized
                                            AIExecutionResult PER provider call
  for each model tool call:
    duplicate tool-call id?  → controlled refusal (never re-executed)
    authorizeToolInvocation  → full FOUND-03 recheck immediately pre-execution
    executionPolicy check    → confirmation_required ⇒ typed refusal
    strict JSON parse + privileged-key rejection + canonical zod validation
    binding lookup (ToolKey → handler)      missing ⇒ fail closed
    limits (total calls, identical repeats) exceeded ⇒ controlled stop
    handler(validatedInput, serverContext)  errors ⇒ controlled result, NO retry
  finish_reason ≠ "tool_calls" → final text
```

## Provider-neutral tool-call contract (FOUND-02b, additive)

`engines/ai/execution-contract.ts` adds `AIProviderToolDefinition`,
`AIToolCall` (id + name + raw untrusted arguments), `AIAssistantTurn`,
assistant-tool-call / tool-result message types and `AIToolTurnRequest`.
`executeAIToolTurn` returns `AIExecutionResult<AIAssistantTurn>` — provider,
actual served model, usage (`unavailable` stays explicit, never zero),
latency, provider request id, finish reason. OpenAI wire shapes
(`tool_calls`, `tool_call_id`, `tools`) exist only inside
`engines/ai/chat-adapter.ts`; malformed provider tool calls fail as
`invalid_output`. Existing string callers (`executeAI`, `askMotorIA`,
`askMotorIAWithHistory`) keep byte-identical request bodies and types.

## Canonical discovery, binding boundary and confirmation

- The catalog (`core/platform/tool-catalog.ts`) gained the verified agent
  operations: `get_client`, `search_task`, `search_invoice` (bound reads;
  `search_client` was bound and its output extended additively) and the
  declared-but-unbound write definitions `create_content`, `create_idea`,
  `create_campaign`. Only the four read tools carry
  `handler: { kind: "reference" }`.
- `agents/forte/canonical/agent-bindings.ts` maps ToolKey → handler,
  execution code ONLY (no metadata/capability/policy duplication);
  `agent-handlers.ts` holds the workspace-scoped READ Prisma operations.
  **The registry is read-only by design.**
- **Every write-persisting tool follows the canonical
  `confirmation_required` policy** (`create_task`, `create_content`,
  `create_idea`, `create_campaign`) — owner pre-push correction 2026-08-27:
  authorization is never automatic execution, and the legacy immediate-write
  behavior was not an owner decision to weaken the canonical policy. This
  surface has no server-verifiable confirmation contract, so these tools are
  never offered to the model; a model-invented call gets a typed
  `confirmation_required` refusal when only confirmation is missing (denied
  otherwise), and no role — OWNER included — substitutes for confirmation
  (the model's claim that the user confirmed is not evidence). The agent
  loop additionally withholds and refuses ANY write-effect tool on this
  surface structurally, independent of policy or bindings. No confirmation
  UI was built (out of scope); the write tools are **deferred** until a
  trusted confirmation contract exists.

## Loop limits & usage preservation

Limits (tested): `maxRounds 5` (legacy value), `maxToolCalls 16`,
`maxIdenticalToolCalls 3`, `maxToolResultChars 20000`, duplicate provider
tool-call ids execute at most once, and no side-effect is ever auto-retried.
Every provider round's normalized result is preserved in
`AgentLoopResult.providerCalls` (source of truth for a future Usage Meter
sink). `AgentUsageSummary` aggregates under documented rules: sums cover
only calls that reported the field; `requestCount` counts actual provider
calls; `unavailableCalls`/`complete` keep partial usage visible. Usage
persistence remains out of scope.

## Attribution

Every provider round carries `attribution: { workspaceId }` (authenticated)
and `activity: "ai.agent_turn"` (new canonical key; evidence: this route).
Planning/chat rounds are never attributed to a tool, and no singular
"primary capability" is fabricated. Tool execution records retain the
canonical ToolKey actually requested and authorized. No model-generated
argument can override workspace, user, role or membership: identity comes
only from `requireReadAccess` + server-loaded evidence, and privileged keys
inside tool arguments are rejected.

## Legacy tools — migrated / omitted / deferred

| Legacy | Canonical | Disposition |
|---|---|---|
| `buscar_clientes` | `search_client` (person.read) | migrated |
| `detalle_cliente` | `get_client` (person.read) | migrated |
| `buscar_tareas` | `search_task` (task.read) | migrated |
| `buscar_facturas` | `search_invoice` (invoice.read) | migrated |
| `crear_contenido` | `create_content` (content.create, confirmation_required) | **deferred** — declared, unbound; no trusted confirmation contract |
| `crear_idea` | `create_idea` (content.create, confirmation_required) | **deferred** — declared, unbound; no trusted confirmation contract |
| `crear_campana` | `create_campaign` (campaign.create, confirmation_required) | **deferred** — declared, unbound; no trusted confirmation contract |
| `crear_tarea` | `create_task` (task.write, confirmation_required) | **deferred** — same; canonical policy not weakened |
| `detalle_proyecto` | — | **omitted** — the project domain has no canonical capability/product (FOUND-02a maps it to `null`); adding one is an owner product decision |
| `generar_imagen` | — | **omitted** — see below |

The AI-06 agent is therefore **read-only**: the executable set is exactly
`search_client`, `get_client`, `search_task`, `search_invoice`, each still
gated per invocation by Workspace CAN + User MAY + binding + narrowing.

Deleted as superseded: `agents/forte/tools.ts` (AGENT_TOOLS),
`agents/forte/executor.ts`, `agents/forte/legacy-tool-guardrail.ts` (+test)
and `agents/forte/runtime/agent-adapter.ts` (all reachable only from this
route; verified). Canonical FOUND-03 authorization now fully supersedes the
temporary guardrail on this path — one policy layer, not two.

## Image generation (intentional temporary change)

`tools/image-generator.ts` (DALL·E + Blob upload) is NOT usage-preserving
and is NOT part of FOUND-02b. To avoid a hidden provider/cost bypass, image
generation is not in the canonical tool vocabulary and cannot be executed
through the agent. The file itself remains for any future bounded
**image-adapter mission** (proposed follow-up: an `images` capability of the
OpenAI adapter with normalized image-unit usage), which should also decide
the `generate_image` ToolDefinition and its policy.

## Compatibility

Preserved: authentication semantics (`requireReadAccess`, header allowlist),
request shape `{message, history}`, validation messages/limits, response
shape `{respuesta, actions?}`, default provider/model (`openai`/`gpt-4.1`),
sampling (0.6 / 8192), system-prompt intent, error-status behavior
(auth errors keep their status; provider failures are 500).
Intentional changes (route has no UI callers; all documented):

1. **The agent no longer executes writes.** All persisting tools are
   confirmation-gated and deferred; the model is instructed to hand the
   user a ready-to-copy proposal instead. This applies the canonical
   write→confirmation policy (owner pre-push correction) and supersedes the
   legacy immediate-write behavior.
2. `actions[].tool` now carries canonical ToolKeys; denied/invalid/
   confirmation-refused calls appear with `success: false` and a safe reason.
3. `images` no longer appears (image generation omitted).
4. Workspace **capability** enforcement is active on this path (the AI-06
   activation FOUND-03 announced): e.g. a plan without finance no longer
   exposes invoice reads to the agent.
5. `detalle_proyecto` / `generar_imagen` per the table.
6. The system prompt no longer promises unavailable tools and instructs the
   model to use only the read tools actually offered per turn.

## Exact runtime-enforcement boundary (no false claims)

- **Enforced by FOUND-03 now:** only `app/api/ai/agent/route.ts` via
  `engines/ai/agent-loop.ts` (discovery + per-invocation authorization,
  workspace CAN + user MAY + binding + narrowing + policy).
- **Not using FOUND-03:** every other route/surface (they keep the existing
  RBAC helpers); Forte pipeline paths (`/api/forte/*`) keep their own
  governance; voice keeps its confirmation stack.
- **Legacy guardrails:** the FOUND-03 legacy-tool guardrail was removed
  together with the legacy path it guarded (nothing imports it anymore).
- **Still not enforced anywhere:** persistent entitlements, plan limits,
  Usage Meter persistence, platform-wide capability gating.
- Capability evidence remains **observational** (plan/config/Presence, per
  FOUND-02a) until persistent entitlements exist.

## Schema / migrations / production

None. No schema changes, no migrations, no production connections, no
production writes; all tests run without network.
