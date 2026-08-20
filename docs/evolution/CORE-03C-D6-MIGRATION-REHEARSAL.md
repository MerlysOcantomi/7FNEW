# CORE-03C-D6 — Turso/libSQL Migration Adoption Rehearsal

- **Date:** 2026-08-20
- **Branch:** `7f-evolution` · starting SHA `7db5c85f5adbfa12fbf6a510cbee60920ed293a5` (= CORE-03C-M2 closure; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`)
- **Verdict:** **PASS — 8/8 exit criteria demonstrated** (§9). **This does NOT authorize a production migration**: the production window is a separate, owner-authorized mission; this record is its evidence input.
- **Production zero-touch:** the production Turso database was never connected to, read from, or written to in this mission. Every command ran with the production env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`) removed from the child environment, against a loopback-only disposable server; the committed driver refuses any non-loopback, non-tempdir target by construction (§2).

Labels: **FACT** (executed and observed here), **INFERENCE**, **OWNER DECISION REQUIRED**, **FUTURE EXECUTION**.

---

## 1. Environment and datasource isolation

| Item | Value |
|---|---|
| Rehearsal server | `sqld 0.24.32 (40c272de 2025-02-14)` — libSQL server, the same software Turso hosts — run locally on `127.0.0.1:45123` (HTTP/Hrana), data directory inside the session's ephemeral scratchpad |
| Binary provenance | npm package `@sqld/linux-x64@0.24.1-pre.42` (repackaged upstream release binaries; GitHub release downloads are egress-blocked in this environment) |
| Client protocol | `@libsql/client` over HTTP — the exact driver family the app's production stack uses (`@prisma/adapter-libsql`) |
| Disposable Turso cloud instance | **not creatable here** (no Turso platform CLI/API token in the environment) — the local sqld server is the faithful stand-in: same server codebase, same wire protocol. Platform-specific behavior (auth, managed PRAGMAs, replicas) remains for the production window's own pre-flight |
| Production datasource | **NOT USED.** Env vars stripped from every child process; the driver additionally refuses to run if any of them is present (e2e excepted, where `DATABASE_URL` must literally equal the rehearsal URL) |
| Write authorization | rehearsal target only |

### Why a real Turso cloud database was not used

Creating one requires the Turso platform CLI or API token; neither exists in this environment (checked by name only). Per the mission's rule, production was **not** used as a substitute and the rehearsal was **not** faked: a genuine libSQL **server** (not an embedded file) was stood up locally so the remote wire protocol, interactive transactions, batching and PRAGMA introspection were all exercised for real.

## 2. Fail-closed safety guard (FACT, committed)

`scripts/rehearse-core-03c-d6.ts` (npm: `db:rehearse-d6`) enforces **positive identification** of a disposable target — there is no "not obviously production → continue" path:

1. `D6_REHEARSAL_URL` must be a `file:` path **inside the OS temp directory**, or an `http/https/ws/wss/libsql` URL whose host is **loopback** (`127.0.0.1`/`::1`/`localhost`). Any other host or scheme aborts. No override exists.
2. Any production-shaped env var present → abort before any connection (e2e phase excepted for `DATABASE_URL` strictly equal to the rehearsal URL).
3. `baseline` only bootstraps an **empty** database (zero user tables) and stamps it with a random-token marker table (`_d6_rehearsal_marker`); every later phase refuses to touch a database whose marker token does not match the state file. A mid-run retarget — even to another local database — fails closed.

## 3. Migration inventory (FACT — SQL read file-by-file)

| # | Name | Purpose | DDL type | Expected delta | Risk | Rollback characteristics |
|---|---|---|---|---|---|---|
| 0 | `0_baseline` | deployed legacy state verbatim (CORE-03B capture) | 48 × CREATE TABLE, 61 × CREATE [UNIQUE] INDEX | empty DB → 48 tables / 61 explicit indexes | none on production (ledger-adopted, never executed there) | n/a — it *is* the restore reference |
| 1 | `1_add_missing_indexes` | the 21 immediately applicable missing indexes | 21 × CREATE INDEX | +21 indexes (61→82), tables unchanged | very low, additive | 21 × DROP INDEX (documented in-file) |
| 2 | `2_add_link_columns` | nullable `InboxTodo.workspaceTaskId` + `QRCode.workspaceId` + their 2 indexes | 2 × ALTER TABLE ADD COLUMN, 2 × CREATE INDEX | +2 nullable/default-free/FK-free columns, +2 indexes (82→84) | low, additive; **unblocks the production HIGH** | indexes droppable; column drop is NOT casual on SQLite — restore-from-snapshot is the rehearsed recovery (§8) |
| 3 | `3_create_portal_tables` | ClientAsset → ClientRequest → ClientRequestAsset → ForteSnapshot | 4 × CREATE TABLE, 9 × CREATE [UNIQUE] INDEX | +4 tables (48→52), +9 indexes (84→93) | low, new empty tables | DROP the 4 empty tables |

No migration contains DML, defaults, invented relations or backfills (verified by reading the SQL, and §6's runtime checks).

## 4. Critical mechanism finding — Prisma migrate cannot target libSQL servers (FACT)

`prisma migrate status` (7.4.1) against the rehearsal server fails with **`P1013: the provided database string is invalid — the scheme is not recognized`** for both `http://127.0.0.1:45123` and `libsql://127.0.0.1:45123`. The sqlite provider accepts **`file:` URLs only**. Therefore:

- `prisma migrate resolve/deploy/status` **can never run against Turso production** (or any libSQL server). The decisions doc's §10 "UNVERIFIED PROVIDER CAPABILITY" is resolved: **NOT SUPPORTED as a direct CLI flow.**
- The rehearsed production-adoption mechanism is a **ledger-compatible applier** (the committed driver): it executes each migration's SQL over `@libsql/client` (one atomic batch per migration) and writes `_prisma_migrations` rows whose **table DDL, migration names, checksums and `applied_steps_count` are taken from — and verified equal to — a reference run of the real Prisma CLI** on a throwaway local *file* database built from the same legacy baseline.
- INFERENCE: after adoption, local/CI tooling (`db:verify-history`, `migrate status` on file builds) remains fully Prisma-native; only the *transport to the server* needs the applier. OWNER DECISION REQUIRED (production mission): confirm this applier mechanism (extended with an explicitly authorized production target and its own gates) as the production window's tool.

## 5. Rehearsal run — stages and results (FACT)

| Stage | Result |
|---|---|
| A. Legacy baseline | `0_baseline` executed on the empty rehearsal server → **48 tables / 61 explicit indexes / no `_prisma_migrations`** — exact pre-adoption production shape (M1 §21.1) |
| B. Synthetic fixtures | Workspace + User + WorkspaceMember + Cliente + Factura (valid JSON array items) + Contact + ChannelConnection + Conversations ×3 (with / without / **orphan** connection) + Messages ×3 (same trio) + legacy InboxTodo (no link column yet) + pre-existing WorkspaceTask + legacy QRCode (no workspace column yet). All synthetic, zero PII |
| Snapshot | server stopped → data directory copied (`snapshot-pre-adoption`) → server restarted |
| C. Reference adoption (local FILE db, real Prisma CLI) | legacy baseline via raw DDL (no ledger) → `migrate resolve --applied 0_baseline` → **creates `_prisma_migrations` with exactly one row** (`0_baseline`, `applied_steps_count=0`, checksum = sha256 of the file), **business schema untouched (48 tables verified)** → `migrate deploy` applies 1–3 → 52/93, 4 ledger rows → `migrate status`: "Database schema is up to date!" → second `migrate deploy`: "No pending migrations to apply." |
| D. Rehearsal adoption (sqld over HTTP, applier) | ledger table created with the reference's DDL; baseline row inserted; migrations applied **one at a time**, each validated (§6); final ledger **equals the reference ledger** in names, checksums and applied_steps_count |
| Final schema | **52 tables / 93 explicit indexes**, matching `npm run db:verify-history` (52/93/integrity ok/drift 57 = manifest 57) — no unexplained drift |
| Idempotence | second applier run: **pending=0, schema delta 0, ledger delta 0, data delta 0**; reference second `migrate deploy` equally a no-op |
| Status | ledger↔history report: all 4 APPLIED, 0 pending, 0 unknown rows, checksums match |
| Repeatability | after the restore (§8) the **entire sequence was re-run from the restored pre-adoption state with the final committed driver — identical results end to end** |

## 6. Per-migration validation (FACT)

- **Migration 1:** 48 tables / 82 explicit indexes; no unexpected tables/columns; all fixture rows intact.
- **Migration 2 (critical):** `QRCode.workspaceId` and `InboxTodo.workspaceTaskId` exist, type `TEXT`, **nullable, no default** (PRAGMA-verified); their 2 indexes exist (84 total); **the legacy InboxTodo row's link stayed `NULL`** (no invented relation), **the legacy QRCode row's workspace stayed `NULL`** (no default workspace), **WorkspaceTask count unchanged** (no synthetic tasks); no row destroyed.
- **Migration 3:** 52 tables / 93 indexes; `ClientAsset`, `ClientRequest`, `ClientRequestAsset`, `ForteSnapshot` created **empty**; fixtures intact. (Schema/persistence only — no product claims.)

## 7. Application compatibility — InboxTodo HIGH end-to-end (FACT)

Run through the **real application stack** — `PrismaClient` + `@prisma/adapter-libsql` over HTTP to the libSQL server (the same adapter path production uses), importing the real services:

1. **`createTodo` (modules/inbox/todo-service.ts)** — the exact dual-write transaction that fails in production today: InboxTodo created, mirror WorkspaceTask created (`sourceType='inbox_todo'`, `sourceId=todo.id`), `workspaceTaskId` populated, transaction committed. **No orphan, no duplicate** (exactly 1 mirror). The production HIGH is demonstrably resolved by migration 2.
2. **`resolveWorkspaceTaskId` legacy branch** — `updateInboxScopedTaskStatus` addressed by the InboxTodo id resolved through `workspaceTaskId` and updated the linked WorkspaceTask to `done`.
3. **Transaction rollback** — controlled fixture with the same interactive `$transaction` shape (create InboxTodo → create WorkspaceTask → injected failure before the link step): **full rollback over the wire protocol; zero partial rows** (counts identical before/after).
4. **QRCode** — workspace-scoped create/read through the app client; the legacy row kept `workspaceId = NULL`.
5. **Portal tables + ForteSnapshot** — nested `ClientRequest.assets` create + `include`, `ClientAsset` create, `ForteSnapshot` upsert/findUnique round-trip: all OK.
6. **Factura.items** — parses as a JSON array through the app client (the facturacion read-path contract).

## 8. Recovery / restore — rehearsed, not described (FACT)

Mechanism: **stop server → filesystem snapshot of the sqld data directory → (later) stop server → delete data directory → copy snapshot back → restart.** Executed for real: after the full adoption + e2e, the pre-adoption snapshot was restored and verified — **48 tables / 61 explicit indexes, `_prisma_migrations` absent, `workspaceTaskId` column absent, fixture rows present.** `DROP COLUMN` was deliberately **not** used as a rollback mechanism (SQLite/libSQL caveats). INFERENCE for production: the equivalent is a Turso snapshot/branch/dump taken in the maintenance window before adoption; the window must verify its restore path the same way before applying anything.

## 9. Exit criteria — 8/8

| # | Criterion | Result |
|---|---|---|
| 1 | Disposable rehearsal datasource positively identified | PASS — loopback-only guard + empty-DB bootstrap + marker token (§2) |
| 2 | Legacy-equivalent baseline reproduced | PASS — 48/61/no-ledger (§5-A) |
| 3 | Prisma baseline adoption / ledger demonstrated | PASS — reference `resolve --applied` observed row-by-row; ledger-compatible replication verified equal (§5-C/D); CLI-vs-libSQL limitation documented (§4) |
| 4 | Migrations 1–3 applied successfully | PASS — attributed and validated per migration (§6) |
| 5 | Second deploy idempotent | PASS — both the applier and the reference CLI (§5) |
| 6 | App compatibility incl. InboxTodo E2E | PASS (§7) |
| 7 | Transaction rollback demonstrated | PASS (§7.3) |
| 8 | Recovery/restore actually rehearsed | PASS (§8) |

## 10. Failures and fixes during the rehearsal (honest record)

Two fixture-shape errors in the **driver** (not in any migration) surfaced and were fixed while building the rehearsal: a wrong `ChannelConnection` column guess (`channel` → real `channelType`/`name`) and wrong portal-table field guesses (corrected to `title`/`assetUrl`/`assetName`/`filename`/`sizeBytes`/`maturity` from the schema). Zero failures were observed in the migrations themselves, the ledger flow, idempotence, the e2e, or the restore. The complete sequence was re-run from the restored baseline with the final committed driver, green end to end.

## 11. What this mission did NOT do

No connection to production Turso (not even read-only); no production migration, resolve, deploy, seed, backfill, repair or ledger write; no D2 drops; no D5 tightenings; no D3 repairs; no InboxTodo/legacy cleanup; no edit to any historical migration (history byte-identical; `db:verify-history` green); no merge to master; no PR.

## 12. Production readiness

**READY FOR OWNER REVIEW — production migration NOT authorized by this record.** The future production window (separate mission, owner-authorized) needs, at minimum: the §8-equivalent Turso snapshot + verified restore path; the CORE-03C-M2 §8 gates re-run in-window (`db:audit-m1` + supplementary counts); the adoption mechanism decision of §4; an explicitly authorized production-target variant of the applier with its own guard; and the InboxTodo create-path smoke test immediately after adoption.
