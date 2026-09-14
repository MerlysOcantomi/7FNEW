# 7F — Database: current production vs verified target (NEON-03)

Status: **CODE READY on branch `claude/neon-03-postgres-runtime`, NOT cut
over.** This document separates what production runs TODAY from what the
code on this branch is verified against, so nobody mistakes one for the
other. Nothing here changes production; the cutover is NEON-05.

## 1. Two states, kept apart

| | CURRENT PRODUCTION (`master`, Vercel) | TARGET / VERIFIED (this branch) |
|---|---|---|
| Engine | Turso (libSQL / SQLite) | PostgreSQL 16 (Neon is the intended host) |
| Runtime driver | `@prisma/adapter-libsql` | `@prisma/adapter-pg` over a `pg` pool (`core/db.ts`) |
| Canonical schema provider | `sqlite` | `postgresql` (`prisma/schema.prisma`) |
| Migration history in use | `prisma/migrations` (SQLite `0_baseline…6_found04a_workspace_entitlements`) | `prisma/migrations-postgres` (`0_init`, immutable, sha256 `679d9d18…`) |
| Connection variables | `DATABASE_URL`/`TURSO_DATABASE_URL` + auth token | `DATABASE_URL` (pooled) for the runtime, `DIRECT_URL` (direct) for the Prisma CLI only |
| Data | 476 rows (12 workspaces, 14 users) as of the FOUND-04A audit | none — no data has been migrated; every database the branch touches is disposable |
| Verified by | CI on `master` (SQLite history gate) | CI on the branch: full suite on an ephemeral PostgreSQL 16 + baseline verify + legacy SQLite gate |

The branch is **never merged to `master` by itself**: `master` auto-deploys
production, and a deploy of this code against the Turso variables would fail
closed on the first query (`DATABASE_URL` must be `postgresql://`). The
sequence is NEON-04 (Neon staging + Vercel Preview + ETL rehearsal), NEON-05
(freeze, single ETL, cutover), NEON-06 (Turso decommission).

## 2. Connection contract (Prisma 7.4.x)

Prisma 7 reads NO url from the schema: the `datasource` block only names the
provider. Connections come from two places, deliberately different:

- **Runtime** — `core/db.ts` reads `DATABASE_URL` and builds
  `new PrismaPg({ connectionString, max, connectionTimeoutMillis })`. The
  URL must have the `postgresql:`/`postgres:` scheme; `file:`, `libsql://`
  and anything else are refused on first use, with only the scheme in the
  error. `TURSO_DATABASE_URL`, `DATABASE_AUTH_TOKEN` and `TURSO_AUTH_TOKEN`
  are never consulted (they may remain in Vercel until NEON-06; they select
  nothing). `DATABASE_POOL_MAX` (default 5 per process) is the only tuning
  knob; an invalid value throws. In production `DATABASE_URL` is the Neon
  **pooled** endpoint, with the explicit `sslmode=verify-full` (NEON-05):
  `pg` treats `require`/`prefer`/`verify-ca` as deprecated aliases of
  `verify-full` and warns about them, and `core/db.ts` logs a warning for
  any non-loopback URL that is not `verify-full` (never refuses, so a
  configuration slip cannot take production down). The client is built with
  the `database.write` guard extension (`core/db-write-guard.ts`): while
  `SEVENF_OPERATION_MODE=freeze-writes` every write-class operation is
  refused with HTTP 503 `OPERATION_FROZEN`; reads keep working. See
  `SEVENF-NEON-05-PRODUCTION-CUTOVER.md`.
- **Prisma CLI** — `prisma.config.ts` reads `DIRECT_URL` (the Neon **direct**
  endpoint, also `sslmode=verify-full`) for `migrate deploy`, `migrate status`, `migrate diff` and
  `db execute`. When unset the datasource is omitted: `prisma generate` still
  works (CI, Vercel build) and every command that needs a connection fails
  with Prisma's own "datasource.url property is required". No fallback URL.

Client construction happens in exactly one runtime module (`core/db.ts`);
`lib/db.ts` re-exports it. HTTP handlers may not import `pg`,
`@prisma/adapter-pg` or `@libsql/client` (guarded by
`app/api/no-http-ddl.test.ts`).

## 3. Semantic parity decisions (PostgreSQL vs SQLite)

| Area | SQLite/Turso behaviour | PostgreSQL decision | Where |
|---|---|---|---|
| Free-text search (`searchContains`, `searchStartsWith`, ~116 sites) | case-insensitive by accident of `LIKE` | case-insensitive on purpose: `mode: "insensitive"` (ILIKE) | `core/db-search.ts` |
| Structured filter `Proyecto.customId` | case-insensitive | **identifier**: exact case | `modules/proyectos/service.ts` |
| Structured filters `Proyecto.assignedTo`, `Proyecto.tags`, `ContentPiece.responsable` | case-insensitive | **text** (display names, free-form tags): case-insensitive | `modules/proyectos/service.ts`, `modules/contenido/service.ts` |
| Inbox Message-ID lookups (In-Reply-To, References, duplicate) | matched only because `LIKE` ignored case | explicit `mode: "insensitive"`; the header is persisted as received, the needle is lower-cased | `modules/inbox/email-inbound.ts` |
| Historical `sourceId` fallback | verbatim | verbatim (exact) | `modules/inbox/email-inbound.ts` |
| `Notification.link` contains conversation id, `Cliente.customId` prefix scan | exact in practice | exact (ids and generated prefix) | `core/notifications/inbox.ts`, `modules/clientes/service.ts` |
| `Proyecto.allowedUsers` contains user id | case-insensitive (widening!) | exact — authorization never widens | `modules/proyectos/service.ts` |
| Raw SQL (attention-count, unanswered) | `?` placeholders, `0/1` booleans, ISO text timestamps | `$n`, `TRUE/FALSE`, `Date` parameters, `COUNT(*)` as bigint coerced by `countFromRows` | `core/db-dialect.ts`, `modules/inbox/attention-queries.ts`, `modules/inbox/unanswered.ts` |
| Transactions | interactive `$transaction` (9 sites) + array (2) | unchanged; Workspace+OWNER membership now atomic; IMAP cursor committed optimistically | `core/workspace.ts`, `app/api/workspaces/create`, `modules/inbox/imap-sync.ts` |

No model was merged, no JSON-as-string column became `JSONB`, no `Float`
became `NUMERIC`: the baseline is fidelity-first (`TEXT`, `TIMESTAMP(3)`,
`INTEGER`, `BOOLEAN`, `DOUBLE PRECISION` only). FOUND-04A's
`WorkspaceEntitlement` is in the schema and the baseline with no runtime
reader yet.

## 4. Test infrastructure

`test/support/postgres.ts` gives every database test file its own database:
`TEST_DATABASE_URL` (loopback only — `localhost`, `127.0.0.1`, `::1`; no
override) names a PostgreSQL server the suite may `CREATE DATABASE` on; the
helper creates `t7f_<label>_<pid>_<random>`, runs `prisma migrate deploy`
over `prisma/migrations-postgres` with a temporary dotenv-free config, sets
`DATABASE_URL` to it, removes every legacy connection variable, and drops it
in `after` once no session remains on it. A missing or non-loopback `TEST_DATABASE_URL`
FAILS the file — nothing is skipped and there is no SQLite fallback.

Local run:

```
docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16   # or a local cluster
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm test
```

`TEST_DATABASE_URL` is parsed ONCE into explicit parameters (host, port,
user, password, database) and never handed to `pg` or Prisma as a string:
the installed parser honours `?host=`, repeated or percent-encoded keys,
`?port=` and socket paths, so a query string, a fragment, a socket path or a
non-loopback host is rejected before any connection (`test/support/postgres.test.ts`
proves zero `connect` calls on rejection and redacted errors). Provisioning
also removes provider keys (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`,
`RESEND_API_KEY`), blocks outbound HTTP to non-loopback hosts, and records
fire-and-forget runtime work through `core/background-tasks.ts` (pending →
settled-unreviewed → consumed; a settled outcome nobody reviewed can never be
discarded). Tests call `settleBackgroundTasks()` before asserting on it and
before `dispose()`, which refuses to drop a database while tasks are pending,
while settled outcomes were never reviewed, or while any server session is
still open (bounded wait on `pg_stat_activity` for the pool's in-flight
`Terminate`s; a leaked client fails the file). The drop never uses
`WITH (FORCE)`, and the network guard is restored only after the drop. The
guard blocks non-loopback hosts, never follows redirects (a loopback answer
redirecting off loopback is refused), and the AI adapters resolve
`globalThis.fetch` at call time so import order cannot bypass it. Expected
failures are the exact contract, not a pattern: `ingest:intelligence` rejects
with `AIExecutionError` code `provider_unavailable` and the adapter's own
missing-key message (`isMissingProviderKeyError`); `message:short-intent`
fulfils with `{ status: "failed", stage: "execute", error }` carrying that
same error and persists nothing. Any other rejection or network attempt fails
the test.

What the PostgreSQL suite covers, precisely:

| Layer | Covered by | Notes |
|---|---|---|
| Service integration on PostgreSQL | `test/postgres-runtime.smoke.test.ts`, `core/workspace.postgres.integration.test.ts`, `core/db-search.postgres.integration.test.ts`, presence repository / public-site / reception-service, inbox pipeline / outbound / raw queries / Message-ID / IMAP cursor, usuarios scope | in-process service calls, one disposable DB per file |
| HTTP endpoints | `app/api/ai/ai-security.test.ts`, `app/api/qr/qr-security.test.ts`, `app/api/workspaces/workspaces-create.postgres.integration.test.ts`, `app/api/cliente/requests/portal-tables.integration.test.ts` | route handlers with a synthetic Next request scope; no server, no browser |
| Browser / OAuth | not covered | NEON-04 (Vercel Preview manual checklist) |
| Dated tasks | smoke step 5 (`WorkspaceTask` with `dueAt`) | NOT the calendar/appointments module |
| Calendar / appointments | not covered on PostgreSQL | NEON-04 |
| Capability snapshots | smoke steps 2 and 7, `core/workspace.postgres.integration.test.ts` | pure resolver over persisted sources; no AI call |
| Activity / intelligence persistence | pipeline + smoke background assertions | intelligence fails closed without keys; `AIClassification` stays empty; provider persistence with a real key is NOT exercised |
| AI provider calls | never — keys removed, outbound HTTP blocked; `ai-security` stubs `fetch` | real-provider behaviour is out of the suite by design |
| Neon pooler / Vercel Preview | not covered — blocked in NEON-04 (no Neon/Vercel access from the agent environment) | NEON-04 follow-up, see `7F-NEON-04-STAGING-ETL.md` §1 |
| ETL Turso → PostgreSQL | `scripts/db/etl-core.test.ts`, `scripts/db/etl.postgres.integration.test.ts` | production-shaped SQLite source, guards, two rehearsals, parity L1–L3, tamper detection |

The `node:sqlite` gates (`raw-queries.sqlite-equivalence`,
`email-message-id-casing`) and `scripts/build-db-from-history.ts` stay as
**legacy safety** until the cutover.

## 5. Tooling

```
npm run db:postgres:init       # regenerates 0_init from the canonical schema; must report "unchanged"
POSTGRES_VERIFY_URL=… npm run db:postgres:verify   # EMPTY loopback DB → history applied now → ledger → diff empty → redeploy no-op
npm run db:verify-history      # legacy SQLite gate (derived sqlite-provider variant), 50 tables / 94 indexes / drift 51
DIRECT_URL=… npm run db:migrate:deploy / db:migrate:status   # NEON-04/05 only, against a Neon endpoint
npm run db:etl:plan                                          # target schema, FK insert order (no connections)
ETL_TARGET_URL=… npm run db:etl:stamp-staging -- --target-role staging --expect-target-host … --expect-target-database … --expect-staging-id … --confirm-stamp …   # once, after 0_init, only on an EMPTY canonical database
ETL_TARGET_URL=… npm run db:etl:stamp-production -- --target-role production --expect-target-host … --expect-target-database … --expect-project … --expect-branch … --confirm-stamp …   # NEON-05, same invariants, production marker
ETL_SOURCE_URL=… ETL_TARGET_URL=… npm run db:etl:run -- --target-role staging|local|production --expect-target-host … --expect-target-database … [--expect-staging-id … | --expect-project … --expect-branch … --confirm-production …] --manifest …
ETL_SOURCE_URL=… ETL_TARGET_URL=… npm run db:etl:parity -- <same flags> --manifest … [--live-source]
```

The ETL (`scripts/db/etl-core.ts`, `scripts/db/etl-turso-to-postgres.ts`)
reads Turso in one consistent snapshot and loads PostgreSQL in one
transaction; it has no production mode and refuses any host or database that
looks like production. Role `staging` additionally requires the database to
carry the stamped NEON-04 staging identity marker (database comment), which
`stamp-staging` writes only on a database that already carries `0_init` and
holds no rows. Design, guards, parity levels and rehearsal evidence:
`docs/architecture/7F-NEON-04-STAGING-ETL.md`.

`0_init` is immutable: `generate-init` refuses to change an existing
baseline and `verify` pins its sha256. Schema changes after publication are
NEW directories under `prisma/migrations-postgres` (and an entry in
`EXPECTED_POSTGRES_MIGRATIONS`).

## 6. Legacy left in place on purpose (removed in NEON-06)

- `prisma/migrations` (SQLite history), `prisma/migrations/drift-manifest.json`
  and `scripts/build-db-from-history.ts` — production's history until the
  cutover; the verifier derives a sqlite-provider schema in memory.
- `@prisma/adapter-libsql` / `@libsql/client` dependencies and the scripts
  that construct their own libSQL client (`prisma/seed.ts`,
  `prisma/backfill-connections.ts`, `scripts/seed-*.ts`,
  `scripts/ensure-7f-business-workspace.ts`,
  `scripts/backfill-workspace-tasks.ts`, `scripts/verify-workspace-context.ts`,
  the CORE-03C appliers/rehearsals, `scripts/migrate-*.ts`,
  `scripts/checkTables.ts`, `scripts/inbox-data-migration.smoke.test.ts`).
  They still target Turso and are frozen: they are not part of the
  PostgreSQL runtime and must not be run against Neon. Seeds needed for
  NEON-04 staging are re-pointed at `@core/db` in that mission.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in Vercel Production — ignored
  by this code, retired in NEON-06.
