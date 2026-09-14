# 7F — NEON-04 — Neon staging, Vercel Preview and ETL rehearsal

Status: **BLOCKED on infrastructure access**, tooling and rehearsals
**delivered**. Everything that can be proven without a Neon project or a
Vercel Preview was executed against a local disposable PostgreSQL 16 acting as
an explicit stand-in for Neon staging, with the real production Turso database
as a read-only source. Nothing here changes production: `master` stays at
`4f00cd2`, Turso was only read, no Vercel variable was touched.

Branch: `claude/neon-04-staging-preview-etl`, created from
`61d9fdb` (NEON-03-R1). Baseline `prisma/migrations-postgres/0_init` sha256
`679d9d18e72a3fa101bd96f6c39b2194ba38ae86de35359a3e46be8d662af30e`, unchanged.

## 1. Exact blockers (what the owner must unblock)

| # | Blocker | Evidence | Unblocks |
|---|---|---|---|
| B1 | **Neon API/console unreachable from the agent environment** | the egress proxy answers `403` to `CONNECT console.neon.tech:443` and `CONNECT api.neon.tech:443`; the environment README instructs not to route around it | §3 real staging project (`7f-staging`), pooled/direct URLs, rehearsal on Neon, pooler/transaction checks |
| B2 | **No Neon credentials** | no `NEON_*` / `DATABASE_URL` for a Neon host in the environment; no `neonctl` | same as B1 |
| B3 | **Vercel API unreachable** | `403` to `CONNECT api.vercel.com:443` and `vercel.com:443`; no `vercel` CLI, no `VERCEL_TOKEN` | §9 Preview env audit, Preview-only variables, Preview deploy inspection, Preview smoke |
| B4 | **No production writer freeze mechanism exists** (code audit, §11) | zero env flags, zero gate in `middleware.ts`, `core/db.ts` or RBAC; public and cron write paths | **`NEON-05 BLOCKER: production writer freeze mechanism`** |

Resolution paths that need no code: grant the agent environment egress to
`api.neon.tech` / `console.neon.tech` / `api.vercel.com` and provide a Neon
API key scoped to a **staging** project plus a Vercel token scoped to Preview,
or have the owner run the exact commands in §3 and §9 by hand. B4 is design
work for NEON-05 (§11.4 lists the recommended shape; nothing partial was
shipped in NEON-04 on purpose).

## 2. Pre-flight anchors

| Anchor | Value |
|---|---|
| `origin/master` | `4f00cd2` (NEON-02-CLOSE) — unchanged by this mission |
| `origin/claude/neon-03-postgres-runtime` | `61d9fdb` — parent of this branch, not rebased |
| Prisma | `7.4.1` exact (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, `@prisma/adapter-libsql`) |
| `0_init` sha256 | `679d9d18…af30e` (pinned by `scripts/postgres-baseline.ts` and by the ETL) |
| Local stand-in | PostgreSQL 16.13, loopback `127.0.0.1:54329`, databases `neon04_rehearsal_1`, `neon04_rehearsal_2` (disposable) |
| Source | production Turso (`libsql://<db>.aws-eu-west-1.turso.io`), **read-only**, fingerprint `a97d5c1a11db` |

## 3. Neon staging — plan (blocked, B1/B2)

What NEON-04 was to do and what to run once access exists. None of it ran.
The order is the canonical lifecycle enforced by the tooling (NEON-04-R2): the
staging identity is stamped **only** on a database that already carries the
canonical history and holds no rows.

1. **Create / audit Neon staging.** `GET /api/v2/projects`. Reuse a project
   only if it is dedicated to staging (name contains `staging` **and** it is
   not the project whose branch backs Production). Otherwise create
   `7f-staging` (region `aws-eu-west-1`, same as Turso, PostgreSQL 16).
   Record the non-secret Neon resource id the API returns (project id, or
   branch/endpoint id if the database is one branch of a shared staging
   project): that id becomes `--expect-staging-id`. It is not fixed yet;
   `sevenf-neon04-staging` in older notes was only a placeholder.
2. **Obtain both endpoints.** Pooled (`-pooler` host) → `DATABASE_URL`;
   direct → `DIRECT_URL`; both with the explicit `sslmode=verify-full`
   (NEON-05: `require` is a deprecated alias in `pg`). The runtime uses the pooled
   URL through `pg` (`max` 5 by default, `DATABASE_POOL_MAX`); the Prisma CLI
   and the ETL use the direct URL.
3. **Prove the database is new and empty.** Before any DDL:

```
DIRECT_URL=<neon direct> DATABASE_URL=<neon pooled> npm run db:migrate:status   # 1 migration pending, ledger absent
psql "<neon direct>" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"   # 0
```

4. **Apply the canonical history.**

```
DIRECT_URL=<neon direct> DATABASE_URL=<neon pooled> npm run db:migrate:deploy   # applies 0_init only
```

5. **Verify ledger and schema.** `migrate status` → up to date; ledger has
   one completed `0_init` row with checksum `679d9d18…af30e`; 50 tables, no
   sequences. (`db:postgres:verify` is loopback-only by design; on Neon the
   ETL's own guard repeats these checks on every command.)
6. **Stamp the staging identity.** The command re-proves steps 3–5 on the
   live connection (identity, no different marker, completed `0_init` with
   the pinned checksum, all 50 tables, no foreign table, no sequences,
   **every application table empty**) and only then writes the database
   comment. There is no flag to skip the emptiness check: a populated
   database can never be turned into staging by this command.

```
ETL_TARGET_URL=<neon direct> npm run db:etl:stamp-staging -- --target-role staging \
  --expect-target-host <neon direct host> --expect-target-database <db> \
  --expect-staging-id <neon staging resource id> --confirm-stamp <db>
```

7. **Verify the marker.**

```
psql "<neon direct>" -Atc "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = current_database()"
# sevenf:environment=staging;sevenf:migration=neon-04;sevenf:target=<neon staging resource id>
```

8. **ETL.** Exactly as in §7 with `--target-role staging --expect-target-host
   <neon direct host> --expect-target-database <db> --expect-staging-id <neon
   staging resource id>`. Role `staging` still refuses any host/database
   containing `prod`, still requires the live `current_database()` to match,
   and requires the stamped identity.
9. **Parity** L1–L3 with `--live-source` (§6).
10. Neon-specific checks that only a real endpoint can answer (all pending):
   pooled connection through `core/db.ts` (Prisma 7 + `pg` pool, `max` 5),
   `$transaction` through the pooler (PgBouncer transaction mode: no session
   state, no `SET` outside a transaction, no named prepared statements reused
   across pooled connections — to be confirmed on the real pooler, not
   assumed), `prisma migrate diff --from-config-datasource
   --to-schema prisma/schema.prisma --exit-code` → `No difference detected`,
   `_prisma_migrations` ledger equals the local one (one row, pinned checksum).

## 4. Source audit — Turso production, read-only

Measured twice in this mission (inventory probe at `23:23Z`, ETL snapshots
at `23:39Z`/`23:39Z`/`23:41Z`); identical row counts every time, so the source
did not move during the rehearsals. Only `SELECT`/`PRAGMA` statements were
sent; no `_prisma_migrations` table exists on Turso (its history was applied
by the legacy scripts), which is why the ETL never consults a source ledger.

| Fact | Value |
|---|---|
| Tables | 49 (the PostgreSQL baseline has 50: `WorkspaceEntitlement` exists only in the target) |
| Rows | 480 across 33 non-empty tables; 16 tables empty |
| Columns | 676; every column's storage class is the canonical one for its declared type (no `TEXT` column holding numbers, no `BLOB`) |
| `DATETIME` values | 991 non-null: 990 in the libSQL adapter shape `YYYY-MM-DDTHH:MM:SS.mmm+00:00`, **1** in the SQLite `CURRENT_TIMESTAMP` shape `YYYY-MM-DD HH:MM:SS` (`AllowedEmail.createdAt`, one legacy row); 0 epochs, 0 date-only |
| `BOOLEAN` values | 159 non-null, all stored as integers 0/1 |
| JSON-in-TEXT columns | 22 columns, 0 invalid documents |
| Ciphertext | `ChannelConnection.credentials` (2 rows) — carried verbatim, compared by digest only, never printed |
| Missing in source | `Workspace.entitlementRevision` (column), `WorkspaceEntitlement` (table) — new in the PostgreSQL schema |

Largest tables: `Activity` 79, `Message` 74, `Evento` 30, `ConversationAction`
28, `Cliente` 27, `Contact` 21. The full per-table inventory (row counts,
storage classes, date shapes, JSON validity) is reproducible with
`scripts/db/etl-turso-to-postgres.ts plan` plus the ETL manifest.

## 5. ETL tooling — `scripts/db/etl-core.ts` + `scripts/db/etl-turso-to-postgres.ts`

Versioned (`MANIFEST_VERSION = 1`), reproducible, fail-closed. npm entry
points: `db:etl:plan`, `db:etl:run`, `db:etl:parity`. Inputs are environment
variables only (`ETL_SOURCE_URL`, `ETL_SOURCE_AUTH_TOKEN`, `ETL_TARGET_URL`);
they are never echoed — logs and manifests carry a 12-hex sha256 fingerprint of
the host instead.

### 5.1 Guards (all before any write)

| Guard | Rule |
|---|---|
| source scheme | `libsql:`, `https:`, `http:`, `ws:`, `wss:`, `file:` only — a PostgreSQL source is refused |
| target scheme | `postgresql:` / `postgres:` only — Turso/SQLite can never be a target |
| target role | `staging` or `local` — **there is no production mode**; any other value throws |
| staging identity (NEON-04-R1) | role `staging` requires `--expect-staging-id <id>` **and** the live database must carry the marker `sevenf:environment=staging;sevenf:migration=neon-04;sevenf:target=<id>` as its PostgreSQL database comment (`pg_shdescription`, outside the application schema and the ledger). Absent, malformed, different environment/migration/target → FAIL before any source read and before any write, `--reset-target` included. Operator-supplied role/host/database are never enough on their own. The id is non-secret (the Neon staging resource id, `[a-z0-9-]`, 3–64 chars) and may never contain `prod` |
| staging stamp (NEON-04-R2) | `stamp-staging` writes that marker only after proving, on the live connection: `current_database()` matches, no different marker, completed `0_init` with the pinned checksum, all 50 canonical tables, no foreign base table, no sequences, and **0 rows in every application table**. Any non-empty table → FAIL (table names and counts in the error, never secrets); no flag skips it; a populated database is never relabelled. An identical marker is idempotent (schema re-verified, nothing written) |
| foreign schema | `assertTargetSchema` (shared by run, parity and stamp) also refuses any base table in `public` outside the 50 canonical tables plus `_prisma_migrations` |
| explicit identity | `--expect-target-host` and `--expect-target-database` are mandatory and must equal the URL's host and database (a keyword in the hostname is never enough) |
| loopback | role `local` requires a loopback host in the URL **and** `inet_server_addr()` loopback (or a Unix socket) on the live connection; with `--forwarded-loopback` a **private** server address is accepted for a container-published port (GitHub Actions service, `docker run -p`), a public one never |
| production lookalike | host or database matching `/prod/i` is refused unconditionally |
| live identity | `current_database()` on the open connection must equal the expectation |
| schema | `_prisma_migrations` must hold a completed `0_init` whose checksum equals the pinned baseline sha256; all 50 tables present; zero sequences (the schema has none, so "sequence sync" is a check, not an action) |
| emptiness | every table must be empty, unless `--reset-target --confirm-reset <exact database name>` is given; the reset is a `TRUNCATE … RESTART IDENTITY CASCADE` **inside** the load transaction |

### 5.2 Extraction — one consistent snapshot

All 49 `SELECT * FROM "<table>"` statements go to Turso in a single
`client.batch(…, "read")`, which libSQL executes inside one read transaction:
the snapshot is consistent across tables without freezing writers. The
limitation is explicit: production keeps writing after the snapshot; the
parity verifier reports live drift separately (§6, level 3) and the writer
freeze belongs to NEON-05 (§11).

### 5.3 Transformation — driven by the target schema, not by guesses

The target schema is parsed from the pinned `0_init/migration.sql` (50
tables, 87 foreign keys, 5 column types: `TEXT`, `TIMESTAMP(3)`, `BOOLEAN`,
`INTEGER`, `DOUBLE PRECISION`; anything else fails closed).

| Target type | Source storage accepted | Result |
|---|---|---|
| `TEXT` | string only | verbatim (ciphertext, JSON text, Message-IDs untouched); JSON-looking text that does not parse is a **warning** in the manifest |
| `TIMESTAMP(3)` | adapter shape with offset, SQLite `CURRENT_TIMESTAMP` (UTC), epoch ms/s | normalised to UTC, written with `$n::timestamp(3)` under `SET LOCAL TIME ZONE 'UTC'` |
| `BOOLEAN` | integer 0/1 only | `false`/`true` (`INTEGER` columns keep their integers: type-driven, never value-driven) |
| `INTEGER` / `DOUBLE PRECISION` | number / bigint / numeric string | number; non-integer in `INTEGER` fails |
| absent in source | — | `NULL` (`Workspace.entitlementRevision`); NOT NULL without default fails closed |

IDs are preserved verbatim. Tables load in a deterministic topological order
(Kahn over the 87 FKs, `AllowedEmail > … > WorkspaceTask`); rows of
self-referencing tables (`Message.replyToId`-style, `PresenceMedia.sourceMediaId`)
are ordered parents-first. Foreign keys are **never** disabled or deferred.

### 5.4 Load

One transaction on the direct connection; chunks of 100 rows per multi-row
`INSERT`; commit only after every table loaded; on any error the transaction
rolls back and the target is left exactly as found. The manifest records
`snapshotAt`, source/target fingerprints, insert order, per-table
`sourceRows`/`loadedRows`/table digest/per-row digests/warnings, totals and
timings.

## 6. Parity verifier — levels 1–3

`db:etl:parity --manifest <file> [--live-source]`, read-only on both sides.

| Level | Check | Mismatch output |
|---|---|---|
| 1 | row count per table: snapshot = target (= live source with `--live-source`) | table, counts |
| 2 | table digest = sha256 over sorted per-row digests of the canonical row representation, computed from the target through `::text` casts and from the snapshot through the same canonical mapping; duplicate PKs; FK orphan scan on all 87 FKs; timestamp domain (pre-2000 / future) warnings | table, digests |
| 3 | field-by-field comparison against the **live** source, row by row | table, primary key, column and both values — values of `ChannelConnection.credentials` and `ClientAuth.passwordHash` are replaced by `<redacted sha256:…>`; other values are truncated |

Live drift since the snapshot (rows that changed in production after
extraction) is reported as its own section, never as an ETL bug.

## 7. Rehearsal evidence (local stand-in, real Turso source)

Commands (identical for a Neon target except `--target-role staging` and the
expected host/database):

```
DIRECT_URL=… DATABASE_URL=… npm run db:migrate:deploy
ETL_SOURCE_URL=$TURSO_DATABASE_URL ETL_SOURCE_AUTH_TOKEN=$TURSO_AUTH_TOKEN \
ETL_TARGET_URL=postgresql://postgres@127.0.0.1:54329/neon04_rehearsal_1 \
  npm run db:etl:run -- --target-role local --expect-target-host 127.0.0.1 \
  --expect-target-database neon04_rehearsal_1 --manifest rehearsal-1.manifest.json
… npm run db:etl:parity -- <same flags> --manifest rehearsal-1.manifest.json --live-source
```

| Rehearsal | Target state before | migrate deploy | schema check | extract | transform | load | ETL total | parity (L1–L3 + live) | Result |
|---|---|---|---|---|---|---|---|---|---|
| #1 | empty DB → `0_init` | 1.7 s | 38 ms | 1041 ms | 16 ms | 62 ms | 1156 ms | 1286 ms | 480/480 rows, 50/50 tables OK, 0 orphans, 0 duplicate PKs, 0 live drift |
| #2 (fresh DB) | empty DB → `0_init` | 1.7 s | 41 ms | 728 ms | 16 ms | 67 ms | 852 ms | 874 ms | identical per-table digests, per-row digests, totals and insert order to #1 |
| #3 (reset path) | #1 data present | — | 37 ms | 1277 ms | 16 ms | 184 ms | 1514 ms | 768 ms | refused first without `--confirm-reset`; with it: digests identical to #1 |
| #4 (role `staging`, R1/R2) | empty canonical database, then stamped | 1.7 s | see §7.1 | | | | | | refused while unstamped and refused to stamp while populated (no TRUNCATE reached); after `stamp-staging` on the empty database, load + parity OK, digests identical to #1 |

### 7.1 Rehearsal #4 — staging role against the stamped local stand-in (NEON-04-R1)

Evidence recorded in the session report: with the database unstamped, `run
--target-role staging … --reset-target --confirm-reset <db>` failed on the
identity check with every row still in place; `stamp-staging` on a populated
database failed on the emptiness check with the comment still NULL;
`stamp-staging` on the empty canonical database wrote the marker; the ETL then
loaded 480/480 rows and `parity --live-source` reported OK. The integration
test `scripts/db/etl.postgres.integration.test.ts` repeats this sequence
(unmarked, wrong marker, malformed marker, populated database cannot be
stamped, ledger/schema negatives, stamp on the empty database, idempotence,
staging run/parity, local unaffected) in CI.

Warnings: exactly one, `Message.content: JSON-looking text is not valid JSON`
— one human message whose text starts with `{` or `[`; `content` is not a JSON
column, the value is carried verbatim, and the warning is the intended
visibility, not a defect.

Wall-clock budget for the production-sized dataset: **under 5 seconds**
end-to-end (deploy + ETL + parity) on loopback; against Neon the extract
(Turso, `eu-west-1`) and load (Neon, same region) legs are network-bound and
should be re-measured in staging before the NEON-05 window is set.

Additional proofs on the loaded data:

- **Runtime read smoke** with the application's own client (`core/db.ts`,
  `PrismaPg`) against `neon04_rehearsal_2`: `workspace.count()` = 12,
  `DateTime` fields decode as `Date` with the original millisecond UTC
  instants, `Boolean` fields as booleans, `Int`/`Float` as numbers, JSON text
  fields as objects, relations (`Conversation → Message`, `Contact`,
  `WorkspaceMember → User`) resolve, and `contains` + `mode: "insensitive"`
  search works. No writes.
- **Schema drift**: `prisma migrate diff --from-config-datasource
  --to-schema prisma/schema.prisma --exit-code` on the loaded rehearsal DB →
  `No difference detected` (exit 0). `_prisma_migrations` holds one row,
  checksum `679d9d18…`; 50 tables, 87 FK constraints, 75 unique indexes, 0
  sequences.
- **Domain spot checks**: `Message.createdAt` spans `2026-04-10 … 2026-07-22`
  UTC, 0 rows before 2000 or in the future; 58/58 `Message.metadata` and
  5/5 `Workspace.config` parse as JSON; all 12 `Workspace.entitlementRevision`
  are `NULL` as designed.

Automated regression: `scripts/db/etl-core.test.ts` (14 unit tests) and
`scripts/db/etl.postgres.integration.test.ts` (12 tests: production-shaped
SQLite source built from the legacy history minus migration 6, guards,
rehearsal #1, semantic assertions, parity with live source, non-empty
refusal, rehearsal #2 reproducibility, tamper detection with redaction,
staging identity negatives, populated-database stamp refusal, ledger/schema
guards and the stamp flow) run in `npm test` and in CI against the CI
PostgreSQL service.

## 8. Seeds

Staging needs no seed scripts: the ETL loads a faithful copy of production.
The legacy libSQL seeds listed in `7F-DATABASE.md §6` stay frozen and are not
part of this mission.

## 9. Vercel Preview — plan (blocked, B3)

Nothing was inspected or changed on Vercel. When access exists:

1. `GET /v9/projects/<7fnew>/env` — list every variable with its targets.
   Confirm Production carries `TURSO_*` (legacy, ignored by NEON-03 code) and
   no `DATABASE_URL`/`DIRECT_URL` yet, or, if present, that they are **not**
   modified by this mission.
2. Create **Preview-only** variables, scoped to the git branch
   `claude/neon-04-staging-preview-etl`: `DATABASE_URL` (Neon pooled, staging),
   `DIRECT_URL` (Neon direct, staging). Never add a Production target.
3. Providers stay fail-closed in Preview: do not add `OPENAI_API_KEY`,
   `DEEPSEEK_API_KEY`, `RESEND_API_KEY`, IMAP credentials or `CRON_SECRET` to
   Preview unless the owner explicitly wants staging to talk to real providers.
   With the keys absent, intelligence rejects with `provider_unavailable`
   (contract proven in `test/support/postgres.ts`) and outbound e-mail is not
   sent; nothing fakes success. `AUTH_SECRET` and Google OAuth remain whatever
   Preview already has — **no auth bypass** is added.
4. The push of this branch already creates the Preview deployment once the
   Vercel Git integration sees it. Inspect the build (`prisma generate` +
   `next build`) and the runtime logs: `core/db.ts` must report a
   `postgresql://` URL; any `TURSO_*` value is ignored by design.
5. Smoke — manual checklist, honest about coverage (no claim beyond it):
   login (Google OAuth or dev-login), workspace switch, inbox list + open a
   conversation + send an internal note, create/edit a task, CRM client list,
   calendar list, `/system` platform admin read pages, public widget
   `POST /api/inbox/public/send` into a staging workspace, tracking pixel GET.
   Not covered by the smoke: real provider calls, IMAP sync against a real
   mailbox, cron (Vercel does not run crons on Preview).

## 10. Neon pooling / transactions / drift (blocked, B1)

Pending items, each with the exact check to run in staging:

| Item | Check | Expected |
|---|---|---|
| pooled runtime | `DATABASE_URL` pooled + `npm run build && next start`, hit `/api/overview` | 200, `pg` pool ≤ 5 connections in `pg_stat_activity` for the app role |
| interactive transactions through PgBouncer | `POST /api/workspaces/create` (`$transaction` workspace+member) | both rows or neither (NEON-03 C3 semantics hold) |
| IMAP optimistic cursor | `POST /api/workspaces/[id]/connections/[connId]/sync` twice concurrently against a staging connection with no credentials | second call loses the cursor race cleanly, no duplicate ingestion |
| drift | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` with `DIRECT_URL` = Neon direct | exit 0 |
| ledger | `SELECT migration_name, checksum FROM _prisma_migrations` | one row, `0_init`, `679d9d18…` |

## 11. Writer / freeze audit (code, complete)

Runtime scope audited: `app/`, `core/`, `modules/`, `engines/`, `agents/`,
`lib/`, `components/`, `middleware.ts`. 131 runtime files import the single
Prisma client (`core/db.ts`, re-exported by `lib/db.ts`); there is no second
client, no raw `pg`/libSQL usage, zero raw SQL writes.

### 11.1 Existing freeze mechanism: **none**

- No `MAINTENANCE_MODE` / `READ_ONLY` / `WRITE_FREEZE` / kill-switch variable
  in runtime code or `.env.example`.
- `middleware.ts` only fails closed when `AUTH_SECRET` is missing, and exempts
  `PUBLIC_PATHS` (`/api/inbox/public`, `/api/inbox/email/inbound`,
  `/api/inbox/webhooks`, `/api/sites`, `/api/auth`, …), several of which write.
- `core/db.ts` forwards every property; its only refusal is the
  non-`postgresql://` guard, which blocks reads and writes alike.
- `Workspace.status` (`suspended`/`archived`) is documented as observational
  only (`core/system/workspace-status.ts`); nothing reads it to block a write.
- `WorkspaceEntitlement` and `PresenceSubscription` have zero runtime writes.

### 11.2 Write paths that a freeze must cover

| Class | Paths |
|---|---|
| Public, unauthenticated writes | `POST /api/inbox/public/send` (web-chat widget: contact, conversation, message, identity, notifications, intelligence), `POST /api/inbox/email/inbound` (Resend webhook, secret-gated: full ingestion), `POST /api/sites/[slug]/reception` (contact, conversation, `WorkspaceTask`) |
| GET requests that write | `/api/inbox/track/open/[token]`, `/api/inbox/track/confirm/[token]` (`message.update`), `/api/auth/callback/google` (`user.create/update`, default workspace), `/api/cron/imap-sync` |
| Cron | `vercel.json`: `*/5 * * * *` → `/api/cron/imap-sync` (`CRON_SECRET` bearer, fails closed in production) → IMAP sync writes (`channelConnection` cursor + ingestion) |
| RSC render that writes | `app/forte/improvements/page.tsx` → `loadForteImprovements` → un-awaited `forteSnapshot.upsert` |
| Fire-and-forget writes | ~20 sites (`logActivity`, `notify*`, `sendOutboundAsync`, attachment scan, short-intent, intelligence, `forteSnapshot`); only 3 are registered in `core/background-tasks.ts` (`ingest:notify`, `ingest:intelligence`, `message:short-intent`) |
| Authenticated API writes | ~60 route files via module services and `$transaction` (inventory kept in the NEON-04 session report; every one goes through `db` from `core/db.ts`) |
| Platform admin | `/api/system/**` (allowed emails, users, workspace plan/status/vertical + `platformAuditLog`) |
| Dormant | 8 presence repository writers exported but with no caller; `getOrCreateDefaultWorkspace` with no runtime caller |

### 11.3 Choke points

| Layer | Covers | Verdict |
|---|---|---|
| `core/db.ts` proxy `get` trap | 100 % of DB traffic incl. cron, RSC, background tasks, public webhooks | the only complete gate; not implemented |
| `middleware.ts` | HTTP only, Edge, cannot see Prisma; misses public prefixes and GET-that-writes | defence in depth at most |
| `requireWriteAccess` / `requireWorkspaceRole` | most authenticated API writes | misses public, cron, tracking, RSC |

### 11.4 Decision for NEON-04 — nothing partial shipped

A middleware-only or RBAC-only freeze would leave the public widget, the
Resend webhook, the tracking pixels, the cron and the Forte page writing
during the cutover window, so no partial mechanism was added. Recorded as
**`NEON-05 BLOCKER: production writer freeze mechanism`**. Recommended shape
(for NEON-05 design, not implemented here): an explicit
`DATABASE_WRITE_FREEZE=1` read once in `core/db.ts`, enforced in the proxy
`get` trap by returning a stub that throws a typed `WriteFrozenError` for
write method names (`create*`, `update*`, `upsert`, `delete*`,
`$executeRaw*`, `$transaction`, `$queryRawUnsafe`), mapped by `core/api.ts`
to `503` + `Retry-After`, with the public routes and cron answering `503`
early, plus a test that enumerates the write method surface of the generated
client so a new method cannot slip past the list.

## 12. Cutover runbook (NEON-05 draft — measured where possible)

| Step | Action | Measured / expected | Verify |
|---|---|---|---|
| 0 | Prerequisites: staging rehearsal green on Neon (§3 lifecycle: empty → `0_init` → verify → stamp → ETL → parity, §7 timings re-measured), freeze mechanism shipped (§11.4), Production Neon project created and **empty** | — | `migrate status`: 1 pending |
| 1 | Freeze writers (`DATABASE_WRITE_FREEZE=1` on Production, redeploy or env reload) | ≤ 2 min (Vercel redeploy) | widget `POST` → 503; cron returns 503; `pg_stat_activity` on Turso side not observable — use app logs |
| 2 | Apply `0_init` to Production Neon with `DIRECT_URL` | 1.7 s local | ledger row, checksum `679d9d18…` |
| 3 | ETL `--target-role staging` is refused for production by design: NEON-05 must add a `production` role behind an explicit, separately authorised confirmation (`--confirm-production <db>`), never a default | ~1.2 s local for 480 rows; expect low seconds on Neon | manifest totals `sourceRows = loadedRows` |
| 4 | Parity L1–L3 with `--live-source` | ~1.3 s local | `[parity] OK`, live drift 0 (writers frozen) |
| 5 | Switch Production `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) to Neon production; redeploy | ≤ 2 min | `core/db.ts` accepts `postgresql://`; `/api/overview` 200 |
| 6 | Smoke (§9.5 checklist on Production, read-mostly) | ~10 min manual | — |
| 7 | Unfreeze (`DATABASE_WRITE_FREEZE` removed) | ≤ 2 min | widget `POST` → 200 |
| 8 | Keep Turso untouched and reachable for the rollback window (no decommission before NEON-06) | — | — |

Total planned write-unavailability window: steps 1–7, dominated by two
Vercel redeploys plus the manual smoke; the data movement itself is seconds
at today's volume.

## 13. Rollback design

- **Before step 5** (nothing switched): stop; Turso still serves; Neon
  production database is discarded or re-truncated. No data written to Turso
  during the freeze, so nothing to reconcile.
- **After step 5, before unfreeze**: revert `DATABASE_URL`/`DIRECT_URL` to
  the previous values and redeploy. Because writers were frozen, Turso and
  Neon hold the same data; nothing to reverse-ETL.
- **After unfreeze**: rows written to Neon since step 7 exist only on Neon. A
  reverse ETL is **not** provided by NEON-04 (the tooling refuses a
  PostgreSQL source and a Turso target on purpose). Rollback then means
  restoring service on Turso with data loss bounded by the time since
  unfreeze, and the decision is the owner's; the manifest of step 3 gives the
  exact set of rows that existed at cutover. Keep the window between step 7
  and the "go/no-go" decision short and observed (§14).
- Turso credentials are not rotated and Turso is not deleted in NEON-05;
  that is NEON-06 after the rollback window closes.

## 14. Observability during and after cutover

- ETL/parity logs: table-level lines with counts and digests, no values, no
  URLs (fingerprints only); the manifest file is the audit record (keep it
  outside the repository: it contains production primary keys).
- Runtime: `core/db.ts` fails closed with an explicit message on a wrong URL
  scheme; `pg` pool errors surface as Prisma errors through `core/api.ts`.
  On Neon, watch `pg_stat_activity` (connections ≤ pool `max` per instance),
  Neon's connection/CPU graphs, and Vercel function error rate on
  `/api/inbox/**` and `/api/cron/imap-sync`.
- Freeze signals (once NEON-05 ships it): count of `WriteFrozenError` 503s
  by route; zero after unfreeze.

## 15. Gates run on the final state (this branch)

`npx prisma generate`, `npm run typecheck`, `npm run lint`, `npm test`
(full suite incl. the two new ETL files), `npm run db:postgres:init`
(`unchanged`), `POSTGRES_VERIFY_URL=… npm run db:postgres:verify`,
`npm run db:verify-history`, `npm run build`. Results are in the session
report; CI runs the same set on the pushed branch.

## 16. Out of scope, deliberately

No merge to `master`, no production change, no Turso write, no Turso
schema change or decommission, no dual-write, no credential rotation, no
Finesse/Admin/Forte work, no partial freeze middleware, no legacy cleanup
(NEON-06).
