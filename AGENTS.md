# 7F — Agent guidance

## App shell (authenticated workspace)

All work on layout, scroll, or viewport behavior for **authenticated** routes must follow the **App Shell Contract**:

**→ [docs/app-shell-contract.md](docs/app-shell-contract.md)**

Summary:

- Shell root: **viewport-bounded** (`fixed inset-0` pattern as in [`components/app-shell.tsx`](components/app-shell.tsx)); avoid new **`min-h-screen`-only** roots for core pages.
- **`main`**: primary **`overflow-y-auto`** scroll; use **`flex-1 min-h-0 max-h-full`** along the chain.
- **No document/body scroll** as the default for core workspace pages.
- Exceptions: split-view (Inbox), chat (Assistant), internal table/panel scroll — see the doc.

Do not regress **ContextShell** / legacy layouts without aligning them to this contract when touching those files.

## Inbox pipeline testing

Write-heavy Inbox flows (Fanny `create_task` automation, future approve /
dismiss / convert flows) follow the **pure planner** pattern:

**→ [docs/inbox-pipeline-testing.md](docs/inbox-pipeline-testing.md)**

Summary:

- Keep policy and write-planning logic pure and deterministic.
- Let the Prisma transaction be a thin orchestration layer with no inline
  business conditions.
- Test the pure layers with `node:test`; reach for DB integration tests
  only when Prisma / migration / persistence behavior itself is what you
  need to verify.

Reference example: [`modules/inbox/auto-task-policy.ts`](modules/inbox/auto-task-policy.ts) +
[`modules/inbox/auto-task-write-planner.ts`](modules/inbox/auto-task-write-planner.ts) +
their `*.test.ts` siblings.
