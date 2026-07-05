# CLAUDE.md — Working rules for Claude Code

> Read `AGENTS.md` and `docs/ways-of-working.md` for product/architecture rules.
> This file records how the owner wants Claude Code to **deliver** changes.

## Delivery flow (owner preference — takes precedence)

The owner ships **directly to `master` (production)**. No separate feature
branches and no PR/merge cycle just to preview changes.

Every task follows: **review → push → review**

1. Finish the change.
2. Run the relevant checks (lint / tests / build, whatever applies to the change).
3. Show the owner a short summary of what will be committed (files + what it does).
4. Commit and push **directly to `master`**.
5. Verify it landed and nothing broke (the second "review").

Notes:

- `master` is production. Pushing there is authorized by the owner.
- The "review before push" step is the safety net that replaces PR review —
  never skip it. For anything non-trivial, surface the summary before pushing.
- Speak Spanish with the owner; write the repo in English (per `AGENTS.md`).
