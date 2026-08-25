# 7F — FOUND-02b: Usage-Preserving AI Execution Foundation (AI-01 → AI-03)

> **STATUS: IMPLEMENTED FOUNDATION — EXECUTION CONTRACT + ADAPTER + USAGE.**
> **No AI Gateway, no tool execution, no enforcement, no usage persistence.**
>
> FOUND-02b (2026-08-25) implements phases AI-01 → AI-03 of
> [`7F-SEVENF-INTELLIGENCE-AI-GATEWAY.md`](7F-SEVENF-INTELLIGENCE-AI-GATEWAY.md):
> a shared, provider-agnostic execution contract whose result ALWAYS carries
> normalized usage. Zero schema/migration/production changes.

## Starting audit (delta since ARCH-03 §2)

The ARCH-03 inventory still held: every text path funneled through
`askMotorIA` (OpenAI `gpt-4.1` / DeepSeek `deepseek-reasoner`, raw fetch,
usage discarded inside `engines/ai/{openai,deepseek}.ts`), plus the
duplicated OpenAI clients in `app/api/ai/agent/route.ts` (tool loop, orphan
— no UI caller) and `tools/image-generator.ts`. No external module imported
the per-vendor files directly — only `engines/ai/index.ts` — which made the
engine-internal restructuring below safe.

## What was built

| Piece | File | Content |
|---|---|---|
| AI-01 contract | `engines/ai/execution-contract.ts` | `AIExecutionRequest` (messages, mode/provider/model, sampling, `activity`, `attribution`, request metadata), `AIExecutionResult<T>`, `AIUsage`, `AIExecutionError` (codes: `provider_unavailable`, `provider_rate_limited`, `provider_error`, `invalid_output`). Attribution uses FOUND-01 keys (`ActivityKey`, `CapabilityKey`, `ProductKey`) — no parallel namespace. No secrets, no plan names, no UI state. |
| AI-02 adapter | `engines/ai/chat-adapter.ts` | One OpenAI-compatible chat-completions adapter factory; OpenAI and DeepSeek are configured INSTANCES (endpoint, key env var read per call, default model, timeout, legacy log/error behavior). Injectable `fetchImpl` for tests. Errors normalized; API keys can never reach messages. |
| AI-03 execution | `engines/ai/execution.ts` | `executeAI(request)` → normalized result: output, provider, **model actually served** (provider echo), usage, latency, `providerRequestId` (response header), finish reason, attribution echo. Mode→provider policy preserved verbatim (`operativo` → DeepSeek, else OpenAI; explicit override wins). |
| Compat wrappers | `engines/ai/index.ts` | `askMotorIA` / `askMotorIAWithHistory` are now thin wrappers over `executeAI` via pure request builders (`buildMotorIARequest`, `buildMotorIAHistoryRequest`) that reproduce the legacy semantics exactly — including the operativo history quirk (last user message only) and mode prompt/sampling defaults. `engines/ai/{openai,deepseek}.ts` became thin delegates; the duplicated raw fetches inside the engine are gone. |

## Usage semantics (the point of this mission)

```txt
AIUsage =
  { status: "reported", inputTokens?, outputTokens?, totalTokens?,
    cachedInputTokens?, reasoningTokens?, requestCount }
| { status: "unavailable", requestCount }
```

Missing usage is explicit `unavailable`; a missing number stays
`undefined`, never 0 — absent and zero mean different things to the future
Usage Meter. Extension for audio durations / image units is additive. Cost
is deliberately NOT computed: usage first, pricing tables later (ARCH-03
§15); nothing couples the result to OpenAI pricing.

## First migrated path

`modules/inbox/message-short-intent.ts` — chosen because it is server-side,
single-shot classification, no side effects beyond its existing metadata
write, its caller is fire-and-forget (errors already swallowed), it lost
usage, and the migration is one call-site swap (reversible). It now calls
`executeAI` with the same request the legacy path produced (same shared
builder), plus canonical attribution (`activity: "ai.message_classification"`,
`product: "smart_inbox"`, `workspaceId`) — provider/model/usage/latency
surface in its existing debug log only. Nothing is persisted.

`app/api/ai/agent/route.ts` was audited and deliberately NOT migrated: it
is the repo's only tool loop, so it is not the minimal safe path — it is
the documented **next** migration (AI-06), together with
`tools/image-generator.ts` (images capability of the OpenAI adapter).

## Legacy paths remaining (all still behavior-identical)

All `askMotorIA` callers (Fanny pipeline, Ask Fanny/Finesse, composer
assist, `/api/ai/*` mode routes, automations, scan) now flow THROUGH the
foundation via the wrappers — usage is captured at the layer — but they
still consume only the string output. Migrating each to `executeAI` (and
using the result) is incremental follow-up. Voice keeps its own realtime
transport (`core/voice`) — out of scope here. **Strategic rule now in
force: no new AI path may discard usage — new call sites use `executeAI`.**

## Future integration (designed for, not implemented)

- Capability/tool resolver (FOUND-02a/AI-05): `AIExecutionRequest` carries
  attribution/activity and will accept the resolved execution context; no
  auth is duplicated, `User.role` is not used, nothing is enforced here.
- Usage Meter: subscribes as a sink on `AIExecutionResult.usage` +
  attribution; no `UsageEvent`/tables exist yet.
- Streaming: the contract returns a result object, so a streamed variant
  can be added without breaking callers; deliberately not built now.
- Structured output: callers keep their existing validation (short-intent's
  strict parse untouched); a central schema layer arrives with AI-06+.

## Tests & limitations

`engines/ai/execution.test.ts` (17 tests, no network — injected fetch):
usage mapping (full/partial/missing-as-unavailable), provider/model/
request-id mapping, attribution propagation, legacy request-body parity for
both providers (exact model/sampling/system prompts, operativo history
quirk, system-message filtering), error normalization (429/500/network/
empty) with legacy message parity, and no-secret-in-errors assertions.
Full suite: 1400/1400 (baseline 1383 + 17). Limitations: wrapper
composition is proven by the builders' tests + typecheck (the wrappers are
two-line compositions); raw non-abort network errors are now wrapped in
`AIExecutionError` (message prefix added) — callers only catch generically.
