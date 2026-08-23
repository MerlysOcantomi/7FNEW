# CORE-03C-M2 — Final Data / Legacy Decisions

- **Date:** 2026-08-20
- **Branch:** `7f-evolution` · starting SHA `5c3f804b4655e9e3edfcadde65d1b0f3cf3f5d23` (= CORE-03C-M1 closure; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`, 24 ahead / 0 behind)
- **Status:** **COMPLETE — decision and preparation record.** This mission converts the CORE-03C-M1 production evidence into closed owner decisions, migration rules, per-model repair plans and reproducible pre-migration gates. **It executes nothing**: zero writes to Turso, zero migrations applied, zero backfills, zero rows repaired, zero tables dropped, zero schema changes, zero ledger adoption. Every rule below is FUTURE EXECUTION.
- **Evidence basis:** `docs/evolution/CORE-03C-M1-DATA-LEGACY-AUDIT.md` §21 (2026-08-19 read-only production run). No remote query was re-executed in M2 — no material contradiction between the M1 evidence and the repository was found, so none was needed.

Labels: **FACT** (verified from the repository or the M1 production evidence), **INFERENCE** (reasoned from facts), **OWNER DECISION** (closed in this mission), **FUTURE EXECUTION** (rule prepared here, performed in a later gated mission).

---

## 1. Decision matrix

| ID | Problem | Production evidence (M1, 2026-08-19) | Owner decision | Migration rule | Pre-flight gate | Execution phase |
|---|---|---|---|---|---|---|
| **D2** | `ClientProject` / `ClientInvoice` / `ClientFile` dead legacy portal tables | 0 rows each; 0 code references (M1 §6, §21.3) | **APPROVED — retire** | remove from `schema.prisma` + exclude from Neon `0_init` + eventual `DROP TABLE`; **no data migration needed** | `COUNT(*) == 0` for each of the three, immediately before executing; any row → STOP | convergence mission (Stage 5 / Neon track); **not M2** |
| **D5** | Nullability tightenings: `Factura.items`, `Documento.url`, `Cliente.tipo`, `Factura.fechaEmision` | 0 violating rows in all four (M1 §21.4) | **APPROVED WITH MANDATORY RE-CHECK** | tighten exactly as decisions doc §7; **no invented values, no artificial backfill, no semantically false defaults** | full D5 gate (§8 below) re-run immediately before the migration; any new incompatible row → STOP | Stage 5 (Turso rebuild-class) or Neon `0_init`; **not M2** |
| **D3** | Multitenant repair: NULL `workspaceId` rows (8 tables) + FK orphans (3 relations) | M1 §21.8 | **POLICY APPROVED** (deterministic-only; no default workspace — prohibited) | classify every row `DETERMINISTIC` / `AMBIGUOUS` / `ORPHANED` / `LEGITIMATE_NULL` per the per-model plans in §5–§7; auto-repair only DETERMINISTIC | per-model pre-migration queries (§5–§7) re-run before each repair; recount integrity after | dedicated repair mission(s) post-M2; FK enforcement per decisions doc §8 (Neon-first) |
| **D6** | Adoption of migration history on Turso (incl. `2_add_link_columns`) | ledger absent; both link columns absent (M1 §21.1, §21.6–21.7) | **REHEARSAL REQUIRED** (spec closed in §10) | rehearse on a disposable Turso/libSQL database per §10; production adoption only after the rehearsal passes and the owner schedules it | rehearsal report + re-run of `db:verify-history` + M1 gates | separate rehearsal mission, then production adoption window |
| **InboxTodo NO_MATCH** | 3 legacy rows with no `WorkspaceTask` counterpart | EXACT 0 / AMBIGUOUS 0 / NO_MATCH 3 (M1 §21.7) | **NO synthetic WorkspaceTask** (closed, §6.3) | preserve rows read-only in place until the InboxTodo retirement mission; archive before any drop; backfill is a no-op and is skipped | recompute EXACT/AMBIGUOUS/NO_MATCH before the retirement mission | InboxTodo retirement mission (post-adoption) |
| **QRCode** | `workspaceId` column absent; future backfill policy | 0 rows; column absent (M1 §21.6) | **DETERMINISTIC-ONLY backfill** (closed, §6.4) | DETERMINISTIC → assign; AMBIGUOUS / ORPHANED / UNKNOWN → STOP for review; **never a default workspace** | recompute derivability classes immediately before backfill; `COUNT(*) == 0` keeps it a structural no-op | post-adoption backfill step |
| **ChannelConnection orphans** | 5 `Conversation` + 25 `Message` rows point at deleted connections | M1 §21.8 | **SetNull convergence** (closed, §7.1) | `connectionId → NULL` where the target row is missing — this is exactly the declared-but-unenforced `onDelete: SetNull`; no tenancy invented | orphan recount == expected before repair; 0 orphans after; required before any FK on these relations | repair mission pre-FK (Neon cutover or audited Turso subset) |
| **Activity** | 21 NULL-workspace rows + 4 orphaned workspace refs | M1 §21.8 | **derive-by-parent rule + SetNull convergence** (closed, §7.2) | orphaned refs → NULL first (declared SetNull semantics); NULL rows → derive via `module`+`recordId` parent mapping; unresolvable → owner review, never invented | recount NULL/orphan; per-row classification report before any write | repair mission post-M2 |
| **Legacy nullable workspace rows** | `Cliente` 8 · `Proyecto` 10 · `Tarea` 4 · `Transaccion` 5 · `Factura` 1 · `Notification` 2 | M1 §21.8 | **per-model deterministic derivation, unanimity rule** (closed, §5) | derive from related rows; single unanimous candidate → DETERMINISTIC; conflict → AMBIGUOUS (stop); no candidates → owner review; `Notification` → LEGITIMATE_NULL | per-model queries in §5, re-run before repair | repair mission post-M2 |
| **User.workspaceId** | 14/14 rows NULL | M1 §21.8 | **LEGITIMATE_NULL — do NOT backfill** (closed, §4) | column is `@deprecated` in the schema; canonical membership = `WorkspaceMember`; future retirement mission drops the column (D4-style gated) | n/a (no repair); retirement mission gets its own audit | column retirement mission (post-M2, low urgency) |

Nothing in this table has been executed. **OWNER DECISION** rows are closed as decisions; every action column is **FUTURE EXECUTION**.

---

## 2. Sources of truth reviewed

`docs/evolution/CORE-03C-M1-DATA-LEGACY-AUDIT.md` (§21 production evidence), `docs/evolution/CORE-03C-CANONICAL-SCHEMA-DECISIONS.md` (D1–D7, §7 nullability matrix, §8 FK strategy, §12 audit design, §13 plan), `prisma/schema.prisma` (current model declarations), `prisma/migrations/` (`0_baseline` … `3_create_portal_tables`, `drift-manifest.json`), and the live consumer code verified file-by-file in this mission: `core/activity.ts`, `app/api/activity/route.ts`, `core/dashboard/recent-activity.ts`, `core/workspace-context.ts`, `core/workspace.ts`, `core/notifications.ts`, `modules/inbox/todo-service.ts`, `modules/inbox/inbox-tasks-write.ts`, `app/api/inbox/todos/route.ts`, `app/inbox/page.tsx` (call sites), `modules/inbox/transport/email-transport.ts`, `app/api/inbox/conversations/[id]/messages/route.ts`, `app/api/workspaces/[id]/connections/[connId]/route.ts`, `modules/inbox/email-inbound.ts` / `email-outbound.ts`, `modules/{clientes,proyectos,tareas,finanzas,facturacion}/service.ts`. Frozen decisions D1 and D7 were respected; nothing here reopens them.

---

## 3. The D3 classification policy (approved)

Every future repair of a missing/incorrect `workspaceId` (or any tenancy-bearing reference) must classify each affected row into exactly one of:

- **DETERMINISTIC** — the correct workspace is derivable **unambiguously** from an existing, verifiable relation (a reproducible SQL rule, not intuition). Only this class may be auto-repaired.
- **AMBIGUOUS** — two or more candidate workspaces exist. **NO AUTO-BACKFILL.** The row is recorded for explicit resolution.
- **ORPHANED** — the reference points at a nonexistent entity and no other deterministic relation can reconstruct it. **NO INVENTED RELATION.** Treatment (keep NULL / unlink / archive / delete as technical residue) is decided **per model**, never globally.
- **LEGITIMATE_NULL** — the canonical model semantically allows the entity to exist without a workspace. **Preserve NULL.** No column becomes NOT NULL for uniformity's sake.

Global prohibitions (owner-ratified): **no default/universal workspace ever receives ambiguous data**; no fuzzy/approximate matching; no fabricated relations; no repair without its pre-migration query re-run first.

FACT (schema): all 12 models involved declare `workspaceId String?` with `onDelete: SetNull` — NULL is *schema-legal* everywhere it occurs today. The reason to repair anyway is product reality (FACT, verified in every service): **all runtime reads filter by a mandatory `workspaceId`**, so NULL-workspace rows are invisible, unreachable "dark data". Repair restores legacy business data to the tenant that owns it; it is recovery, not tidying.

---

## 4. User.workspaceId vs WorkspaceMember (analysis closed)

- **FACT:** `prisma/schema.prisma` already declares `User.workspaceId` as `/// @deprecated Single-workspace pointer from before multi-tenancy. The canonical source of "which workspaces does this user belong to" is the memberships relation`.
- **FACT:** workspace resolution (`core/workspace-context.ts`) and every membership check (`core/workspace.ts` `checkMembership`, `requireRoleInWorkspace` family) read **only `WorkspaceMember`**. A repo-wide search found **zero runtime reads or writes** of `User.workspaceId` (the only hit is a doc comment in `core/system/users.ts`).
- **FACT (M1):** all 14 User rows have `workspaceId = NULL`, while `WorkspaceMember` holds 11 memberships — tenancy demonstrably lives in `WorkspaceMember`.
- **Classification: LEGITIMATE_NULL.** `User` is an auth-level entity; a user may belong to zero, one or many workspaces via memberships. `User.workspaceId` must **not** be backfilled — filling it would re-create the pre-multi-tenancy single-workspace assumption the architecture deliberately removed.
- **FUTURE EXECUTION:** retire the column (and its relation) in a dedicated audited migration, in the same gated family as `User.googleId` (decisions doc D4). Zero urgency; nullable and unread it is harmless.

---

## 5. Per-model repair plans — NULL `workspaceId` populations

Common template rules: candidate set = `DISTINCT` non-NULL `workspaceId` collected over the named deterministic sources; `|set| = 1` → DETERMINISTIC (assign that workspace); `|set| > 1` → AMBIGUOUS (record, stop); `|set| = 0` → no derivation (owner review per model). **Repairs are ordered parents-first** (Cliente → Proyecto → Tarea/Factura/Transaccion → Activity) so children can inherit freshly repaired parents in a second pass. All queries below are aggregate/read-only until the repair mission itself runs. EXECUTION: **NOT PERFORMED IN M2** — applies to every plan in §5–§7.

### 5.1 Cliente — 8 rows NULL

- CANONICAL EXPECTATION: every Cliente belongs to a workspace (root tenant entity; services always filter by it).
- DETERMINISTIC SOURCE CANDIDATES: child rows referencing the Cliente that carry a non-NULL workspace — `Proyecto.clienteId`, `Factura.clienteId`, `Tarea.clienteId`, `Transaccion.clienteId`, `Documento.clienteId`, `Contact.clienteId`, `Conversation.clienteId` (the last two are NOT NULL-workspace models, so any hit is decisive).
- SAFE REPAIR RULE: unanimity across all child sources → assign. Conflict → AMBIGUOUS. No children → owner review (likely abandoned/pre-tenancy test data; archive-or-delete is an owner call per row group — never auto-delete).
- PRE-MIGRATION QUERY (per NULL-workspace cliente, aggregate form):
  `SELECT COUNT(DISTINCT w) FROM (SELECT "workspaceId" w FROM "Proyecto" WHERE "clienteId" = :id AND "workspaceId" IS NOT NULL UNION SELECT "workspaceId" FROM "Factura" WHERE … /* repeat per source */)`
- POST-MIGRATION VALIDATION: `SELECT COUNT(*) FROM "Cliente" WHERE "workspaceId" IS NULL` equals exactly the recorded AMBIGUOUS + no-derivation remainder; integrity recount shows no new orphan workspace refs.

### 5.2 Proyecto — 10 rows NULL

- DETERMINISTIC SOURCES (in order): `clienteId → Cliente.workspaceId` (after 5.1); children `Tarea/Factura/Transaccion/Documento/Evento/Nota` referencing the proyecto. Unanimity rule across everything available.
- AMBIGUOUS / no-derivation: as template; a Proyecto with neither cliente nor children goes to owner review.
- PRE/POST queries: same pattern as 5.1 with the Proyecto sources.

### 5.3 Tarea — 4 rows NULL

- DETERMINISTIC SOURCES: `proyectoId → Proyecto.workspaceId`, `clienteId → Cliente.workspaceId` (both post-repair of parents). Unanimity between the two when both exist; conflict → AMBIGUOUS.
- No parents at all → owner review (legacy standalone task; candidate for archive with the eventual `Tarea → WorkspaceTask` convergence mission rather than repair here).

### 5.4 Transaccion — 5 rows NULL

- DETERMINISTIC SOURCES: `clienteId → Cliente.workspaceId`, `proyectoId → Proyecto.workspaceId`. Unanimity rule. Financial rows with no derivation are owner-review only — **never guessed** (money data must not change tenant on inference weaker than unanimity).

### 5.5 Factura — 1 row NULL

- DETERMINISTIC SOURCES: `clienteId → Cliente.workspaceId`, `proyectoId → Proyecto.workspaceId`. Same unanimity rule and same financial-data caution as 5.4.

### 5.6 Notification — 2 rows NULL

- FACT: notification delivery reads are **user-scoped, not workspace-scoped** (`core/notifications.ts` reads `where: { userId, read: false }`); `workspaceId` on Notification is contextual metadata.
- Classification: **LEGITIMATE_NULL.** The rows still reach their user; the canonical column stays nullable; no tightening is planned for it.
- OPTIONAL cosmetic repair (owner may skip entirely): derive via `userId → WorkspaceMember` **only when the user has exactly one membership**; anything else stays NULL. Not required for any planned constraint.

### 5.7 User — 14 rows NULL

See §4: **LEGITIMATE_NULL, no backfill, future column retirement.**

---

## 6. Per-model plans — link columns and legacy rows

### 6.1 Conversation / Message — no NULL-workspace problem

FACT: both declare `workspaceId String` NOT NULL and M1 found 0 violations; their issue is `connectionId` (§7.1). No workspace repair applies.

### 6.2 InboxTodo — workspace integrity clean

FACT (M1): 3 rows, 0 without workspace, 0 orphan workspace refs. No workspace repair applies. Linkage: §6.3.

### 6.3 InboxTodo NO_MATCH — OWNER DECISION (closed)

- FACT (M1 §21.7): the 3 production rows have **no** `WorkspaceTask(sourceType='inbox_todo')` counterpart: EXACT 0, AMBIGUOUS 0, NO_MATCH 3. The EXACT-only backfill would link nothing.
- **OWNER DECISION: NO synthetic WorkspaceTask.** Sevenef does not fabricate tasks, reconstruct fictitious history, or approximate-match. The backfill step is **skipped** as a no-op (re-verified by the gate in §8 before the retirement mission).
- Preservation strategy (evaluated against the real repo):
  - FACT: the operational read path already migrated — `GET /api/inbox/todos` serves `WorkspaceTask` via `listInboxScopedTasks`; the 3 legacy rows do **not** surface in the product. They are already effectively read-only historical evidence, workspace-scoped, harmless in place.
  - **Chosen strategy: keep the rows in place, untouched, until the InboxTodo model-retirement mission.** They cost nothing, contaminate nothing operational, and remain queryable for forensics via the model that still exists.
  - At the retirement mission: export/archive the rows (mechanism and destination = owner call at that mission — repo-versioned JSON evidence vs. external archive) **before** any `DROP`, then retire model + table per the convergence protocol. FUTURE EXECUTION.
  - Rejected options: synthetic/approximate task creation (prohibited); deleting the rows now (destroys evidence without owner sign-off); adding new read paths for them (contaminates the new model's surface).

### 6.4 QRCode — OWNER DECISION (closed)

- FACT (M1 §21.6): 0 rows; `workspaceId` column absent pending `2_add_link_columns`.
- **OWNER DECISION (policy ratified): deterministic-only backfill.** After adoption: `DETERMINISTIC` (target record exists with a unique non-NULL workspace, via the `module→{Cliente,Proyecto,Tarea,Factura,Documento}` mapping already implemented in `scripts/audit-core-03c-m1.ts`) → assign; `AMBIGUOUS` / `ORPHANED` / `UNKNOWN` → **STOP / review**; **never a default workspace**.
- INFERENCE: with 0 rows the column migration is structurally trivial and the backfill a no-op — *if* the pre-flight still shows 0 rows. The gate (§8) recomputes total + derivability classes immediately before adoption/backfill; any new row re-activates the full policy.
- FACT (unchanged from 2B): the three `/api/qr/*` routes are already workspace-safe for new rows (server-resolved workspace, hostile values ignored, regression-tested), so post-adoption rows are born scoped.

---

## 7. Per-model plans — orphaned references

### 7.1 Conversation.connectionId / Message.connectionId → ChannelConnection (5 + 25 orphans)

- SEMANTICS (FACT, from schema + code):
  - Both columns are declared `String?` with `onDelete: SetNull` — the canonical model **explicitly allows** a Conversation/Message without a connection.
  - Runtime survives NULL by design: types are `string | null` end-to-end; the email transport documents "Missing/foreign connections fall back to the env-level sender" (`modules/inbox/transport/email-transport.ts`); a dangling id behaves identically to NULL at lookup time (workspace-scoped `findFirst` → null → fallback).
  - Root cause of the orphans (FACT): `DELETE /api/workspaces/[id]/connections/[connId]` hard-deletes the `ChannelConnection` row, and production has **no enforced FK**, so the declared SetNull never fires — children keep dangling ids. The dangling id then **propagates**: the messages route copies `conversation.connectionId` onto every new outbound message.
- **POLICY (closed): SetNull convergence.** The repair sets `connectionId = NULL` exactly where the referenced connection no longer exists — this materializes the semantics the schema always declared. It is classified **DETERMINISTIC** (the target value is NULL by declared semantics; no tenancy or relation is invented). **No row is deleted**; conversations and messages are preserved with full history.
- Rejected: deleting orphaned conversations/messages (destroys inbox history; nothing requires it); re-pointing to another connection (fabricated relation — prohibited); leaving them dangling forever (blocks FK enforcement and keeps propagating dangling ids).
- PRE-MIGRATION QUERY: the M1 audit's own orphan counts (`fkOrphans` for these two relations) re-run immediately before repair; the repair `UPDATE`'s `WHERE` must be the exact anti-join used by the audit.
- POST-MIGRATION VALIDATION: both orphan counts == 0; total row counts unchanged; spot aggregate: `COUNT(*) WHERE connectionId IS NULL` increased by exactly the pre-counts.
- FUTURE EXECUTION note: once the real FK with `SetNull` exists (Neon `0_init`, or an owner-approved audited Turso subset per decisions doc §8), the delete path heals structurally and this class of drift cannot recur.

### 7.2 Activity — 21 NULL workspace + 4 orphaned workspace refs

- WHAT ACTIVITY IS (FACT): an audit-trail row `{module, recordId, type, userId?, userName?, userEmail?, data?, workspaceId?}`. Module values written by the runtime: `clientes`, `proyectos`, `tareas`, `facturacion`, `documentos` (CRUD routes) and `email` (`recordId = Conversation.id`, inbound/outbound email logging). Types: created/updated/deleted/status_change/assigned/… (`core/activity.ts`).
- ORIGIN OF THE BAD ROWS (FACT + INFERENCE): the current writer `logActivity` **throws without a workspaceId** — the guard exists today. The 21 NULL rows therefore predate the guard (legacy writer era). The 4 orphaned refs point at workspaces deleted after the rows were written; the declared `SetNull` never fired (same unenforced-FK cause as §7.1).
- VISIBILITY (FACT): every Activity reader (`/api/activity`, dashboard recent-activity) filters by the caller's `workspaceId` — NULL and orphaned rows are **invisible dark data**; no user-facing behavior depends on them.
- REPAIR RULE (closed):
  1. **Orphaned refs (4 rows): SetNull convergence first** — `workspaceId = NULL` where the workspace no longer exists (declared semantics, DETERMINISTIC in the §7.1 sense). They then join the NULL population.
  2. **NULL rows: derive via parent** — map `module → parent table` (`clientes→Cliente`, `proyectos→Proyecto`, `tareas→Tarea`, `facturacion→Factura`, `documentos→Documento`, `email→Conversation`) and resolve `recordId → parent.workspaceId`. Parent exists with non-NULL workspace → **DETERMINISTIC**, assign. Parent exists with NULL workspace → **defer** (re-run after §5 repairs the parent; parents-first ordering). Parent missing → **ORPHANED**.
  3. **ORPHANED activities:** audit metadata whose subject no longer exists. Recommended treatment: archive-then-delete as technical residue — but this is **OWNER DECISION REQUIRED at the repair mission**, presented with the per-module counts; M2 does not pre-decide deletion of any production row.
- PRE-MIGRATION QUERY: aggregate classification report (counts per module × {DETERMINISTIC, DEFERRED, ORPHANED}) produced read-only before any write; no PII in the report (counts only).
- POST-MIGRATION VALIDATION: NULL + orphan recount matches the recorded AMBIGUOUS/ORPHANED remainder; readers unaffected (they never saw these rows).

---

## 8. Pre-migration gates (reproducible; mandatory immediately before each future execution)

The gate runner is the existing read-only tooling: **`npm run db:audit-m1`** (aggregate JSON, guard-enforced SELECT/PRAGMA) plus the two §12-A supplementary counts (M1 §21.9). RECOMMENDATION (unchanged from M1): the executing mission folds those two counts into the audit tool first, so one command produces the entire gate. The 2026-08-19 numbers are **point-in-time evidence, never a substitute for the gate**.

| Gate | Condition (all must hold) | On violation |
|---|---|---|
| **D2** | `rowCounts.ClientProject == 0` · `ClientInvoice == 0` · `ClientFile == 0` | **STOP** — back to evaluation; the tables received data |
| **D5 — Factura.items** | `nulls == 0` · `empty == 0` · `whitespaceOnly == 0` · `invalidJson == 0` · `jsonNonArrays == 0` | **STOP** — no invented `'[]'`, no auto-repair of invalid JSON; owner re-decides |
| **D5 — Documento.url** | `nulls == 0` (and record `empty`/`whitespaceOnly` for owner if > 0) | **STOP** |
| **D5 — Cliente.tipo** | `COUNT(*) WHERE tipo IS NULL == 0` | **STOP** |
| **D5 — Factura.fechaEmision** | `COUNT(*) WHERE fechaEmision IS NULL == 0` · `COUNT(*) WHERE fechaEmision IS NOT NULL AND datetime(fechaEmision) IS NULL == 0` | **STOP** |
| **QRCode** | recompute `total` + derivability classes; proceed structurally if `total == 0`; else backfill only the `DETERMINISTIC` class; `AMBIGUOUS`/`ORPHANED`/`UNKNOWN` → review | **STOP** on any non-deterministic row reached by a write |
| **InboxTodo** | recompute `linked`/`EXACT`/`AMBIGUOUS`/`NO_MATCH`; backfill only `EXACT` (currently 0); `NO_MATCH` rows follow §6.3 | **STOP** on `AMBIGUOUS` |
| **Integrity** | recount `rowsWithoutWorkspace`, `rowsWithNonexistentWorkspace`, `fkOrphans`, `crossTenantMismatches`; any relation receiving a real FK must show **0 orphans** post-repair; cross-tenant must stay 0 | **STOP** — new drift means new evidence, new decision |
| **Universal** | gate runs in the same maintenance window as the migration it guards; results recorded (counts only) in the executing mission's doc | any unexplained delta vs. this record → STOP |

---

## 9. InboxTodo production HIGH — full determination (M2 closure of the analysis)

- **Affected code paths (FACT):**
  1. `modules/inbox/todo-service.ts:373-383` — `createTodo` dual-write: `tx.inboxTodo.create` → `tx.workspaceTask.create` → `tx.inboxTodo.update({ data: { workspaceTaskId } })`, one interactive `$transaction`.
  2. `modules/inbox/inbox-tasks-write.ts:274-277` — `resolveWorkspaceTaskId` legacy fallback: `db.inboxTodo.findFirst({ select: { workspaceTaskId: true } })`, reached only when a caller passes a legacy InboxTodo id that is not a WorkspaceTask id.
- **Trigger conditions (FACT):** path 1 runs on `POST /api/inbox/todos`, invoked from the Inbox UI (`app/inbox/page.tsx` — manual todo creation and suggestion-accept flows). Path 2 runs on status updates addressed by legacy id. The Fanny auto-task pipeline is unaffected (writes `WorkspaceTask` directly).
- **Error behavior (FACT + INFERENCE):** the referenced column does not exist on Turso, so the statement fails; the interactive transaction **rolls back atomically** — no partial InboxTodo/WorkspaceTask pair is ever persisted; the route returns a 500 via `handleError`. INFERENCE: consistent with the data — the newest InboxTodo row is 2026-05-04 and `WorkspaceTask` shows no `inbox_todo` rows.
- **Functional impact:** creating a todo from the Inbox UI fails in production. **Operation loss** (the user's create is rejected), **not data loss/corruption** (rollback is clean). Reads are unaffected (`GET` serves WorkspaceTask).
- **Fallback:** none on path 1. Path 2 degrades to `null` → 404 only when its first (canonical) branch already missed.
- **Unblocking migration (FACT):** `prisma/migrations/2_add_link_columns/migration.sql` — additive, nullable, index-only companions, no DML.
- **Minimum safe path (closed):** rehearse and adopt the migration history on Turso per §10 (D6) — ledger-adopt `0_baseline`, deploy `1_add_missing_indexes` + `2_add_link_columns` (+ `3_create_portal_tables`, which fixes the parallel portal/Forte outage in the same window). **Not an application hack:** `workspaceTaskId` is canonical architecture (decisions doc §6.D); removing it from the code to match the old schema would be regression, not convergence. The schema converges to the code, not the reverse.
- Urgency: **HIGH stands** — this is the strongest evidence-backed reason to schedule the D6 rehearsal promptly.

---

## 10. D6 — Turso adoption rehearsal specification (closed; execution is a separate mission)

Environment: a **disposable Turso/libSQL database** (or local libSQL server) that never shares credentials, URL or data with production. Production is untouched throughout.

1. **Snapshot/schema equivalence** — build the rehearsal DB to the exact deployed shape: execute `0_baseline`'s DDL (the verified CORE-03B capture, 48 tables / 61 indexes) directly; verify counts + `integrity_check` match the baseline record.
2. **History application** — prove the Prisma flow against libSQL: `prisma migrate resolve --applied 0_baseline` (the §10 UNVERIFIED PROVIDER CAPABILITY — this is the step that must be proven, including that Turso accepts the `_prisma_migrations` write and any PRAGMAs Prisma issues), then `prisma migrate deploy` for `1_add_missing_indexes`.
3. **`2_add_link_columns` adoption** — deploy it; verify both columns exist nullable/default-free and both dependent indexes exist; then deploy `3_create_portal_tables` and verify 52/93.
4. **Representative data compatibility** — seed synthetic rows mirroring production shapes *before* step 3 (InboxTodo rows without the column, Facturas with JSON items, Conversations/Messages with and without connections); verify the migrations neither touch nor invalidate them.
5. **Idempotency / ledger** — re-run `migrate deploy` (must be a no-op), `migrate status` (clean), and the repo's `db:verify-history` semantics against the rehearsal DB.
6. **Rollback/recovery** — document and exercise the recovery story: index drops are reversible in place; column drops are NOT casual on SQLite (rehearse the documented restore-from-snapshot path instead); record the exact procedure a failed production window would follow.
7. **Post-migration application behavior** — run the app (or targeted integration tests) against the rehearsal DB: inbox list/read paths, QR routes, portal request/asset routes, Forte snapshot store.
8. **InboxTodo create path specifically** — execute `createTodo` end-to-end against the rehearsal DB: the dual-write transaction must commit, the forward link must be populated, and `resolveWorkspaceTaskId`'s legacy branch must work.

Exit criteria: all eight steps green + written rehearsal report → the owner may then schedule the production adoption window (D6 timing), which re-runs the §8 gates first. Any step failing → adoption stays blocked; findings return to a decision round.

---

## 11. What M2 did not do

No migration applied to Turso; no backfill; no row repaired, deleted or archived; no table dropped; no model removed from `schema.prisma`; no ledger/`_prisma_migrations` created anywhere; no remote query executed (read-only or otherwise); no demo data; no code change; no merge to master; no UX/product change. The only repository changes are this document and the status annotations in the two existing evolution docs.

## 12. Next recommended mission

**CORE-03C-D6-REHEARSAL** — execute §10 on a disposable Turso/libSQL instance (unblocks the production HIGH and the QR/InboxTodo link columns). After a green rehearsal: the production adoption window (gates §8), then the repair missions (§5–§7) and the D2/D5 executions in their gated stages.

> **Status (2026-08-20): executed — PASS 8/8.** See `CORE-03C-D6-MIGRATION-REHEARSAL.md`. The production window remains a separate, owner-authorized mission.

> **Status (2026-08-22): production adoption executed — COMPLETE.** The §8 gates ran fresh in-window (all green, zero delta) and migrations 1–3 were adopted in production (52/93, Option A no-ledger). See `CORE-03C-D6-PRODUCTION-ADOPTION.md`. The repair missions (§5–§7) and the D2/D5 executions remain owner-gated and were NOT executed.

> **Status (2026-08-22, later): D3 deterministic repairs executed — COMPLETE.** 38 UPDATEs, 0 DELETEs: Activity orphan-ref SetNull (4) + derivation (4), Conversation/Message connection SetNull (5 + 25) — all fkOrphans now 0. The §5 NULL-workspace populations produced **zero** deterministic candidates (a self-contained pre-tenancy cluster with no non-NULL witness): 28 ORPHANED rows + 21 deferred Activities remain owner decisions. See `CORE-03C-D3-DETERMINISTIC-REPAIRS.md`. D2/D5 remain NOT executed.

> **Status (2026-08-22, later still): D5 schema tightenings executed — COMPLETE.** Fresh gates all green (zero incompatible rows), then `4_d5_schema_tightenings` applied atomically: Cliente.tipo / Documento.url / Factura.items / Factura.fechaEmision are NOT NULL in production (the two canonical defaults added), rows/values verbatim, 52/93 preserved, drift manifest 57→51. See `CORE-03C-D5-SCHEMA-TIGHTENINGS.md`. D2 remains NOT executed.

> **Status (2026-08-22, final): D2 legacy portal retirement executed — COMPLETE.** Fresh gate 0/0/0 rows + zero inbound dependencies + zero active runtime references, then `5_d2_retire_legacy_portal_tables` dropped ClientProject/ClientInvoice/ClientFile atomically: production is 49/93, canonical portal tables intact, remaining rows intact, Option A held. See `CORE-03C-D2-LEGACY-PORTAL-RETIREMENT.md`. The CORE-03C production sequence (D6 → D3 → D5 → D2) is closed; remaining owner decisions: D3 orphaned cluster, final Evolution validation, merge to master.
