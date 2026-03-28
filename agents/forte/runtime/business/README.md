# Forte Business Domain Layer

## Purpose

Projects normalized signals onto business domains, giving Forte the ability to understand which areas of a business are covered, weak, or missing entirely. This layer is read-only and does not execute actions.

## What It Does

```
NormalizedSignals + active modules --> DomainState[] (per domain: level, strength, gaps)
Intent text --> relevant BusinessDomain[]
```

## Inputs

- **`NormalizedSignals`** — 13 boolean signals from the semantic dictionary (see `agents/forte/semantic/README.md`)
- **Active modules** — list of module IDs with their `provides[]` capabilities, from the runtime capability resolver or phase1 catalog
- **Intent text** — natural-language description of user intent (for domain mapper only)

## Outputs

- **`DomainState[]`** — one entry per domain with: level (`none`/`basic`/`intermediate`/`advanced`), strength score, supporting signals, supporting modules, missing capabilities, and notes
- **`BusinessDomain[]`** — domains relevant to a given intent text

## Current Domains

7 domains derived from the semantic dictionary's signal groupings:

| Domain | Supporting Signals | Supporting Modules |
|---|---|---|
| `communication` | smartInbox | inbox |
| `relationship` | crm, smartInbox, portal | clientes, inbox |
| `delivery` | projectDelivery, taskManagement | proyectos, tareas |
| `marketing` | campaigns | campanas |
| `content` | contentMarketing | contenido |
| `finance` | invoicing, financeControl | facturacion, finanzas |
| `intelligence` | documents, automations, documentAnalysis, aiAssistance | documentos, automatizaciones |

## Files

| File | Responsibility |
|---|---|
| `signals.ts` | Isolated extraction of `NormalizedSignals` + `resolveSignals()` from the semantic dictionary |
| `domain-types.ts` | `BusinessDomain`, `DomainLevel`, `DomainState` type definitions |
| `domain-resolver.ts` | `resolveDomainStates()` — signals + modules to domain states with gaps |
| `domain-mapper.ts` | `mapIntentToDomains()` — intent text to relevant domains via keyword rules |
| `index.ts` | Barrel exports |

## Rules

- **Reuses the semantic dictionary.** Does not create new signals or inference rules.
- **Read-only.** Does not execute actions, modify data, or trigger side effects.
- **Deterministic.** No AI, no LLM calls. Keyword matching and boolean logic only.
- **Only active for `recommendation` and `analysis` intents.** The decision engine skips domain resolution for other intents.
- **Extending domains** means adding entries to `SIGNAL_TO_DOMAINS`, `MODULE_TO_DOMAINS`, and `DOMAIN_EXPECTED_CAPABILITIES` in `domain-resolver.ts`.

## Integration Point

`agents/forte/runtime/decision-engine.ts` calls the domain resolver and mapper when building plans for `recommendation` or `analysis` intents. The resulting `DomainState[]` is attached as `FortePlan.domainContext` (optional field).

No other part of the pipeline (policy, execution, approval) reads or depends on domain context.

## Future Extensions

- **Forte Improvements UI**: surface domain gaps as actionable suggestions to the user
- **Agent specialization**: use domain states to adjust Forte's behavior per business profile
- **Semantic layer unification**: `signals.ts` should eventually import from a shared `agents/forte/semantic/` module instead of maintaining a local copy
