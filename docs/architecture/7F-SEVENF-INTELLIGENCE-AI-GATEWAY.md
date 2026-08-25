# 7F — SevenF Intelligence / AI Gateway (Tools · Providers · Context · Usage)

> **STATUS: TARGET ARCHITECTURE / DESIGN. NOT YET IMPLEMENTED.**
>
> ARCH-03 (2026-08-24). Designs the shared intelligence layer mandated by
> [`7F-FUTURE-PLATFORM-ARCHITECTURE.md`](7F-FUTURE-PLATFORM-ARCHITECTURE.md)
> §7 (SevenF Intelligence), §8 (provider abstraction) and §10 (usage meter),
> consuming the access model of
> [`7F-ENTITLEMENTS-CAPABILITIES-TOOLS.md`](7F-ENTITLEMENTS-CAPABILITIES-TOOLS.md)
> (ARCH-02) — especially *Entitlements → Capabilities → Tools* and
> *persona ≠ permission boundary*. Design + read-only audit only: no runtime,
> no provider changes, no refactors, no tables.

---

## 1. What SevenF Intelligence is

**SevenF Intelligence ≠ a specific agent.** It is the common infrastructure
under every AI face of the platform — Fanny, Freya, Forte, the Finesse
assistant, Smart Inbox AI, Growth AI, Finance AI, and future agents.

Personas/agents MAY vary: tone, instructions, tool preference, workflow
role, domain framing.
Personas/agents may NEVER own: authentication, authorization, tenant
isolation, provider secrets, entitlement enforcement. Those belong to the
gateway, once, for everyone.

The failure mode this design prevents is already visible in the repo:
independent provider fetches, per-route context builders, discarded usage,
and agent-local capability logic (§2–§3). Every new product surface built
without a gateway multiplies all four.

---

## 2. Current AI inventory (read-only audit, 2026-08-24, master @ `0233ded`)

Providers actually present: **OpenAI Chat Completions** (raw fetch),
**DeepSeek Chat Completions** (raw fetch), **OpenAI Realtime** (server-side
client-secret mint + `@openai/agents` WebRTC in the browser), **OpenAI
Images** (DALL·E 3). No Anthropic/Gemini/ElevenLabs, no embeddings, no
official SDK client server-side (`new OpenAI` appears nowhere), **no
streaming anywhere**, and **no text path captures provider usage**.

| # | Path | Purpose | Provider/model | Context source | Tools | WS-aware | Usage | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `app/api/ai/route.ts` | generic MotorIA prompt | via `askMotorIA` (mode→`gpt-4.1`/`deepseek-reasoner`) | raw prompt | — | auth only | discarded | legacy |
| 2 | `app/api/ai/chat/route.ts` | multi-turn chat modes | `askMotorIAWithHistory` → `gpt-4.1` | client history | — | no | discarded | legacy |
| 3 | `app/api/ai/agent/route.ts` | **Mr. Forte tool-loop agent** (only tool loop in repo) | **inline duplicated OpenAI fetch**, hardcoded `gpt-4.1` | `gatherBusinessContext()` SQL-dump text | 10 legacy tools + 4 Forte capability-filtered bridges; ad-hoc `JSON.parse` args | yes | discarded | orphan (no UI caller) |
| 4–10 | `app/api/ai/{tareas,clientes,proyectos,facturacion,finanzas,correct,resume}` | per-domain helpers | `askMotorIA` modes | `engines/ai/prompts.ts` builders over POST body (no DB) | — | no | discarded | legacy (via `@/lib/ai` shim) |
| 11 | `app/api/assistant/finesse/route.ts` | Ask Finesse (text) | `askMotorIA` DeepSeek pref., OpenAI fallback | Finesse prompt + `sanitizeFinesseContext` JSON | none by design | yes | discarded | live |
| 12 | `app/api/assistant/finesse/realtime-token/route.ts` | Finesse voice mint | `core/voice/mint.ts` → Realtime `gpt-realtime-2.1(-mini)` | `buildFinesseVoiceInstructions()` | none by design | yes | **ignored** (`response.done` unhandled) | live (flagged) |
| 13 | `app/api/voice/realtime-token/route.ts` | Voice Lab mint | same mint; lab config | static lab instructions | 2 simulated zod tools | identity only | client-side only, unpersisted | experimental |
| 14 | `app/api/inbox/conversations/[id]/ask/route.ts` | Ask Fanny | `askMotorIA` DeepSeek | in-file conversation block | — | yes | discarded | live |
| 15 | `app/api/inbox/composer/assist/route.ts` | composer assist | `askMotorIA` OpenAI | in-file templates + locale | — | locale | discarded | live |
| 16 | `modules/inbox/intelligence.ts` | **Fanny pipeline** (classify/summarize/draft/auto-task) | `askMotorIA` DeepSeek; persists `MODEL_NAME="operativo"` (a mode, not a model) | `FANNY_SYSTEM_PROMPT` + `buildWorkspaceContextBlock()` | single-shot JSON; deterministic post-processing + `auto-task-policy` | yes | discarded | live (core) |
| 17 | `modules/inbox/message-short-intent.ts` | per-message intent | `askMotorIA` DeepSeek | in-file prompt | — | yes | discarded | live |
| 18 | `app/api/automations/run` → `modules/automatizaciones/*` | 10 automation analyses | `askMotorIA` | inline DB queries → text | — | yes | discarded | live (no UI caller) |
| 19 | `tools/scan.ts` via attachments routes | OCR doc extraction | `askMotorIA` DeepSeek | OCR text slice | — | yes | discarded | live |
| 20 | `tools/image-generator.ts` | image generation | **third independent OpenAI fetch**, `dall-e-3` | tool args | is a tool | indirect | n/a | via #3 only |
| 21–23 | `app/api/forte/{runtime-test,recommend,execute-approved}` | Forte pipeline / recommendations / approved execution | **no LLM** — deterministic | registry + workspace config | Forte handlers; zod on request | yes | n/a | foundation |
| 26 | `engines/presence/freya.ts` | Freya style proposals | **no vendor** — heuristic behind swappable provider interfaces | Business Profile projection | — | pure | n/a | foundation |
| 27 | `app/motor/page.tsx` | "Motor IA" console | **mock** (fictional models/tools) | — | — | no | n/a | mock UI |

Provider client instantiations: `engines/ai/openai.ts`, `engines/ai/deepseek.ts`
(the shared facade), plus **duplicates** in `app/api/ai/agent/route.ts` and
`tools/image-generator.ts`; voice mint in `core/voice/mint.ts` (clean,
injectable); legacy import shim `lib/ai/index.ts` still used by the 8
`/api/ai/*` routes. Model strings are hardcoded in 8+ files, with the voice
model/voice allowlists duplicated between lab config and Finesse policy.
Context assembly exists in **three unshared strategies** (SQL-dump text,
profile-block text, sanitized page JSON) plus per-route prompt builders.
Auth is the strong point: every AI route calls `requireReadAccess` /
`requireWriteAccess` before touching a provider (proven by
`app/api/ai/ai-security.test.ts`).

---

## 3. Path classification

| Path | Classification |
|---|---|
| `engines/ai` (`askMotorIA`, openai/deepseek fetch wrappers) | **CANONICAL CANDIDATE** — the funnel almost everything already uses; evolves into the gateway execution layer |
| `core/voice/mint.ts` + `core/voice/*` contracts | **SPECIALIZED VALID PATH** — realtime credentials are a legitimately different transport; contracts (effects, policies, binding) are gateway seeds, not duplication |
| `app/api/ai/agent/route.ts` inline OpenAI fetch | **DUPLICATED PROVIDER CLIENT** (and the repo's only tool loop — its *loop* is a gateway seed, its *client* is debt) |
| `tools/image-generator.ts` OpenAI Images fetch | **DUPLICATED PROVIDER CLIENT** (image generation belongs behind the same adapter layer) |
| `lib/ai/index.ts` shim + `/api/ai/*` mode routes | **LEGACY / ADAPTER** — self-declared temporary import path; routes are pre-platform helpers |
| Forte runtime (`agents/forte/runtime/*`) | **CANONICAL CANDIDATE (governance)** — context→capabilities→plan→policy→approval→execution is the target tool-governance shape |
| Voice Lab (`app/voice-lab/*`) | **EXPERIMENTAL** — admin-gated spike; its metrics/pricing math is a usage-capture seed |
| `engines/presence/freya.ts` | **SPECIALIZED VALID PATH** — provider-swappable by construction; model for adapter design |
| `app/motor/page.tsx` | **MOCK** — not an execution path; must not inform architecture |

Not all duplication is bad: voice transport and Freya's provider interfaces
are *valid* specializations. The convergence targets are the two duplicate
OpenAI clients, the three context strategies, and the two governance stacks.

---

## 4. Target request flow

```txt
Incoming AI request
↓ Identity (session/auth)                          SECURITY BOUNDARY
↓ Workspace context (tenant resolution)            SECURITY BOUNDARY
↓ Membership / permission context                  SECURITY BOUNDARY
↓ Entitlements → Capabilities (ARCH-02 §2)         SECURITY BOUNDARY
↓ Experience / vertical context                    BUSINESS POLICY (narrows, never grants)
↓ Agent/persona selection                          BUSINESS POLICY (narrows, never grants)
↓ Allowed tools (getAllowedTools — §7)             SECURITY BOUNDARY (discovery auth)
↓ Business context assembly (§9)                   BUSINESS POLICY
↓ Provider/model policy (§11–§12)                  AI POLICY
↓ AI execution (provider adapter)                  AI POLICY
↓ Tool calls (execution auth — §8)                 SECURITY BOUNDARY (re-validated per call)
↓ Usage capture (§13)                              OBSERVABILITY (mandatory contract)
↓ Audit / telemetry hooks (§16)                    OBSERVABILITY
↓ Response
```

Reading of the classification: SECURITY BOUNDARY stages fail closed and can
never be skipped or overridden by persona/experience/prompt content;
BUSINESS POLICY stages shape behavior within what security allows; AI POLICY
stages are substitutable (provider, model, retry) without touching security;
OBSERVABILITY stages must not be able to break the request (fire-and-forget
with loud logging) but their *contract* is mandatory (§13).

The repo already implements the first three stages well (consistent
`requireReadAccess`/`requireWriteAccess` before provider contact) and stages
4–7 partially in Forte's runtime; the gateway generalizes rather than
reinvents them.

---

## 5. AIExecutionContext

One canonical context object, resolved once per request by the gateway and
passed down — no agent rebuilds identity/tenancy/permissions on its own:

```txt
AIExecutionContext {
  workspace            tenant id + resolved config/vertical
  user                 acting identity (or system principal for pipelines)
  membership           role → permission set (ARCH-02 §11)
  entitlements         capability snapshot (ARCH-02 §18)
  experience           shell context (narrowing only)
  vertical             domain adaptation key
  persona              agent voice/scope (narrowing only)
  capabilities         resolved workspace capabilities
  permissions          resolved user permissions
  locale               operator/customer locale
  businessContext      profile block reference (§9), not a raw dump
  conversationContext  bounded transcript/summary reference
  requestMetadata      requestId, surface, channel, timestamps
}
```

Rules: **no secrets in the context** (provider keys never enter it — §18);
background pipelines (Fanny ingestion) run as a *system principal* with the
workspace's capabilities and a pipeline-specific permission set, not as a
fake user; today's three context builders become suppliers of
`businessContext` behind one interface instead of three call-site styles.
The existing `ForteContext` (tenant/workspace/user/surface + requestId,
rejects defaults) and `VoiceSessionBinding` (never trusts the provider
credential for tenancy) are the seeds — same invariants, one object.

---

## 6. Tool definition

Extends ARCH-02 §5.2 `ToolDefinition`. Conceptual shape:

```txt
ToolDefinition {
  key                    snake_case verb (draft_reply)
  description            model- and human-facing
  requiresCapabilities   ARCH-02 capability keys (person.read, …)
  requiresPermissions    permission implied by capability unless stricter
  effect                 read | navigate | draft | propose | write     (core/voice/contracts.ts vocabulary — adopted platform-wide)
  riskClass              READ | WRITE | EXTERNAL_SIDE_EFFECT | FINANCIAL | COMMUNICATION | ADMIN
  activity               usage-meter activity key (ai.reply_draft)
  inputSchema            zod schema (single source for validation + provider JSON schema)
  outputSchema           zod schema where the tool returns structured data
  handler                server-side implementation reference
  availability           constraints: surfaces, channels, personas, verticals
  executionPolicy        immediate | controlled | confirmation_required   (derived from effect + riskClass, overridable stricter-only)
}
```

`effect` describes *what kind of change*; `riskClass` describes *blast
radius* (a `write` that sends money is FINANCIAL; one that messages a
customer is COMMUNICATION). Both feed human-in-the-loop policy (§21).
Today's `VoiceToolDef {effect, execution}` and Forte's `ForteCapability
{kind, requiresApproval}` are two partial expressions of this one type —
the registry (§22) unifies them; neither is discarded.

---

## 7. Tool resolution (discovery)

```txt
getAllowedTools(AIExecutionContext) =
    tools whose requiresCapabilities ⊆ workspace capabilities   (ARCH-02)
  ∩ tools whose requiresPermissions  ⊆ user permissions
  ∩ persona scope                                                (reduce only)
  ∩ experience surface                                           (reduce only)
  ∩ context constraints (channel, availability, vertical)
  ∩ safety/tool policy (global caps, e.g. AI never auto-sends)
```

Invariants: **persona may reduce tools, never amplify beyond
authorization; experience may reduce surface, never grant capabilities.**
Adding Growth entitlements makes Growth tools appear for every persona
whose scope includes them — zero agent code changes (ARCH-02 §10). The
current counter-example to converge: `agent-adapter.ts` capability-filters
the four bridged read tools but appends unbridged legacy write tools
unfiltered — exactly the pattern the resolver forbids.

---

## 8. Tool execution security — defense in depth

Two independent gates; passing the first never implies the second:

```txt
TOOL DISCOVERY AUTH    what enters the prompt's tool list   (§7)
TOOL EXECUTION AUTH    re-validated server-side on EVERY call:
                       workspace · membership · permission ·
                       capability · resource tenant scope
```

A model that hallucinates a tool call — or names a tool that was filtered
out of discovery — gains **no authority**: execution auth rejects it the
same way it would reject a forged HTTP request. Tool args are untrusted
input: validated against `inputSchema` (zod) before the handler runs;
malformed args are a typed failure (§24), never a silent `{}` (the current
`catch → {}` in the agent route is the anti-pattern). Resource loads inside
handlers stay `(id, workspaceId)`-scoped exactly as today's Forte handlers
and inbox routes already do. Forte's approved-execution re-validation
(fingerprint + contextKey + expiry before rehydrating a plan) is the model
for deferred/approved executions.

---

## 9. Business context: minimal context + retrieval on demand

The gateway does **not** dump the business into the prompt. Strategy:

- **Minimal standing context**: the Business Profile block
  (`buildWorkspaceContextBlock` is the best current implementation) +
  bounded conversation summary. Small, always present, workspace-scoped.
- **Retrieval on demand**: everything else — Person, Conversation,
  Appointment, Campaign, Invoice, Payment, Review, Task — is reached
  through **read tools** over the Business Graph (ARCH-01 §11), resolved
  per §7 and executed per §8. The model asks; it is not pre-fed.

This replaces the `gatherBusinessContext` SQL-dump pattern (fixed
top-N of five tables in hand-formatted text) with capability-gated,
paginated, need-driven reads. No vector DB and no graph DB are designed
here; if retrieval search is ever added it sits behind the same read-tool
interface. Huge context dumps are treated as a defect: they leak data the
request didn't need, cost tokens, and bypass tool-level authorization.

---

## 10. Person convergence

The gateway speaks **person identity** (ARCH-02 §5.2): tools and
capabilities use `person.*` — never `contact.*` / `cliente.*` /
`clientAuth.*`. Today's three storage models (`Contact`, `Cliente`,
`ClientAuth` — ARCH-01 follow-up, unresolved) are implementation details
behind the canonical domain: a `search_client` tool may internally query
both `Contact` and `Cliente`, but it exposes one person concept, and the
future convergence changes zero tool or capability keys. Internal technical
adapters per storage model are permitted only *behind* the canonical
domain, never as separate AI-visible tools. There is one intelligence
about a person, not three intelligences per table.

---

## 11. Provider abstraction

Conceptual adapter interface, replacing per-vendor inline fetches:

```txt
ProviderAdapter {
  key                     openai | deepseek | anthropic | google | …
  capabilities: ProviderCapabilities {
    text · vision · tools · structuredOutput · streaming ·
    speechToText · textToSpeech · realtime · embeddings · images
  }
  models[]                ids + context length + modality + pricing ref
  execute(request) → AIExecutionResult        (usage-preserving — §13)
}
```

Voice providers (OpenAI Realtime today; ElevenLabs/Google later) implement
the same shape with `realtime`/`textToSpeech` capabilities; the mint +
session-binding pattern in `core/voice` stays, generalized per provider.
Providers are **not** required to support identical features — selection
asks "which available provider supports the required capabilities under
current policy?" instead of hardcoding a vendor per feature. Freya's
swappable provider interfaces in `engines/presence/freya.ts` are the
in-repo precedent. A lightweight **provider registry** (§22) declares
capabilities and models; **credentials never live in definitions** (§18).

---

## 12. Model policy

**Business capability ≠ model.** `ai.reply_draft` never means "gpt-X".
Policy maps *(activity, requirements)* → *(provider, model)* considering:
quality tier, latency, cost, language, tool support, privacy, context
length, availability. Kept deliberately simple at first — a static policy
table with per-activity defaults and per-workspace/vertical overrides where
justified; no learned router. Consequences for today's code: the 8+
hardcoded model strings collapse into policy entries; the persisted
`MODEL_NAME = "operativo"` (a mode name stored as a model id) is replaced
by recording the *actual* provider+model from the execution result (§13);
the duplicated voice model/voice allowlists (lab vs Finesse policy) become
one policy source with two consumers.

---

## 13. Usage capture — the non-negotiable contract

The execution layer ALWAYS returns (when the provider exposes it):

```txt
AIExecutionResult {
  output                  text / structured / stream handle
  provider, model         the ones actually used (post-fallback)
  usage {
    inputUnits/tokens · outputUnits/tokens · cachedTokens?
    audioDurationMs? · imageUnits? · requestCount
  }
  latencyMs
  providerRequestId?      when safe to retain
  estimatedCost?          via pricing tables (§15) — never trusted from provider alone
  finishReason
}
```

`usage` may be `unavailable` (typed, explicit) but never silently dropped.
This directly fixes the audited defect: `askMotorIA` returns a bare string
and both fetch wrappers discard the provider `usage` object; production
Finesse voice ignores `response.done` usage entirely. Storage is the
future Usage Meter's job — ARCH-03 defines only the contract, so that when
the meter arrives it is a *sink*, not a refactor. The Voice Lab's
`TurnUsage` parsing and cost math are the in-repo seed to generalize
(server-side, persisted — not client-side, ephemeral).

---

## 14. Activity attribution

Every execution is attributable (ARCH-02 §9) as:

```txt
{ workspace · product · capability · tool · activity ·
  experience · provider · model }

smart_inbox / conversation.reply / draft_reply     / ai.reply_draft
growth      / campaign.create    / generate_campaign / ai.campaign_generation
```

Finesse note: `experience = finesse`, but **product/capability reflect the
real capability used** — a reply drafted inside Finesse attributes to
`smart_inbox` / `ai.reply_draft`, so cost and adoption roll up truthfully
per product regardless of shell. The gateway knows every field at execution
time because they all ride in `AIExecutionContext` + `ToolDefinition`.

---

## 15. Cost calculation

```txt
RAW USAGE   (provider facts: tokens, seconds, images)   ← captured by §13
COST        (SevenF calculation: usage × pricing table
             {provider, model, unit rates, currency, effectiveDate, version})
```

Cost is computed by SevenF against versioned pricing tables — never
exclusively trusted from the provider, and recomputable when prices change
retroactively. `app/voice-lab/config.ts`'s `LAB_PRICING` (with its honest
"estimate — confirm" flags) is the seed shape. Pricing tables and cost
persistence belong to the Usage Meter mission; the gateway's obligation
ends at delivering complete raw usage + the attribution tuple (§14).

---

## 16. Four observability planes — never one table

```txt
AUDIT               relevant action, who, what changed        (exists: Activity / PlatformAuditLog)
PRODUCT TELEMETRY   adoption events per workspace/product      (future — ARCH-01 §9)
USAGE               resources consumed, attributable           (future — ARCH-01 §10, fed by §13)
AI TRACE            technical execution debugging              (future; minimal, short-lived)
```

Different consumers, retention, sensitivity and shape. The gateway emits
*hooks* for all four at the marked flow stages (§4); none of them may fail
the request. Mixing them into one conceptual table is a no-go.

## 17. Privacy / data minimization

- Usage records need **no full prompts** — counts, ids, attribution only.
- Telemetry needs **no conversation content** — event + attribution only.
- AI trace minimizes sensitive content: bounded excerpts at most,
  short-lived, access-controlled; provider request ids only when safe.
- Context retrieval is always workspace-scoped (§9 tools inherit §8 auth).
- The current voice posture — log error *names*, never bodies/keys/audio —
  is the platform standard. Retention policy is future work, but nothing in
  this design requires storing content to work.

## 18. Provider credentials

Provider credentials are **infrastructure configuration** (env/secret
store): never entitlements, never user-visible settings, never present in
`AIExecutionContext`, tool definitions, provider registry entries, or
anything an agent/model can read. The realtime pattern is the reference:
the browser receives only a short-lived ephemeral secret, and tenancy is
never trusted from the provider credential (`VoiceSessionBinding`). If a
future BYOK (bring-your-own-key) offering appears, it is a separate design
with its own isolation review — not a relaxation of this rule.

---

## 19. Agents / personas

| Agent | Current purpose | Current runtime | Provider path | Tools | WS-aware | Target role in SevenF Intelligence |
|---|---|---|---|---|---|---|
| **Fanny** | Inbox triage, summary, intent, lead score, drafts, auto-task | Real: `modules/inbox/intelligence.ts` + ask/short-intent routes; manifest suggest-only (`canWrite:false`) | `askMotorIA` → DeepSeek | none (single-shot JSON + deterministic `auto-task-policy`) | yes | **Persona + pipeline** on the gateway: same execution contract; her auto-task policy stays deterministic post-processing; gains capability-resolved tools per workspace/channel (§20) |
| **Mr. Forte** | Orchestrator; capability→plan→policy→approval runtime; recommendation heuristics; legacy tool-loop route | Real deterministic runtime + orphan LLM route #3 | inline duplicated OpenAI fetch (`gpt-4.1`) | 10 legacy + 4 bridged tools | yes | **Workflow orchestrator** whose runtime concepts get generalized *into* the gateway (§20); his LLM surface re-lands on the shared execution layer |
| **Freya** | Presence style proposals, photo assessment | Foundation: deterministic heuristic behind swappable provider interfaces; manifest suggest-only | none today | none | pure | **Domain agent** — first consumer of the provider adapter when generative styling arrives; interface already gateway-shaped |
| **Finesse** | Beauty vertical assistant (text + voice) | Real: two routes; no manifest (vertical specialist, not roster persona) | DeepSeek/OpenAI text; OpenAI Realtime voice | none by design | yes (server re-scopes context) | **Vertical persona/experience** over the gateway; voice becomes the realtime transport of the same layer (§21-voice) |
| Francis / Felix / Fiona / Fathom | roster metadata | display-only | none | none | n/a | Future personas; they onboard by definition (persona scope + tools), not by new runtimes |

Classification: Fanny = persona + product pipeline; Forte = workflow
orchestrator + specialized deterministic runtime (valid, not forced into
"just a prompt"); Freya = domain agent; Finesse = vertical persona.
**All of them share one security/tool boundary** — that is the definition
of being on SevenF Intelligence.

### Fanny, specifically

Fanny is not "another IA". She is a persona/experience over SevenF
Intelligence that can operate in web chat, Smart Inbox, Finesse, WhatsApp
and future channels; her capabilities and tools depend on the Workspace
(entitlements) and channel (availability constraints), never on her own
code. Her safety posture (suggest-only, operator approves, hard global caps
that workspace preferences cannot bypass) is workspace policy enforced by
the gateway — portable across every channel she appears in.

### Forte → shared concepts mapping

| Current Forte concept | Target shared concept |
|---|---|
| `ForteContext` (tenant/workspace/user/surface, rejects defaults) | `AIExecutionContext` core identity (§5) |
| `resolveForteCapabilities` (registry ∩ workspace config ∩ role ∩ surface) | `getAllowedTools` resolution (§7), re-based on ARCH-02 entitlements instead of `config.modules` |
| capability `kind` read/write/generate + `requiresApproval` | `ToolDefinition.effect` + `riskClass` + `executionPolicy` (§6) |
| plan → policy-guard → execute (read-only now) | execution auth + human-in-the-loop ladder (§8, §21) |
| `ApprovalSnapshot` + fingerprint + contextKey re-validation | deferred-execution approval contract (§21) |
| handler registry (`actionId` → workspace-scoped handler) | tool handlers in the tool registry (§22) |
| `agent-adapter` legacy bridges | migration shim — retired once tools are registry-native |

Nothing valid is replaced for the sake of renaming: the runtime *is* the
governance seed; what changes is its authority source (entitlements) and
its audience (all agents, not only Forte).

---

## 20. Voice

Voice is a **transport** of SevenF Intelligence, not a second architecture:
same `AIExecutionContext`, same tool resolution (§7), same execution auth
(§8), same usage contract (§13 — duration, provider, model/voice, cost
basis), same failure model (§24). Already-correct pieces to keep: the mint
pattern (server-side credential, ephemeral client secret, tenancy never
trusted from the provider), effects/execution-policy contracts, the
routing rule that only `immediate` tools ride the realtime channel while
`controlled`/`confirmation_required` detour through the server. Gaps the
gateway closes: production voice must consume `response.done` usage
(today ignored), the duplicated lab/Finesse model+voice allowlists merge
into model policy (§12), and voice tools — when they arrive — come from
`getAllowedTools`, not from a per-surface list. Voice providers are
substitutable via §11 (`realtime`/`speechToText`/`textToSpeech`
capabilities).

---

## 21. Side-effect tools & human-in-the-loop

Risk ladder for tools like `send_message`, `send_email`, `create_invoice`,
`create_campaign`, `publish_content`, `charge_payment`,
`schedule_appointment`:

```txt
effect: write  +  riskClass ∈ {EXTERNAL_SIDE_EFFECT, COMMUNICATION,
                               FINANCIAL, ADMIN}
⇒ execution mode resolved per tool call:

AUTO       execute immediately          (READ + low-risk only, by default)
CONFIRM    inline user confirmation     (spoken/written summary → yes/no)
APPROVAL   durable approval object      (snapshot + fingerprint + expiry,
                                         re-validated before execution)
```

Resolution inputs: tool definition (effect/riskClass floor) → workspace
policy (may only *tighten*) → user permission (an unpermitted user cannot
CONFIRM their way past §8) → agent context (channel/persona may tighten).
Additional rules for side-effect tools: **idempotency keys** per proposed
action (a retried model turn must not double-send — §23), audit entry on
execution, rate/limit checks against workspace limits (ARCH-02 §8), and
entitlement re-check at execution time. The two existing confirmation
stacks — voice `ActionProposal/resolveConfirmation` and Forte
`ApprovalSnapshot/approved-execution` — merge into this one ladder
(CONFIRM ≈ voice's contract, APPROVAL ≈ Forte's), which is the design
resolution of audit finding "two parallel governance stacks". Specific
product policies (which tools sit where per vertical) are decided later.

---

## 22. Tool registry & provider registry

**Tool registry**: one canonical `ToolDefinition[]` with separated
handlers/adapters. It feeds: AI tool schemas (per provider format),
navigation/actions where applicable, usage attribution (activity keys),
documentation and testing. Boundaries that keep it from becoming a
god-registry: it holds *definitions only* (no business logic — handlers
live with their modules); it does not own authorization (the resolver does,
reading ARCH-02); it does not own approval state; UI surfaces consume it,
never extend it ad hoc. Today's `core/registry` `AgentToolDefinition`
(declared but unexercised — no module ships tools, no handler string is
resolved) is the slot where this lands; Forte's handler registry shows the
handler side.

**Provider registry**: lightweight — provider capabilities, available
models, feature support (§11). **No API keys in definitions** (§18). It
answers "who can serve this request under policy", nothing more.

---

## 23. Failure model, fallback & retries

```txt
AUTH_DENIED · CAPABILITY_DENIED · TOOL_DENIED       user-visible (honest denial), not retryable
CONTEXT_INVALID                                     internal defect; fail closed
PROVIDER_UNAVAILABLE · MODEL_UNAVAILABLE            retryable per policy → fallback ladder
RATE_LIMITED                                        retryable with backoff; surfaces as "busy"
TOOL_EXECUTION_FAILED                               typed result to the model/user; never fake success
OUTPUT_INVALID                                      schema-validation failure → bounded re-ask or typed failure; never silent {}
USAGE_UNAVAILABLE                                   typed, logged; never blocks the response
```

Fallback ladder for provider/model failure: **safe retry** (same
provider/model, bounded) → **model fallback** (same provider, policy-listed
alternate) → **provider fallback** (capability-equivalent provider) →
**fail closed** with a typed error. Critical separation: **model invocation
retry ≠ tool execution idempotency** — retrying a model call is safe;
re-executing a side-effect tool is not. Tools with effects carry
idempotency keys, and an ambiguous failure after a side-effect attempt is
surfaced as uncertain, never silently retried (§21). Provider internals are
not leaked to users; error *names* are logged, not bodies (§17).

### Streaming

Current state: zero streaming in the repo (audited). The gateway supports
`non-stream` and `stream` as **two delivery modes of one architecture** —
same context, same tool authorization, same usage contract (usage arrives
at stream end); never a second code path. Realtime/voice is the third
delivery mode under the same rule.

### Structured output

Centralized in the execution layer: zod schemas (already a repo dependency,
today unused for AI output) define expected shapes; the gateway validates,
handles fences/parse failures uniformly, applies provider-native structured
output where the adapter supports it, and returns typed results. The four
hand-rolled fence-strip parsers (`intelligence.ts`, `message-short-intent.ts`,
`scan.ts`, agent route) converge here; per-feature ad-hoc parsing becomes
the exception that needs justification.

---

## 24. Current → target mapping

| Current path / concept | Target | KEEP / EVOLVE / RETIRE | Why |
|---|---|---|---|
| `engines/ai` (`askMotorIA`, modes, fetch wrappers) | Gateway execution layer + provider adapters; modes become persona/policy inputs | EVOLVE | Already the funnel; must return `AIExecutionResult` (usage!) instead of `string` |
| `lib/ai/index.ts` shim + 8 `/api/ai/*` mode routes | Callers of the gateway or retired per product review | RETIRE (shim) / EVOLVE (routes) | Self-declared temporary; routes predate the platform direction |
| `app/api/ai/agent/route.ts` | Re-landed on shared execution layer + tool registry | RETIRE (inline client) / EVOLVE (tool loop) | The duplicate client is debt; the loop is the only in-repo tool-loop implementation |
| `tools/image-generator.ts` inline fetch | `images` capability of the OpenAI adapter | EVOLVE | Third duplicate client |
| Forte runtime (context/capabilities/plan/policy/approval/handlers) | Shared tool governance (§19 mapping) | KEEP / EVOLVE | Target-shaped already; re-based on entitlements |
| `core/voice/contracts.ts` (effects, policies, binding) | Platform-wide tool + session vocabulary | KEEP | Adopted by ARCH-02/03 as-is |
| `core/voice/mint.ts` + realtime session | Realtime transport of the gateway | KEEP | Clean, injectable, tenancy-safe |
| Voice Lab metrics/pricing (`app/voice-lab/*`) | Seed of usage capture + cost tables (server-side, persisted) | EVOLVE | Only cost math in repo; wrong tier (client-side, ephemeral) |
| Fanny pipeline (`intelligence.ts`, `auto-task-policy`) | Persona + pipeline on gateway; deterministic policy unchanged | KEEP / EVOLVE | Core product value; needs usage + schema layer, not redesign |
| Three context builders (`gatherBusinessContext`, `buildWorkspaceContextBlock`, `sanitizeFinesseContext`) | One `businessContext` interface + retrieval tools (§9) | EVOLVE / RETIRE (SQL-dump) | Three unshared strategies; profile-block is the keeper |
| `core/registry` manifests (`AgentToolDefinition`, agents, engines) | Tool/provider registry substrate (§22) | EVOLVE | Declared but unexercised — right slot, needs the gateway to give it a runtime |
| Freya heuristic providers | First adapter-native domain agent | KEEP | Already provider-swappable |
| `app/motor/page.tsx` mock console | — | RETIRE (or clearly-labeled demo) | Fictional models/tools; must not masquerade as the gateway |
| Persisted `MODEL_NAME="operativo"` | Actual provider+model from `AIExecutionResult` | EVOLVE | A mode name is not a model id; breaks future attribution |

---

## 25. Duplication / conflict matrix

| Issue | Current location | Risk | Target convergence | Blocks future? | When to fix |
|---|---|---|---|---|---|
| Second OpenAI client (tool loop) | `app/api/ai/agent/route.ts` | Split provider policy, no usage, drift | Shared execution layer (AI-06) | YES (usage meter, model policy) | First migration once foundation exists |
| Third OpenAI client (images) | `tools/image-generator.ts` | Same | `images` capability of adapter | mild | With AI-06/07 |
| Usage discarded on every text path | `engines/ai/{openai,deepseek}.ts` returning `content` only | **Blocks Usage Meter entirely** | `AIExecutionResult` contract (AI-03) | **YES — hard blocker** | Foundation (now-tier) |
| Voice usage ignored in production | `finesse-voice-controller.ts` (no `response.done` handling) | Unmetered voice cost | §13 via realtime events | YES (usage meter) | With voice's next iteration |
| Provider coupling by mode name | `askMotorIA` mode-switch; model ids inlined per vendor file | Vendor lock-in creep; no policy seam | Provider adapters + model policy (§11–§12) | partial | Foundation |
| Model strings dispersed (8+ files, duplicated voice allowlists) | see §2 audit | Split sources of truth | Model policy table | partial | Foundation onward |
| Agent-local capability logic / unfiltered legacy write tools | `agents/forte/agent-adapter.ts` append path | Authorization asymmetry | `getAllowedTools` + execution auth | YES (security posture) | With tool registry adoption |
| Duplicated auth/context construction (3 strategies) | `tools/context/*`, `core/workspace.ts`, `finesse-assistant.ts` | Inconsistent AI behavior; triple maintenance | One `businessContext` interface (§9) | mild | Incremental |
| Two governance stacks (Forte approval vs voice confirmation) | `agents/forte/runtime/*` vs `core/voice/confirmation.ts` | Diverging approval semantics | One HITL ladder (§21) | mild (worsens with each new surface) | When first shared side-effect tool ships |
| Ad-hoc JSON parsing of AI output (no zod) | 4 hand-rolled parsers | Silent data corruption (`catch → {}`) | Central structured-output layer (§23) | mild | Foundation onward |
| Legacy import shim | `lib/ai/index.ts` | Two import paths, stale docs | Single gateway import | no | Opportunistic |
| Mock "Motor IA" console | `app/motor/page.tsx` | Fake-product rule violation risk | Retire or label | no | Product decision |

Nothing above is fixed in ARCH-03.

---

## 26. Minimal AI foundation — the recommendation

> **¿Qué mínimo necesitamos implementar AHORA antes de seguir creciendo
> Smart Inbox, Growth, Finance y Finesse?**

**Answer: B — MINIMAL AI GATEWAY FOUNDATION NOW** (not A design-only, not
C full gateway).

- **Why not A (design only):** the single hard blocker is empirical:
  *every* text execution discards usage, and every week of new AI features
  adds call sites that will all need re-touching when the result contract
  changes. `askMotorIA` returning `string` is a one-way door being walked
  through daily. Also, two duplicate provider clients already exist; a
  third will appear with the next tool-using feature unless the shared
  layer exists first.
- **Why not C (full gateway):** most of the estate is *already funneled*
  through `askMotorIA` (17 of 20 LLM paths), auth is consistently strong,
  and there is no streaming, no multi-provider routing pressure, and one
  real vertical. Building the full resolver/registry/HITL/telemetry stack
  now is over-engineering ahead of Entitlements Phases 1–3 and the Usage
  Meter, and ARCH-01 §16 forbids building what we'd unbuild.
- **The minimal foundation** = AI-01 → AI-03 below: a shared execution
  contract that preserves usage, behind the existing facade, with adapters
  formalized — small, non-breaking (a compatibility wrapper keeps
  `askMotorIA` callers working during migration), and it converts the Usage
  Meter from "refactor everything later" into "attach a sink later".

### Interaction with ARCH-02 Phases 1–2

ARCH-02's recommendation (canonical vocabulary, then read-only capability
resolver) stands — ARCH-03 does not change it. The sequencing decision for
what to implement next is **option C of the mission's §37: one minimal
joint mission for the shared capability/tool vocabulary**, then the two
foundations proceed without ever becoming parallel stacks:

> **Implementation note (FOUND-01, 2026-08-25):** the joint vocabulary
> mission is implemented in `core/platform/` — see
> [`7F-FOUND-01-SHARED-VOCABULARY.md`](7F-FOUND-01-SHARED-VOCABULARY.md).
> The shared tool contract is `PlatformToolDefinition` (the legacy
> `ToolDefinition` in `agents/forte/tools.ts` keeps its name until AI-04),
> and voice's effect/policy vocabularies now re-export from
> `core/platform/vocabulary.ts`. FOUND-02a/02b and AI-01+ remain
> unimplemented; no gateway, no usage capture, no tool runtime exist yet.

```txt
FOUND-01  Shared vocabulary (joint)     ARCH-02 Phase 1 capability/product
                                        catalogs + ARCH-03 ToolDefinition
                                        catalog — one typed vocabulary,
                                        docs+types only, zero behavior.
FOUND-02a Entitlements Phase 2          read-only capability resolver.
FOUND-02b AI foundation AI-01→AI-03     usage-preserving execution contract.
          (02a ∥ 02b — independent once FOUND-01 exists)
```

What the AI side needs from ARCH-02's phases is exactly and only:
capability keys (for `ToolDefinition.requiresCapabilities`) and, later,
the read-only resolver (for `getAllowedTools`). Neither blocks AI-01→03,
which is why the joint vocabulary mission is the only ordering constraint.

---

## 27. Implementation phases (future missions — none executed here)

```txt
AI-01  Shared execution contract     AIExecutionRequest/Result types +
                                     gateway entry point wrapping engines/ai;
                                     askMotorIA becomes a thin compat wrapper.
AI-02  Provider adapters             openai/deepseek fetches formalized as
                                     adapters with ProviderCapabilities;
                                     images join the OpenAI adapter.
AI-03  Usage-preserving result       all gateway calls return usage/latency/
                                     model-actually-used; callers may still
                                     ignore it, the layer may not; stop
                                     persisting mode names as model ids.
AI-04  Shared tool registry          ToolDefinition[] canon (zod input
                                     schemas); Forte legacy tools + voice
                                     tool defs re-expressed; no god-registry.
AI-05  Capability-based resolver     getAllowedTools(context) on the ARCH-02
                                     read-only resolver; discovery + execution
                                     auth split; unfiltered legacy-tool append
                                     path closed.
AI-06  Migrate first path            app/api/ai/agent/route.ts re-lands on
                                     gateway + registry (kills duplicate
                                     client #1); structured-output layer in.
AI-07  Migrate remaining paths       Fanny pipeline, Finesse text, composer,
                                     automations, scan, images; retire lib/ai
                                     shim; one businessContext interface;
                                     voice usage handling.
AI-08  Usage meter sink              executions emit attribution + usage to
                                     the Usage Meter (its own mission defines
                                     storage); HITL ladder unification when
                                     the first shared side-effect tool ships.
```

Grounding: AI-01→03 touch one module (`engines/ai`) plus types; AI-04/05
depend on FOUND-01/02a; AI-06 is deliberately the orphan route (lowest
blast radius, highest debt); AI-07 is incremental per path; AI-08 waits for
the Usage Meter design mission.

---

*Next design mission recommended by ARCH-03: **FOUND-01 — shared
capability/tool vocabulary** (joint ARCH-02 Phase 1 + ToolDefinition
catalog), after owner review of this document.*
