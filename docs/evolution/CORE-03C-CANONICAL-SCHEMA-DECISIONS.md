# CORE-03C-1 — Canonical Schema Decisions and Migration-History Design

- **Date:** 2026-08-16
- **Branch:** `7f-evolution`
- **Starting SHA:** `49a0b7c0d099dd44d47f9adf1cbba601b9b5ba1b` (= `origin/7f-evolution`; `origin/master` at `312785fb270ed334ff2af121e280c1a03bed02bd`, 8 ahead / 0 behind)
- **Status:** decision record — **nothing here was implemented**. No schema, config, migration, database or data change was made. The only file this mission produced is this document.

---

## 1. Executive summary

Sevenef's main database currently has **no reproducible history**: 52 Prisma models face 48 deployed Turso tables, there is no `_prisma_migrations` ledger, and the deployed structure was assembled by an 843-line imperative script (`prisma/push-turso.ts`), six one-shot `scripts/migrate-*.ts` files, two loose SQL files, and — in one demonstrated case — an authenticated HTTP endpoint (removed by CORE-02B). CORE-03B captured the deployed reality into an immutable, verified baseline document.

This record decides, with repository evidence:

1. **Source of truth** becomes a four-layer architecture (§4): one canonical Prisma schema (Layer 1), the immutable CORE-03B deployed-state baseline (Layer 2), a SQLite/Turso migration history (Layer 3), and a separate, generated PostgreSQL/Neon history (Layer 4). One canonical schema file remains the single hand-maintained source; provider variants are **generated and mechanically verified, never hand-maintained in parallel** (owner directive).
2. **Model classification (§5):** 41 `CANONICAL_KEEP`, 4 `LEGACY_RETAIN` (Usuario, Tarea, InboxTodo, InboxEntry), 3 `CANONICAL_ADD` (ClientRequest, ClientRequestAsset, ClientAsset — live portal routes fail today because their tables were never deployed), 3 `REMOVE_FROM_CANONICAL` (ClientProject, ClientInvoice, ClientFile — zero productive references after a two-pass audit), 1 `OWNER_DECISION_REQUIRED` (ForteSnapshot, per owner instruction — regardless of its productive references).
3. **Local experiments on Prisma 7.4.1 (§11)** proved: the CORE-03B baseline still reconstructs the deployed state exactly (48 tables / 61 indexes, integrity ok); `prisma migrate diff` can generate both the canonical SQLite DDL and the deployed→canonical drift script fully offline; the drift requires **28 full table rebuilds** — decisive evidence against any single-shot correction; and, critically, Prisma 7.4.1 does **not** refuse a cross-provider diff — it silently emits a drop-everything script (§11, E4b). Provider isolation must therefore be enforced by repository structure and CI, not by trust in the tool.
4. **CORE-03C-2 is sequenced (§13)** into ten small, individually verifiable commits, starting with the safest corrections (ledger scaffolding, additive indexes and columns) and deferring every destructive or rebuild-class change behind the aggregate data audit (§12) and owner approval.

Verdict: **READY FOR OWNER DECISION** (§15 lists the seven decisions that need the owner; §16 states the recommended default for each).

---

## 2. Scope and database boundary

This record concerns **only the main canonical Sevenef/7F database** — the one `core/db.ts` connects to and `prisma/schema.prisma` describes.

Explicitly out of boundary, per the mission:

- any experimental or laboratory database, and the `claude/turso-lab-setup-r48st0` branch (not read, not merged, not used as evidence);
- any Mission Control operational database;
- any endpoint or configuration belonging to another database;
- external database names as schema evidence — every claim below is grounded in this repository's code, docs, or a local throwaway SQLite database.

No remote system was contacted. CORE-03B's versioned evidence is reused instead of repeating its remote read-only audit. `.env` files were not read; no secret value appears in this document.

---

## 3. Evidence and methodology

**Inputs read:** `AGENTS.md`, `CLAUDE.md`, `docs/ways-of-working.md`, `docs/execution-workflow.md`, `docs/evolution/CORE-00-AUDIT.md`, `docs/evolution/CORE-03B-SCHEMA-AUDIT.md`, `docs/evolution/CORE-03B-BASELINE-DRAFT.sql`, `docs/evolution/CORE-02B-SECURITY-CLOSURE.md`, `prisma/schema.prisma`, `prisma.config.ts`, `package.json`, `core/db.ts`, `prisma/push-turso.ts`, the `scripts/migrate-*.ts` family, `prisma/sql/*.sql`, and the root `migration.sql` artifact.

**Model-usage inventory:** the 52 model names were extracted mechanically from `schema.prisma` and converted to Prisma client accessors by the client's actual rule — only the first letter is lowercased (`QRCode → qRCode`, `AIClassification → aIClassification`); guessing camelCase would have missed both. Each accessor was then counted in three tiers with `rg`:

- **PRODUCTIVE** — `\b(db|tx|prisma)\.<accessor>\b` across `app core modules engines lib agents components hooks middleware.ts`, excluding `*.test.*`;
- **TEST** — the same pattern in `*.test.*` only;
- **SCRIPT/LEGACY** — the same pattern in `scripts prisma tools`.

Schema declarations, the generated client, the baseline SQL, tests, docs, fixtures and historical scripts were **not** counted as productive use. Every zero-hit model received a mandatory second pass before classification: relation-field traversal (`include`/`select`/`connect`/nested `create`), dynamic access, and route/page consumer tracing. This second pass is what saved `ClientRequestAsset` from misclassification (§6.B).

**Local experiments:** run exclusively inside a `mktemp -d` directory (deleted afterward), against local SQLite files only, with the four database environment variables removed via `unset` in a subshell, `CHECKPOINT_DISABLE=1`, the repo-local `node_modules/.bin/prisma` binary, and a **temporary Prisma config** (no `dotenv/config` import, temp schema copy, temp SQLite URL) — the repository's real `prisma.config.ts` was never passed to a datasource-using Prisma command because it imports `dotenv/config`. Full log in §11.

**Documentation basis:** prisma.io is unreachable from this sandbox (network egress policy), so Prisma behavior claims are grounded in the **installed 7.4.1 CLI itself** — its `--help` output and `node_modules/prisma/config.d.ts` / `@prisma/config` type definitions — plus the version-appropriate links the CLI itself prints: `https://pris.ly/d/migrate-diff`, `https://pris.ly/d/migrate-baseline`, `https://pris.ly/d/migrate-resolve`. Those links are recorded here as the official references but were **not verifiable from this environment**; CORE-03C-2 should confirm them before relying on any behavior not demonstrated locally in §11.

---

## 4. Source-of-truth hierarchy

Four layers, each with a distinct job. Confusing any two of them is how the current situation happened.

### Layer 1 — Canonical product model

`prisma/schema.prisma`, **after** the CORE-03C-2 corrections decided here. It defines what Sevenef *needs*: entities, fields, relations, indexes, constraints. It is the only hand-edited schema artifact. Today it is *not yet* canonical — it declares 3 tables that must not exist (§5 REMOVE_FROM_CANONICAL), omits 1 deployed column (`User.googleId`) and 2 deployed indexes, and disagrees with the database on 7 columns' nullability.

### Layer 2 — Deployed state (immutable)

`docs/evolution/CORE-03B-BASELINE-DRAFT.sql` + `CORE-03B-SCHEMA-AUDIT.md`. A faithful record of what **is** deployed (48 tables, 61 indexes, SHA-256 `6347f71d…0638`), verified again locally in this mission (§11 E1). It describes reality, not intent. It is never edited, never applied to production, and never "upgraded" to look like Layer 1. Its role: the fixed starting point every migration plan diffs *from*.

### Layer 3 — SQLite/Turso migration history

`prisma/migrations/` (to be created by CORE-03C-2), provider-locked to SQLite via `migration_lock.toml`. Its first entry, `0_baseline`, is the Layer-2 DDL verbatim — the deployed state, **not** the ideal state — so that a fresh local database built from the history is structurally identical to production, and every later migration is an explicit, reviewed delta toward Layer 1. This history exists for as long as Turso is the runtime or the rollback target.

**Adoption on the existing Turso database:** the Prisma-documented mechanism is `prisma migrate resolve --applied 0_baseline` (per the installed CLI's own help: *"baseline databases when starting to use Prisma Migrate on existing databases"*, ref `https://pris.ly/d/migrate-baseline`), which records the baseline in `_prisma_migrations` **without executing its DDL**. Against Turso specifically this is an **UNVERIFIED PROVIDER CAPABILITY** (owner directive): it was not tested here, Turso rejects some standard PRAGMAs (CORE-03B §3), and it writes a new table to production. **No write of `_prisma_migrations` to Turso is proposed until a future, explicitly authorized mission verifies it on a disposable Turso instance first.** Until then, Layer 3 serves local/CI reconstruction and review; production adoption is a scheduled later step, not a side effect.

### Layer 4 — PostgreSQL/Neon migration history

A second, independent history (e.g. `prisma/migrations-postgres/`), generated **from the approved Layer 1** with `migrate diff --from-empty/--from-migrations … --script` under a PostgreSQL config. It starts empty-to-canonical: Neon has no legacy, so it needs no baseline of the deployed SQLite state — its `0_init` is the ideal schema directly. SQLite SQL and PostgreSQL SQL never share a directory (§11 E4b shows why the tool cannot be trusted to catch the mixture).

### Keeping one source of truth (owner directive — no dual hand-maintained schemas)

The provider variant is **derived, never hand-edited**:

- One canonical `prisma/schema.prisma` (SQLite provider while Turso is the runtime).
- The PostgreSQL variant is produced by a deterministic generation step that rewrites only the datasource provider line into a build artifact (e.g. `generated/schema.postgres.prisma`, gitignored or committed read-only — CORE-03C-2 decides placement), consumed by a second Prisma config file (`prisma.config.postgres.ts`) via `--config`. The installed `@prisma/config` types confirm one `schema`/`migrations`/`datasource` per config, so per-provider = per-config-file, selected per command.
- **CI enforces derivation:** a check regenerates the variant and fails on any diff, so the two can never diverge by hand-editing; a second check builds a fresh database from each history and diffs it against the canonical schema (`migrate diff --from-config-datasource --to-schema … --exit-code`), so histories can never drift from Layer 1 silently.
- This is viable because the schema is provider-portable by construction: 0 `@map`/`@@map`, 0 enums, 0 `Json` columns, 0 `@db.*` native types, `cuid()` IDs everywhere (CORE-00 §18); the only provider-specific artifact is the generated SQL, which is exactly what the per-provider histories hold.

**Turso as rollback:** the Turso database and Layer 3 remain intact and deployable throughout any Neon adoption; nothing in this design modifies or retires Turso until a future mission does so explicitly.

---

## 5. Full 52-model classification matrix

Counts are productive references (**p**), test references (**t**), script/legacy references (**s**) from the §3 inventory. "Turso" = table exists in the deployed baseline. Every model carries exactly one classification.

### CANONICAL_KEEP — 41 models

Deployed, productively used, and part of the canonical model. Future migration action: none beyond the corrective deltas in §7–§9. Risk if nothing is done: none at model level.

| # | Model | Turso | p / t / s | Productive evidence (examples) | Domain |
|---|---|---|---|---|---|
| 1 | Vertical | yes | 2/0/3 | `core/verticals.ts` (`db.vertical.findMany/findUnique`) | Core config |
| 2 | Workspace | yes | 40/15/21 | `core/workspace.ts`, `core/workspace-context.ts`, governance | Core tenancy |
| 3 | WorkspaceMember | yes | 14/1/6 | `core/workspace-context.ts` membership checks, RBAC | Core tenancy |
| 4 | Cliente | yes | 24/0/16 | `modules/clientes/service.ts`, inbox conversion | Core business |
| 5 | Proyecto | yes | 30/0/9 | `modules/proyectos`, portal `app/api/cliente/proyectos` | Core business |
| 6 | Documento | yes | 11/0/1 | `modules/documentos/service.ts` | Core business |
| 7 | Transaccion | yes | 12/0/6 | `modules/finanzas/service.ts` | Core business |
| 8 | Factura | yes | 29/0/9 | `modules/facturacion/service.ts`, portal facturas | Core business |
| 9 | Evento | yes | 16/0/7 | calendar routes/services | Core business |
| 10 | Nota | yes | 9/0/2 | notas module | Core business |
| 11 | Automatizacion | yes | 8/0/1 | `modules/automatizaciones` | Core business |
| 12 | User | yes | 21/2/4 | auth callback, `core/auth/**`, usuarios admin | Core auth |
| 13 | PlatformAdmin | yes | 5/0/0 | `core/auth/platform-auth.ts`, google callback bootstrap | Platform |
| 14 | PlatformAuditLog | yes | 2/0/0 | `core/system/audit.ts` | Platform |
| 15 | AllowedEmail | yes | 12/0/0 | invite-only auth flow | Core auth |
| 16 | Notification | yes | 10/0/0 | `core/notifications.ts` | Core |
| 17 | Activity | yes | 4/0/0 | `core/activity.ts`, dashboard | Core |
| 18 | Contact | yes | 18/7/4 | inbox identity/services | Inbox |
| 19 | Conversation | yes | 57/10/13 | `modules/inbox/service.ts` (hottest model) | Inbox |
| 20 | ConversationRead | yes | 2/0/0 | `app/api/inbox/conversations/[id]/read` | Inbox |
| 21 | Message | yes | 31/18/13 | inbox pipeline, transports | Inbox |
| 22 | ConversationAction | yes | 28/1/0 | Fanny action pipeline | Inbox |
| 23 | AIClassification | yes | 2/0/0 | `modules/inbox/intelligence.ts` | Inbox |
| 24 | ConversationHandoff | yes | 5/0/0 | handoff service | Inbox |
| 25 | ConversationDraft | yes | 7/0/0 | composer drafts | Inbox |
| 26 | QRCode | yes | 3/0/0 | `app/api/qr/**` (3 routes) | Core tooling |
| 27 | ClientAuth | yes | 5/0/0 | portal login/register (`app/api/cliente/auth/**`) | Client portal |
| 28 | Campaign | yes | 10/0/1 | marketing module | Marketing |
| 29 | ContentPiece | yes | 9/0/5 | contenido module | Marketing |
| 30 | ContentIdea | yes | 8/0/0 | contenido module | Marketing |
| 31 | Attachment | yes | 12/0/0 | attachments routes/service | Core |
| 32 | ChannelConnection | yes | 32/8/10 | inbox channels, IMAP/SMTP (encrypted creds) | Inbox |
| 33 | ExternalIdentity | yes | 4/4/2 | identity resolution | Inbox |
| 34 | ContactIdentityLink | yes | 6/1/3 | identity resolution | Inbox |
| 35 | MessageAttachment | yes | 1/0/1 | `modules/inbox/attachment-service.ts` | Inbox |
| 36 | WorkspaceTask | yes | 42/6/5 | `modules/tasks/service.ts` — **canonical task model per AGENTS.md** | Core work |
| 37 | PresenceSite | yes | 10/7/3 | `engines/presence/repository.ts` | Presence |
| 38 | PresencePublication | yes | 4/2/0 | presence publish flow | Presence |
| 39 | PresenceDomain | yes | 7/1/0 | presence domains | Presence |
| 40 | PresenceMedia | yes | 3/1/2 | presence media | Presence |
| 41 | PresenceSubscription | yes | 1/2/0 | `engines/presence/repository.ts:252` | Presence |

### LEGACY_RETAIN — 4 models

Deployed, still productively referenced, but **superseded** by canonical models. They stay in the canonical schema and in the database for now; their retirement is a dedicated, data-driven future mission each (AGENTS.md: convergence of duplicated models is "a dedicated future PR", never an implicit fix).

| Model | Turso | p / t / s | Superseded by | Evidence & retirement note |
|---|---|---|---|---|
| Usuario | yes | 13/7/9 | User | `modules/usuarios/service.ts`, `modules/usuarios/scope.ts`; correlated to `User` by email, **no FK by design** (AGENTS.md). Retirement requires unifying auth + admin UI. |
| Tarea | yes | 29/0/13 | WorkspaceTask | 12 productive files incl. `modules/tareas/service.ts`, dashboards, Forte executor. Highly alive; retirement = three-model task convergence mission. |
| InboxTodo | yes | 10/0/3 | WorkspaceTask | AGENTS.md: legacy/audit-only, never the new write path. Runtime still reads it via `modules/inbox/inbox-tasks-write.ts`, `modules/tasks/inbox-todo-mapping.ts`. Needs `workspaceTaskId` link column first (§6.D). |
| InboxEntry | yes | 12/0/0 | Conversation | `app/api/inbox/route.ts`, `modules/inbox/service.ts`; the two-entry-model debt is documented in AGENTS.md. |

Risk if nothing is done: none immediate (they work today); the risk is *permanent* duplication and drift — hence scheduled convergence missions, not silent removal.

### CANONICAL_ADD — 3 models

Declared in Prisma, **productively wired, and missing from the deployed database** — every request that reaches them fails today (CORE-03B classified these routes CRITICAL). Future migration action: create the tables (order and DDL in §6.B / §13-C6). Risk if nothing is done: standing production outage on the client-portal request/asset features.

| Model | p / t / s | Productive evidence |
|---|---|---|
| ClientRequest | 8/0/0 | `app/api/cliente/requests/route.ts` (list/create), `app/api/cliente/requests/[id]/route.ts`, `app/api/requests/route.ts` (internal view), `app/api/cliente/dashboard/route.ts`; UI `app/cliente/solicitudes/page.tsx` |
| ClientRequestAsset | 0 direct/0/0 — **used via relation** | nested `assets: { create: … }` in `app/api/cliente/requests/route.ts:74-83`; `include: { assets: true }` in the same file (L19, L86), `[id]/route.ts:47`, `app/api/requests/route.ts` (L16, L55) |
| ClientAsset | 4/0/0 | `app/api/cliente/archivos/route.ts` (list/upload), `app/api/cliente/dashboard/route.ts`; UI `app/cliente/archivos/page.tsx` |

### REMOVE_FROM_CANONICAL — 3 models

Deployed tables with **zero productive references** after the two-pass audit (direct accessors: 0; relation traversal from `Cliente`: no `include`/`select`/nested access anywhere in runtime code; portal pages fetch only `/api/cliente/{dashboard,facturas,proyectos,archivos,requests,perfil,auth}`, all served by tenant models + ClientAsset/ClientRequest).

| Model | Turso | Superseded by | Effect on code | Effect on data | Future action | Risk if nothing done |
|---|---|---|---|---|---|---|
| ClientProject | yes | Proyecto (portal reads `db.proyecto`) | none — no references to update | table stays until audited | remove model + `Cliente` back-relation from schema (CORE-03C-2); physical `DROP TABLE` only in a later mission after a row-count audit (§12) and owner sign-off | dead model keeps generating client API surface and confuses every future audit |
| ClientInvoice | yes | Factura (portal reads `db.factura`) | none | same | same | same |
| ClientFile | yes | ClientAsset / Documento | none | same | same | same |

These are *models leaving the canonical definition*, *not* table drops: Layer 2 keeps recording the deployed tables, and dropping them is an explicitly separate, owner-approved step. This is why creating tables "solely because Prisma declares them" is wrong in general — Prisma declaration is intent, not evidence (see also §6.B/C).

### OWNER_DECISION_REQUIRED — 1 model

| Model | p / t / s | Evidence | Decision needed |
|---|---|---|---|
| ForteSnapshot | 3/0/0 | `agents/forte/runtime/business/snapshot-store.ts` (upsert/findUnique/deleteMany), called from `agents/forte/runtime/business/index.ts` and `improvements-loader.ts`; workspace-scoped ("one workspace, one latest snapshot"), unique `workspaceId`, FK → Workspace; exercised by `npm run test:forte-business` | Whether Forte business-analysis memory belongs in the **main Sevenef database** (→ CANONICAL_ADD, create the table) or in a separate/an internal store, and whether the capability is production-committed at all. Per owner instruction this model is **always** OWNER_DECISION_REQUIRED regardless of its productive references. §15-D1 states the trade-offs and a recommendation. |

Tally: 41 + 4 + 3 + 3 + 1 = **52**. ✓

---

## 6. Special-case decisions

### A. Vertical, Workspace, WorkspaceMember (HISTORY_GAP)

Deployed and structurally identical to Prisma (CORE-03B §10) — only their creating DDL is missing from the repo. **Decision: CANONICAL_KEEP, incorporated into the reproducible history via the Layer-3 baseline**, whose DDL is the deployed capture (their `CREATE TABLE` statements are already in `CORE-03B-BASELINE-DRAFT.sql`). Because baseline adoption on the live database is ledger-only (`resolve --applied`-style, §4 Layer 3 — an unverified-on-Turso, future authorized step), **their DDL is never re-executed against the existing database**. A fresh local/CI database gets them from the baseline like every other table. No data action, no risk.

### B. ClientAsset, ClientRequest, ClientRequestAsset (PRISMA_ONLY portal trio)

Productive functionality exists (§5 CANONICAL_ADD): the portal's "solicitudes" and "archivos" surfaces and one internal route are fully wired and **fail at runtime today** on `db.clientRequest` / `db.clientAsset` / nested `assets` access — these are the routes that would fail:

- `GET/POST /api/cliente/requests`, `GET/PATCH /api/cliente/requests/[id]`
- `GET /api/requests` (internal)
- `GET/POST /api/cliente/archivos`
- `GET /api/cliente/dashboard` (queries clientRequest/clientAsset for counts)

**Decision: CANONICAL_ADD for all three.** `ClientRequestAsset` is explicitly included: it has no direct accessor but is written through nested `create` and read through `include: { assets: true }` — relation-level use is productive use.

**Creation order** (FK dependency order, one additive migration, §13-C6): 1. `ClientAsset` (FK → Cliente), 2. `ClientRequest` (FKs → Cliente, Proyecto), 3. `ClientRequestAsset` (FK → ClientRequest). All parent tables already exist. Include their declared indexes in the same migration. No backfill needed — the tables start empty by definition.

### C. ForteSnapshot

Runtime evidence (recorded for the owner, not to preempt the decision): real Sevenef runtime code uses it — `agents/forte/runtime/business/snapshot-store.ts` is called by the Forte business runtime (`business/index.ts`, `improvements-loader.ts`); it stores per-workspace analysis state (workspace-scoped, unique `workspaceId`, JSON-serialized payload marked "no secrets"); tests exercise it via mocked/local flows. It is not referenced by any non-Sevenef system in this repository. Today every snapshot persist/load in production fails (table absent), which the Forte runtime tolerates as "no snapshot".

**Classification: OWNER_DECISION_REQUIRED** (owner directive — automatic CANONICAL_ADD is expressly ruled out). The decision and its consequences are stated in §15-D1. No external database was investigated and the table is not created.

### D. InboxTodo.workspaceTaskId

`WorkspaceTask` is canonical, `InboxTodo` is legacy (AGENTS.md). The linking column is declared in Prisma, has a written-but-never-applied migration script (`scripts/migrate-inbox-todo-link.ts`, CORE-03B §11-HIGH), and **runtime code already reads it**: `modules/inbox/inbox-tasks-write.ts:276` (`select: { workspaceTaskId: true }`) and follows `legacy.workspaceTaskId` (L278–283) to resolve legacy ids — a live failure path today, and `scripts/backfill-workspace-tasks.ts` cannot run without the column.

**Decision (matches the expected recommendation):**
1. keep the link in the canonical model;
2. add the column **nullable** in an additive Layer-3 migration (`ALTER TABLE "InboxTodo" ADD COLUMN "workspaceTaskId" TEXT` — SQLite-legal because it is nullable and FK-less at this stage);
3. add the declared index `InboxTodo_workspaceId_workspaceTaskId_idx` in the same migration;
4. validate and backfill (the audited successor of `backfill-workspace-tasks.ts`) in a **separate, later phase** with the §12 checks first;
5. **no `NOT NULL`** and no FK constraint until the data is proven clean — and likely never `NOT NULL`, since pre-link legacy rows may legitimately have no task.

### E. QRCode.workspaceId

Sevenef is multi-tenant; `QRCode` is the only workspace-declared model whose deployed table has **no `workspaceId` at all** — production QR codes are effectively unscoped. Three live routes (`app/api/qr/save`, `qr/delete/[id]`, `qr/[module]/[recordId]`) operate on it.

**Decision (matches the expected recommendation):**
1. add `workspaceId` **nullable** in an additive migration, plus the declared `QRCode_workspaceId_module_recordId_idx`;
2. determine the workspace of existing rows **by derivation, not invention**: each QR row carries `module` + `recordId` pointing at a tenant-scoped record (cliente/proyecto/factura/…) — the future backfill resolves `workspaceId` through that record's own `workspaceId`; rows whose target no longer exists stay `NULL` and are reported, **never swept into a default workspace** (that was exactly F-WS-05's mistake);
3. runtime hardening (CORE-03C-2 code change, not schema): the QR routes must set `workspaceId` from the caller's resolved workspace context on every new row and refuse creation without one;
4. `NOT NULL` is considered only after the backfill and the §12 audit both come back clean.

### F. Nullability and defaults — decided in §7.

### G. Foreign keys — decided in §8.

### H. Indexes — decided in §9.

### I. User.googleId (Turso-only column + unique index)

Evidence: **no runtime code reads or writes `googleId`** — `rg googleId` over `app core modules lib engines` returns nothing; the Google OAuth callback resolves users **by email** (`app/api/auth/callback/google/route.ts:119`, `db.user.findUnique({ where: { email: emailLower } })`). The column exists only because `push-turso.ts` (L170, L706) created it.

**Decision: declare it in the canonical schema as an explicitly deprecated legacy-compat column** — `googleId String? @unique` with a `/// legacy-compat, unused by runtime, retirement pending` doc comment — rather than leaving it undeclared. Rationale: §11-E3b proved that any diff-generated migration from an undeclared state wants to **drop the column via a full `User` table rebuild** (data loss, silently bundled into unrelated corrections). Declaring it makes the schema converge with reality and protects the data. Actual retirement (drop column + index) is a later mission, gated on the owner confirming no external consumer exists (§15-D4). The column and its index are not removed now.

### J. Existing legacy models

Covered by §5: `Usuario`, `Tarea`, `InboxTodo`, `InboxEntry` are LEGACY_RETAIN with named successors and dedicated retirement missions; `ClientProject`, `ClientInvoice`, `ClientFile` are REMOVE_FROM_CANONICAL (model-level only; deployed tables untouched pending audit + owner sign-off); `ClientAuth` stays CANONICAL_KEEP (live portal auth — note its cross-tenant-unique email is finding F-AUTH-07, a future mission, not a schema-history concern). No productive table is proposed for deletion because of low reference counts — the only removal candidates have **zero** productive references and named successors.

---

## 7. Nullability / default decision matrix

Product truth was established from validation schemas, services and call sites — not from Prisma's declaration alone.

| Column | Prisma | Turso | Product evidence | **Canonical decision** | Pre-migration data check | Backfill | Provider-specific risk |
|---|---|---|---|---|---|---|---|
| `Transaccion.descripcion` | `String?` | NOT NULL | `createTransaccionSchema`: `z.string().optional().nullable()` (`modules/finanzas/validation.ts:6`); service passes through | **nullable** (relax Turso) | none needed (widening) | none | SQLite: requires full table rebuild to drop NOT NULL. PostgreSQL: plain `ALTER COLUMN DROP NOT NULL`. Until fixed, a legal-in-types null write **fails in production** |
| `Transaccion.categoria` | `String?` | NOT NULL | same schema, line 7 | **nullable** (relax Turso) | none | none | same as above |
| `Notification.message` | `String?` | NOT NULL | `core/notifications.ts:33` writes `message: input.message ?? null` — runtime explicitly writes null today | **nullable** (relax Turso) — this is an active production write-failure path | none | none | same as above; highest urgency of the three |
| `Cliente.tipo` | `String @default("empresa")` | nullable | `createClienteSchema` enum-defaults `"empresa"` (`modules/clientes/validation.ts:11`); inbox auto-create omits it and relies on the default | **required with default `"empresa"`** | `COUNT(*) WHERE tipo IS NULL` | set NULLs → `'empresa'` | SQLite: NOT NULL tightening = table rebuild; PostgreSQL: `SET NOT NULL` fails unless backfilled first — check is mandatory in both |
| `Documento.url` | `String` | nullable | validation requires a URL (`modules/documentos/validation.ts:6`); a NULL url renders a dead document | **required** | `COUNT(*) WHERE url IS NULL` | NULL rows are broken records: report and quarantine decision for owner; no invented value | same rebuild/SET NOT NULL asymmetry |
| `Factura.items` | `String` (JSON-serialized) | nullable | service `JSON.parse(f.items)` on **every read** (`modules/facturacion/service.ts:38,48`) — a NULL row crashes list & detail today | **required**, canonical default `'[]'` for repair only | `COUNT(*) WHERE items IS NULL`; plus JSON-parse validity check (§12) | NULLs → `'[]'` after owner confirms no better source | same; also future Postgres `jsonb` conversion depends on parseability (§12) |
| `Factura.fechaEmision` | `DateTime @default(now())` | nullable, no default | validation optional; Prisma default supplies it on create | **required with default now()** | `COUNT(*) WHERE fechaEmision IS NULL` | NULLs → row's `createdAt` | same rebuild asymmetry; DateTime representation change on Postgres (§12 checks convertibility) |

The three "relax" fixes remove an active failure mode and are data-safe (widening); the four "tighten" fixes are **blocked behind the §12 audit and backfills** and land late in the sequence (§13-C7).

---

## 8. Foreign-key strategy

**Decision: real, database-enforced foreign keys are the canonical target** — mandatory for PostgreSQL/Neon (Layer 4 `0_init` carries all of them from day one), staged for SQLite/Turso.

- **`relationMode = "prisma"` is rejected as a permanent solution.** It would make the schema stop *promising* constraints, not make the data consistent; it forfeits `Cascade`/`SetNull` enforcement forever and would have to be undone for Neon anyway. It is acceptable only as an explicitly temporary *documentation* of today's SQLite reality if CORE-03C-2 needs an interim honest state — and the recommendation is to not bother: the schema keeps declaring relations, and this record documents that Turso does not enforce 37 of them yet.
- **Orphan audit before any constraint** (§12): every one of the 37 missing FKs gets an aggregate orphan count. A constraint is only added where the count is 0 or the repair is decided.
- **Repair order:** (1) audit counts → (2) owner decides per relation: re-parent, null out (only for nullable FKs), or delete orphans → (3) repair migration (data) → (4) constraint migration (structure). Never both in one step.
- **SQLite vs PostgreSQL risk is fundamentally different:** in SQLite, adding an FK to an existing table means a **full table rebuild** (new table + copy + drop + rename — §11-E3b measured 28 rebuilds for the complete correction), executed under `PRAGMA foreign_keys=OFF`, with the whole-table copy as the failure surface. In PostgreSQL it is `ALTER TABLE … ADD CONSTRAINT … NOT VALID` + `VALIDATE CONSTRAINT` — online, incremental, reversible. **Therefore: no migration adding the 37 FKs to production Turso is designed or scheduled here**; the FK completion lands naturally and cheaply in the Neon history, and Turso gets, at most, an owner-approved staged subset (starting with the busiest Inbox tables) after the orphan audit. This defers the riskiest SQLite surgery to the platform where it is safe.
- `WorkspaceMember`'s two CASCADE FKs and `WorkspaceTask`'s FK already exist in production (CORE-03B) — the pattern is proven; the gap is historical, not conceptual.

Risk if nothing is done: `onDelete: Cascade`/`SetNull` semantics silently unenforced on 37 relations; orphan accumulation continues (F-WS-06 compounds this).

---

## 9. Index strategy

**Decision: all 23 missing Prisma-declared indexes belong to the canonical schema and are the first corrective migration** (CORE-03B §15.6 already called this "the safest first correction": additive, no rebuilds, no data risk, immediate Inbox read-path benefit). They cover exactly the hottest query paths: `Contact` (3), `Conversation` (6 — including `[workspaceId,status]` and `[workspaceId,lastMessageAt]`, the inbox list ordering), `Message` (2), `ConversationAction` (4), `InboxTodo` (1), `AIClassification` (1), `ConversationHandoff` (1), `ConversationDraft` (2), `InboxEntry` (2), `QRCode` (1, lands with its column §6.E).

**Turso-only indexes — both justified by real queries, both promoted into the canonical schema (CANONICAL_ADD at index level), neither dropped:**

- `Conversation_workspaceId_category_idx` — `category` is an operator-taxonomy filter used in the inbox list WHERE (`modules/inbox/service.ts:444,485`); declare as `@@index([workspaceId, category])`.
- `Workspace_status_idx` — `status` is the control-plane lifecycle column (schema doc comment; `core/system/workspace-status.ts`); tiny table today, but declaring it keeps schema = reality and costs nothing; declare as `@@index([status])`.

`User_googleId_key` follows its column's decision (§6.I): declared, retained, retirement deferred.

Result: after CORE-03C-2, schema-declared indexes and deployed indexes converge exactly; §11-E3b's "drop the two Turso-only indexes" delta disappears by declaration rather than by deletion.

---

## 10. Provider-specific migration-history design

Concrete layout (target state after CORE-03C-2; nothing created yet):

```
prisma/
  schema.prisma                  # Layer 1 — the ONLY hand-edited schema
  migrations/                    # Layer 3 — SQLite/Turso history
    migration_lock.toml          #   provider = "sqlite"
    0_baseline/migration.sql     #   verbatim CORE-03B deployed state (48 tables, 61 indexes)
    1_add_missing_indexes/…      #   §9 (23 indexes + declare-only converges)
    2_add_link_columns/…         #   §6.D InboxTodo.workspaceTaskId, §6.E QRCode.workspaceId (+2 indexes)
    3_create_portal_tables/…     #   §6.B trio (+ ForteSnapshot iff owner approves)
    4_relax_notnull/…            #   §7 three Turso-stricter rebuilds (staged, after audit)
    …                            #   tighten/NOT NULL & FK subset only after §12 + owner
  migrations-postgres/           # Layer 4 — PostgreSQL/Neon history
    migration_lock.toml          #   provider = "postgresql"
    0_init/migration.sql         #   generated from approved Layer 1 (FKs + all indexes included)
prisma.config.ts                 # sqlite config (schema, migrations/, datasource file:… or libsql)
prisma.config.postgres.ts        # postgres config (generated schema variant, migrations-postgres/)
```

- **Active source per provider:** the Prisma config file passed via `--config` selects schema + history + datasource; the installed `@prisma/config` types (one `schema`, one `migrations.path`, one `datasource` per config) make this the supported multi-provider layout in Prisma 7.4.1.
- **No duplication between providers:** SQL lives only inside its own history; the PG schema variant is generated from Layer 1 (§4), never edited.
- **No dual-schema divergence:** CI regenerates the variant and `--exit-code`-diffs each history's product against Layer 1 (§4); any hand edit to a generated artifact or any history/schema drift fails the build.
- **Turso as rollback:** Layer 3 + the untouched Turso database remain a complete, deployable stack during and after Neon adoption.
- **Empty Neon build:** `migrate deploy`-equivalent over `migrations-postgres/` (or `migrate diff --from-empty --to-migrations … --script` piped to the target) produces the full canonical schema from zero — demonstrated provider-correct offline in §11-E4a.
- **Baseline adoption without re-executing DDL:** ledger-only marking of `0_baseline` as applied (`migrate resolve --applied`), which per the installed CLI exists exactly for "baseline databases when starting to use Prisma Migrate on existing databases". **Against Turso this remains UNVERIFIED PROVIDER CAPABILITY** (§4 Layer 3): it must be proven on a disposable Turso database in an authorized future mission before any production use, because it writes `_prisma_migrations` — and no such write is proposed until then.
- **Version-specific references** (printed by the installed CLI, not re-verified online from this sandbox — prisma.io is egress-blocked): `https://pris.ly/d/migrate-diff`, `https://pris.ly/d/migrate-baseline`, `https://pris.ly/d/migrate-resolve`. The repo's own root `migration.sql` error transcript already proves one Prisma-5/6 recipe difference the hard way: `--to-schema-datamodel` no longer exists in 7.x; the 7.4.1 flags are exactly those listed in §11-E5.

---

## 11. Prisma 7.4.1 local experiment results

Environment: `mktemp -d` sandbox (deleted afterward), local SQLite files only, subshell with `unset DATABASE_URL TURSO_DATABASE_URL DATABASE_AUTH_TOKEN TURSO_AUTH_TOKEN`, `CHECKPOINT_DISABLE=1`, `PRISMA_HIDE_UPDATE_MESSAGE=1`, repo-local `node_modules/.bin/prisma`, and a **temporary config** (no `dotenv/config`, temp schema copy, temp SQLite URL, temp migrations path). The repository's `prisma.config.ts` was never used for a datasource-bearing command. One `--help` invocation loaded the repo config by default before the temp config was passed explicitly; `--help` executes nothing and reads no datasource, and no value was printed — noted for completeness.

| # | Experiment | Command essence | Result |
|---|---|---|---|
| E1 | Baseline still reconstructs deployed state | `node:sqlite` `DatabaseSync.exec(CORE-03B-BASELINE-DRAFT.sql)` on a fresh temp DB | **48 tables, 61 indexes, `integrity_check` ok** — matches CORE-03B exactly; the baseline remains a faithful, executable record. (`prisma db execute` was ruled out first: it submits the script as a single command.) |
| E2 | Prisma 7 handles the schema offline | `prisma validate --config <temp config>` | **valid**, no repo files created, no `dev.db`, `git status` clean |
| E3 | Canonical SQLite DDL, flags of 7.4.1 | `migrate diff --from-empty --to-schema <temp schema> --script` | **52 CREATE TABLE, 90 CREATE INDEX** (sha256 `9618227eaf8cd391…`). Confirms the 7.x flag surface (`--from/to-schema`), vs the removed `--to-schema-datamodel` recorded in the root `migration.sql` transcript |
| E3b | Deployed → canonical drift, quantified | `migrate diff --from-config-datasource --to-schema <temp schema> --script` against the E1 database | 749-line script (sha256 `03f5a3d0e0319591…`): **4 CreateTable** (portal trio + ForteSnapshot), **2 AddColumn** (`InboxTodo.workspaceTaskId`, `QRCode.workspaceId`), **11 standalone CreateIndex**, and **28 full table rebuilds** (`new_*` create/copy/drop/rename under `PRAGMA foreign_keys=OFF`) driven by the 37 FKs + nullability deltas — and it would **drop `User.googleId` and both Turso-only indexes**. Item-by-item this matches CORE-03B §11; it is the decisive argument for the staged plan (§13) over any one-shot correction, and for declaring the Turso-only objects (§6.I, §9) |
| E4a | PostgreSQL DDL generates offline | provider swapped to `postgresql` in a temp copy; `migrate diff --from-empty --to-schema … --script` | **52 CREATE TABLE in PostgreSQL dialect** (sha256 `a688914f90227a88…`), no live database needed — Layer 4 `0_init` is producible from Layer 1 alone |
| E4b | Cross-provider mixing | `--from-config-datasource` (SQLite temp DB) vs the **postgresql** schema copy | **NOT refused.** Despite the CLI's own help stating a cross-provider diff "is not supported", 7.4.1 exits 0 and silently emits a catastrophic script: `DROP TABLE` × 48 + `CREATE TABLE` × 52 in **SQLite** dialect (145 `DATETIME`, 0 PG types, PRAGMA statements). The tool treats the foreign-provider schema as a completely different database. **Conclusion: provider separation is a repository/CI responsibility; the tool will not catch the mistake** |
| E5 | Ledger status semantics | `migrate status --config <temp config>` on the E1 database | "**The current database is not managed by Prisma Migrate**" + pointer to `pris.ly/d/migrate-baseline` — exactly the production situation, and the state `resolve --applied` is designed to fix (on Turso: unverified, §10) |

Cleanup verified: temp directory removed, `git status` clean, no database files anywhere in the repository.

Pending checks that could not run here (recorded, not executed): verifying `migrate resolve --applied` and `migrate deploy` against a **disposable Turso instance** (needs remote access — future authorized mission); reading the prisma.io documentation pages behind the `pris.ly` links (network egress blocked).

---

## 12. Future aggregate-only data audit (design — not executed)

To run in a later authorized mission, read-only, against Turso, returning **counts only** — no row content, no names, no emails, no message bodies. Every query is aggregate by construction.

**A. NULLs in columns the canonical model wants required:**
```sql
SELECT COUNT(*) FROM "Cliente"   WHERE "tipo" IS NULL;
SELECT COUNT(*) FROM "Documento" WHERE "url" IS NULL;
SELECT COUNT(*) FROM "Factura"   WHERE "items" IS NULL;
SELECT COUNT(*) FROM "Factura"   WHERE "fechaEmision" IS NULL;
```
Expected: 0 or small; any non-zero blocks the §7 tightening until backfilled.

**B. Orphans for each of the 37 missing FKs** (pattern, one per relation; child-side count):
```sql
SELECT COUNT(*) FROM "Conversation" c
  LEFT JOIN "Workspace" w ON w."id" = c."workspaceId"
  WHERE c."workspaceId" IS NOT NULL AND w."id" IS NULL;
```
Expected: 0 for recent tables; non-zero likely where `SetNull` semantics were never enforced. Non-zero → per-relation owner repair decision (§8).

**C. Rows without workspace** (per nullable-`workspaceId` table, cf. F-WS-06):
```sql
SELECT COUNT(*) FROM "Tarea" WHERE "workspaceId" IS NULL;  -- repeat per table
```

**D. InboxTodo ↔ WorkspaceTask linkage** (after the column exists):
```sql
SELECT COUNT(*) FROM "InboxTodo" WHERE "workspaceTaskId" IS NULL;
SELECT COUNT(*) FROM "InboxTodo" t
  LEFT JOIN "WorkspaceTask" w ON w."id" = t."workspaceTaskId"
  WHERE t."workspaceTaskId" IS NOT NULL AND w."id" IS NULL;
```

**E. QR codes without workspace + derivability:**
```sql
SELECT COUNT(*) FROM "QRCode";                                   -- total
SELECT "module", COUNT(*) FROM "QRCode" GROUP BY "module";       -- derivation route per module
```
(Post-column: `WHERE "workspaceId" IS NULL` count; per-module joins to targets to count non-derivable rows.)

**F. Duplicate checks for every unique constraint the canonical schema declares** (pattern):
```sql
SELECT COUNT(*) FROM (
  SELECT "email" FROM "ClientAuth" GROUP BY "email" HAVING COUNT(*) > 1
);
```
Run for each declared unique (including composite ones like `WorkspaceMember(userId, workspaceId)`); expected 0 — Turso already enforces the deployed uniques, so this guards only constraints being *added*.

**G. DateTime convertibility** (SQLite stores TEXT/INTEGER; Postgres needs parseable values):
```sql
SELECT COUNT(*) FROM "Factura"
  WHERE "fechaEmision" IS NOT NULL AND datetime("fechaEmision") IS NULL;  -- repeat per DateTime column
```

**H. Boolean domain** (pattern, per Boolean column):
```sql
SELECT COUNT(*) FROM "Automatizacion" WHERE "activa" NOT IN (0, 1);
```

**I. JSON-as-String parseability** (SQLite `json_valid`; per JSON-serialized column — `Factura.items`, `ChannelConnection.config`, snapshot/metadata columns):
```sql
SELECT COUNT(*) FROM "Factura" WHERE "items" IS NOT NULL AND json_valid("items") = 0;
```

**J. Encrypted credentials that must survive Neon:**
```sql
SELECT COUNT(*) FROM "ChannelConnection" WHERE "credentials" IS NOT NULL;
SELECT COUNT(*) FROM "ChannelConnection"
  WHERE "credentials" IS NOT NULL AND length("credentials") < 65;  -- shorter than iv+tag ⇒ corrupt
```
These rows are opaque hex (AES-256-GCM, CORE-02B); the audit only proves count + minimum-length sanity. The Neon cutover plan must carry them byte-identical and decrypt-verify **in the target** with `CHANNEL_ENCRYPTION_KEY` before switching (CORE-00 §17 already requires this).

Execution rules for that future mission: read-only transaction; aggregates only; results recorded as counts in a versioned doc; any non-zero count becomes a named repair decision — no auto-repair.

---

## 13. CORE-03C-2 — ordered implementation plan (not executed)

Small commits, each independently checkable and revertable. C1–C5 are the approved-by-evidence core; C6+ carry owner gates.

| # | Commit | Files | Exact change | Checks | Risk | Rollback |
|---|---|---|---|---|---|---|
| C1 | `chore(evolution): remove stale migration transcript` | `migration.sql` (delete) | delete the root PowerShell error transcript (CORE-03B §15.10) | `npm test`, `git diff --stat` = 1 deletion | none — file is junk | `git revert` |
| C2 | `feat(db): schema corrections from CORE-03C decisions` | `prisma/schema.prisma` | remove ClientProject/ClientInvoice/ClientFile models + `Cliente` back-relations; add `User.googleId String? @unique` (deprecated doc comment); add `@@index([status])` on Workspace, `@@index([workspaceId, category])` on Conversation | `prisma validate` (temp config), `tsc`, `npm test`, `npm run build`; grep: no runtime refs to removed models (0 today) | low — removed models have zero refs; generated client shrinks | revert commit |
| C3 | `feat(db): introduce sqlite migration baseline (deployed state)` | `prisma/migrations/migration_lock.toml`, `prisma/migrations/0_baseline/migration.sql` | baseline = CORE-03B draft DDL verbatim; lockfile `provider = "sqlite"` | local: fresh DB from history == E1 counts; `migrate diff --from-migrations --to-config-datasource(local replica) --exit-code` = no diff | none to prod (repo-only) | delete dir |
| C4 | `feat(db): additive index migration` | `prisma/migrations/1_add_missing_indexes/` | the 23 missing indexes (§9) | build fresh DB from history; diff against schema shrinks by exactly those indexes | very low — additive | drop-index down-script documented |
| C5 | `feat(db): additive link columns` | `prisma/migrations/2_add_link_columns/` | nullable `InboxTodo.workspaceTaskId` + its index; nullable `QRCode.workspaceId` + its index; QR runtime write-path change (set workspaceId from context, refuse without) | history rebuild + targeted route tests | low — additive; QR route change behind tests | revert; columns are nullable and unused until backfill |
| C6 | `feat(db): create portal tables` **(owner gate: ForteSnapshot inclusion)** | `prisma/migrations/3_create_portal_tables/` | CREATE ClientAsset → ClientRequest → ClientRequestAsset (+indexes, FKs); ForteSnapshot only if §15-D1 approves | history rebuild; portal route tests with local DB | low — new empty tables | drop tables (empty) |
| C7 | `feat(db): relax turso-stricter columns` **(after §12-A run)** | `prisma/migrations/4_relax_notnull/` | staged rebuilds: Transaccion (descripcion, categoria), Notification (message) to nullable | history rebuild; `PRAGMA foreign_key_check`/`integrity_check` in harness | medium — first rebuild-class migration; staged one table per migration | restore from Turso rollback layer; rebuilds are transactional per table |
| C8 | `test(db): from-scratch harness + drift CI` | `scripts/build-db-from-history.ts` (new), CI job | harness builds an empty DB from `prisma/migrations`, then `migrate diff --from-config-datasource --to-schema --exit-code` proves history == canonical (modulo documented staged gaps); CI also regenerates the PG schema variant and fails on diff | the harness IS the check | none | remove job |
| C9 | `chore(db): retire imperative schema tooling` | `prisma/push-turso.ts`, `scripts/migrate-*.ts` (6), `scripts/checkTables.ts` | delete `push-turso.ts` (or reduce to a tombstone README pointing at migrations); delete applied one-shots (their DDL now lives in baseline/history); keep backfill scripts (data, not DDL) until their missions run | `npm test`, `rg` proves nothing imports them | low — none are npm scripts; manual-only today | revert |
| C10 | `docs(db): adoption + handoff runbook` | `docs/evolution/` new doc | runbook: verify-on-disposable-Turso plan for `resolve --applied 0_baseline` (the §10 UNVERIFIED capability), then production adoption steps; handoff contract to CORE-DB-01A (Neon): generate `migrations-postgres/0_init` from approved Layer 1, §12 audit as precondition, credentials decrypt-verify requirement | doc review | none | n/a |

Deliberately **excluded** from CORE-03C-2: any write to Turso (including `_prisma_migrations`), the four NOT NULL tightenings (§7 — need §12 + backfills), the 37-FK completion on SQLite (§8 — deferred to the Neon history + optional audited subset), all backfills, any Neon/provider change.

---

## 14. Risks and rollback

| Risk | Mitigation |
|---|---|
| Baseline adoption mechanism unproven on Turso (`resolve --applied` = UNVERIFIED PROVIDER CAPABILITY) | C10 runbook mandates rehearsal on a disposable Turso instance in an authorized mission before any production ledger write; until then Layer 3 is local/CI-only |
| Rebuild-class migrations (C7, future FK work) copy whole tables on SQLite | staged one-table-per-migration, §12 audit first, Turso snapshot/rollback retained, Postgres path preferred for FK completion |
| Cross-provider SQL contamination (E4b: the tool silently emits destructive scripts) | per-provider directories + lockfiles + CI regeneration/diff gates (§4, C8); humans never run cross-provider diffs by convention *and* CI would catch the artifacts |
| Removed models resurface (someone re-adds ClientProject et al.) | C2 removes them from the generated client — compile-time protection; §5 records the decision |
| `googleId` (or other deployed-only objects) silently dropped by a future generated migration | declared in schema (§6.I, §9) so diffs converge instead of destroy |
| Drift between schema and histories re-appears | C8 CI: history-built DB diffed against canonical schema with `--exit-code` on every push |
| Data-dependent steps (backfills, NOT NULL, FKs) run blind | hard-gated behind §12 aggregate audit + per-item owner decisions |
| Rollback of the whole program | Turso + Layer 2 baseline are never modified by CORE-03C-2; at any point the repo can be reverted commit-by-commit with production untouched |

---

## 15. Open owner decisions

Each with consequences and a recommendation; none is executed until decided.

- **D1 — ForteSnapshot placement.** *Question:* does Forte's per-workspace analysis memory belong in the main Sevenef DB? *If yes:* CANONICAL_ADD in C6; portal-independent; the runtime's persist/load stops failing. *If no / not yet:* model moves to DEFERRED_NOT_DEPLOYED (kept in schema but excluded from histories) or is relocated to an internal store — the Forte runtime keeps tolerating "no snapshot". *Recommendation:* include it in C6 (it is real Sevenef runtime code, workspace-scoped, tested), but the classification stays OWNER_DECISION_REQUIRED per your instruction until you rule.
- **D2 — Physical drop of ClientProject / ClientInvoice / ClientFile tables.** Model removal (C2) is evidence-backed; dropping the deployed tables destroys whatever rows they hold. *Recommendation:* keep tables until the §12 row counts are known; drop in a later mission if counts are 0 or data is confirmed obsolete.
- **D3 — FK completion on Turso.** Full 37-FK completion on SQLite = heavy rebuilds. *Recommendation:* complete FKs only in the Neon history; optionally an audited Inbox-table subset on Turso after §12-B.
- **D4 — `User.googleId` retirement.** Unused by runtime; declared for safety. *Recommendation:* confirm no external consumer, then schedule a drop mission; zero urgency.
- **D5 — `Factura.items` / `Documento.url` NULL repair values.** Backfill `'[]'` / quarantine broken documents need product sign-off (§7). *Recommendation:* as stated in §7 after §12-A counts.
- **D6 — Timing of production baseline adoption on Turso** (writing `_prisma_migrations`). *Recommendation:* only after C1–C8 are merged, the disposable-Turso rehearsal passes, and a maintenance window exists.
- **D7 — `prisma.config.ts` datasource correction.** Today it points at `file:./dev.db` (not Turso) — accidental protection worth making intentional. *Recommendation:* CORE-03C-2 keeps local-file for dev and documents that production deploys use an explicit, separate config/env — no credentials in the file.

---

## 16. Final recommendation

Adopt the four-layer source-of-truth architecture (§4) with the single hand-maintained canonical schema and generated, CI-verified provider variants; classify the 52 models as decided in §5; execute CORE-03C-2 exactly as sequenced in §13, whose only production-affecting steps are deferred behind the §12 aggregate audit, the disposable-Turso rehearsal, and the §15 owner decisions.

Nothing in this mission changed the schema, the configuration, any migration state, or any data. The single change is this document.

**READY FOR OWNER DECISION** — specifically §15 D1–D7; C1–C5 and C8 of §13 are recommended for approval as-is, since every input they need is already evidence-backed.
