# Turso schema deploy — runbook

How a Turso database gets the application schema, and how we keep it from
drifting away from the code.

## Source of truth

**`prisma/schema.prisma` is the single source of truth.** Nothing else defines
tables, columns or indexes. There is no hand-maintained SQL list to update when
a model changes.

Prisma's migration engine cannot connect to a remote Turso database (the
datasource is `sqlite`/`file:`, and the engine has no `libsql://` connector).
So the deploy works in two steps:

1. `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
   renders the canonical DDL for the current schema.
2. `@libsql/client` applies that DDL to the remote database.

Both steps live in `prisma/turso-schema.ts`; `prisma/push-turso.ts` is the thin
CLI wrapper around them.

| File | Role |
|---|---|
| `prisma/schema.prisma` | Source of truth (models, indexes) |
| `prisma/turso-schema.ts` | Target resolution, guards, DDL generation, idempotent provisioning |
| `prisma/push-turso.ts` | CLI entry point (`npm run turso:push`) |
| `scripts/turso-schema-drift.test.ts` | Drift detector (`npm run test:turso-drift`) |

> Historical note: `push-turso.ts` used to carry hand-written `tables` /
> `uniqueIndexes` arrays. Every new model required editing them by hand, and
> they fell behind — 42 provisioned tables against 52 models. That list is gone.

## Provision a Turso database

```bash
# Credentials — never paste tokens into a chat, commit, or log.
export TURSO_DATABASE_URL="libsql://<database>-<org>.turso.io"
export TURSO_AUTH_TOKEN="<auth token>"

NODE_USE_ENV_PROXY=1 npm run turso:push
```

Works on an empty database and is safe to re-run: every statement is
`CREATE ... IF NOT EXISTS`, and columns missing from tables that already exist
are added with `ALTER TABLE ADD COLUMN`. Nothing is ever dropped or rewritten,
so re-running never destroys data.

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

## Environment variable precedence

The provisioner resolves its target deliberately, and **differently from
`core/db.ts`** (which prefers `DATABASE_URL` for the running app):

| | Order |
|---|---|
| URL | `TURSO_DATABASE_URL` → `DATABASE_URL` *(only if it is a `libsql://` URL)* |
| Token | `TURSO_AUTH_TOKEN` → `DATABASE_AUTH_TOKEN` |

A `file:` `DATABASE_URL` is ignored on purpose: a local dev database must never
be mistaken for the remote Turso target. If nothing resolves, the script fails
with an explicit error instead of guessing.

The script prints the resolved database **name** and which variable it came
from before writing anything. It never prints the URL or the token.

## Not pointing at production

`push-turso.ts` refuses a target whose name looks like production (`7f*`,
`*-prod*`, `sevenef-prod*`). Lab/preview/dev/staging names are not flagged.

To provision production deliberately, set the workspace-bound override — there
is no global force switch:

```bash
TURSO_PROVISION_ALLOW_PRODUCTION="<exact database name>" \
  NODE_USE_ENV_PROXY=1 npm run turso:push
```

## Verify tables, indexes and integrity

`npm run turso:push` prints expected vs live counts, added columns and FK
violations, and fails if the live table count is short or any FK is violated.

To check an existing database by hand (read-only):

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
npm run test:turso-drift
```

Runs entirely against throwaway local SQLite files — no credentials, no proxy,
no remote connection. It fails when:

- a model in `schema.prisma` is not provisioned as a table,
- provisioned tables, indexes or columns differ from the source of truth,
- re-provisioning is not idempotent,
- `@@map` is introduced (model name ≠ table name), which the check would
  otherwise silently mis-compare.

Because the deploy *derives* its DDL from `schema.prisma`, adding a model needs
no change to the deploy code — the drift test simply keeps proving that.
