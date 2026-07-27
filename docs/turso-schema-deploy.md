# Turso schema — runbook

Two tools, one job each. Neither of them is a migration engine.

| Command | What it does | Writes? |
|---|---|---|
| `npm run turso:bootstrap` | Creates the whole schema on an **empty** database | Yes, once, all-or-nothing |
| `npm run turso:verify` | Compares a database against `schema.prisma` | **Never** |

Anything else — adding a column, completing a half-created database,
reconciling drift, deciding which changes are "safe" — is deliberately out of
scope. A database that has drifted needs a hand-written migration; these tools
tell you exactly what differs and refuse to guess.

> Coming later, out of scope here: `identity:bootstrap` (users, roles,
> workspaces) and `seed:finesse-demo` (optional fictional data).

## Source of truth

**`prisma/schema.prisma` is the single source of truth.** Nothing else defines
tables, columns or indexes, and there is no hand-maintained SQL list.

Prisma's migration engine cannot connect to a remote Turso database (the
datasource is `sqlite`, and the engine has no `libsql://` connector), so both
tools derive the canonical structure the same way:

1. `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
   renders the canonical DDL, using the **locally installed** Prisma CLI —
   resolved from the repository root, run through `process.execPath` with an
   explicit `cwd`, never via `npx` and never downloaded on demand.
2. Every statement is classified by a real SQL scanner; anything that is not a
   `CREATE TABLE` or `CREATE [UNIQUE] INDEX` is a hard error.
3. The DDL is applied to a **throwaway local SQLite file**, which is then
   introspected. That introspection — not a regex over SQL text — is the
   canonical structure.

| File | Role |
|---|---|
| `prisma/schema.prisma` | Source of truth |
| `prisma/turso-schema.ts` | Target resolution, guard, DDL generation, SQL scanner, introspection, read-only comparison |
| `prisma/bootstrap-turso.ts` | `npm run turso:bootstrap` |
| `prisma/verify-turso.ts` | `npm run turso:verify` |
| `scripts/turso-target-guard.test.ts` | Guard and URL-parsing tests |
| `scripts/turso-bootstrap.test.ts` | Empty-only, atomicity, concurrency tests |
| `scripts/turso-verify.test.ts` | Read-only comparison tests |

> Historical note: `push-turso.ts` used to carry hand-written `tables` /
> `uniqueIndexes` arrays that fell behind the schema (42 tables against 52
> models). It was then replaced by an additive reconciler that tried to repair
> existing databases. Both are gone: guessing which changes are safe to apply
> to a live database is not something this repository wants to own.

## `turso:bootstrap`

### Contract

Writes **only** to a database that is both:

- classified as non-production (see the guard below), and
- free of application tables.

It creates everything or nothing. The whole run happens inside a single
`BEGIN IMMEDIATE` transaction:

1. Resolve and validate the target; apply the guard.
2. Generate the canonical DDL and validate every statement.
3. `BEGIN IMMEDIATE` — take the write lock **before** reading, so two
   concurrent runs cannot both conclude the database is empty.
4. Read `sqlite_master`; refuse if any application table exists.
5. Apply the whole canonical DDL.
6. Introspect the result and require it to match the canonical structure
   exactly — tables, columns, foreign keys, indexes.
7. `PRAGMA foreign_key_check` (zero rows) and `PRAGMA integrity_check` (`ok`).
8. Commit only if every step passed. Otherwise roll back: no partial tables,
   no partial indexes, and a sanitized error.

```bash
export TURSO_DATABASE_URL="libsql://<database>-<org>.turso.io"
export TURSO_AUTH_TOKEN="<auth token>"

NODE_USE_ENV_PROXY=1 npm run turso:bootstrap
```

Exit codes: `0` created and verified · `2` refused (not empty, or the result
could not be verified) · `1` operational or configuration error.

### A non-empty database is refused

```text
Database is not empty.
Bootstrap refused.
Use turso:verify or create a fresh database.
```

The second run produces exactly this, without modifying anything. That is
deliberate: pretending creation is idempotent would hide the fact that the
database's contents were never actually checked against the schema. Use
`turso:verify` for that.

Tables owned by the engine or other tooling (`sqlite_*`, `libsql_*`,
`_litestream*`, `_prisma_migrations`) do not count as application tables.

### What bootstrap will never do

It issues no column-adding statement, no `DROP`, no data modification and no
change plan. It does not complete a partially created database, reconcile
drift, rebuild a table or migrate data. The test suite proves this by recording
every statement the tool issues: exactly one write — the canonical DDL,
verbatim — and reads.

### There is no production override

A production or unrecognised name **cannot be unlocked**. The guard takes no
environment argument at all, so no variable — however it is spelled — can
enable it. Provisioning production is a different, deliberate procedure that
does not live here.

## `turso:verify`

### Contract

Strictly read-only. The canonical structure is materialised locally; the target
is only ever read. The target is handed to the comparison through
`asReadOnly()`, whose type exposes **no write method at all** and whose runtime
guard refuses any statement that is not a `SELECT` or a read-only `PRAGMA`. It
emits no corrective SQL and suggests no repair.

Because it cannot write, it is safe against any database, including production
— that is the point of keeping it separate from bootstrap.

```bash
NODE_USE_ENV_PROXY=1 npm run turso:verify
```

| Verdict | Exit code | Meaning |
|---|---|---|
| `identical` | 0 | Every compared element matches, and nothing was uncomparable |
| `drift detected` | 2 | At least one proven difference |
| `structure not verifiable` | 2 | No proven difference, but something could not be compared faithfully |
| — | 1 | Operational or configuration error |

### What it compares

Tables; columns (type, nullability, default, primary-key position, hidden
flag); foreign keys grouped correctly, including composite ones, with their
`ON UPDATE` / `ON DELETE` actions; indexes with their uniqueness, key columns
and order, collation and partiality. Declaration order is irrelevant;
everything else is not.

Defaults are compared **raw**, exactly as SQLite reports them. A default
differing only in whitespace is a real difference and is never normalized away.

### Conservative by construction

`identical` is returned only when it can be proven. SQLite's PRAGMAs do not
describe everything, so these constructs yield `structure not verifiable`
rather than being assumed equal — even when both sides look the same:

- `CHECK` constraints;
- generated columns (their expressions are not exposed);
- expression indexes;
- column collations;
- `WITHOUT ROWID`, `STRICT`, `AUTOINCREMENT`;
- any table whose `CREATE TABLE` statement is not recorded.

The current `schema.prisma` uses none of them, so a database created by
`turso:bootstrap` verifies as `identical`. A test fails if the schema ever
introduces one, so this can never degrade silently.

## Picking the target

### Environment variable precedence

| | Order |
|---|---|
| URL | `TURSO_DATABASE_URL` → `DATABASE_URL` *(only if it is a `libsql://` URL)* |
| Token | paired with whichever variable supplied the URL: `TURSO_DATABASE_URL` → `TURSO_AUTH_TOKEN` then `DATABASE_AUTH_TOKEN`; `DATABASE_URL` → `DATABASE_AUTH_TOKEN` then `TURSO_AUTH_TOKEN` |

Pairing the token with its URL stops one database's token from being sent to
another. A `file:` `DATABASE_URL` is ignored on purpose so a local dev database
is never mistaken for the remote target.

### URL parsing

Parsed with `new URL()` and refused when it is not unambiguous: not a valid
URL, not the `libsql:` protocol, credentials in the URL (`user:pass@`), query
parameters (`?authToken=…`), an empty or IP-literal hostname, or an unexpected
path component.

Only the **database name** (first host label) and the name of the variable it
came from are ever printed. The URL, the hostname, the query string and the
token never reach a log line, and every error surfaced by either CLI passes
through the sanitizer first.

### The production guard is an allow-list

A database can be bootstrapped **only** when its name contains one of these
markers as a whole token (split on `-`, `_`, `.`):

```
lab  preview  dev  develop  development  staging  test  sandbox
```

Everything else is treated as production and refused — including names nobody
anticipated. A production marker (`prod`, `production`, `live`, `main`,
`master`) wins even next to a safe one, so `7f-prod-test` is production.

| Name | `turso:bootstrap` |
|---|---|
| `sevenef-mr-forte-lab`, `sevenef-preview`, `forte-mc-dev` | allowed |
| `7f`, `7f-7frames`, `sevenef`, `sevenef-live`, `sevenef-prod`, `sevenef-production` | refused |
| any unrecognised name | refused |

`turso:verify` runs against any of them: it cannot write.

## Inspecting a database by hand (read-only)

```sql
SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%';
SELECT count(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';
PRAGMA foreign_key_check;   -- expect zero rows
PRAGMA integrity_check;     -- expect "ok"
```

A freshly bootstrapped database currently holds **52 tables and 90 indexes**.
That number is not a target to maintain by hand — it is whatever
`schema.prisma` currently describes.

## Running behind the egress proxy

In Claude Code cloud environments, outbound traffic goes through a proxy.
`curl` honours `HTTPS_PROXY` automatically; **Node (undici) does not**, so any
Node command that talks to Turso needs the opt-in:

```bash
NODE_USE_ENV_PROXY=1 npm run turso:verify
```

Without it the client bypasses the proxy and the request is rejected with
`403 Host not in allowlist`. The environment's **Network access** setting must
also allow the database host, including its regional data-plane hostname
(`*.<region>.turso.io`) — the apex `*.turso.io` alone does not cover it.

## Tests and clean-checkout validation

```bash
npm ci
npm run typecheck            # = prisma generate && tsc --noEmit
npm run test:turso           # guard + bootstrap + verify
```

Granular: `test:turso-guard`, `test:turso-bootstrap`, `test:turso-verify`.

Every suite runs against throwaway local SQLite files — no credentials, no
proxy, no remote connection, no `npx`, no downloads — and works from any
working directory.

The generated Prisma client lives outside the repository, so a fresh clone
cannot typecheck until it is generated; `npm run typecheck` does that first.
`npm run build` already runs `prisma generate` before `next build`, so the
deployed build is unaffected.

CI (`.github/workflows/turso-schema-drift.yml`) runs the typecheck and all
three suites on pushes to any branch and on pull requests to `master`, but only
when a relevant file changes. The job needs no credentials or secrets and never
connects to Turso.
