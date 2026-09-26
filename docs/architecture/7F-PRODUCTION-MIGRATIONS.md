# sevenef — Production Database Migration Pipeline

Status: **canonical deployment contract**

This runbook defines how every sevenef vertical evolves the shared PostgreSQL
schema. Finesse, Scholara, Bonabasto, Oloju and future products do not own
separate ad-hoc production DDL paths.

## 1. One history for the platform

Canonical schema:

```text
prisma/schema.prisma
```

Canonical PostgreSQL history:

```text
prisma/migrations-postgres/
  0_init/
  7_finesse_appointments_v2/
  8_scholara_.../
  9_bonabasto_.../
  ...
```

Every schema change gets a new migration. The immutable `0_init` baseline is
never edited.

## 2. Migration modes

Every migration after `0_init` must start with exactly one policy declaration:

```sql
-- sevenef:migration-mode=routine
```

or:

```sql
-- sevenef:migration-mode=manual
```

### routine

Eligible for automatic production application before the new Vercel deployment
is activated. A routine migration must be backwards-compatible with the
currently running application.

Typical routine changes:

- create a new table;
- add nullable columns;
- create indexes;
- add structures that old code can safely ignore.

The repository policy rejects routine migrations containing destructive or
contracting operations such as DROP, TRUNCATE, data DELETE/UPDATE, rename,
column type changes, SET NOT NULL, or ADD COLUMN NOT NULL.

### manual

A valid migration that deliberately stops automatic production deployment.
Use it for contract/cleanup phases that require a reviewed runbook, data
backfill, compatibility window, or explicit maintenance operation.

Examples:

- dropping an old column/table;
- renaming a live column;
- changing a column type;
- making an existing column NOT NULL;
- destructive cleanup/backfill sequences.

A pending manual migration causes the Vercel production build to fail **before
Prisma writes anything**.

## 3. Deployment order

```text
PR
 ↓
CI: migration policy
 ↓
Prisma generate
 ↓
Typecheck
 ↓
Lint
 ↓
Tests
 ↓
PostgreSQL history verification
 ↓
Legacy SQLite history verification
 ↓
Build
 ↓
Merge
 ↓
Vercel production build starts
 ↓
Guard exact Neon production identity
 ↓
Read migration ledger
 ↓
Confirm ledger is a prefix of repository history
 ↓
Confirm every pending migration is routine
 ↓
prisma migrate deploy
 ↓
Re-read and verify exact ledger
 ↓
next build
 ↓
Vercel activates the new deployment
```

The critical property is **database first, application second**. If migration
or verification fails, the Vercel build fails and that deployment is never
activated.

## 4. Preview safety

For Vercel Preview and Development:

```text
VERCEL_ENV != production
→ production migrator skips
→ normal build
```

Preview builds never mutate the production database.

## 5. One-time Vercel Production configuration

The `7-fnew` project must expose these values **only to Production**:

| Variable | Purpose |
|---|---|
| `DIRECT_URL` | existing Neon direct (non-pooler) connection string, secret |
| `SEVENF_PRODUCTION_DB_HOST` | exact direct Neon hostname |
| `SEVENF_PRODUCTION_DB_DATABASE` | exact database name |
| `SEVENF_PRODUCTION_DB_PROJECT` | Neon project id |
| `SEVENF_PRODUCTION_DB_BRANCH` | Neon branch id |

The last four are identity configuration, not credentials. The runner also
requires `sslmode=verify-full` for non-loopback production targets and rejects
a `-pooler` host.

The live database must already carry the NEON-05 production marker:

```text
sevenf:environment=production;
sevenf:migration=neon-05;
sevenf:project=<project>;
sevenf:branch=<branch>
```

A missing or mismatched marker stops the deployment.

## 6. Commands

Audit policy without any database connection:

```bash
npm run db:migration:audit
```

Production migrator (normally invoked by Vercel, not manually):

```bash
npm run db:migrate:production
```

Vercel build contract:

```bash
npm run vercel-build
```

It runs:

```text
migration policy
→ guarded production migrator (production only)
→ normal application build
```

## 7. Rules for agents and developers

1. Never use `prisma db push` for production schema evolution.
2. Never edit `0_init`.
3. Never modify Neon tables manually for normal product development.
4. Every schema change gets a new PostgreSQL migration.
5. Every post-baseline migration declares `routine` or `manual`.
6. New verticals use the same history; they do not get an independent DDL path
   merely because they have their own repo or UI.
7. Prefer expand → backfill → switch code → contract for changes that cannot be
   completed safely in one routine migration.
8. A migration failure blocks deployment; do not weaken the guard to make a
   deployment pass.

## 8. Current first routine migration

`7_finesse_appointments_v2` is the first migration under this policy. It is
additive: nullable Appointment V2 columns plus indexes, so the previous app
version remains compatible while the migration is applied.
