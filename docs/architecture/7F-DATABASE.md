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
  **pooled** endpoint.
- **Prisma CLI** — `prisma.config.ts` reads `DIRECT_URL` (the Neon **direct**
  endpoint) for `migrate deploy`, `migrate status`, `migrate diff` and
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
(`WITH (FORCE)`) in `after`. A missing or non-loopback `TEST_DATABASE_URL`
FAILS the file — nothing is skipped and there is no SQLite fallback.

Local run:

```
docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16   # or a local cluster
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm test
```

Real-PostgreSQL coverage added or ported in NEON-03: `core/db.test.ts`,
`core/db-search.postgres.integration.test.ts`,
`core/workspace.postgres.integration.test.ts`, usuarios scope isolation,
presence repository / public-site / reception-service, inbox ingestion
pipeline, outbound service, raw queries, Message-ID semantics, IMAP cursor,
ai-security, qr-security, workspaces/create, portal-tables, and the smoke
`test/postgres-runtime.smoke.test.ts` (user → workspace → membership →
capabilities → cliente → inbox → task → presence → AI snapshot, with
multi-tenant isolation). The `node:sqlite` gates
(`raw-queries.sqlite-equivalence`, `email-message-id-casing`) and
`scripts/build-db-from-history.ts` stay as **legacy safety** until the cutover.

## 5. Tooling

```
npm run db:postgres:init       # regenerates 0_init from the canonical schema; must report "unchanged"
POSTGRES_VERIFY_URL=… npm run db:postgres:verify   # EMPTY loopback DB → history applied now → ledger → diff empty → redeploy no-op
npm run db:verify-history      # legacy SQLite gate (derived sqlite-provider variant), 50 tables / 94 indexes / drift 51
DIRECT_URL=… npm run db:migrate:deploy / db:migrate:status   # NEON-04/05 only, against a Neon endpoint
```

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
