# 7F — Execution Workflow and Response Contract

This document defines how repository work must be planned, executed, integrated, and reported.
It is the canonical execution protocol for 7F and overrides older workflow wording that requires
small pull requests or long-lived working branches by default.

## 1. Core principle

Plan carefully once, implement one solution, validate it completely, and integrate it immediately.

Do not create a second implementation while an earlier branch, pull request, or unmerged commit already
contains work for the same problem.

## 2. Session and prompt identification

Every work block must have a stable session identifier and title.

```text
SESSION 7F-<AREA>-<NUMBER> — <TITLE>
PROMPT 7F-<AREA>-<NUMBER>.<PHASE> — <TITLE>
```

Examples:

```text
SESSION 7F-I18N-01 — Canonical i18n architecture
PROMPT 7F-I18N-01.1 — Freeze contracts and architecture
PROMPT 7F-I18N-01.2 — Port namespaces and close superseded work
```

Keep the same identifier in the plan, implementation summary, related commits, and follow-up work.
Do not reuse one identifier for a different task.

## 3. Required workflow

Every implementation task follows this sequence:

1. **Audit the real repository first.**
   - Read the current code, not only docs or commit messages.
   - Check `master`, relevant branches, open pull requests, and recent commits.
   - Detect duplicate implementations, stale plans, conflicts, and already-completed work.
2. **State the plan before editing.**
   - Explain the objective, likely files, risks, validation, and explicit non-goals.
   - Resolve architecture decisions before implementation begins.
3. **Implement one coherent solution.**
   - Do not create parallel versions.
   - Do not include unrelated cleanup.
   - Preserve approved architecture unless a verified blocker requires reconsideration.
4. **Validate completely.**
   - Run targeted tests, typecheck, lint, and build when relevant.
   - Perform manual UI or Vercel verification when the change affects visible behavior.
5. **Integrate immediately.**
   - When the work is ready and safe, commit and push directly to `origin/master`.
   - Do not leave finished work waiting in a branch.
6. **Report the exact final state.**
   - Include files, checks, commit SHA, push status, deployment status, and remaining work.

## 4. Default branch policy

The default execution path is direct integration to `master` after audit and successful checks.

```text
Audit → plan → implement → checks → commit → push to master → verify → close
```

Do not create a branch by default.
Do not create a pull request merely because a change is small.
Do not accumulate many finished commits outside `master` while `master` keeps advancing.

## 5. When a branch is allowed

Use a branch only when at least one concrete reason applies:

- the change is high risk;
- a separate Vercel Preview is required;
- an architectural alternative must be reviewed visually before integration;
- branch protection technically prevents direct push;
- production authentication or production data must not be affected during validation;
- the maintainer explicitly requests a branch or pull request.

A branch must use the session identifier, for example:

```text
work/7f-i18n-01
work/7f-beauty-03
```

Only one active implementation branch may exist for the same solution.

## 6. Fast branch integration

When a branch is necessary, the expected lifecycle is:

```text
create branch → implement → validate → review preview → merge immediately → delete branch
```

The branch must be merged in the same work session or immediately after approval.
Do not allow a branch to remain open while `master` advances through many unrelated commits.
Before starting more work in the same area, first integrate, explicitly discard, or supersede the branch.

## 7. Pull request policy

A pull request is a technical vehicle, not the default unit of work.

Use one only when:

- repository protection requires it;
- formal review is materially useful;
- the change is high risk;
- the maintainer explicitly requests it.

If a pull request is required only for integration, open it when the implementation is complete, run the
checks, review it, merge it promptly, and remove the branch. Do not leave it open while developing a
second version elsewhere.

## 8. Preview authentication

Never weaken or remove Google authentication in production merely to inspect a branch.

For branch or Vercel Preview validation, prefer:

1. a Preview-only environment variable;
2. a reversible Preview-only bypass;
3. restriction to authorized accounts or environments;
4. fail-closed behavior in Production;
5. removal or disabling of the bypass before merge.

Production must always keep its normal authentication guarantees.

## 9. Anti-duplication rule

Before implementing any solution, search for:

- open pull requests;
- active or stale branches;
- commits not integrated into `master`;
- alternative files or duplicate modules;
- documents describing a competing architecture.

If prior work exists:

1. compare it with current `master`;
2. decide what to keep, port, merge, or discard;
3. resolve and close the earlier work;
4. only then continue.

Never implement a second version simply because the first one is inconvenient to merge.

## 10. Work-block size

Prefer a complete, coherent, testable block over many artificial micro-PRs.

A good block:

- has one clear product or technical objective;
- may contain several related files and commits;
- produces a usable or architecturally complete result;
- can be validated and deployed safely;
- closes stale or superseded work in the same area.

Do not split one coherent change into separate pull requests for types, files, wiring, and tests unless
there is a real risk or dependency boundary.

## 11. Prompt structure

Implementation prompts should contain these headings:

1. **Identification** — session, prompt number, repository, target branch, area.
2. **Context** — current state, approved decisions, previous branches/PRs, known risks.
3. **Objective** — exact desired result.
4. **Mandatory audit** — what must be inspected before editing.
5. **Allowed scope** — files, modules, and behaviors that may change.
6. **Out of scope** — explicit prohibitions.
7. **Implementation requirements** — ordered technical work.
8. **Validation** — tests, typecheck, lint, build, UI/preview checks.
9. **Integration** — direct `master` push or justified branch-and-fast-merge path.
10. **Required response** — exact completion report.

When audit, implementation, validation, and publication are safe in one coherent task, keep them in one
well-organized prompt instead of forcing separate planning and implementation conversations.

## 12. Progress responses

During long work, provide short progress updates only when they add useful information.

Each update should state one or more of:

- what has been confirmed;
- an important issue found;
- what decision was made;
- what remains before completion.

Do not repeatedly announce that work is still running. Do not repeat the same status. If a subtask fails,
continue directly with the available evidence and report the limitation instead of waiting indefinitely.

## 13. Required final response format

Every completed repository task ends with a plain text block that is easy to copy and paste:

```text
SESSION:
- 7F-<AREA>-<NUMBER> — <TITLE>

STATUS:
- Integrated in master / Preview ready / Blocked

SUMMARY:
- ...

FILES CHANGED:
- ...

CHECKS:
- ...

COMMIT:
- <SHA> <message>

PUSH:
- origin/master confirmed

DEPLOYMENT / VERCEL:
- ...

BRANCHES / PULL REQUESTS:
- None created
- or: <branch/PR>, reason, merge status, cleanup status

NOTES / RISKS:
- ...

REMAINING WORK:
- ...

NEXT RECOMMENDED SESSION:
- 7F-<AREA>-<NUMBER> — <TITLE>
```

Never report "done" without the commit SHA and push status when the task requested repository changes.
Never claim a deployment or clean working tree without verifying it.

## 14. Session states

Use these states consistently:

```text
01 — PLANNED
02 — APPROVED
03 — IN PROGRESS
04 — VALIDATING
05 — INTEGRATED IN MASTER
06 — VERIFIED IN PRODUCTION
07 — CLOSED
```

Do not begin another implementation for the same module while the previous session still has an
unresolved branch, pull request, or competing implementation.

## 15. Language and delivery

- Speak to the maintainer in Spanish.
- Write code, technical identifiers, branch names, commit messages, and repository documentation in English.
- Deliver prompts in a single copyable text block.
- Give every prompt and session a number and a descriptive title.
- Do not mention or choose a specific model in repository workflow documents; the maintainer decides which
  execution environment to use.

## 16. Final rule

```text
PLAN CAREFULLY ONCE.
IMPLEMENT ONE VERSION.
VALIDATE COMPLETELY.
INTEGRATE IMMEDIATELY.
DO NOT LET BRANCHES AGE.
DO NOT CREATE PARALLEL SOLUTIONS.
```
