# CORE-03B — Turso schema audit and baseline draft

> **Status: READY FOR CORE-03C REVIEW.**
> Read-only audit. Nothing was migrated, applied, registered or adopted.

---

## 1. Objective and limits

CORE-03B answers one question: **what is actually deployed on Turso today**, and
how does it relate to `prisma/schema.prisma` and to the DDL the repository can
reconstruct from its own history.

In scope:

- strictly read-only inspection of the deployed Turso schema;
- a three-way comparison — Prisma model ↔ deployed Turso structure ↔ local SQL history;
- resolution of the seven models CORE-03A found with no locally identifiable `CREATE TABLE`;
- a documentary **draft** baseline representing the deployed structure;
- verification of that draft against a temporary, throwaway local database.

Explicitly out of scope: applying, registering or adopting any migration;
correcting any difference; `prisma migrate` / `db push` / `db pull` in any form;
creating `prisma/migrations`; retiring `push-turso.ts`; seeds, backfills, data
reads, dumps; any move to Neon or PostgreSQL. Every remedy identified below is a
decision for **CORE-03C**, not an action taken here.

This work stabilises the *current* Turso base. It is not a provider migration.

## 2. Date and audited SHA

| Item | Value |
| --- | --- |
| Date | 2026-08-11 |
| Branch | `7f-evolution` |
| Audited HEAD | `617c30e401af0e98a20c487f5a05963b32c59b98` |
| `origin/7f-evolution` at audit time | `617c30e401af0e98a20c487f5a05963b32c59b98` |
| `origin/master` at audit time | `312785fb270ed334ff2af121e280c1a03bed02bd` |
| Working tree at audit time | clean |

CORE-03A (the audited HEAD) is treated as approved and closed. None of its work
was repeated, refactored or corrected.

## 3. Read-only method

Prisma Client was **not** used to inspect Turso — it could open connections
outside the read-only guard. Inspection ran through the libSQL client already
present in the project (`@libsql/client`, no dependency added), from a temporary
script located **outside the repository** and deleted afterwards.

Controls actually applied:

1. An explicit read transaction: `client.transaction("read")`. The client
   exposes it, so the guard is real and the mission proceeded.
2. Every schema query issued **inside** that transaction.
3. The transaction rolled back and closed, then the client closed.
4. Read-only status was **not** probed by attempting a write.

### `PRAGMA query_only`

`PRAGMA query_only = 1` is **rejected by the Turso server**:

```
SQL_PARSE_ERROR: SQL not allowed statement: PRAGMA query_only = 1
```

Reading it back is permitted and returns `0`. Two consequences, stated plainly:

- the session-level `query_only` flag is **not** the protection in force here;
- the protection in force is the server-side read transaction
  (`transaction("read")`), which is the control the instructions require and
  which the installed client does support.

`PRAGMA schema_version` is likewise rejected by the server
(`SQL not allowed statement`), so schema identity across captures is established
by the canonical `sqlite_schema` hash and the object counts instead — see §13.

### Credentials

Turso credentials were taken **only** from the environment already configured.
Variable names were discovered from repository configuration (`.env.example`,
`prisma/push-turso.ts`, `core/db.ts`): `TURSO_DATABASE_URL` /
`TURSO_AUTH_TOKEN`, with `DATABASE_URL` / `DATABASE_AUTH_TOKEN` as the
alternative pair.

Presence check only, never contents:

| Variable | Configured |
| --- | --- |
| `TURSO_DATABASE_URL` | `true` |
| `TURSO_AUTH_TOKEN` | `true` |
| `DATABASE_URL` | `false` |
| `DATABASE_AUTH_TOKEN` | `false` |

No value was printed, copied, decoded or logged. No `env` / `printenv` / `set -x`
was run, no `.env` file was read, no token was passed as a visible argument, and
no credential appears in this document or in the baseline draft. No token was
created, renewed or revoked; no Turso permission or setting was changed; no data
was copied or downloaded.

## 4. Sanitised list of remote queries

Only structural metadata was read. The complete set of statement shapes issued
(261 distinct statements, all instances of these forms):

```
SELECT sqlite_version()
PRAGMA query_only = 1                 -- rejected by server, see §3
PRAGMA query_only
PRAGMA schema_version                 -- rejected by server, see §3
PRAGMA user_version
PRAGMA foreign_keys
PRAGMA table_list
SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name
PRAGMA table_xinfo("<table>")         -- once per table
PRAGMA foreign_key_list("<table>")    -- once per table
PRAGMA index_list("<table>")          -- once per table
PRAGMA index_xinfo("<index>")         -- once per index
```

All identifiers interpolated into `PRAGMA` calls came exclusively from
`sqlite_schema`, were validated against `^[A-Za-z_][A-Za-z0-9_]*$` and quoted as
identifiers.

`_prisma_migrations` does not exist, so no query touched it.

**Not executed on Turso:** `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `UPSERT`,
`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `VACUUM`, `REINDEX`, `ANALYZE`, `ATTACH`,
`DETACH`, `PRAGMA optimize`, `PRAGMA wal_checkpoint`, `user_version` or
`schema_version` assignment, `integrity_check`, `quick_check`, `.dump`,
`.clone`, `.import`, `.read`, `db pull`, `db push`, any migration command, any
query against application rows, any `COUNT(*)` over business data, any seed or
backfill.

## 5. Relevant versions

| Component | Version |
| --- | --- |
| Remote SQLite engine (`SELECT sqlite_version()`) | 3.47.0 |
| `@libsql/client` | 0.17.0 |
| `prisma` | 7.4.1 |
| `@prisma/client` | 7.4.1 |
| `@prisma/adapter-libsql` | 7.4.1 |
| Prisma datasource provider | `sqlite` |

## 6. Prisma inventory

- **52 models** in `prisma/schema.prisma` (recomputed, matching CORE-03A).
- **0** `@@map` and **0** `@map` attributes — every model's physical table name
  is identical to the model name. No logical/physical renaming exists anywhere
  in the schema, which removes an entire class of false "missing table"
  findings.
- No `@@id` composite primary keys; every model has a single-column `id`.
- Client-side generation used throughout: `@default(cuid())` for ids and
  `@updatedAt` for `updatedAt`. Neither produces a database-level default, so
  their absence in Turso is **not** drift.

## 7. Real Turso inventory

Captured read-only, application objects only (`sqlite_*` internals excluded):

| Object | Count |
| --- | --- |
| Tables | 48 |
| Explicit indexes (`sql IS NOT NULL`) | 61 |
| Views | 0 |
| Triggers | 0 |
| `PRAGMA user_version` | 0 |
| `PRAGMA foreign_keys` | 1 (enabled) |
| `PRAGMA table_list` rows | 50 (48 app tables + `sqlite_schema` + `sqlite_temp_schema`) |

Auto-created indexes (`sqlite_autoindex_*`, `sql IS NULL`) are filtered as
SQLite internals. They are reproduced by each table's own `PRIMARY KEY` /
`UNIQUE` constraint and are never re-emitted as `CREATE INDEX` — see §10.

## 8. Local historical script inventory

| # | File | Operation | Objects | Order | Idempotent | Destructive | Evidence it ran |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `prisma/push-turso.ts` (`tables`, L20–698) | `CREATE TABLE IF NOT EXISTS` ×42 | Cliente, Proyecto, Tarea, Transaccion, Factura, Documento, Evento, Nota, Usuario, Automatizacion, User, AllowedEmail, Notification, Activity, InboxEntry, Contact, Conversation, Message, ConversationAction, AIClassification, ConversationHandoff, ConversationDraft, Attachment, QRCode, ClientProject, ClientInvoice, ClientFile, Campaign, ContentPiece, ContentIdea, ClientAuth, ConversationRead, ChannelConnection, InboxTodo, ExternalIdentity, ContactIdentityLink, MessageAttachment, PresenceSite, PresencePublication, PresenceDomain, PresenceMedia, PresenceSubscription | 1st | yes | no | **Yes** — all 42 present in Turso |
| 2 | `prisma/push-turso.ts` (`uniqueIndexes`, L700–745) | `CREATE [UNIQUE] INDEX IF NOT EXISTS` ×43 | indexes on the tables above | 2nd | yes | no | **Yes** — all present |
| 3 | `prisma/push-turso.ts` (`alterColumns`, L771–822) | `ALTER TABLE … ADD COLUMN` ×50 | Cliente, Proyecto, User, InboxEntry, AIClassification, ConversationAction, Conversation, Notification, Message, ChannelConnection | 3rd | effectively (duplicate-column errors swallowed) | no | **Yes** — every added column present, incl. `Conversation.trashedAt` |
| 4 | `prisma/sql/2026-07-19-inbox-data-04b-additive.sql` | 3 `CREATE TABLE`, 11 `ALTER TABLE ADD COLUMN`, 13 `CREATE [UNIQUE] INDEX` | ExternalIdentity, ContactIdentityLink, MessageAttachment, Message, ChannelConnection | — | yes | no | **Yes** — mirrored into `push-turso.ts`; structure present |
| 5 | `prisma/sql/2026-07-21-presence-persistence-additive.sql` | 5 `CREATE TABLE`, 12 `CREATE [UNIQUE] INDEX` | Presence* | — | yes | no | **Yes** — mirrored into `push-turso.ts`; structure present |
| 6 | `scripts/migrate-workspace-task.ts` (L49–88) | `CREATE TABLE IF NOT EXISTS` + 7 `CREATE INDEX` | WorkspaceTask | — | yes | no | **Yes** — table and all 7 indexes present |
| 7 | `scripts/migrate-platform-audit-log.ts` (L43–57) | `CREATE TABLE IF NOT EXISTS` + 4 `CREATE INDEX` | PlatformAuditLog | — | yes | no | **Yes** — table and all 4 indexes present |
| 8 | `scripts/migrate-platform-admin.ts` (L49–57) | `CREATE TABLE IF NOT EXISTS` + 1 `CREATE UNIQUE INDEX` | PlatformAdmin | — | yes | no | **Yes** — table and index present |
| 9 | `scripts/migrate-workspace-status.ts` (L74, L92) | `ALTER TABLE ADD COLUMN` + `CREATE INDEX IF NOT EXISTS` | `Workspace.status`, `Workspace_status_idx` | — | yes (ALTER guarded) | no | **Yes** — column and index present |
| 10 | `scripts/migrate-conversation-category.ts` (L73, L90) | `ALTER TABLE ADD COLUMN` + `CREATE INDEX IF NOT EXISTS` | `Conversation.category`, `Conversation_workspaceId_category_idx` | — | yes (ALTER guarded) | no | **Yes** — column and index present |
| 11 | `scripts/migrate-inbox-todo-link.ts` (L54, L69) | `ALTER TABLE ADD COLUMN` + `CREATE INDEX IF NOT EXISTS` | `InboxTodo.workspaceTaskId`, `InboxTodo_workspaceId_workspaceTaskId_idx` | — | yes (ALTER guarded) | no | **NO — neither column nor index exists in Turso** |
| 12 | `app/api/setup/client-auth-table/route.ts` (L17–29) | runtime `CREATE TABLE IF NOT EXISTS` + 2 `CREATE UNIQUE INDEX` | ClientAuth | — | yes | no | **Yes — and this is the variant that actually ran.** See note below |
| 13 | `migration.sql` (repo root) | **none — not SQL** | — | — | — | — | n/a |

Additional observations:

- **`ClientAuth` was created by the HTTP setup route, not by `push-turso.ts`.**
  Two different `CREATE TABLE` variants exist for it, and the stored DDL
  identifies which one won. `push-turso.ts` L490–499 declares
  `"updatedAt" DATETIME NOT NULL` at four-space indentation; the route declares
  `"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` at six-space
  indentation. Turso stores the six-space form *with* the default. Because both
  use `IF NOT EXISTS`, the route ran first and `push-turso.ts` has been a no-op
  for this table ever since. Worth recording: an authenticated HTTP endpoint is
  part of this database's real schema history, which makes it a live, unlogged
  DDL path into production.
- **`migration.sql` at the repository root contains no DDL at all.** It is a
  captured PowerShell/`prisma migrate diff` *error transcript* (`--to-schema-datamodel`
  was removed) accidentally committed under a `.sql` name. It contributes
  nothing to schema history and must not be mistaken for a migration.
- `CREATE TABLE` statements also appear in `modules/usuarios/scope.test.ts`,
  `scripts/inbox-data-migration.smoke.test.ts` and `core/db.test.ts`. These are
  **test fixtures against in-memory/local databases**, not deployment DDL, and
  are excluded from the "local `CREATE TABLE`" set. Notably `scope.test.ts`
  fixtures `Workspace`, `WorkspaceMember`, `User`, `Usuario`, `Cliente`,
  `Proyecto` and `Tarea` — which is why a naive grep can wrongly suggest those
  tables have deployment DDL.
- No `DROP`, `RENAME`, column removal or row rewrite exists in any script.
  Every historical path is additive.
- No views and no triggers are created anywhere in the repository, consistent
  with the 0/0 counts observed in Turso.

**Critical rule applied throughout:** *the existence of a script does not prove
it was executed.* The only proof of deployed structure is the read-only Turso
metadata. Item 11 above is exactly why this matters — the script exists, is
idempotent and looks routine, yet its effect is absent from production.

## 9. Full comparison matrix

Legend — **In Turso**: table exists in the deployed schema. **Local DDL**:
production-path `CREATE TABLE` exists in the repository (test fixtures
excluded).

Differences deliberately **not** classified as drift, because Prisma handles
them in the client rather than the database: virtual relation fields;
`@default(cuid())`; `@updatedAt`; enums stored as text; `@default(now())`
rendered as `CURRENT_TIMESTAMP`. No `@map`/`@@map` exists, so no logical/physical
name difference exists either.

| Prisma model / table | In Turso | Local DDL | Historical origin | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| `AIClassification` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK conversationId → Conversation(id). index missing: [workspaceId,leadScore] |
| `Activity` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `AllowedEmail` | yes | yes | push-turso.ts | MATCH | — |
| `Attachment` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `Automatizacion` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `Campaign` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `ChannelConnection` | yes | yes | push-turso.ts | MATCH | — |
| `ClientAsset` | **no** | **no** | — none — | PRISMA_ONLY | table absent from Turso |
| `ClientAuth` | yes | yes | push-turso.ts | MATCH | — |
| `ClientFile` | yes | yes | push-turso.ts | MATCH | — |
| `ClientInvoice` | yes | yes | push-turso.ts | MATCH | — |
| `ClientProject` | yes | yes | push-turso.ts | MATCH | — |
| `ClientRequest` | **no** | **no** | — none — | PRISMA_ONLY | table absent from Turso |
| `ClientRequestAsset` | **no** | **no** | — none — | PRISMA_ONLY | table absent from Turso |
| `Cliente` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | nullability: tipo: prisma=NOT NULL turso=NULL. default: tipo: prisma='empresa' turso=(none). FK: missing FK workspaceId → Workspace(id) |
| `Contact` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK clienteId → Cliente(id). index missing: [workspaceId,email] [workspaceId,telefono] [workspaceId,clienteId] |
| `ContactIdentityLink` | yes | yes | push-turso.ts | MATCH | — |
| `ContentIdea` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `ContentPiece` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `Conversation` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK contactId → Contact(id); missing FK clienteId → Cliente(id); missing FK proyectoId → Proyecto(id); missing FK connectionId → ChannelConnection(id). index missing: [workspaceId,status] [workspaceId,lastMessageAt] [contactId] [clienteId] [proyectoId] [connectionId]. Turso-only index: Conversation_workspaceId_category_idx (workspaceId,category) |
| `ConversationAction` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK conversationId → Conversation(id). index missing: [conversationId,createdAt] [workspaceId,status] [workspaceId,source] [workspaceId,sourceMessageId] |
| `ConversationDraft` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK conversationId → Conversation(id). index missing: [conversationId,createdAt] [workspaceId,status] |
| `ConversationHandoff` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK conversationId → Conversation(id). index missing: [workspaceId,status] |
| `ConversationRead` | yes | yes | push-turso.ts | MATCH | — |
| `Documento` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | nullability: url: prisma=NOT NULL turso=NULL. default: tipo: prisma=(none) turso='documento'. FK: missing FK workspaceId → Workspace(id) |
| `Evento` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `ExternalIdentity` | yes | yes | push-turso.ts | MATCH | — |
| `Factura` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | nullability: items: prisma=NOT NULL turso=NULL; fechaEmision: prisma=NOT NULL turso=NULL. default: subtotal: prisma=(none) turso=0; total: prisma=(none) turso=0; fechaEmision: prisma=CURRENT_TIMESTAMP turso=(none). FK: missing FK workspaceId → Workspace(id) |
| `ForteSnapshot` | **no** | **no** | — none — | PRISMA_ONLY | table absent from Turso |
| `InboxEntry` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK contactId → Contact(id); missing FK conversationId → Conversation(id). index missing: [workspaceId,conversationId] [workspaceId,contactId] |
| `InboxTodo` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | missing column(s): workspaceTaskId. index missing: [workspaceId,workspaceTaskId] |
| `Message` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id); missing FK conversationId → Conversation(id); missing FK connectionId → ChannelConnection(id). index missing: [conversationId,createdAt] [workspaceId,createdAt] |
| `MessageAttachment` | yes | yes | push-turso.ts | MATCH | — |
| `Nota` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `Notification` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | nullability: message: prisma=NULL turso=NOT NULL. FK: missing FK workspaceId → Workspace(id) |
| `PlatformAdmin` | yes | yes | migrate-platform-admin.ts | MATCH | — |
| `PlatformAuditLog` | yes | yes | migrate-platform-audit-log.ts | MATCH | — |
| `PresenceDomain` | yes | yes | push-turso.ts | MATCH | — |
| `PresenceMedia` | yes | yes | push-turso.ts | MATCH | — |
| `PresencePublication` | yes | yes | push-turso.ts | MATCH | — |
| `PresenceSite` | yes | yes | push-turso.ts | MATCH | — |
| `PresenceSubscription` | yes | yes | push-turso.ts | MATCH | — |
| `Proyecto` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `QRCode` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | missing column(s): workspaceId. index missing: [workspaceId,module,recordId] |
| `Tarea` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | FK: missing FK workspaceId → Workspace(id) |
| `Transaccion` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | nullability: descripcion: prisma=NULL turso=NOT NULL; categoria: prisma=NULL turso=NOT NULL. default: fecha: prisma=CURRENT_TIMESTAMP turso=(none). FK: missing FK workspaceId → Workspace(id) |
| `User` | yes | yes | push-turso.ts | STRUCTURAL_DRIFT | Turso-only column(s): googleId. FK: missing FK workspaceId → Workspace(id). Turso-only unique: User_googleId_key (googleId) |
| `Usuario` | yes | yes | push-turso.ts | MATCH | — |
| `Vertical` | yes | **no** | — none — | HISTORY_GAP | structure matches Prisma exactly; only the creating DDL is missing |
| `Workspace` | yes | **no** | — none — | HISTORY_GAP | structure matches Prisma; Turso-only index: Workspace_status_idx (status) |
| `WorkspaceMember` | yes | **no** | — none — | HISTORY_GAP | structure matches Prisma exactly; only the creating DDL is missing |
| `WorkspaceTask` | yes | yes | migrate-workspace-task.ts | MATCH | — |

### Classification tally

| Classification | Count | Objects |
| --- | --- | --- |
| `MATCH` | 19 | AllowedEmail, ChannelConnection, ClientAuth, ClientFile, ClientInvoice, ClientProject, ContactIdentityLink, ConversationRead, ExternalIdentity, MessageAttachment, PlatformAdmin, PlatformAuditLog, PresenceDomain, PresenceMedia, PresencePublication, PresenceSite, PresenceSubscription, Usuario, WorkspaceTask |
| `COMPATIBLE_DIFFERENCE` | 0 tables classified this way outright, because every table carrying such a difference also carries a heavier one. **10 individual differences** exist: 4 Turso-only objects + 6 default-value differences | Turso-only objects: `User.googleId`, `User_googleId_key`, `Workspace_status_idx`, `Conversation_workspaceId_category_idx`. Default differences (harmless — the client always supplies the value): `Cliente.tipo`, `Documento.tipo`, `Transaccion.fecha`, `Factura.subtotal`, `Factura.total`, `Factura.fechaEmision`. Itemised in §11 |
| `PRISMA_ONLY` | 4 | ClientAsset, ClientRequest, ClientRequestAsset, ForteSnapshot |
| `TURSO_ONLY` | 0 | — |
| `HISTORY_GAP` | 3 | Vertical, Workspace, WorkspaceMember |
| `STRUCTURAL_DRIFT` | 26 | Cliente, Proyecto, Tarea, Documento, Transaccion, Factura, Evento, Nota, Automatizacion, User, Notification, Activity, Contact, Conversation, Message, ConversationAction, InboxTodo, AIClassification, ConversationHandoff, ConversationDraft, InboxEntry, QRCode, Campaign, ContentPiece, ContentIdea, Attachment |
| `UNKNOWN` | 0 | — |

Totals: 52 Prisma models, 48 Turso tables, 0 tables in Turso with no Prisma model.

## 10. Resolution of the seven models

CORE-03A reported seven models with no locally identifiable `CREATE TABLE`. That
count was **recomputed independently** — not assumed — and comes out at seven
again: 52 Prisma models minus 45 tables with a production-path local
`CREATE TABLE` (42 in `push-turso.ts`, plus `WorkspaceTask`, `PlatformAuditLog`
and `PlatformAdmin` in their `migrate-*` scripts; `ClientAuth` is covered twice
and counted once).

By name, with their real status:

| # | Model | Exists in Turso | Verdict |
| --- | --- | --- | --- |
| 1 | `Vertical` | **yes** | `HISTORY_GAP` — deployed, structure matches Prisma exactly (8 columns, PK `id`, unique `key`). Only the history is missing. |
| 2 | `Workspace` | **yes** | `HISTORY_GAP` — deployed, all 10 Prisma columns present including `status` (added by `migrate-workspace-status.ts`). Carries a Turso-only index `Workspace_status_idx` not declared in Prisma. Only the creating DDL is missing. |
| 3 | `WorkspaceMember` | **yes** | `HISTORY_GAP` — deployed, structure matches Prisma exactly, including both FKs (`userId`→User, `workspaceId`→Workspace, both `CASCADE`) and the composite unique `(userId, workspaceId)`. Only the history is missing. |
| 4 | `ClientAsset` | **no** | `PRISMA_ONLY` — **absent from Turso.** Functional risk. |
| 5 | `ClientRequest` | **no** | `PRISMA_ONLY` — **absent from Turso.** Functional risk. |
| 6 | `ClientRequestAsset` | **no** | `PRISMA_ONLY` — **absent from Turso.** Functional risk. |
| 7 | `ForteSnapshot` | **no** | `PRISMA_ONLY` — **absent from Turso.** Functional risk. |

None is mapped under a different name — the schema has zero `@map`/`@@map` — and
none remains uncertain.

**`Workspace` and `WorkspaceMember` are both present and structurally correct.**
CORE-03A's finding is confirmed as what it claimed to be: a documentation gap,
not a missing table. The repository cannot reconstruct them; production has them.

### Named historical cases

- **`Conversation.trashedAt`** — **present in Turso** (`DATETIME`, nullable), and
  present in Prisma. Origin: `prisma/push-turso.ts` L809
  (`ALTER TABLE "Conversation" ADD COLUMN "trashedAt" DATETIME`). Classified
  `MATCH` at column level. No action needed.
- **`WorkspaceTask`** — **present in Turso**, `MATCH`. All 30 Prisma columns
  present, PK `id`, FK `workspaceId` → `Workspace(id)` `ON DELETE CASCADE`
  `ON UPDATE CASCADE`, and all seven declared indexes present. Origin:
  `scripts/migrate-workspace-task.ts`, which demonstrably ran. This is the
  canonical task model per `AGENTS.md` and it is fully deployed.

Neither object was modified.

## 11. Differences by severity

### CRITICAL — 4

Four Prisma models have **no table in Turso**. Any code path reaching them fails
at runtime:

| Model | Prisma columns | Notes |
| --- | --- | --- |
| `ClientAsset` | 12 | Client-portal assets; FK → `Cliente` |
| `ClientRequest` | 11 | Client-portal requests; FKs → `Cliente`, `Proyecto` |
| `ClientRequestAsset` | 5 | FK → `ClientRequest` |
| `ForteSnapshot` | 8 | FK → `Workspace`, unique `workspaceId` |

Their absence is coherent: no production-path DDL was ever written for them, so
nothing could have deployed them.

### HIGH — 5

| Item | Detail |
| --- | --- |
| `InboxTodo.workspaceTaskId` missing | `scripts/migrate-inbox-todo-link.ts` was **never applied**. The column and its index `InboxTodo_workspaceId_workspaceTaskId_idx` are absent. Prisma declares both. Any read/write of that field fails, and `scripts/backfill-workspace-tasks.ts` depends on it. |
| `QRCode.workspaceId` missing | Prisma declares `workspaceId String?` and `@@index([workspaceId, module, recordId])`. No local DDL ever adds the column; Turso does not have it. `QRCode` is therefore not workspace-scoped in production. |
| `Transaccion.descripcion` NOT NULL in Turso | Prisma says `String?`. A write with `null` fails at the database. |
| `Transaccion.categoria` NOT NULL in Turso | Same shape as above. |
| `Notification.message` NOT NULL in Turso | Prisma says `String?`. A write with `null` fails at the database. |

The last three are the dangerous direction: **Turso is stricter than Prisma**, so
the type system says a write is legal and the database rejects it.

### MEDIUM — 41

| Item | Count | Detail |
| --- | --- | --- |
| Missing FK constraints | 37 across 24 tables | Prisma declares the relation; Turso has no constraint. Systematic cause: `push-turso.ts` creates most tables **without** a `workspaceId` FK and then adds `workspaceId` via `ALTER TABLE ADD COLUMN`, which SQLite cannot use to attach a foreign key. `Conversation` has **zero** FKs in Turso against five declared in Prisma. With `PRAGMA foreign_keys = 1` on the server, Prisma's `onDelete` semantics (`Cascade`, `SetNull`) are simply not enforced for these relations. |
| Prisma stricter than Turso (nullability) | 4 | `Cliente.tipo`, `Documento.url`, `Factura.items`, `Factura.fechaEmision` are `NOT NULL` in Prisma but nullable in Turso. Existing rows may hold `NULL` where the generated types promise a value. |

### LOW — 23

23 declared Prisma indexes are absent in Turso, across 10 tables: `Contact` (3),
`Conversation` (6), `Message` (2), `ConversationAction` (4), `InboxTodo` (1),
`AIClassification` (1), `ConversationHandoff` (1), `ConversationDraft` (2),
`InboxEntry` (2), `QRCode` (1). Correctness is unaffected; these are read-path
performance gaps on the busiest Inbox tables.

### INFORMATIONAL — 8

- Turso-only column `User.googleId` + unique index `User_googleId_key`: created
  deliberately by `push-turso.ts` (L170, L706) for Google auth, never added to
  `schema.prisma`. Prisma is unaware of it; being nullable, it does not break
  writes.
- Turso-only indexes `Workspace_status_idx` and
  `Conversation_workspaceId_category_idx`: created by `migrate-workspace-status.ts`
  and `migrate-conversation-category.ts`, not declared in Prisma.
- Default-value differences that are harmless because the client always supplies
  the value: `Cliente.tipo`, `Documento.tipo`, `Transaccion.fecha`,
  `Factura.subtotal`, `Factura.total`, `Factura.fechaEmision`.

## 12. `_prisma_migrations` status

**The table does not exist.** No query was issued against it.

Consequence: Turso holds **no migration ledger of any kind**. The deployed schema
was built entirely by imperative scripts (`push-turso.ts` plus the `migrate-*`
family), none of which records what it applied. There is no `checksum`, no
`finished_at`, no `applied_steps_count` — nothing to reconcile against. This is
precisely the condition CORE-03C must resolve, and it is why the sole reliable
evidence of deployed structure is the live metadata read here.

`prisma/migrations/` does not exist in the repository either, so nothing was
disturbed there.

## 13. Capture hashes

Two independent read-only captures were taken before writing this document, and
the pair was repeated after writing it (§14).

| Capture | Tables | Explicit indexes | Views | Triggers | `user_version` | Canonical SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 48 | 61 | 0 | 0 | 0 | `6347f71d88f32d7943eef0c86ae39c49d1beede05522f7b0faf5d42bd8400638` |
| #2 | 48 | 61 | 0 | 0 | 0 | `6347f71d88f32d7943eef0c86ae39c49d1beede05522f7b0faf5d42bd8400638` |

The hash covers a canonical, sorted representation of `sqlite_schema`
(`[type, name, tbl_name, sql]` per object) with SQLite internals excluded.

**The two captures are identical**, so the inspection window was stable and the
baseline draft rests on a consistent snapshot. `PRAGMA schema_version` is
unavailable on Turso (§3), so this hash plus the object counts stand in for it.

## 14. Local reconstruction result

The draft was verified **only** against a throwaway local database, never
against Turso:

1. A temporary directory was created with `mktemp -d`.
2. An empty local SQLite/libSQL database was created inside it.
3. Only `CORE-03B-BASELINE-DRAFT.sql` was applied — **109 of 109 statements
   applied, 0 errors**.
4. The rebuilt schema was compared semantically with capture #1 — tables,
   columns, types, nullability, defaults, primary keys, hidden/generated
   columns, foreign keys (including `on_delete` / `on_update`), unique
   constraints, indexes (including origin and partiality), views and triggers.

   **Result: exactly equivalent. Zero differences.**
5. Automatically generated internal objects were excluded from the comparison.
6. On the temporary database only: `PRAGMA integrity_check` → `ok`;
   `PRAGMA foreign_key_check` → 0 rows.
7. Prisma resolution against the rebuilt schema:
   - models with **no table**: `ClientAsset`, `ClientRequest`,
     `ClientRequestAsset`, `ForteSnapshot`;
   - models with **missing columns**: `InboxTodo.workspaceTaskId`,
     `QRCode.workspaceId`.
8. The database and its temporary directory were deleted. No real data was ever
   copied into it.

Step 7 restates §11 rather than adding a new finding: the baseline is a faithful
mirror of Turso, and Turso is what cannot satisfy those six Prisma expectations.
The reconstruction test — does the draft reproduce the captured schema — passed
without exception.

## 15. Risks and pending decisions for CORE-03C

Nothing below was acted on. Each item is a decision for CORE-03C.

1. **Four missing tables** (`ClientAsset`, `ClientRequest`, `ClientRequestAsset`,
   `ForteSnapshot`). Decide whether the client-portal and Forte-snapshot
   features are live; if so this is a production outage waiting on a code path,
   and the tables must be created. If not, decide whether the models should stay
   in `schema.prisma` at all.
2. **`InboxTodo.workspaceTaskId`**. `migrate-inbox-todo-link.ts` never ran.
   Decide whether to run it, fold it into the baseline, or accept that
   `backfill-workspace-tasks.ts` cannot currently work.
3. **`QRCode.workspaceId`**. Never had DDL. Decide whether QR codes must be
   workspace-scoped, and whether existing rows need a backfill.
4. **Three NOT NULL columns stricter in Turso than in Prisma**
   (`Transaccion.descripcion`, `Transaccion.categoria`, `Notification.message`).
   Decide the direction of truth: relax the database or tighten the schema.
   Relaxing requires a SQLite table rebuild.
5. **37 missing foreign keys.** Decide whether 7F wants database-enforced
   referential integrity. Adding them to existing tables requires full table
   rebuilds and a data-integrity pass first, because current rows may already
   violate them. Alternatively, adopt `relationMode = "prisma"` explicitly so the
   schema stops promising constraints the database does not have.
6. **23 missing indexes** on the hottest Inbox tables. Cheap and additive; likely
   the safest first correction.
7. **Turso-only objects** (`User.googleId` + its unique index,
   `Workspace_status_idx`, `Conversation_workspaceId_category_idx`). Decide
   whether to declare them in `schema.prisma` so the two sides converge.
8. **No migration ledger.** Decide how to introduce `_prisma_migrations`, whether
   this baseline (once corrected or as-is) becomes the initial migration, and how
   to mark it applied without re-running it against live data.
9. **`push-turso.ts` retirement.** It is currently the de-facto deployment
   mechanism and it silently swallows errors (`console.error` then continue), so
   a failed statement leaves production diverged with no signal. Decide when it
   is replaced by Prisma Migrate.
10. **`migration.sql` at the repository root** is a committed error transcript,
    not SQL. Decide whether to delete it; it can only mislead future audits.
11. **`app/api/setup/client-auth-table/route.ts` is a live DDL path into
    production** and demonstrably created the deployed `ClientAuth` table.
    Decide whether an HTTP endpoint should be able to alter the schema at all
    once Prisma Migrate is adopted.
12. **Nullability weaker in Turso than in Prisma** (`Cliente.tipo`,
    `Documento.url`, `Factura.items`, `Factura.fechaEmision`). Decide whether
    existing `NULL`s must be backfilled before tightening.

## 16. Conclusion

The read-only inspection was stable across two identical captures, the audit is
complete, and `CORE-03B-BASELINE-DRAFT.sql` reconstructs the captured Turso
schema exactly, with `integrity_check` and `foreign_key_check` clean on the
temporary rebuild.

The draft is a **faithful record of what is deployed** — not a corrected or
idealised schema — and it must not be applied.

**READY FOR CORE-03C REVIEW.**
