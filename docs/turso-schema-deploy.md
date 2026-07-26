# Turso schema deploy — runbook

How a Turso database gets the application schema, what this tool will and will
not do to an existing database, and how we keep it from drifting away from the
code.

## What this is (and is not)

`npm run turso:push` is an **additive bootstrap**, not a migration engine.

| It does | It refuses |
|---|---|
| Create an empty database's whole schema | Rewrite or rebuild an existing table |
| Add a table that does not exist yet | Change a column's type, nullability, default or primary key |
| Add a column that SQLite can add | Add a foreign key to an existing table |
| Add an index whose columns exist and whose data allows it | Drop or rename anything |

Anything in the right-hand column aborts with **`manual migration required`**,
listing every offending object — and it aborts **before writing anything**, so a
database that needs a human is never left half-provisioned.

## Source of truth

**`prisma/schema.prisma` is the single source of truth.** Nothing else defines
tables, columns or indexes. There is no hand-maintained SQL list.

Prisma's migration engine cannot connect to a remote Turso database (the
datasource is `sqlite`, and the engine has no `libsql://` connector), so the
deploy works in four steps:

1. `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
   renders the canonical DDL for the current schema.
2. That DDL is applied to a **throwaway local SQLite file**, which is then
   introspected. This introspection — not a regex over the SQL text — is the
   canonical structure.
3. The target database is introspected with the same code, and the two
   structures are compared field by field.
4. Only additive differences are applied; then the target is introspected again
   and required to match.

| File | Role |
|---|---|
| `prisma/schema.prisma` | Source of truth (models, indexes) |
| `prisma/turso-schema.ts` | Target resolution, guard, DDL generation, introspection, comparison, additive provisioning |
| `prisma/push-turso.ts` | CLI entry point (`npm run turso:push`) |
| `scripts/turso-target-guard.test.ts` | Target guard tests (`npm run test:turso-guard`) |
| `scripts/turso-schema-drift.test.ts` | Drift detector (`npm run test:turso-drift`) |

> Historical note: `push-turso.ts` used to carry hand-written `tables` /
> `uniqueIndexes` arrays. Every new model required editing them by hand, and
> they fell behind — 42 provisioned tables against 52 models. That list is gone.

## What happens when the schema changes

| Change in `schema.prisma` | On an empty database | On an existing database |
|---|---|---|
| New model | created | table created |
| New nullable column | created | `ALTER TABLE ADD COLUMN` |
| New column with a **constant** default | created | `ALTER TABLE ADD COLUMN`, existing rows get the default |
| New `NOT NULL` column without a default | created | added only while the table is empty; otherwise **`manual migration required`** |
| New column with a non-constant default (`now()` → `CURRENT_TIMESTAMP`) | created | **`manual migration required`** — SQLite refuses it |
| New index | created | created |
| New unique index | created | created, unless existing rows already contain duplicates → **`manual migration required`** |
| New relation (foreign key) | created | **`manual migration required`** — SQLite cannot add a foreign key to an existing table |
| Changed `onDelete` / `onUpdate` | created | **`manual migration required`** |
| Type change | created | **`manual migration required`** |
| Nullability or default change | created | **`manual migration required`** |
| Primary-key change | created | **`manual migration required`** |
| Renamed model or field | created under the new name | **`manual migration required`** (the old object is reported as extra) |
| Removed model or field | absent | **`manual migration required`** (reported as extra) |
| Field-level `@map` | supported | supported — the physical column name comes from the DDL |
| Model-level `@@map` | refused by an explicit guard | refused by an explicit guard |

A `@@map` is refused because the drift detector's independent cross-check
("every model in `schema.prisma` exists as a table") assumes model name = table
name. The provisioner itself would handle it; the guard exists so the check
never silently compares the wrong things. Teaching the cross-check about
`@@map` is a small, deliberate change — see `assertModelNamesMatchTables`.

### When you get `manual migration required`

Write the migration by hand (the repository already uses this pattern — see
`scripts/migrate-*.ts` and `prisma/sql/`), apply it, then re-run
`npm run turso:push`. The additive path will then find nothing left to do and
the verification step will confirm the database matches `schema.prisma`.

For a table rewrite, the SQLite recipe is: create the new table, copy the data,
drop the old one, rename. This tool deliberately does not do that automatically
— a rebuild that goes wrong on a populated production table is unrecoverable.

## Provision a Turso database

```bash
# Credentials — never paste tokens into a chat, commit, or log.
export TURSO_DATABASE_URL="libsql://<database>-<org>.turso.io"
export TURSO_AUTH_TOKEN="<auth token>"

NODE_USE_ENV_PROXY=1 npm run turso:push
```

Exit codes: `0` success, `2` `manual migration required`, `1` anything else.

Nothing is ever dropped or rewritten, so a successful run never destroys data,
and re-running is a no-op.

### Running behind the egress proxy

In Claude Code cloud environments, outbound traffic goes through a proxy.
`curl` honours `HTTPS_PROXY` automatically; **Node (undici) does not**, so any
Node command that talks to Turso needs the opt-in:

```bash
NODE_USE_ENV_PROXY=1 npm run turso:push
```

Without it the client bypasses the proxy and the request is rejected with
`403 Host not in allowlist`. The environment's **Network access** setting must
also allow the database host, including its regional data-plane hostname
(`*.<region>.turso.io`) — the apex `*.turso.io` alone does not cover it.

## Picking the target

### Environment variable precedence

| | Order |
|---|---|
| URL | `TURSO_DATABASE_URL` → `DATABASE_URL` *(only if it is a `libsql://` URL)* |
| Token | paired with whichever variable supplied the URL: `TURSO_DATABASE_URL` → `TURSO_AUTH_TOKEN` then `DATABASE_AUTH_TOKEN`; `DATABASE_URL` → `DATABASE_AUTH_TOKEN` then `TURSO_AUTH_TOKEN` |

Pairing the token with its URL is deliberate: it stops one database's token
from being sent to another. A `file:` `DATABASE_URL` is ignored on purpose so a
local dev database is never mistaken for the remote target.

### URL parsing

The URL is parsed with `new URL()` and refused when it is not unambiguous:

- not a valid URL, or not the `libsql:` protocol;
- credentials in the URL (`user:pass@…`) — pass the token via
  `TURSO_AUTH_TOKEN` instead;
- query parameters (`?authToken=…`) — same reason;
- an empty, IP-literal or otherwise ambiguous hostname;
- an unexpected path component.

Only the **database name** (first host label) and the name of the variable it
came from are ever printed. The URL, the hostname, the query string and the
token never reach a log line, and every child-process `stderr` is sanitized
before it is shown.

### The production guard is an allow-list

A database is provisioned automatically **only** when its name contains one of
these markers as a whole token (split on `-`, `_`, `.`):

```
lab  preview  dev  develop  development  staging  test  sandbox
```

Everything else is treated as production and refused — including names nobody
anticipated. A production marker (`prod`, `production`, `live`, `main`,
`master`) wins even next to a safe one, so `7f-prod-test` is production.

| Name | Result |
|---|---|
| `sevenef-mr-forte-lab`, `sevenef-preview`, `forte-mc-dev` | provisioned |
| `7f`, `7f-7frames`, `sevenef`, `sevenef-live`, `sevenef-prod`, `sevenef-production` | refused |
| any unrecognised name | refused |

To provision a refused database deliberately, set the workspace-bound override
— there is no global force switch, and the value must equal the name exactly:

```bash
TURSO_PROVISION_ALLOW_PRODUCTION="<exact database name>" \
  NODE_USE_ENV_PROXY=1 npm run turso:push
```

## Verification

`npm run turso:push` prints the target's name and classification, what it
created, and then proves the result:

- the target is introspected again and must match the canonical structure —
  no missing table, column, foreign key or index, and no mismatched type,
  nullability, default, primary key, foreign-key action or index definition;
- `PRAGMA foreign_key_check` must return zero rows;
- `PRAGMA integrity_check` must return `ok`.

`✓ Schema provisioned successfully` is printed **only** when all of that holds.

To inspect a database by hand (read-only):

```sql
SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%';
SELECT count(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';
PRAGMA foreign_key_check;   -- expect zero rows
PRAGMA integrity_check;     -- expect "ok"
```

A freshly provisioned database currently holds **52 tables and 90 indexes**.
That number is not a target to maintain by hand — it is whatever
`schema.prisma` currently describes.

## Check for drift (CI or local)

```bash
npm run test:turso          # guard + drift
npm run test:turso-guard    # target guard only
npm run test:turso-drift    # drift detector only
```

Both suites run entirely against throwaway local SQLite files — no credentials,
no proxy, no remote connection.

The drift detector compares **structure**, not names. It fails when a model in
`schema.prisma` is not provisioned; when a table, column, foreign key or index
is missing; when a column's type, nullability, default or primary-key position
differs; when a foreign key's `ON DELETE` / `ON UPDATE` differs; when an index
changes uniqueness or key columns; when a change that needs a human is applied
silently instead of aborting; and when re-provisioning is not idempotent.

They also run in CI (`.github/workflows/turso-schema-drift.yml`) on pushes to
any branch and on pull requests to `master`, but only when a relevant file
changes. The job needs no credentials or secrets, and it typechecks the
repository in the same run.

## Clean-checkout validation

The generated Prisma client lives outside the repository, so a fresh clone
cannot typecheck until it is generated:

```bash
npm ci
npm run typecheck            # = prisma generate && tsc --noEmit
npm run test:turso
```

`npm run build` already runs `prisma generate` before `next build`, so the
deployed build is unaffected; only a bare `tsc --noEmit` needs the extra step.
