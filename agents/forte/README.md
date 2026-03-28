# Mr Forte

Forte is 7F's orchestrator. It understands business context, reasons about what to do, applies policy, and executes safely. It can also recommend without executing.

Forte is not just an AI wrapper. It is a structured system where AI plays a role in interpretation and assistance, but decisions, security, and execution are governed by deterministic logic.

## Architecture

```
agents/forte/
├── phase1/          # Semantic dictionary + recommendation engine
├── phase2/          # API contracts + service adapter for phase1
├── runtime/         # Core execution pipeline
│   └── business/    # Business domain interpretation
├── semantic/        # Canonical signal reference (documentation)
├── executor.ts      # Legacy agent tool executor (bridged to runtime)
├── tools.ts         # Legacy agent tool definitions (bridged to runtime)
└── system-prompt.ts # Legacy agent system prompt
```

### Layer Responsibilities

**phase1 — Semantic + Recommendation**

Source of truth for the semantic dictionary: signals, inference rules, base profiles, catalog of modules/engines/tools, and architectural recommendations.

Files: `recommender.ts`, `catalog.ts`, `types.ts`, `module-levels.ts`

**phase2 — API Adapter**

Validation contracts and service layer that exposes phase1 recommendations via API. Does not contain its own logic.

Files: `contracts.ts`, `service.ts`

**runtime — Execution Pipeline**

Core pipeline: `context -> capabilities -> plan -> policy -> execution`

Includes approval flow, approved execution layer, handler registry, store provider, and legacy agent bridge.

Files: `forte-context.ts`, `capability-resolver.ts`, `decision-engine.ts`, `policy-guard.ts`, `action-runtime.ts`, `approved-execution.ts`, `approved-execution-service.ts`, `approval.ts`, `approval-store.ts`, `store-provider.ts`, `pipeline.ts`, `handlers.ts`, `run-step.ts`, `agent-adapter.ts`, `types.ts`

**runtime/business — Business Understanding**

Projects signals onto business domains. Detects gaps, calculates domain maturity, maps intent text to relevant domains. Read-only, deterministic, no AI.

Files: `signals.ts`, `domain-types.ts`, `domain-resolver.ts`, `domain-mapper.ts`

See: [`runtime/business/README.md`](runtime/business/README.md)

**semantic — Canonical Reference**

Documentation anchor for the semantic dictionary. Defines which signals exist, what inference rules apply, and where to find the implementations.

See: [`semantic/README.md`](semantic/README.md)

**Legacy files** (`executor.ts`, `tools.ts`, `system-prompt.ts`)

Pre-Forte agent implementation. Partially bridged to the runtime via `agent-adapter.ts`. Will be progressively migrated as more handlers are registered.

## Semantic Source of Truth

The 13 canonical signals and 5 inference rules are defined in [`semantic/README.md`](semantic/README.md).

Current implementations:
- `phase1/recommender.ts` — used by the recommendation engine
- `runtime/business/signals.ts` — used by the business domain layer

Both must stay in sync until unified into a shared module.

## What NOT to Do

- **Do not create another Forte.** There is one orchestrator. Extend it, don't duplicate it.
- **Do not duplicate signals.** The semantic dictionary is the source of truth. If you need a new signal, add it there.
- **Do not duplicate the catalog.** `phase1/catalog.ts` merged with registry manifests is the catalog. Do not build a parallel one.
- **Do not mix execution with recommendation.** Recommendations are read-only projections. Execution goes through the runtime pipeline with policy and approval.
- **Do not put business logic in policy.** Policy decides what is allowed. Business logic lives in handlers and the business layer.
- **Do not replace structural logic with AI.** AI assists in interpretation and generation. Decisions about what to execute, what to approve, and what to block are deterministic.

## How Forte Evolves

1. Semantic dictionary (signals, inference, profiles) — done
2. Execution pipeline (context, plan, policy, runtime, approval) — done
3. Business understanding (domains, gaps, intent mapping) — done
4. Recommendations UI (surface domain gaps as actionable suggestions)
5. Agent specialization (Farah, Felix, etc. — personas over the same runtime)
6. Verticalization (industry-specific domain configurations)

Each phase builds on the previous one. No phase replaces another.

## Role of AI in Forte

Forte uses AI but does not depend on it for structural decisions.

- **AI does:** interpret user intent, generate explanations, assist in content, classify inputs
- **System does:** resolve context, evaluate capabilities, build plans, enforce policy, validate approvals, execute via handlers, detect domain gaps

If AI is unavailable, Forte can still resolve context, evaluate policy, and block unsafe actions. It cannot interpret free-text intent without AI, but nothing executes without the deterministic pipeline.

## Design Principle

We are not building multiple systems. We are building one system that can think from different perspectives — semantic, operational, and business — through a single coherent architecture.

## Legacy / Transitional Artifacts

The following elements belong to pre-Forte architecture and are still present for compatibility reasons:

- `system-prompt.ts` referencing "Agente Hibrido 7F-Skina"

Status:
- This is a legacy identity from a previous agent system
- Currently used through bridge layers
- Does not represent Mr Forte architecture

Rule:
- Do NOT expand or reuse this identity in new development

Future:
- Should be aligned or removed when the bridge layer is fully deprecated
