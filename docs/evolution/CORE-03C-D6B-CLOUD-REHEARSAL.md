# CORE-03C-D6B — Turso Cloud Branch Migration Rehearsal

- **Date:** 2026-08-20 (attempt 1) · 2026-08-22 (attempt 2 — resume; attempt 3 — executed)
- **Branch:** `7f-evolution` · attempt 1 from SHA `1a9e1c416d689aac8bbd8470f617364c8cec3afc`; attempts 2–3 from SHA `eae6f8b`/`0ad92a0` (`master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`)
- **Verdict:** **PASS — the cloud rehearsal ran end to end on the real disposable Turso Cloud branch and every mission gate held (§8).** Attempt 1 was BLOCKED (no branch creatable, §1); attempt 2 was BLOCKED (invalid branch credential, §7); attempt 3 ran after the owner supplied a valid branch token. **PASS does NOT authorize production adoption** — that is CORE-03C-D6-PRODUCTION-ADOPTION, a separate owner-gated mission; this record is its cloud evidence input, alongside D6's local evidence.
- **Production zero-write (all attempts):** zero connections to the production database — not even read-only. Every statement of attempt 3 went to the pinned disposable branch hostname `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io`, enforced by a compile-time hostname pin with no override (§8.1). Production-shaped env credentials were absent and are refused by the guard if present.

Labels: **FACT**, **INFERENCE**, **RECOMMENDATION**, **OWNER DECISION REQUIRED**.

---

## 1. Why BLOCKED — exact missing capabilities (FACT)

Creating a disposable Turso Cloud database/branch seeded from production is a **Platform API operation** (or an authenticated `turso` platform CLI session). Two independent blocks exist:

1. **Authorization capability absent.** Present in the environment (by name only, values never read): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — a **database-level** credential pair. Absent under every plausible name: `TURSO_API_TOKEN`, `TURSO_PLATFORM_TOKEN`, `TURSO_TOKEN`, `TURSO_ORG`, `TURSO_ORGANIZATION`, `TURSO_GROUP`; no `~/.config/turso` / `~/.turso` CLI session; no `.env` files; no `turso` platform CLI binary (and its installer pulls from GitHub releases, which this environment's egress blocks). Per the mission rule — ratified here — a database auth token is **not** authorization to create databases, and no attempt was made to use it as one.
2. **Network egress blocked.** `https://api.turso.tech` is unreachable both through the configured proxy (CONNECT tunnel refused, HTTP 403 — the request, and therefore any credential, was never transmitted) and directly from Node (403 at the gateway). `docs.turso.tech` is equally blocked, so the current official platform documentation could not be consulted from here either. Even with a platform token, the branch could not be created **from this environment**.

## 2. What D6B verified before stopping (FACT)

- Repo preflight: `7f-evolution` @ `1a9e1c4` = `origin/7f-evolution`, clean tree, `master` untouched, 26 ahead / 0 behind.
- Credential inventory as above (presence only).
- Reachability probes: proxy CONNECT to `api.turso.tech` → 403 (tunnel refused, nothing sent); direct Node fetch (no credentials attached) → 403; `docs.turso.tech` → blocked both ways.
- Nothing else was executed: no cloud branch, no migrations anywhere, no production connection, no local re-run of D6 (not needed — no difference to diagnose).

## 3. Ledger decision (§8 of the mission) — analysis prepared; OWNER DECISION REQUIRED

The question "does Sevenef need a remote migration ledger on Turso?" was evaluated; **no ledger of any kind was created**, and this remains an owner decision for the cloud rehearsal / production mission:

| Option | Assessment |
|---|---|
| **A — no remote ledger** (migration files + schema-precondition gates + committed deployment evidence) | Sufficient for *this* window: the three deltas are additive and their applied-state is fully decidable from schema introspection (column/index/table existence). Weakness: not durable — future rebuild-class migrations (Stage 5 §7 relaxations, FK subset) are not reliably inferable from schema shape alone, so every future window would re-derive state ad hoc. |
| **B — Sevenef-owned ledger** (an explicitly own table, e.g. `_sevenef_migrations`, storing migration name + sha256 checksum + applied_at, mirroring the `prisma/migrations` names/checksums) | **RECOMMENDATION.** Honest (no imitation of another tool's internals — the mission's stated safety preference), durable for future migrations, trivially convertible later because names/checksums are identical to the Prisma history; local/CI keeps using the real Prisma CLI against file databases, and `db:verify-history` already enforces history↔schema equivalence. Cost: one additive table plus applier support. |
| **C — Prisma-compatible `_prisma_migrations`** | Proven feasible and row-equal to a real Prisma run in D6, and it would become natively readable if Prisma ever supports remote sqlite datasources — but it means hand-maintaining another tool's internal, unsupported table format, with checksum/format coupling to the installed Prisma version. Only justified if that native-support bet is made explicit; no strong reason exists today. |

INFERENCE: whichever option is chosen, the **fail-closed idempotence** contract stays the same as D6 rehearsed: the deployment tool determines "no pending migrations" from its state source (ledger or schema preconditions) and never re-executes DDL blindly.

## 4. Recovery strategy (§16) — prepared, requires platform access to verify

The production window needs a Turso-side recovery mechanism (branch-from-parent, point-in-time restore, and/or dump) — exactly the capability this mission could not reach. FACT: nothing about it could be verified from this environment (API and docs both blocked). The D6-rehearsed principle stands: snapshot before applying, **verify the restore path before the window proceeds**, never treat `DROP COLUMN` as rollback. The cloud rehearsal must demonstrate the real mechanism on the disposable branch before production is ever touched.

## 5. Unblock requirements — to re-run D6B (attempt 1; superseded in part by §7 — the branch now exists and egress is open, only the token remains)

1. **Owner provisions platform authorization**, rehearsal-scoped: a Turso Platform API token with database create/delete permission for the organization (plus the org slug), exposed to the session as e.g. `TURSO_API_TOKEN` + `TURSO_ORG` — or an environment with an authenticated `turso` platform CLI.
2. **Egress policy allows** `api.turso.tech` (and the regional hostname the new branch database will get).
3. Re-run this mission: create `sevenef-core03c-d6b-<timestamp>` seeded from production; prove independent identity; run the M1 auditor + M2 §8 gates against the branch (48/61/no-ledger + real point-in-time counts); extend `scripts/rehearse-core-03c-d6.ts` with an **explicitly authorized** remote-branch target mode (guard pinned to the branch's exact hostname, marker protocol unchanged, production hostname permanently refused); apply migrations 1–3 with per-migration validation; cloud-specific validation (auth, PRAGMAs, transactions, schema visibility); InboxTodo E2E; idempotence; then delete the branch and confirm production intact.

## 6. Repository changes in this mission

This document only. No code, no tooling, no migration, no data, no ledger anywhere.

---

## 7. Attempt 2 (2026-08-22) — branch exists and is reachable; credential invalid (FACT)

The owner resolved attempt 1's blocker manually: a disposable Turso Cloud branch **`7f-d6b-rehearsal`** now exists, with the exact expected hostname `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io`, and the environment carries two credentials for it by name: `D6B_DATABASE_URL` and `D6B_AUTH_TOKEN` (values never printed).

### 7.1 What was verified before stopping

| Check | Result |
|---|---|
| Repo preflight | `7f-evolution` @ `eae6f8b` = `origin/7f-evolution`, clean tree, `master` untouched |
| Target identification | `D6B_DATABASE_URL` parses as `libsql://` with hostname **exactly** `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io` — the owner-declared disposable branch; no embedded credentials, no query params. Egress to that hostname is now allowed: `GET /health` → HTTP 200 (the blocker of attempt 1 §1.2 is resolved for the branch hostname) |
| Auth, without token | `@libsql/client` `SELECT 1` with no `authToken` → **HTTP 401** — the branch requires authentication (it is not an open database) |
| Auth, with `D6B_AUTH_TOKEN` | Hrana `v2/pipeline` `SELECT 1` with the provided value as bearer → **HTTP 400 `{"error":"JWT error: InvalidToken"}`** — the Turso server itself parses and rejects the value |
| Credential shape (metadata only, value unread) | 27 characters; **not** JWT-shaped (no `header.payload.signature` structure — a Turso database token is a JWT of several hundred characters); all-lowercase words separated by non-alphanumeric characters, several matching common natural-language words. INFERENCE: the value stored in `D6B_AUTH_TOKEN` is a human-written placeholder note, not a token. It was deliberately **not** read or printed (the mission prohibits printing credential-slot values, and the permission layer independently blocked it) |
| Other credential sources | none: no `.env*` with values (only `.env.example`), no `TURSO_*`/`DATABASE_*` vars, no token embedded in the URL |

### 7.2 Why this is a hard stop

The mission requires positive identification **and** access to the branch before any phase. The branch is positively identified (exact hostname, reachable, auth-protected), but with no valid credential neither the read-only baseline audit (M2 §8 gates) nor any later phase can run. No fallback exists that respects the rules: production credentials are absent (and prohibited), and the Platform API path is out of scope by the mission's own terms.

### 7.3 What was NOT done (attempt 2)

No connection beyond the four probes above; no query ever executed on the branch (every attempt was refused at the auth layer); no write, DDL, DML, marker, ledger or migration anywhere; no production contact of any kind; no code or tooling change — this document is again the only repository change.

### 7.4 Unblock requirement (single, precise)

Generate a **database auth token for the branch** `7f-d6b-rehearsal` (Turso dashboard → the branch database → *Generate token*, or `turso db tokens create 7f-d6b-rehearsal` from an authenticated owner CLI; full-access, since the rehearsal writes to the branch) and place its JWT value in the session environment as **`D6B_AUTH_TOKEN`** (keeping `D6B_DATABASE_URL` as is). Everything else — egress, hostname, mission plan, driver design (§5.3) — is ready; on the next run the mission resumes directly at the read-only baseline audit.

> **Resolved same day:** the owner supplied a valid full-access (`"a":"rw"`) branch token and attempt 3 executed the full rehearsal — see §8.

---

## 8. Attempt 3 (2026-08-22) — cloud rehearsal EXECUTED on the real branch (FACT)

Everything below ran against the disposable Turso Cloud branch only. Labels as in the rest of this doc; every count is aggregate-only (no row content, no PII, no credential ever printed).

### 8.1 Tooling and fail-closed safety (committed)

`scripts/rehearse-core-03c-d6b.ts` (npm: `db:rehearse-d6b`) — the cloud counterpart of the D6 driver, with the safety model adapted to a remote target:

- The rehearsal hostname is a **compile-time constant pin**: the guard accepts only `libsql`/`https`/`wss` URLs whose hostname is exactly `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io`. Any other host — production's included — is refused; no env var can widen it; embedded URL credentials and plaintext `http` are refused.
- `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` present in the environment → abort before any connection. `DATABASE_URL`/`DATABASE_AUTH_TOKEN` are accepted only for the e2e phase and only when strictly equal to the D6B branch values.
- `mark` (the first write) accepts only a database in the exact ledger-free pre-adoption shape (48/61), stamps it with a random-token marker table (`_d6b_rehearsal_marker`) and captures every business table's row count; all later phases refuse a database whose marker token does not match the local state file. `0_baseline` is never parsed or executed (mission §E).
- Guard behavior is unit-tested with zero network: `scripts/rehearse-core-03c-d6b.test.ts` (hostname pin incl. production-shaped hosts, env guard, precondition parser against the real migration files, fail-closed state classification).

### 8.2 Target identification and baseline equivalence (mission §A–§B)

- `D6B_DATABASE_URL` hostname matched the pin exactly; owner-supplied token verified JWT-shaped with `"a":"rw"` (metadata only). `GET /health` → 200.
- Read-only baseline audit: **48 business tables · 61 explicit indexes · `_prisma_migrations` absent · `_sevenef_migrations` absent · `InboxTodo.workspaceTaskId` absent · `QRCode.workspaceId` absent · portal tables absent** — the exact M1 §21.1 pre-adoption production shape.
- Row counts matched the M1 §21.2 point-in-time production evidence **exactly, all 20 audited tables** (Workspace 12, WorkspaceMember 11, User 14, Usuario 2, Cliente 27, Proyecto 18, Tarea 15, WorkspaceTask 13, InboxTodo 3, Conversation 18, Message 74, Factura 18, D2 trio 0, QRCode 0, Documento 0, InboxEntry 0, Vertical 0, ClientAuth 0). INFERENCE: consistent with a branch seeded from the production snapshot; combined with the distinct pinned hostname, the target is positively identified as the disposable copy, not production.

### 8.3 M2 §8 gates re-run on the branch (mission §C) — ALL GREEN

`npm run db:audit-m1` (read-only, guard-enforced) against the branch, plus the three §21.9 supplementary counts:

| Gate | Branch result | Verdict |
|---|---|---|
| D2 trio | ClientProject/ClientInvoice/ClientFile = 0/0/0 | PASS |
| D5 Factura.items | 18 total: 0 null / 0 empty / 0 whitespace / 0 invalid JSON / 0 non-arrays | PASS |
| D5 Documento.url | 0 rows (vacuously clean) | PASS |
| D5 Cliente.tipo | 0 NULL | PASS |
| D5 Factura.fechaEmision | 0 NULL · 0 unparseable | PASS |
| QRCode | total 0 → proceed structurally | PASS |
| InboxTodo | 3 rows: EXACT 0 / AMBIGUOUS 0 / NO_MATCH 3 (per §6.3: stay NULL) | PASS |
| Integrity | identical to M1 §21.8, zero delta: NULL-workspace {Activity 21, Cliente 8, Factura 1, Notification 2, Proyecto 10, Tarea 4, Transaccion 5, User 14}; nonexistent-workspace Activity 4; fkOrphans 4/5/25 on the 3 known relations; cross-tenant 0. (No relation receives a real FK in this window; migration 3's FKs are on new empty tables.) | PASS |

### 8.4 Delivery mechanism validated on the real cloud hostname (mission §D)

`prisma migrate status` (7.4.1) against the branch hostname fails **P1013 "the scheme is not recognized"** for both `libsql://` and `https://` — rejection is pre-connection (no credential transmitted). FACT: the D6 §4 finding holds against real Turso Cloud: **Prisma CLI can never deliver migrations to a libSQL server; the applier over `@libsql/client` is the real mechanism.**

### 8.5 Applier without ledger — migrations 1–3 applied and validated (mission §E–§I)

Per the mission's §N rule, **no ledger was created**. Applied-state is decided from **schema preconditions**: each migration's objects (indexes/tables/columns) are parsed from its SQL (21 idx · 2 cols + 2 idx · 4 tables + 9 idx — parser verified against the real files); all-present → APPLIED, none → PENDING, partial → INCONSISTENT → STOP. Each pending migration runs as **one atomic batch**, then is validated individually:

| Step | Result |
|---|---|
| 1_add_missing_indexes | 48 tables / **82** explicit indexes; all business-table row counts identical to the `mark` capture |
| 2_add_link_columns | 48 / **84**; `InboxTodo.workspaceTaskId` and `QRCode.workspaceId` TEXT · nullable · no default (PRAGMA-verified); **all 3 legacy InboxTodo rows kept `workspaceTaskId = NULL`** (no synthetic WorkspaceTask), **0 QRCode rows gained a workspace** (0 exist); WorkspaceTask count unchanged (13); rows intact |
| 3_create_portal_tables | **52 / 93**; ClientAsset, ClientRequest, ClientRequestAsset, ForteSnapshot created **empty**; rows intact |
| Final schema | 52 business tables / 93 explicit indexes = `db:verify-history` (52/93/integrity ok/drift 57 = manifest 57) — no unexplained drift |

### 8.6 Idempotence (mission §M)

Second applier run: **NO PENDING MIGRATIONS** (all three APPLIED by schema preconditions), zero DDL executed, schema delta 0. The fail-closed contract of D6 §3 holds on the cloud with no ledger at all for this additive window.

### 8.7 Cloud-specific validation (mission §J)

On a disposable scratch table (`_d6b_probe`, dropped afterwards), over the real wire protocol: `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, `CREATE INDEX` executed and immediately visible via `sqlite_schema`/PRAGMA; **interactive transactions**: commit persisted, rollback left nothing; **batch atomicity**: a batch containing a failing statement was rejected with no partial write. Server `sqlite_version 3.47.0`. `@libsql/client` (driver phases) and `@prisma/adapter-libsql` (e2e, §8.8) both worked against Turso Cloud auth.

### 8.8 InboxTodo E2E — real services, real adapter, real cloud (mission §K–§L)

Synthetic `d6b-`-prefixed sandbox rows (workspace/user/member/cliente; zero PII) plus the real app stack (`PrismaClient` + `@prisma/adapter-libsql` + the actual service modules):

1. **`createTodo`** (the production HIGH): InboxTodo + mirror WorkspaceTask (`sourceType='inbox_todo'`) + `workspaceTaskId` committed atomically — **no orphan, no duplicate**, on real Turso Cloud.
2. **`resolveWorkspaceTaskId` legacy branch** (still live code): status update addressed by InboxTodo id resolved through the link and marked the mirror `done`.
3. The **3 legacy production-copy todos remained untouched and unlinked** after all e2e traffic.
4. Injected mid-transaction failure in the same interactive shape: **full rollback, zero partial rows**.
5. QRCode scoped create/read OK; NULL-workspace count unchanged (no invented default).
6. Portal tables (nested create + include) and ForteSnapshot upsert/findUnique round-trip OK.
7. `Factura.items`: **18/18 production-copy rows parse as JSON arrays** through the app client (counts only).

### 8.9 Recovery rehearsal (mission §O)

Executed, not described: a **logical dump** of the branch (schema DDL + every row, read over the wire) restored into a throwaway local SQLite file and verified — **52 tables, 93 explicit indexes, 487 rows copied, 0 row-count mismatches** — then the dump was **deleted** (production-copy data never outlives the verification). This proves a restore path that needs neither the Platform API nor production. Additionally: branch-from-parent itself is demonstrated owner-side (this branch exists); `api.turso.tech` is now egress-reachable from the environment but was not used (no platform token; out of mission scope). RECOMMENDATION for the production window: owner-side snapshot/branch before the window plus this rehearsed logical-dump path as the in-window fallback, verified before applying anything.

### 8.10 Ledger decision — cloud evidence in (mission §N; final input for the owner)

No ledger was created (`status` fails if one appears). Cloud evidence: for this additive window, **option A (schema-precondition gates, no remote ledger) was sufficient and idempotent on real Turso Cloud** — pending-detection needed nothing else. The §3 analysis stands with one upgrade: A is now *proven* for this window, not just argued; **B (`_sevenef_migrations`) remains the RECOMMENDATION at the moment a non-inferable (rebuild-class) migration first appears — not before**; C stays unjustified. OWNER DECISION REQUIRED at production-adoption time; nothing needs to be created for this rehearsal's completion, so nothing was.

### 8.11 Checks (mission §P)

`npm run typecheck` clean · `npm test` **1322/1322 pass** (includes the new D6B guard tests) · `npm run build` OK · `npm run db:verify-history` OK (52/93/integrity ok/drift 57 = manifest 57).

### 8.12 State left on the branch, and repository changes

Branch (disposable, owner may delete or keep it): migrations 1–3 applied (52/93); `_d6b_rehearsal_marker`; `d6b-`-prefixed synthetic rows (workspace `d6b-ws`, user, member, cliente, 2 e2e todos + mirror tasks, 1 QRCode, 1 ClientRequest + asset, 1 ClientAsset, 1 ForteSnapshot). The 3 legacy InboxTodo rows and every other production-copy row: byte-identical counts to the `mark` capture. No ledger.

Repository: this document; `scripts/rehearse-core-03c-d6b.ts`; `scripts/rehearse-core-03c-d6b.test.ts`; `db:rehearse-d6b` npm script. No historical migration edited (`db:verify-history` green); no `master` touch; no PR.

### 8.13 Exit — PASS, and what it does NOT mean

All mission gates (§A–§P) demonstrated above. **PASS makes this record evidence for owner review of CORE-03C-D6-PRODUCTION-ADOPTION. It does not authorize, schedule or start any production write.** The production window remains a separate mission requiring: owner authorization, in-window M2 §8 gate re-run, in-window snapshot + verified restore path, an explicitly authorized production-target applier variant with its own guard, and the post-adoption InboxTodo smoke test.
