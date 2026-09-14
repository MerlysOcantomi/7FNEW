# SevenF — Foundation candidates

Registry of capabilities born in SevenF that are written to be reusable
beyond it. A capability listed here is **stable, not frozen**: its contract
is kept compatible and evolved through additive changes and documented
deprecation paths, never treated as a mistake when a wider abstraction
appears. Nothing here is moved to FORTE Foundation until the review
triggers below say the abstraction has been proven by more than one
consumer. `agents/forte/**` in this repository is the SevenF agent runtime,
not FORTE Foundation.

## Privileged Operations

| Field | Value |
|---|---|
| Capability | Privileged Operations (operation registry + policy source + pure decision + enforcement points) |
| Status | `FOUNDATION_CANDIDATE` |
| Maturity | experimental / candidate (v1) |
| Origin | SevenF |
| Initiative | NEON-05 (Turso → Neon production cutover) |
| Code | `core/privileged-operations/` (contract), `core/db-write-guard.ts` (database enforcement), `core/background-tasks.ts#startBackgroundTask` (background enforcement), `middleware.ts` (HTTP defence in depth) |
| First real consumer | `database.write` — the write freeze around the production database cutover; `background.start` as its companion |
| Target | FORTE Foundation (later; see triggers) |
| Current policy source | SevenF runtime configuration: `SEVENF_OPERATION_MODE` (`normal` \| `freeze-writes`; unset = `normal`; anything else = invalid → fail closed). Deliberately outside the application database. |
| Future policy sources | Mission Control (declared mode per environment / per product), without changing any caller |
| Future operation families (reserved, NOT implemented) | `database.destructive`, `deploy.production`, `secrets.modify`, `dns.modify`, `payments.execute`, `billing.modify`, `integration.disconnect`, `infrastructure.destroy` |
| Future possible consumers | deployments, secrets, DNS, payments, destructive operations, integrations, infrastructure |
| Principle | Stable, not frozen |
| Compatibility promise | operation ids and modes are append-only; `OperationDecision` may gain fields, never lose one; `checkOperation` / `assertOperationAllowed` keep their signatures; a policy source is replaced with `setPolicySource`, never by editing callers |
| Deprecation / evolution path | "Write Freeze" → "Privileged Operations Governance": add operations, add modes, add sources; retire a mode by first mapping it to a successor in the policy layer for one release |

### Review triggers (re-evaluate extraction to FORTE Foundation when any occurs)

- a second real product uses the capability;
- a second operation family appears (anything beyond `database.*` / `background.*`);
- a SevenF-specific condition leaks into the core (workspace, tenant, agent or plan concepts inside `core/privileged-operations/`);
- repeated exceptions appear (call sites bypassing `assertOperationAllowed`, env-specific `if`s outside the policy source);
- Mission Control becomes the policy source;
- another migration or provider proves a wider abstraction.

### Deliberately separate (for now)

`agents/forte/runtime/{approval,policy-guard,approved-execution,decision-engine}.ts`
implement risk levels, `requiresApproval`, fingerprints, context verification,
expiration and approved execution — for Forte plans and actions inside a
workspace/agent context. Privileged Operations is a platform capability that
must work with no plan, no agent and no workspace (a cron tick, a webhook, a
page render). The two may converge later (an approval could become a policy
source that grants a time-boxed `deploy.production`), which is why the
decision shape already carries `source` and `reason`; nothing was extracted
from Forte in v1 because none of those primitives is free of plan/agent
context today.
