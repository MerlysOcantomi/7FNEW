# SevenF — NEON-05 — Production cutover preparation (R1)

Status: **CODE READY FOR REVIEW — CUTOVER NOT EXECUTED.** This document
prepares the Turso/libSQL → Neon/PostgreSQL production cutover. Nothing in
it has run against Neon production `main`, Turso, Vercel Production or the
NEON-04 staging database. NEON-05 is **not** closed.

Branch `claude/neon-05-production-cutover`: created from the NEON-04 tip
`7ee3c20` (the commit that ran the real staging ETL under tag
`neon-04-etl-20260913-01`) with a normal merge of `master` (`e5d3e74`). No
history was rewritten; NEON-04 and `master` are both ancestors.

## 1. What NEON-04 proved (preserved, never re-run)

| Item | Value |
|---|---|
| Neon project | `old-wave-11795585` (dedicated to SevenF; staging and the production candidate are branches of it) |
| Staging branch / database | `br-autumn-water-b23gf0e9` / `neondb`, direct host `ep-super-violet-b2ekwpwn.c-6.eu-central-1.aws.neon.tech`, pooled `…-pooler.…` |
| Staging marker | `sevenf:environment=staging;sevenf:migration=neon-04;sevenf:target=old-wave-11795585` — byte-compatible with the parser in this branch |
| Evidence | one snapshot, one transaction, parity L1–L3, live-source parity, manifest, Vercel Preview with Google OAuth, reads and writes |
| Rule | the staging ETL is never re-run: the target is populated and the `staging` role refuses a non-empty target without an explicit reset, which nobody will pass |

The obsolete `workflow_dispatch` file `.github/workflows/neon04-staging-etl.yml`
(an earlier attempt that never ran the rehearsal) is removed on this branch;
the canonical, executed one is `.github/workflows/neon-04-staging-etl.yml`.

## 2. Production target (to be re-validated live; nothing trusted from here)

| Item | Value |
|---|---|
| Branch / id | `main` / `br-broad-river-b2ue75l8` |
| Database | `neondb` |
| Direct host (ETL, Prisma CLI) | `ep-restless-scene-b2m6ucm7.c-6.eu-central-1.aws.neon.tech` |
| Pooled host (runtime `DATABASE_URL`) | `ep-restless-scene-b2m6ucm7-pooler.c-6.eu-central-1.aws.neon.tech` |
| External audit (not relied upon) | empty: 0 public base tables, 0 sequences, no `_prisma_migrations`, no identity marker |
| Baseline | `prisma/migrations-postgres/0_init/migration.sql`, sha256 `679d9d18e72a3fa101bd96f6c39b2194ba38ae86de35359a3e46be8d662af30e` (unchanged) |

## 3. Writer audit (whole repository, read-only)

Method: every runtime file (`app/`, `core/`, `modules/`, `engines/`,
`agents/`, `lib/`, `components/`, `middleware.ts`) was searched for Prisma
mutations, raw SQL, transactions, storage and email side effects; entry
points were traced back to their trigger. One Prisma client exists
(`core/db.ts`; `lib/db.ts` re-exports it). No `"use server"` actions, no
`instrumentation.ts`, no build hooks, no runtime import of `scripts/` or
`prisma/`. HTTP verb is **not** a write indicator: the cron route writes on
GET, tracking pixels write on GET, the Google callback writes on GET, one
page render writes.

Prisma method census (runtime code): `create` 65, `update` 90, `updateMany`
14, `upsert` 7, `delete` 18, `deleteMany` 10, `createMany` 2,
`createManyAndReturn` / `updateManyAndReturn` 0, `$transaction` 13 (all
carry writes), `$queryRawUnsafe` 3 (all `SELECT`, parameterised by
`core/db-dialect.ts`), `$executeRaw*` 0, `$queryRaw` 0.

| Writer | Entry point | Writes what | Trigger | Auth | Sync/bg | Covered by `database.write` guard | Notes |
|---|---|---|---|---|---|---|---|
| A. Authenticated API (CRM, tasks, projects, invoices, finance, notes, docs, content, campaigns, calendar, automations config, users, inbox actions/todos/drafts/handoffs, workspace config, connections) | ~60 `app/api/**/route.ts` via module services | model rows of each module, `$transaction` in todos/actions/convert/workspace create | HTTP POST/PUT/PATCH/DELETE | session + `requireWriteAccess`/`requireAdminAccess` | sync (+ fire-and-forget activity/notifications) | **yes** | middleware also answers 503 to the mutating verbs while frozen |
| B. Public HTTP | `POST /api/inbox/public/send` (web chat), `POST /api/sites/[slug]/reception` (Presence reception) | Contact, Conversation, Message, ExternalIdentity, ContactIdentityLink, WorkspaceTask, Notification, intelligence transaction | anyone | none (rate limits only) | sync + detached promises | **yes** (guard) + middleware 503 | 5 detached write chains in `public/send` are outside the background registry |
| C. Google OAuth callback / dev-login | `GET /api/auth/callback/google`, `POST /api/auth/dev-login` | User create/update (`lastLogin` on EVERY login), PlatformAdmin bootstrap, AllowedEmail upsert (dev-login), Workspace + WorkspaceMember (`ensureUserHasDefaultWorkspace`, `$transaction`) | login | unauthenticated by nature | sync | **yes** | consequence: while frozen, **no login succeeds** (every login writes); acceptable inside a cutover window with no users |
| D. Client portal | `/api/cliente/auth/login` (public), `/api/cliente/{perfil,requests,archivos}`, `/api/cliente/auth/register` (admin) | ClientAuth update/create, Cliente, ClientRequest, ClientAsset | HTTP | portal JWT / public login | sync | **yes** | |
| E. Webhooks | `POST /api/inbox/email/inbound` (Resend); `/api/inbox/webhooks/[provider]` skeleton | full ingestion pipeline (Conversation, Message, Contact, MessageAttachment, blob `put`) | provider push | `RESEND_WEBHOOK_SECRET`, fails closed 503 when unset | sync + 2 tracked background tasks | **yes** (DB); blob `put` **no** | |
| F. Email inbound / IMAP | `modules/inbox/imap-sync.ts` via cron, `POST /api/inbox/fetch`, `POST /api/workspaces/[id]/connections/[connId]/sync` | ChannelConnection cursor (`updateMany`/`update`), ingestion pipeline | cron / manual | `CRON_SECRET` / write or admin access | sync | **yes** (DB); blob `put` **no** | |
| G. Manual fetch | same as F | same | HTTP POST | authenticated | sync | **yes** | |
| H. Vercel cron | `vercel.json` `*/5 * * * *` → `/api/cron/imap-sync` (GET and POST) | as F, all workspaces | schedule | `CRON_SECRET` bearer; fails closed 500 in production when unset | sync | **yes** (DB) | **finding**: `/api/cron/imap-sync` is not in `PUBLIC_PATHS` of `middleware.ts`, so without a session cookie the middleware answers 401 before the handler runs — the cron appears unreachable in production today (config inference from code; verify in the Vercel cron logs before relying on it) |
| I. Background / fire-and-forget | `ingest:notify`, `ingest:intelligence`, `message:short-intent` (registry) + ~22 bare `void …catch()` sites (`logActivity`, `notify*`, `sendOutboundAsync`, attachment scan, identity resolution in `public/send`, Forte snapshot) | Notification, Activity, AIClassification/Conversation/Handoff/Draft/Action/WorkspaceTask (intelligence), Message delivery updates, Attachment OCR result | after a request returns | inherits | background | DB writes **yes** (guard); *starting* new work: **only the 3 registry sites** ask `background.start` | on Vercel these detached promises can also be killed after the response (known, CORE-00 audit) |
| J. Automations | `POST /api/automations/run` | **none** (read/analysis only); CRUD of `Automatizacion` rows is class A | HTTP | authenticated | sync | n/a | no rule engine fires writes |
| K. Agents | Forte: `ForteSnapshot.upsert` on RSC render of `/forte/improvements` (un-awaited); approved execution `tareas.create` via `executeApprovedRequest`; approval store is in-memory | ForteSnapshot, Tarea | page GET / approved plan | authenticated | bg / sync | **yes** | Fanny/Finesse/Freya: zero DB writes; `engines/ai`: zero |
| L. Scripts at runtime | none imported at runtime; seeds/backfills/rehearsals/ETL are CLI only | — | `npm run …` | operator | — | **no** (they build their own clients: `pg`, libSQL) | the ETL's own `pg.Client` bypasses the guard by design (it is the cutover tool) |
| M. Raw SQL | 3 `$queryRawUnsafe` `SELECT`s (attention counts, unanswered candidates) | reads | HTTP GET | authenticated | sync | classified **read** by `classifyRawSql`; a disguised write would be refused | |
| N. Prisma mutations | 206 model-write call sites | see A–K | | | | **yes, all** (single client, extension applies to every model operation) | |
| O. `$transaction` | 13 sites | writes inside | | | | **yes** — operations on the `tx` client and batch promises go through the extension (integration-tested) | |
| P. `$executeRaw*` / unsafe | 0 runtime sites | — | | | | **yes** if ever added (write by contract) | |
| Q. Blob / storage / email | `core/storage.ts` `put` (4 callers: attachments, inbox upload, inbound email, IMAP), Resend/SMTP sends | object storage, outbound mail | HTTP / cron / webhook | varies | sync/bg | **NO** — outside the database boundary | a freeze does not stop blob uploads or outbound email; they are irreversible external effects documented as uncovered (§5) |
| Dormant | `engines/presence/repository.ts` writers (publish/unpublish/domains/media), `deleteForteSnapshot`, `getOrCreateDefaultWorkspace`, `deleteFromStorage` | — | no caller | — | — | would be covered if wired | |

## 4. Privileged Operations Core v1 (`core/privileged-operations/`)

| Layer | File | Content |
|---|---|---|
| OPERATION | `types.ts`, `registry.ts` | ids `database.write`, `background.start` (append-only; families reserved for `database.destructive`, `deploy.production`, `secrets.modify`, `dns.modify`, `payments.execute`, `billing.modify`, `integration.disconnect`, `infrastructure.destroy` — none implemented) |
| POLICY SOURCE | `env-provider.ts` | `SEVENF_OPERATION_MODE`: unset/empty → `normal` (explicit, tested); `normal`; `freeze-writes`; anything else → `invalid`. Lives outside the application database on purpose. Edge-safe (no Node built-ins) so the middleware reuses the parser |
| DECISION | `policy.ts` | `decideOperation(definition, resolution)` — pure, deterministic; `invalid` denies every registered operation (fail closed) |
| ENTRY POINTS | `index.ts` | `checkOperation(id)`, `assertOperationAllowed(id)` → `PrivilegedOperationDeniedError` (a `PublicApiError`: code `OPERATION_FROZEN`, HTTP 503, value-free message); `setPolicySource` / `resetPolicySource` so Mission Control can become the source later without touching callers |

Freeze semantics: `freeze-writes` refuses `database.write` and
`background.start`; reads are not an operation and are never gated; the name
says what it does (writes are frozen, reads remain), not "maintenance".

Why it is reusable: callers name an operation, never a mode or a variable;
the source is replaceable; the decision is pure; the error is publishable;
nothing in the core knows about workspaces, plans, agents or SevenF modules.
Registered as `FOUNDATION_CANDIDATE` in `FOUNDATION-CANDIDATES.md`.

## 5. Enforcement — defence in depth, honestly scoped

| Layer | Where | Guarantee |
|---|---|---|
| **Database boundary (the guarantee)** | `core/db-write-guard.ts`, applied in `core/db.ts` as a Prisma 7 client extension (`$extends({ query })`, the supported interception mechanism — not a Proxy) | every model operation outside the read allowlist (`findUnique*`, `findFirst*`, `findMany`, `count`, `aggregate`, `groupBy`), `$executeRaw*`, and any `$queryRaw*` whose SQL does not start with a read verb or contains a mutating keyword, asks `database.write` before the query is sent. Covers operations on the transaction client and batch transactions (both integration-tested against a real database, `core/db-write-guard.postgres.integration.test.ts`). Unknown future operations default to write (fail closed) |
| Background start | `core/background-tasks.ts#startBackgroundTask` | `background.start` is asked BEFORE the factory runs; a frozen start never registers or executes work and surfaces as a rejected promise |
| HTTP (UX / load shield only) | `middleware.ts` | mutating methods on `/api/**` (public prefixes included) get 503 `OPERATION_FROZEN` with `Retry-After`; GET is not blocked here; pages untouched |
| API error mapping | `core/api.ts#handleError` | `PrivilegedOperationDeniedError` is a `PublicApiError`, so routes publish 503 with the stable code and no internals |

**Not covered (explicit):** Vercel Blob `put` (4 call sites), outbound email
(Resend / SMTP), external OCR/AI calls, the in-memory Forte approval store,
and the ETL's own `pg` client (by design). A freeze therefore guarantees "no
row changes in the application database", not "no external side effects".
The ~22 bare fire-and-forget sites still perform their writes through the
guarded client (so the write itself is refused while frozen); only the 3
registry sites also refuse to *start*.

## 6. Background quiescence

```
freeze requested   SEVENF_OPERATION_MODE=freeze-writes (runtime configuration, outside the DB)
→ no new writes    database.write refused at the Prisma boundary; mutating /api → 503
→ no new starts    startBackgroundTask refuses background.start before invoking the factory
→ in-flight drains awaitBackgroundQuiescence({ timeoutMs }) waits on the existing pending set
→ pending = 0      QuiescenceReport.pendingAtEnd === 0, or BackgroundQuiescenceTimeoutError naming the count
→ source quiescent proven externally by two identical read-only snapshots (§8) and, after the load, by zero live-source drift
→ final ETL
```

`trackBackgroundTask(label, promise)` is kept for compatibility (the promise
already exists when it is registered, so it cannot refuse a start); the
three tracked sites now use the factory form. `awaitBackgroundQuiescence`
does not consume recorded outcomes. Tests: `core/background-tasks.test.ts`.

**Scope, stated plainly: `awaitBackgroundQuiescence()` proves quiescence
LOCAL TO ONE PROCESS.** The pending set is in-memory; there is no
cross-instance registry, so it says nothing about other Vercel/serverless
instances, regions or processes. It is a building block for a single
runtime, not the proof of global quiescence. For THIS cutover, global
quiescence of the source is proven operationally (§8): automatic writers
neutralised, no relevant users, read-only observations of the source that
do not change between samples, and live-source parity showing zero drift
after the load.

## 7. Existing Forte approval machinery — audited, deliberately separate

`agents/forte/runtime/{approval,policy-guard,approved-execution,decision-engine,approval-store}.ts`
provide risk levels, `requiresApproval`, `execute_after_approval`,
fingerprints, context verification, expiration and approved execution — all
keyed on `FortePlan`/`ForteContext` (workspace, agent, plan steps) and an
in-memory store. Nothing was extracted: a write freeze must hold with no plan,
no agent and no workspace (a cron tick, a webhook, a page render). The
decision shape (`source`, `reason`) leaves room for an approval to become a
policy source later (e.g. a time-boxed `deploy.production`); that convergence
is a review trigger in the foundation registry, not v1 work.

## 8. The cutover sequence — truthful for THIS cutover

Production `master` still runs Turso/libSQL and does **not** contain the
Privileged Operations core; the freeze in this branch protects the
PostgreSQL runtime **after** the switch, not the Turso source before it. No
large backport is made to fake otherwise. SevenF has no real users today,
so the smallest truthful procedure is a **manual quiescence** of the Turso
source, verified rather than assumed:

0. **Pre-tag checklist (mandatory, before the FIRST cutover tag)** — see
   §10.1: environment `sevenf-neon-production` created and verified,
   `APPROVED_CUTOVER_SHA` set to the reviewed commit, Neon branch protection
   verified (§8.5).
1. **Prove absence of relevant users**: `User.lastLogin` and `Message.createdAt`
   maxima on Turso (read-only), Vercel analytics for the window; announce
   the window.
2. **Neutralise automatic writers on the Turso runtime** (Vercel Production
   settings, each reversible, done by the owner during the window):
   - Vercel cron `/api/cron/imap-sync`: currently answered 401 by the
     middleware when no session cookie is present (§3 H) — **verify in the
     cron logs**; additionally rotate/unset `CRON_SECRET` so the route fails
     closed (500) even if reached;
   - Resend inbound webhook: unset `RESEND_WEBHOOK_SECRET` → 503 fail closed;
   - public web chat and Presence reception: no users; optionally pause the
     widget host;
   - Google login: nobody logs in during the window (every login writes);
   - tracking pixels: 401 by the middleware; no outbound mail is sent.
3. **Wait for in-flight work**: the window starts ≥ 5 minutes after step 2
   (longest cron `maxDuration` is 60 s).
4. **Prove the source is quiescent (global, not process-local)**: run
   `db:etl:parity --live-source` against the populated staging with the
   NEON-04 manifest twice, ≥ 5 minutes apart — the "live source drift"
   section must be identical and the drift set stable (it reads Turso
   against the staging snapshot, read-only; it is the same code the final
   parity uses). This external observation, not `awaitBackgroundQuiescence`
   (§6), is the evidence that no instance anywhere is still writing.
5. **Gate before `migrate` — Neon production branch protection** (verify,
   do NOT change in this branch): the Neon branch `main`
   (`br-broad-river-b2ue75l8`) of project `old-wave-11795585` must report
   `protected = true`. Verifiable read-only:
   `GET https://console.neon.tech/api/v2/projects/old-wave-11795585/branches/br-broad-river-b2ue75l8`
   → `branch.protected === true` (or the branch page in the Neon console,
   "Protected" badge). A protected branch cannot be deleted or reset by
   accident from the console/API during the window. If it is not protected,
   STOP and protect it first; only then push `neon-05-cutover-migrate-<n>`.
6. **Data cutover** (workflow, §10), one tag per approval:
   `neon-05-cutover-migrate-<n>` (production guard + empty check, then
   `0_init`) → `neon-05-cutover-stamp-<n>` → `neon-05-cutover-load-<n>` (ETL +
   parity 1 + live-source parity; zero drift expected).
7. **Keep the source quiescent** until step 10.
8. **Switch the runtime** (manual, reviewed): Vercel Production
   `DATABASE_URL` = pooled host `sslmode=verify-full`, `DIRECT_URL` = direct
   host `sslmode=verify-full`, `SEVENF_OPERATION_MODE` unset or `normal`;
   deploy the PostgreSQL code (this branch merged to `master` — a separate,
   later authorisation).
9. **Smoke** (§9.5 of the NEON-04 document, on Production).
10. **Open writes**: restore `CRON_SECRET` / `RESEND_WEBHOOK_SECRET` (now
    against Neon); nothing else, since the mode is already `normal`.
11. Keep Turso untouched for the rollback window (NEON-06 decommissions it).

If a code-enforced freeze on the Turso runtime is wanted anyway, the minimal
change is the middleware 503 for mutating `/api/**` plus `CRON_SECRET`
removal — small, but it is a change to `master` and is **not** made here.

## 9. Production ETL (`scripts/db/etl-turso-to-postgres.ts`)

| Guard (production role) | Behaviour |
|---|---|
| role | `production` is a third, explicit role; `staging` and `local` are unchanged and still refuse any host/database containing `prod` |
| identity | `--expect-project` + `--expect-branch` required; `--expect-staging-id` and `--forwarded-loopback` refused |
| marker | `sevenf:environment=production;sevenf:migration=neon-05;sevenf:project=<id>;sevenf:branch=<id>` — separate strict parser (four pairs). The NEON-04 staging marker (three pairs) is "malformed" under the production parser and vice versa: **neither can masquerade as the other** |
| URL | PostgreSQL scheme only; host exact; database exact; **direct host only** (`-pooler` refused); `sslmode=verify-full` required on any non-loopback host |
| live | `current_database()` exact; production marker exact; ledger present, one completed non-rolled-back `0_init` with the pinned checksum; 50 canonical tables and nothing else; zero sequences; every application table empty |
| one shot | `run` requires `--confirm-production <database>`; `--reset-target` / `--confirm-reset` are refused before any connection; a non-empty target is refused with no hint of a reset; a rerun after success is therefore refused; the load stays one transaction (rollback on any error) |
| `preflight-empty` (R2) | read-only; runs the same production URL/identity guard (`assertTargetUrl`: scheme, exact host, direct endpoint, exact database, `sslmode=verify-full`, project/branch expectation) and then proves on the live connection, inside a `READ ONLY` transaction, that the database has 0 base tables in `public`, no `_prisma_migrations` and 0 sequences. The cutover workflow runs it before `prisma migrate deploy`; `current_database()` alone is never enough |
| `stamp-production` | same invariants as `stamp-staging` through the shared core: role production only, `--confirm-stamp <database>`, live identity, canonical ledger/schema, **empty** application tables, never replaces a different marker, writes only the comment, no skip flag |
| manifest | `target.role = production`, `target.project`, `target.branch`; no URLs |

Tests: `scripts/db/etl-core.test.ts` (marker/expectation/URL negatives,
masquerade both ways, staging compatibility) and
`scripts/db/etl.postgres.integration.test.ts` (populated staging-marked DB
refused under production; stamp-production refusals and success on the empty
canonical DB; staging refused on the production-marked DB; one-shot run,
rerun refused, reset refused, wrong project/branch refused, no secret in
errors; digests identical to the staging/local rehearsals).

## 10. Production workflow (`.github/workflows/neon-05-production-cutover.yml`)

- Trigger: **only** `push` of tags `neon-05-cutover-*`. No
  `workflow_dispatch`, no branch push, no pull_request, no schedule — a
  branch push cannot run it.
- Environment: the job references `sevenf-neon-production`. **GitHub creates
  a referenced environment on first use with NO protection rules**, so the
  environment does not by itself stop a job; the human gate exists only if
  the environment is configured before the first tag (§10.1). Two gates in
  the workflow hold regardless of environment configuration: the tag commit
  must equal `APPROVED_CUTOVER_SHA` (`GITHUB_SHA === APPROVED_CUTOVER_SHA`,
  full 40-hex, exact string equality, checked before checkout and again on
  the checked-out `HEAD`), and every var/secret must be present — otherwise
  the job fails closed before any connection.
- Vars: `APPROVED_CUTOVER_SHA`, `ETL_SOURCE_URL`, `ETL_TARGET_HOST`,
  `ETL_TARGET_DATABASE`, `ETL_PRODUCTION_PROJECT`, `ETL_PRODUCTION_BRANCH`;
  secrets: `ETL_SOURCE_AUTH_TOKEN`, `ETL_TARGET_URL` (direct host,
  `sslmode=verify-full`). Values are never printed.
- Three tag families = three approvals: `…-migrate-<n>` (`preflight-empty`
  = full production guard on `ETL_TARGET_URL` + live emptiness, then
  `migrate deploy` of `0_init` only, then `migrate status`), `…-stamp-<n>`
  (`stamp-production`), `…-load-<n>` (`db:etl:run` one shot → parity 1 →
  parity 2 `--live-source` → manifest artifact, 90 days).
- `permissions: contents: read`; concurrency group
  `neon-05-production-cutover`, never cancelled.
- No reset flags, no TRUNCATE/DELETE/DROP, no `db push`, no `migrate reset`,
  no Vercel mutation: the application switch (§8 step 8) stays a separate
  manual gate so parity can be reviewed before the runtime cuts over.
- Tests: `scripts/db/neon-05-cutover-workflow.test.ts` executes the gates'
  bash exactly as written (tag families, approved-sha match / missing /
  malformed / mismatch, vars/secrets presence without echo, pooled host
  refusal, checked-out commit check) and asserts the file's shape.

### 10.1 Pre-tag checklist — mandatory BEFORE creating any `neon-05-cutover-*` tag

1. Create the GitHub Environment `sevenf-neon-production` in
   `MerlysOcantomi/7FNEW` (Settings → Environments).
2. Add **required reviewers** (at least the owner) and keep "prevent
   self-review" on if available.
3. Set the **deployment branch/tag policy** to allow only tags matching
   `neon-05-cutover-*` (no branches).
4. Add the environment **variables**: `APPROVED_CUTOVER_SHA` = the full sha
   of the reviewed commit the tags will point at; `ETL_SOURCE_URL`;
   `ETL_TARGET_HOST` (direct host, no `-pooler`); `ETL_TARGET_DATABASE`
   (`neondb`); `ETL_PRODUCTION_PROJECT` (`old-wave-11795585`);
   `ETL_PRODUCTION_BRANCH` (`br-broad-river-b2ue75l8`).
5. Add the environment **secrets**: `ETL_SOURCE_AUTH_TOKEN`;
   `ETL_TARGET_URL` (the Neon DIRECT connection string for `neondb` with
   `sslmode=verify-full`).
6. **Verify** on the environment page: reviewers listed, tag policy shows
   `neon-05-cutover-*`, all six vars and both secrets present, and
   `APPROVED_CUTOVER_SHA` equals `git rev-parse` of the commit you intend to
   tag. Verify the Neon branch protection (§8.5).
7. Only then create the first tag, pointing exactly at
   `APPROVED_CUTOVER_SHA`. A tag on any other commit fails the second step
   of the workflow.

## 11. SSL

`pg` (8.16+) treats `sslmode=require`, `prefer` and `verify-ca` as
deprecated aliases of `verify-full` and emits a warning (seen in the NEON-04
Preview). The explicit form is now the documented one: `.env.example`
(`DATABASE_URL`, `DIRECT_URL`), `7F-DATABASE.md` §2, the NEON-04 document
§3, and `core/db.ts#sslPosture` (pure) with a one-time warning for any
non-loopback URL that is not `verify-full` — never a refusal. The ETL
requires `verify-full` for the production role. Test: `core/db-ssl.test.ts`.
No real secret was touched.

## 12. Blockers before a safe NEON-05 cutover

1. **GitHub Environment `sevenf-neon-production`** must be created and
   verified by hand BEFORE the first tag (§10.1): required reviewers, tag
   policy `neon-05-cutover-*`, six vars (including `APPROVED_CUTOVER_SHA`)
   and two secrets. A referenced-but-unconfigured environment does not stop
   a job; only the in-workflow gates do.
2. **Production Neon `main` must be re-validated live** (empty, PG version,
   no marker) by the `migrate` tag's `preflight-empty`; the external audit
   is not trusted. **Branch protection** (`protected = true` on
   `br-broad-river-b2ue75l8`) must be verified before the `migrate` tag
   (§8.5); it is not changed by this branch.
3. **Manual quiescence of the Turso runtime** (§8) is a human procedure, not
   code; it depends on the owner performing steps 2–4 and on verifying the
   cron 401 finding in the Vercel logs.
4. **Application switch** (`master` merge + Vercel Production env change)
   is a separate authorisation; this branch contains the PostgreSQL runtime
   and is not on `master`.
5. **Uncovered side effects** (blob uploads, outbound email) are documented
   in §5; with no users and the webhooks/cron neutralised they do not fire,
   but no code prevents them.
6. Test-suite proof of the freeze uses a disposable local PostgreSQL 16, not
   Neon PostgreSQL 18; the pooled-endpoint behaviour of the extended client
   is verified only by the NEON-04 Preview (staging), not by CI.

## 13. Safety statement

Neon production `main` was **not** connected to or written; Turso was
**not** written; the NEON-04 staging database was **not** reset, reloaded,
re-stamped or touched, and tag `neon-04-etl-20260913-01` was not moved;
Vercel Production was **not** changed; `master` was **not** changed; no
cutover tag was created; the cutover was **not** executed.
