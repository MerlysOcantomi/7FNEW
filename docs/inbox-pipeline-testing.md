# Inbox pipeline testing: pure planners first

Last updated: 2026-05-08

This guide documents the pattern that emerged from PR 12–PR 14 for testing
write-heavy Inbox pipelines (Fanny `create_task`, future approve / dismiss /
convert flows) without standing up a Prisma test database for every scenario.

**Rule of thumb**: keep decision and write-planning logic pure; let the
Prisma transaction be a thin orchestration layer; test the pure layers with
`node:test`. Reach for a DB-backed test only when persistence behavior
itself is what you need to verify.

---

## Why this pattern

Most Inbox pipelines look the same:

1. **Decide**: given normalized inputs and conversation context, should we
   act, and which lane (auto / proposed / skip / dismiss) applies?
2. **Plan writes**: given the decision and any existing record snapshot,
   what `WorkspaceTask` / `ConversationAction` writes should fire?
3. **Execute**: run those writes inside a Prisma transaction.

Steps 1 and 2 carry almost all of the business risk: lane semantics,
idempotency guards, refresh-field allow-lists, audit fields. Step 3 is a
mechanical mapping.

If steps 1 and 2 live inline inside the transaction (as they did before
PR 14), the only way to test them is to spin up Prisma + a sqlite test DB
+ seed every related row + mock `askMotorIA`. That is heavy for the four
scenarios most flows actually need (auto / review / cross-action / idempotency).

Extracting steps 1 and 2 into pure modules turns each scenario into a
plain function call with literal inputs and a `deepEqual` assertion. The
production transaction stays byte-identical because the planner is the
single source of truth that both production and tests consume.

---

## Three layers

### 1. Pure decision

A boolean (or small union) verdict about whether to act, plus a
human-readable `reason`.

- Lives in `modules/inbox/<feature>-policy.ts`.
- One pure function, one decision type.
- No DB. No network. No AI. No `Date.now()`. No `Math.random()`. No `process.env`.
- Inputs are explicit: action, conversation context, classification signals,
  cross-run signals.

Reference: [`modules/inbox/auto-task-policy.ts`](../modules/inbox/auto-task-policy.ts) →
`evaluateAutoCreatePolicy(...)`.

### 2. Pure write planner

A description of the writes that should happen, given the decision plus the
existing record snapshot.

- Lives in `modules/inbox/<feature>-write-planner.ts`.
- One pure function, returns a discriminated union plan
  (`{ kind: "create" | "refresh" | "skip" | "execute" }` etc).
- Calls existing builders / mappers from `modules/tasks/*-mapping.ts` for
  payload shaping — never hand-rolls a payload.
- Returns refresh data using existing `pick*RefreshFields` helpers so the
  allow-list of mutable columns has a single definition.
- Does **not** call the gate internally — accepts the pre-computed
  decision so tests can mix-and-match decisions with existing-record states.
- Does **not** log telemetry — the orchestration layer owns that and reuses
  the plan's exposed `decision` so the log can never drift from the writes.

Reference: [`modules/inbox/auto-task-write-planner.ts`](../modules/inbox/auto-task-write-planner.ts) →
`planCreateTaskWrite(...)`.

### 3. Thin orchestration / transaction layer

Inside `modules/inbox/<feature>.ts` (typically the existing service or
intelligence module):

- Call the policy → log structured telemetry (PII-safe; see
  [`modules/inbox/intelligence.ts`](../modules/inbox/intelligence.ts)
  `fanny_auto_decision` event).
- `findFirst` the existing record snapshot.
- Call the planner.
- `switch` on `plan.taskWrite.kind` (and any other plan branches) and map
  each branch to the corresponding `tx.<model>.create` /
  `tx.<model>.update` call. Fill in fields the planner cannot know yet
  (newly created ids, `new Date()`).
- Treat `kind: "skip"` as a no-op — the planner has already encoded the
  forensic reason.

The transaction must contain **no business conditions**. If you find
yourself writing `if (existing.status === "open" && ...)` inside the
transaction, that condition belongs in the planner.

---

## Test contract

- Use `node:test` + `node:assert/strict`. Mirrors
  `core/i18n/i18n.test.ts`, `agents/forte/runtime/*.test.ts`,
  `modules/inbox/auto-task-policy.test.ts`,
  `modules/inbox/auto-task-pipeline.test.ts`.
- File next to the module under test: `<module>.test.ts`.
- Run via `tsx --test <file>`; add a narrow `test:<feature>` script in
  `package.json` (matches the existing `test:forte-*`, `test:i18n`,
  `test:auto-policy`, `test:fanny-pipeline` convention).
- Cover, at minimum:
  - **Each lane**: auto-true / auto-false / cross-action guard (the gate's
    multi-input rejection).
  - **Idempotency matrix**: for each lane, every relevant `existingTask`
    state (none / refresh-eligible / not-refresh-eligible / dismissed /
    operator-promoted edge case).
  - **Forbidden-field protection**: when the plan returns refresh data,
    assert that lifecycle / identity / audit columns
    (`status`, `sourceType`, `createdBy`, `suggestedBy`, `executionMode`,
    `workspaceId`, `conversationId`, `conversationActionId`, `tareaId`,
    `eventoId`, `completedAt`, `dismissedAt`, …) are **not** present.
    See the `forbiddenKeys` sweep in
    [`modules/inbox/auto-task-pipeline.test.ts`](../modules/inbox/auto-task-pipeline.test.ts).
  - **Determinism**: `planX(input) === planX(input)` via `deepEqual`. Locks
    out accidental clocks / randomness / env reads.
  - **Reason / audit string contracts**: any string that ends up in
    `executionNotes`, telemetry, or operator-visible audit must have a
    stable prefix that downstream search depends on (e.g.
    `"Auto-created by Fanny "`).

Tests should construct inputs with a small `make<X>Input(overrides)` factory
that defaults to a "minimum viable safe" shape so each case only varies the
field it cares about.

---

## Reference example

The Fanny `create_task` automation lane is the canonical implementation:

| Layer | File |
|-------|------|
| Pure decision | [`modules/inbox/auto-task-policy.ts`](../modules/inbox/auto-task-policy.ts) |
| Pure planner | [`modules/inbox/auto-task-write-planner.ts`](../modules/inbox/auto-task-write-planner.ts) |
| Thin transaction layer | [`modules/inbox/intelligence.ts`](../modules/inbox/intelligence.ts) (the `if (action.type === "create_task") { ... }` block) |
| Decision tests | [`modules/inbox/auto-task-policy.test.ts`](../modules/inbox/auto-task-policy.test.ts) (35 cases) |
| Pipeline tests | [`modules/inbox/auto-task-pipeline.test.ts`](../modules/inbox/auto-task-pipeline.test.ts) (11 cases) |

Run them narrowly:

```bash
npm run test:auto-policy
npm run test:fanny-pipeline
```

When extending an existing flow (or adding a new one — approve / dismiss /
convert / event creation), copy this layout: a `<feature>-policy.ts` and a
`<feature>-write-planner.ts` next to each other, with their tests next to
the modules.

---

## When to use a DB integration test

Pure planners cover business logic; they do not cover Prisma's behavior.
Reach for a DB-backed test (sqlite via `DATABASE_URL=file:./dev.db`,
following the [`agents/forte/runtime/approved-execution.test.ts`](../agents/forte/runtime/approved-execution.test.ts)
pattern) only when one of the following is the thing you're verifying:

- **Migration / schema behavior** — column defaults, indices, generated
  columns, constraints actually firing.
- **Relation constraints** — `onDelete` cascade, `@@unique`, optional FK
  resolution against real rows.
- **Transaction semantics** — `tx` rollback on partial failure, isolation
  between concurrent flows, `db.$transaction(async (tx) => ...)` boundary
  bugs.
- **Prisma-specific query behavior** — `groupBy`, `_count`, `findFirst`
  ordering / index usage, JSON column round-trips.
- **End-to-end persistence** — a full operator interaction that writes
  multiple coupled rows and the contract is "after this, the DB looks like
  X" rather than "the planner emitted these write descriptors".

Anything else — lane decisions, refresh allow-lists, idempotency guards,
audit-string contracts, cross-run signals — belongs in a pure planner test.

---

## Anti-patterns

- **Mocking Prisma at the model level** (`db.workspaceTask.create = jest.fn()`).
  If you need to verify what gets written, extract a planner instead. Mocking
  Prisma couples tests to the ORM's surface and breaks every Prisma upgrade.
- **Inline `if (existing.status === ...)` inside the transaction.** Every such
  branch is untested business logic. Move it to the planner.
- **Re-deriving the policy decision in two places** (e.g. once for telemetry,
  once for the planner). Compute it once, pass it in, log from the plan.
- **Mutating the plan in the transaction.** Treat the plan as immutable.
  If the transaction needs additional values (new ids, timestamps), pass
  them as separate arguments to the Prisma call rather than mutating the plan.

---
