# Forte Semantic Dictionary

## Purpose

This is the canonical reference for Mr Forte's semantic vocabulary. All signal names, inference rules, and semantic concepts used across Forte originate from this dictionary.

**This is the source of truth.** Do not duplicate, rename, or reinterpret these signals elsewhere.

## Canonical Signals

13 boolean signals describe the business needs Forte understands:

| Signal | Meaning |
|---|---|
| `crm` | Client/lead/account relationship management |
| `smartInbox` | Conversational intake, messaging, lead intelligence |
| `portal` | Client self-service surface |
| `projectDelivery` | Project-based work, deliverables, coordination |
| `taskManagement` | Actionable tasks, priorities, daily execution |
| `invoicing` | Invoices, billing, collections |
| `financeControl` | Financial visibility, cashflow, profitability |
| `documents` | Document management, contracts, attachments |
| `contentMarketing` | Content production, editorial, social media |
| `campaigns` | Marketing campaigns, launches, growth initiatives |
| `automations` | Workflow automation, follow-up rules |
| `documentAnalysis` | OCR, data extraction, document classification |
| `aiAssistance` | AI-powered analysis, generation, classification |

## Inference Rules

5 deterministic rules propagate implicit dependencies between signals. These rules exist in both implementations listed below and must remain identical:

1. `projectDelivery` implies `taskManagement`
2. `campaigns` implies `contentMarketing`
3. `documentAnalysis` implies `documents`
4. `smartInbox | documentAnalysis | contentMarketing | automations` implies `aiAssistance`
5. `invoicing | portal` implies `crm`

## Current Implementations

The semantic dictionary currently lives in two places:

- **`agents/forte/phase1/recommender.ts`** — original implementation, used by the recommendation engine. `NormalizedSignals` interface + `normalizeInput()` function.
- **`agents/forte/runtime/business/signals.ts`** — isolated extraction for the runtime business layer. `NormalizedSignals` interface + `resolveSignals()` function.

Both define the same 13 signals and the same 5 inference rules. The runtime extraction exists to break an import cycle between `runtime/` and `phase1/`.

## Rules

- **Do not create parallel signal systems.** If a new concept is needed, extend the canonical list here first.
- **Do not rename signals.** Existing code, tests, and domain mappings depend on these exact names.
- **Do not add inference rules without updating both implementations.** Until unification, changes must be mirrored manually.
- **Keep backward compatibility.** Removing or changing signal semantics breaks domain resolution, recommendations, and tests.

## Future Direction

These two implementations should be unified into a single shared module (e.g. `agents/forte/semantic/signals.ts`) that both `phase1/` and `runtime/business/` import from. This eliminates the risk of semantic drift between the two copies.

The unification should:
- move signal types and inference logic here
- not move recommendation logic (stays in `phase1/`)
- not move domain resolution logic (stays in `runtime/business/`)
- preserve all existing behavior and tests
