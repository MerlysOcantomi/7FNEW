# CORE-03C-M1 — Read-Only Data & Legacy Audit

- **Date:** 2026-08-18 (code-level run) · **2026-08-19 (production row-level run — §21)**
- **Branch:** `7f-evolution` · starting SHA `44fb8a8060a4015624ac1fa49ab4c617687f0b82` (= CORE-03C-2B closure) · production run at SHA `06a51cc7c18028239c8359d6fc219c270f2e5700`
- **Status:** **COMPLETE.** The code-level half (application dependencies, reader/writer paths, successor mapping) was completed on 2026-08-18. The production **row-level** half — blocked then for lack of credentials — was executed on **2026-08-19** against the real Turso database, strictly read-only, using the audit tool built for exactly this purpose (§5). Full production evidence in **§21**; sections §6–§11 carry inline pointers so the original EVIDENCE UNAVAILABLE record stays visible as history.
- **NO DATA MUTATIONS PERFORMED (both runs).** 2026-08-18: zero remote connections attempted (no credentials existed). 2026-08-19: the only remote statements issued were guard-verified single-statement `SELECT`/`PRAGMA`; post-run verification confirmed the deployed structure is byte-count-identical to the CORE-03B baseline (48 tables / 61 explicit indexes) and **no `_prisma_migrations` exists on Turso** (§21.1).

Labels used throughout: **FACT** (verified from repository or executed locally), **INFERENCE** (reasoned from facts), **RECOMMENDATION** (proposal for M2 — nothing implemented), **OWNER DECISION REQUIRED**, **EVIDENCE UNAVAILABLE**.

---

## 1. Executive summary

- The three D2 retirement candidates (`ClientProject`, `ClientInvoice`, `ClientFile`) have **zero references in the entire codebase outside `prisma/schema.prisma`** — no runtime, no scripts, no tests, no UI (FACT, §6). At code level they are dead; only their production **row counts** remain unknown (EVIDENCE UNAVAILABLE) and are exactly what blocks D2.
- The four legacy parallel concepts (`Usuario`, `Tarea`, `InboxTodo`, `InboxEntry`) are all **STILL_LIVE at code level**, each with active writer *and* reader paths (FACT, §8). "Legacy" does not mean dead anywhere in this repo.
- **High-priority discovery:** the current InboxTodo write path (`modules/inbox/todo-service.ts:374-383`) creates the InboxTodo **and** its WorkspaceTask **and links them via `workspaceTaskId` inside one transaction**. On the deployed production database that column does not exist yet, so **the whole transaction fails today** — creating inbox todos in production is structurally broken until migration `2_add_link_columns` is adopted (FACT; INFERENCE on production impact).
- A read-only audit tool (`scripts/audit-core-03c-m1.ts`, `npm run db:audit-m1`) now exists: guarded to SELECT/PRAGMA only, opens local files read-only, emits aggregate-only JSON (no row content, no PII, no secrets), degrades absent structures into explicit `TABLE_ABSENT`/`COLUMN_ABSENT` findings, and is proven byte-non-mutating by test (§5).
- No schema, migration, config or data change was made. `db:verify-history` still passes (52 tables / 93 indexes / drift 57 = manifest 57).
- **2026-08-19 production run (headlines — full detail in §21):** the D2 trio holds **0 rows each** (retirement needs no data migration — still owner-gated); `Factura.items` is **18/18 valid JSON arrays, 0 NULL** (the crash-on-read rows do not exist today); `Documento` and `QRCode` are **empty** (0 rows); `InboxTodo.workspaceTaskId` and `QRCode.workspaceId` are **confirmed absent on Turso** — the HIGH finding stands: InboxTodo creation is structurally broken in production; multitenant integrity: 8 tables carry NULL-workspace rows, `Activity` has 4 rows pointing at a nonexistent workspace, and 5 `Conversation` + 25 `Message` rows reference deleted `ChannelConnection`s; **zero cross-tenant mismatches**.

## 2. Scope

Exactly the M1 mission: evidence for D2 and D5, legacy concept liveness, the two 2B link columns, future constraint blockers, and multitenant integrity — observation and quantification only. Out of scope and untouched: any repair, backfill, mapping, retirement, constraint, ledger adoption, Neon work, or new architecture (no Business/Location/RLS concepts exist in the source of truth and none were introduced; a repo-wide search found no `businessId`/`locationId` anywhere).

## 3. Source of truth reviewed

`docs/evolution/CORE-03C-CANONICAL-SCHEMA-DECISIONS.md` (through commit `44fb8a8`), plus the CORE-03B audit/baseline it cites and the drift manifest (`prisma/migrations/drift-manifest.json`, 57 entries). Frozen decisions D1–D7 were respected verbatim; nothing here reopens them.

## 4. Datasources audited

| Datasource | Classification | Configured in | Real data? | Access here | Audited? |
|---|---|---|---|---|---|
| Throwaway SQLite built from `prisma/migrations` | LOCAL_DISPOSABLE | test/tooling temp dirs | synthetic only | read-write (test seeds), audit read-only | **yes** (tool verification) |
| Test databases of the existing suite | TEST | per-test `mkdtemp` | synthetic only | ephemeral | n/a |
| `prisma.config.ts` datasource `file:./dev.db` | LOCAL_PERSISTENT (declared) | `prisma.config.ts` (intentional, D7) | **file does not exist** in this environment | n/a | n/a — nothing to audit |
| Production Turso | TURSO_REMOTE | `core/db.ts`, scripts (env vars) | yes | 2026-08-18: **no credentials present** (`DATABASE_URL`, `TURSO_DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TURSO_AUTH_TOKEN` all unset; presence checked by name only; no value read or printed). 2026-08-19: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` **present** (by name only; `DATABASE_URL`/`DATABASE_AUTH_TOKEN` unset); URL scheme classified as `libsql://` without printing it | **yes — 2026-08-19, read-only (§21)** |
| Neon / other remote | OTHER_REMOTE | not configured anywhere | — | none | n/a (out of scope) |

Credentials note (FACT): nothing to redact — no secret value was ever present in this environment. When the row-level audit runs, a Turso token would technically permit writes; the tool never issues one (guard, §5) and this must be recorded in that future run too.

Credentials note for the 2026-08-19 run (FACT): the available token's capability was **not inspected** (decoding credentials is prohibited); it must be assumed to technically permit writes. No value, URL or token was read into any output, transcript or file; presence was checked strictly by variable name. The read-only property of the run rests on the guard (§5), re-verified before execution (tests 4/4 green), and on the post-run structural check (§21.1).

## 5. Safety / read-only proof

- `scripts/audit-core-03c-m1.ts` contains **no INSERT/UPDATE/DELETE/DDL**; every statement passes `assertReadOnlySql` (single-statement `SELECT`/`PRAGMA` only — tested against UPDATE/DELETE/INSERT/DROP/ALTER and statement-chaining attempts).
- Local files are opened `readOnly: true` (engine-level write rejection). Test proof: the SHA-256 of the database file is **identical before and after** a full audit run.
- Output is aggregate-only (counts, min/max timestamps, length stats); no row content, names, emails, URLs or payloads are emitted. The datasource is echoed as a kind label only — never a URL or token.
- With no datasource available the tool **exits 2 with an explicit message** ("Evidence must not be invented") — demonstrated in this run.
- Tests: `scripts/audit-core-03c-m1.test.ts` (4 tests) — guard rejection, seeded-truth correctness across every classification, byte-identity, absent-structure degradation, deterministic FK-target derivation from the drift manifest.

## 6. D2 evidence — ClientProject / ClientInvoice / ClientFile

**Code-level (FACT):** `rg` across `app core modules engines lib agents components hooks scripts prisma` (schema excluded): **0 references** for all three — no reads, writes, creates, updates, deletes, serialization, API exposure, UI, import/export, or tests. The live portal serves projects/invoices/files from `Proyecto`, `Factura` and `ClientAsset`/`Documento` (successors, verified route by route in CORE-03C-1 §5).

**Successor data equivalence (INFERENCE):** the successors are populated by the live flows; whether the *legacy tables* hold rows not represented in the successors is a **data** question.

**Row-level (EVIDENCE UNAVAILABLE):** totals, per-cliente distribution, timestamps, orphan `clienteId` refs — the tool computes all of these (`d2RetirementCandidates` section) but needs credentials.

> **Resolved 2026-08-19 (FACT, §21.3):** `ClientProject` = **0 rows**, `ClientInvoice` = **0 rows**, `ClientFile` = **0 rows** (0 distinct clientes, 0 orphan refs, no timestamps — the tables are empty).

**Provisional classification:** all three = **SAFE_TO_CONSIDER_RETIREMENT at code level; UNKNOWN at data level.** D2 remains **blocked** exactly as the frozen decision requires: it needs the row counts plus the owner's sign-off. RECOMMENDATION FOR M2: if counts come back 0 → retirement can proceed without data migration; if > 0 → inspect ages and decide export/preserve before any drop. Nothing retired now. *(2026-08-19: counts came back 0 for all three — the "retirement without data migration" branch of this recommendation now applies; the owner's D2 sign-off is still required and nothing was retired.)*

## 7. D5 evidence

### Factura.items

- **Consumers (FACT):** `modules/facturacion/service.ts` calls `JSON.parse(f.items)` on **every list and detail read** (L38, L48) — a NULL/invalid value crashes those reads; `createFactura` writes `JSON.stringify(items)` (L55); validation requires ≥1 item on create (`modules/facturacion/validation.ts:16`); `components/forms/factura-form.tsx` builds the array. Assumption made by code: `items` is always a parseable JSON array — **never NULL-checked**.
- **Deployed reality (FACT via CORE-03B):** the production column is **nullable with no default** (Prisma declares it required) — drift entry `column-nullability:Factura.items`.
- **Row-level states (EVIDENCE UNAVAILABLE):** the tool computes total/NULL/empty/whitespace/valid-vs-invalid JSON/array-vs-non-array/length stats (`d5FacturaItems`).
- > **Resolved 2026-08-19 (FACT, §21.4):** total **18**, NULL **0**, empty **0**, whitespace-only **0**, valid JSON **18**, invalid JSON **0**, JSON arrays **18**, non-arrays **0**, length min/max/avg **66/89/81**. INFERENCE: the crash-on-read NULL rows do not exist today, and 100 % of current values are parseable arrays (jsonb-convertible).
- **Repair categories (RECOMMENDATION FOR M2):** (a) NULL/empty → `'[]'` only with product sign-off (D5); (b) invalid JSON → quarantine list for manual review, never auto-repair; (c) valid non-array shapes → classify before deciding. Conversion risk: SQLite tightening = table rebuild; PostgreSQL `jsonb` cast needs 100 % parseability first. **No UPDATE performed; no default introduced.**

### Documento.url

- **Consumers (FACT):** validation requires a URL on create (`modules/documentos/validation.ts:6`, `z.string().url()`); `modules/documentos/service.ts` passes it through; UI renders it as a link/download target. Deployed column is nullable (drift `column-nullability:Documento.url`) while Prisma declares it required — legacy rows may be NULL and render broken documents.
- **Row-level states (EVIDENCE UNAVAILABLE):** the tool computes NULL/empty/whitespace/https/http/relative/blob-provider/other-shape counts + duplicate-URL groups (`d5DocumentoUrl`). No external fetching/crawling is performed by design.
- > **Resolved 2026-08-19 (FACT, §21.4):** `Documento` holds **0 rows** — every shape category is vacuously 0 and there are no broken records to repair today.
- **RECOMMENDATION FOR M2:** NULL/empty rows are broken records → owner decides quarantine vs deletion vs re-upload; no fallback URL is ever invented (frozen rule).

## 8. Legacy parallel concepts (code-level FACT; row-level EVIDENCE UNAVAILABLE)

| Concept | Writers (create/update/delete call sites) | Readers | Successor | Liveness verdict |
|---|---|---|---|---|
| `Usuario` | 4 | 8 | `User` (correlated by email, deliberately no FK — AGENTS.md) | **STILL_LIVE** — `modules/usuarios/service.ts` CRUD + scope module |
| `Tarea` | 5 | 24 | `WorkspaceTask` (`sourceType='legacy_tarea'` mapping exists) | **STILL_LIVE** — 12 productive files incl. dashboards, calendar feed, Forte executor, portal dashboard |
| `InboxTodo` | 5 | 5 | `WorkspaceTask` (`sourceType='inbox_todo'`) | **STILL_LIVE** — and its only create path now **dual-writes** the WorkspaceTask and links `workspaceTaskId` in one transaction (`modules/inbox/todo-service.ts:374-383`) |
| `InboxEntry` | 6 | 6 | `Conversation` | **STILL_LIVE** — `app/api/inbox/route.ts`, convert flow, `modules/inbox/service.ts` |

> **Resolved 2026-08-19 (FACT, §21.5):** `Usuario` = **2 rows** (created 2026-03 → 2026-05); `Tarea` = **15 rows** (2026-02 → 2026-07, **4 without workspace**); `InboxTodo` = **3 rows** (all created 2026-05-04 within ~2 minutes, 0 without workspace); `InboxEntry` = **0 rows**. INFERENCE: `Tarea` is the only one with recent production writes; `InboxTodo` has received nothing since 2026-05-04 (consistent with the broken create path, §10); `InboxEntry` retirement would need no data handling at today's contents.

Blocking dependencies for retirement (FACT): every one of the four has active reader/writer paths, so none can be retired on code evidence alone; each needs its own convergence mission (already the AGENTS.md rule). Fields without an obvious successor equivalent: `Usuario.rol/departamento/estado` (workspace-less HR-ish fields); `InboxTodo` audit-trail fields are explicitly covered by `modules/tasks/inbox-todo-mapping.ts`.

## 9. QRCode.workspaceId audit

- **FACT:** column exists in the migration history (2B), nullable, no default; production adoption pending. Runtime now write-path-safe (POST stores the server-resolved workspace; hostile client values proven ignored by tests).
- **Derivability design (FACT, implemented in the tool):** UI writes `module` values `clientes|proyectos|tareas|facturacion|documentos` (counted in components); the tool maps them to `Cliente|Proyecto|Tarea|Factura|Documento` and classifies unscoped rows: `DETERMINISTIC` (target row exists with a workspace), `AMBIGUOUS` (target exists but itself has no workspace), `ORPHANED` (no target row), `UNKNOWN` (unmapped module). Classification verified against seeded synthetic data.
- **Row-level counts: EVIDENCE UNAVAILABLE** (production). **No backfill performed; no constraint changed.** Future safe backfill needs: the production derivability counts + an owner rule for AMBIGUOUS/ORPHANED rows (never a default workspace).
- > **Resolved 2026-08-19 (FACT, §21.6):** `QRCode` = **0 rows**; the `workspaceId` column is **confirmed absent** on Turso (`PRAGMA table_info`). All derivability classes (DETERMINISTIC/AMBIGUOUS/ORPHANED/UNKNOWN) are 0 because there are no rows. INFERENCE: at today's contents the future backfill is a no-op and the AMBIGUOUS/ORPHANED owner rule has no cases to rule on (the rule is still required before any backfill runs, since rows can appear).

## 10. InboxTodo.workspaceTaskId audit

- **FACT:** column exists in history (2B), nullable; production column absent until adoption. Mapping key confirmed in code: `WorkspaceTask(sourceType='inbox_todo', sourceId=InboxTodo.id, workspaceId=InboxTodo.workspaceId)`; `scripts/backfill-workspace-tasks.ts` (NOT executed) uses this linkage; `modules/inbox/inbox-tasks-write.ts` already follows the link when present.
- **HIGH finding (FACT + INFERENCE):** the only InboxTodo create path links todo→task transactionally and **fails on production today** (column absent). Production impact: new inbox todos cannot be created until `2_add_link_columns` is adopted — raises the urgency of the (separately authorized) migration adoption.
- **Mapping classes (tool-implemented, verified on synthetic data):** linked / `EXACT` (exactly 1 candidate task) / `AMBIGUOUS` (>1) / `NO_MATCH` (0). Production counts: **EVIDENCE UNAVAILABLE.** **No mapping was written.**
- > **Resolved 2026-08-19 (FACT, §21.7):** the `workspaceTaskId` column is **confirmed absent** on Turso — the HIGH finding above is **revalidated against production structure**, and the transactional create path in `modules/inbox/todo-service.ts` (still present at SHA `06a51cc7`) therefore still fails in production. Mapping of the 3 existing rows: **EXACT 0, AMBIGUOUS 0, NO_MATCH 3** — no `WorkspaceTask(sourceType='inbox_todo')` counterpart exists for any of them, so the future backfill would link **nothing**; the 3 legacy rows have no successor tasks (OWNER DECISION REQUIRED in M2 on whether they get tasks created, stay unlinked, or are retired).

## 11. Multitenant integrity findings

- **Tool coverage (FACT):** for every table with a `workspaceId` column: NULL-workspace counts and nonexistent-workspace counts; for all 39 manifest-derived missing-FK relations: orphan counts; for relations where both sides carry `workspaceId`: cross-tenant mismatch counts. All verified against seeded orphans/mismatches.
- **Production counts: EVIDENCE UNAVAILABLE.** Known structural facts meanwhile (CORE-03B): 37 FK relations unenforced in production; 17+ models have nullable `workspaceId` (F-WS-06) — orphan accumulation is expected, not hypothetical.
- > **Resolved 2026-08-19 (FACT, §21.8):** NULL-workspace rows in 8 tables (`Activity` 21, `Cliente` 8, `Factura` 1, `Notification` 2, `Proyecto` 10, `Tarea` 4, `Transaccion` 5, `User` 14 — i.e. every User row); nonexistent-workspace rows: `Activity` **4**; FK orphans across all manifest-derived relations: `Activity.workspaceId → Workspace.id` **4**, `Conversation.connectionId → ChannelConnection.id` **5**, `Message.connectionId → ChannelConnection.id` **25**, **all other relations 0**; cross-tenant mismatches: **0**. The predicted orphan accumulation is real but narrowly concentrated in 3 relations.

## 12. Future constraint blockers (matrix)

| Target | Future change | Violating rows today | Deterministic repair? | Ambiguous rows | Destructive risk | Decision | Stage | Category |
|---|---|---|---|---|---|---|---|---|
| `Factura.items` | NOT NULL (+ future jsonb) | **unknown** (tool ready) | NULL→`'[]'` only with sign-off; invalid JSON never auto | invalid-JSON rows | crash-on-read today if NULL exists | D5 | M2→Stage 5 | DATA DRIFT + APPLICATION DEPENDENCY |
| `Documento.url` | NOT NULL | unknown | no — broken records need human decision | all NULL/empty | broken links | D5 | M2→Stage 5 | DATA DRIFT |
| `Cliente.tipo`, `Factura.fechaEmision` | NOT NULL + default | unknown | yes (`'empresa'` / `createdAt`) after counts | none expected | low | M2 confirm | Stage 5 | DATA DRIFT |
| 37 missing FKs | real FKs | unknown orphan counts (tool ready, manifest-driven) | per-relation owner rule | orphans | rebuild-class on SQLite | D3 | Neon history / audited subset | SCHEMA DRIFT + DATA DRIFT |
| `QRCode.workspaceId` | eventual NOT NULL | 100 % of legacy rows unscoped (column absent in prod) | partial (derivability classes) | AMBIGUOUS/ORPHANED classes | none if staged | backfill decision | post-adoption | DATA DRIFT + DECISION REQUIRED |
| `InboxTodo.workspaceTaskId` | enforced linkage | all prod rows unlinked (column absent) | `EXACT` class only | `AMBIGUOUS`/`NO_MATCH` | none if staged | backfill decision | post-adoption | DATA DRIFT + APPLICATION DEPENDENCY (create path broken in prod) |
| D2 trio | model removal + drop | unknown row counts | n/a | n/a | data loss if rows exist | **D2 (owner)** | M2 | LEGACY COMPATIBILITY + DECISION REQUIRED |
| Legacy quartet | convergence/retirement | live code paths (FACT) | n/a | n/a | product behavior | dedicated missions | post-M2 | APPLICATION DEPENDENCY |

**Matrix resolution — 2026-08-19 production counts (FACT, §21):** `Factura.items` NOT NULL → **0 violating rows**; `Documento.url` NOT NULL → **0 rows at all**; `Cliente.tipo` NULL → **0**; `Factura.fechaEmision` NULL → **0** (and 0 unparseable non-NULL values under SQLite `datetime()`); missing-FK orphans → **only 3 relations dirty** (`Activity.workspaceId` 4, `Conversation.connectionId` 5, `Message.connectionId` 25; the rest 0); `QRCode` → 0 rows, column absent; `InboxTodo.workspaceTaskId` → column absent, 3 rows all `NO_MATCH`; D2 trio → 0 rows. INFERENCE: none of the four §7 tightenings is data-blocked today; FK enforcement is data-blocked only on the 3 dirty relations pending an owner repair rule. These are point-in-time counts — every future constraint migration must re-check immediately before applying.

## 13. Application dependency matrix

See §6–§10: D2 trio → zero dependencies; `Factura.items` → facturacion service/form (JSON.parse, no NULL handling); `Documento.url` → documentos validation/UI; quartet → active writers/readers enumerated; QR routes → workspace-guarded; todo-service → transactional dual-write (prod-breaking pre-adoption).

## 14. Data quality findings

Structural (FACT, from source of truth): 3 production columns stricter than the model (write-failure paths), 4 weaker (possible NULLs under required types — `Factura.items` NULLs would crash list/detail reads today), 37 unenforced FKs, unscoped production `QRCode`. Row-level quantification: pending credentials (§15).

## 15. Unknowns / unavailable evidence

**Everything row-level in production**, because no database credential exists in this execution environment: D2 counts; D5 content states; legacy row counts and recency; QR derivability counts; InboxTodo mapping counts; all integrity counts. **To obtain:** run `npm run db:audit-m1` in an environment where the owner provides `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (or a read-only replica URL, preferred). Estimated runtime: seconds; output: one JSON document of counts, safe to commit after review.

> **Resolved 2026-08-19:** exactly that command ran against production Turso (§21). Remaining unknowns after the run: the token's precise permission level (not inspected — assumed write-capable, mitigated by the guard); whether any external consumer reads `User.googleId` (D4, unchanged); and all §18 owner decisions. No row-level M1 evidence remains unavailable.

## 16. Risks

- Acting on D2/D5 without the row-level counts (mitigated: decisions remain blocked).
- Production inbox-todo creation is structurally broken pre-adoption (HIGH; surfaced to owner — adoption timing is D6/Stage 5, not M1's call).
- The remote (`libsql`) path of the audit tool is code-reviewed but untested against a live Turso (no credentials here); first authorized run should start with the row-count section and be supervised. *(2026-08-19: the supervised run happened — the remote path worked first try, row counts were reviewed before the derived classifications, and the post-run structural check confirmed zero writes; this risk is closed.)*

## 17. Decisions now enabled

- M2 can already **plan** D2 with the code-level half settled (zero dependencies): the only remaining input is row counts.
- The QR/InboxTodo backfill **designs** (classification rules) are fixed and testable; only production numbers are missing.
- Adoption urgency of `2_add_link_columns` is now evidence-backed (broken create path), strengthening the case for scheduling the Stage-5 rehearsal.

**After the 2026-08-19 run, M1 additionally enables (all still owner-gated — these are inputs, not decisions):**

- **D2** now has its full evidence: 0 rows in all three tables + 0 code references → M2 can put the retirement decision to the owner with no data-migration prerequisite.
- **D5 / §7 tightenings** have zero violating rows today (`Factura.items`, `Documento.url`, `Cliente.tipo`, `Factura.fechaEmision`) → M2 can propose confirming the four tightenings with a re-check-before-apply rule instead of a repair backfill.
- **D3** now has real orphan counts: only 3 dirty relations → M2 can scope the FK conversation to `Activity.workspaceId` (4), `Conversation.connectionId` (5), `Message.connectionId` (25) and treat the remaining relations as clean.
- The `2_add_link_columns` adoption case is strengthened again: production **structurally confirms** both columns absent while the only InboxTodo create path requires one of them.

## 18. Decisions still blocked

D2 (needs counts + owner), D5 (needs content states + owner), D3 (needs orphan counts), backfill rules for AMBIGUOUS/ORPHANED QR rows and AMBIGUOUS/NO_MATCH todos (owner), D6 timing (needs rehearsal).

**Status after 2026-08-19:** the *evidence* inputs above are satisfied; what remains blocked is exclusively **OWNER DECISION REQUIRED** territory: D2 sign-off per model; D5 confirmation of the tightenings; D3 repair rule for the 3 dirty relations (re-parent / null out / delete) and the NULL-workspace rows in 8 tables; treatment of the 3 unlinked InboxTodo rows (`NO_MATCH`); D6 adoption timing (needs the disposable-Turso rehearsal, unchanged). No recommendation in this document has been converted into a decision.

**Status after 2026-08-20:** those owner decisions were closed in **CORE-03C-M2** — see `CORE-03C-M2-FINAL-DATA-LEGACY-DECISIONS.md` (decision matrix, per-model repair plans, pre-migration gates, D6 rehearsal spec). D6 execution itself remains gated on the rehearsal.

## 19. Recommended M2 inputs

1. The production run of `npm run db:audit-m1` (owner-authorized, read-only), committed as `CORE-03C-M1-PRODUCTION-COUNTS` evidence. *(Done 2026-08-19 — the evidence lives in §21 of this document.)*
2. Owner rulings: D2 per-model, D5 repair values, QR/todo ambiguous-row policy.
3. Then M2 emits the repair/retirement plan; execution stays in later gated stages.

## 20. No-mutation statement

**NO DATA MUTATIONS PERFORMED.** No INSERT/UPDATE/DELETE/UPSERT/DDL against any real database; no remote connection was attempted (none was possible); no backfill, normalization, mapping, retirement, constraint, nullability, default, relation or schema change; `prisma/schema.prisma`, `prisma.config.ts`, all migrations, the baseline and the drift manifest are byte-identical to `44fb8a8`. The only repository changes are: this document, the read-only audit tool, its tests, and one npm script entry.

**No-mutation statement for the 2026-08-19 production run:** every remote statement passed `assertReadOnlySql` (single-statement `SELECT`/`PRAGMA` only); no INSERT/UPDATE/DELETE/UPSERT/DDL, no `migrate deploy`/`resolve`/`db push`/`db pull`, no seed, no backfill, no PRAGMA that modifies state, no `_prisma_migrations` created, no migration applied, no schema or ledger change of any kind. Post-run read-only verification (§21.1) shows the deployed structure still exactly matches the CORE-03B baseline (48 tables / 61 explicit indexes) with no `_prisma_migrations` table. The only repository change from this closure run is this document.

## 21. Production row-level evidence — 2026-08-19 run (M1 closure)

### 21.1 Run metadata and read-only proof

| Item | Value |
|---|---|
| Date | 2026-08-19 |
| Branch / SHA | `7f-evolution` @ `06a51cc7c18028239c8359d6fc219c270f2e5700` (= `origin/7f-evolution`; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`; 23 ahead / 0 behind; working tree clean) |
| Datasource | **TURSO_REMOTE** — audit tool label `REMOTE_LIBSQL (credentials from environment, redacted)`; URL scheme classified `libsql://` without printing it |
| Command | `npm run db:audit-m1` (the mechanism built in §5, unmodified — no auditor bug was found, so no auditor change was made) |
| Credentials (presence by name only) | `TURSO_DATABASE_URL` present, `TURSO_AUTH_TOKEN` present; `DATABASE_URL` unset, `DATABASE_AUTH_TOKEN` unset. No value read, printed, decoded or copied anywhere. Token capability not inspected — assumed write-capable; the guard is the enforcement |
| Pre-run verification | guard + tests re-verified at this SHA: `scripts/audit-core-03c-m1.test.ts` **4/4 pass** (guard rejection incl. chaining, seeded-truth classifications, byte-identity, absent-structure degradation, FK-target derivation); `npm run db:verify-history` **OK** (52 tables / 93 indexes / integrity ok / drift 57 = manifest 57) |
| Supervision | row counts (§21.2) reviewed for plausibility before interpreting derived classifications, per the M1 execution rule |
| Post-run verification (read-only) | guarded `SELECT`s against `sqlite_schema`: **48 tables**, **61 explicit indexes** (exactly the CORE-03B deployed baseline), **`_prisma_migrations` absent** → no ledger created, no schema change, zero writes |
| Output hygiene | aggregate-only JSON: counts, min/max timestamps, length statistics, classification labels. No names, emails, phones, messages, invoice contents, URLs, client/workspace IDs, payloads, credentials or tokens |
| Supplementary queries | the three §12-A/§12-G aggregates the canonical decisions doc designs but the tool does not compute (`Cliente.tipo` NULLs, `Factura.fechaEmision` NULLs, `fechaEmision` datetime-parseability) were run as guarded single-statement `SELECT COUNT(*)` under the identical guard logic (§21.9) |

### 21.2 Row counts (FACT)

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| Workspace | 12 | | Conversation | 18 |
| WorkspaceMember | 11 | | Message | 74 |
| Vertical | 0 | | Factura | 18 |
| User | 14 | | Documento | 0 |
| Usuario | 2 | | QRCode | 0 |
| Cliente | 27 | | ClientAuth | 0 |
| Proyecto | 18 | | ClientProject | 0 |
| Tarea | 15 | | ClientInvoice | 0 |
| WorkspaceTask | 13 | | ClientFile | 0 |
| InboxTodo | 3 | | ClientAsset | TABLE_ABSENT |
| InboxEntry | 0 | | ClientRequest | TABLE_ABSENT |
| | | | ClientRequestAsset | TABLE_ABSENT |
| | | | ForteSnapshot | TABLE_ABSENT |

FACT: the four CANONICAL_ADD tables are still absent in production — the portal request/asset routes and Forte snapshot persistence remain structurally broken there (CORE-03B CRITICAL finding unchanged; migration `3_create_portal_tables` not adopted).

### 21.3 D2 — ClientProject / ClientInvoice / ClientFile (FACT)

All three: **total 0, distinct clientes 0, orphan `clienteId` refs 0, no timestamps** (empty tables). Combined with the zero-code-reference FACT (§6): retirement requires **no data migration**. RECOMMENDATION FOR M2: put per-model retirement (schema removal + Neon exclusion + eventual `DROP TABLE`) to the owner. **OWNER DECISION REQUIRED (D2)** — nothing retired in this mission.

### 21.4 D5 — Factura.items / Documento.url (FACT)

- `Factura.items`: total **18** · NULL **0** · empty **0** · whitespace-only **0** · valid JSON **18** · invalid JSON **0** · JSON arrays **18** · non-arrays **0** · length min/max/avg **66/89/81**. INFERENCE: no crash-on-read rows exist; 100 % jsonb-convertible today. RECOMMENDATION FOR M2: the NOT NULL tightening needs no repair backfill at current data — only a re-check immediately before the migration. OWNER DECISION REQUIRED (D5) to confirm.
- `Documento.url`: total **0** — all shape categories (NULL/empty/whitespace/https/http/relative/blob-provider/other) vacuously 0; duplicate-URL groups 0. Same recommendation/gate as above.
- Supplementary §12-A counts (FACT): `Cliente.tipo` NULL = **0**; `Factura.fechaEmision` NULL = **0**; `fechaEmision` values unparseable by SQLite `datetime()` = **0** (caveat: `datetime()` parseability is indicative for TEXT storage; the Neon cutover plan re-verifies representation, per §12-G).

### 21.5 Legacy quartet (FACT)

| Table | Rows | Oldest | Newest | Without workspace |
|---|---|---|---|---|
| Usuario | 2 | 2026-03-26 | 2026-05-03 | not workspace-scoped |
| Tarea | 15 | 2026-02-22 | 2026-07-19 | 4 |
| InboxTodo | 3 | 2026-05-04 | 2026-05-04 | 0 |
| InboxEntry | 0 | — | — | 0 |

INFERENCE: `Tarea` is the only legacy model with recent writes (July 2026); the three `InboxTodo` rows were created within ~2 minutes on 2026-05-04 and nothing since — consistent with the structurally broken create path (§21.7); `InboxEntry` is data-empty (its code paths remain live, §8 — retirement is still a convergence mission, just with zero rows to migrate today).

### 21.6 QRCode workspace derivability (FACT)

Total **0 rows**; `workspaceId` column **ABSENT** (confirmed via `PRAGMA table_info` — migration `2_add_link_columns` not adopted); with/without workspace and all per-module derivability classes (DETERMINISTIC / AMBIGUOUS / ORPHANED / UNKNOWN) are **0 by emptiness**. INFERENCE: the future backfill is currently a no-op. OWNER DECISION REQUIRED (unchanged, for future rows): the AMBIGUOUS/ORPHANED rule must still exist before any backfill runs.

### 21.7 InboxTodo ↔ WorkspaceTask mapping (FACT) — HIGH finding revalidated

- `workspaceTaskId` column **ABSENT** on Turso (confirmed via `PRAGMA table_info`); `linked` = COLUMN_ABSENT.
- Mapping of the 3 rows: **EXACT 0 · AMBIGUOUS 0 · NO_MATCH 3** — no `WorkspaceTask(sourceType='inbox_todo')` counterpart exists for any of them.
- Code at this SHA still creates InboxTodo + WorkspaceTask and writes `workspaceTaskId` inside one `$transaction` (`modules/inbox/todo-service.ts:373-381`).
- **HIGH (FACT + structural confirmation):** creating inbox todos in production still fails end-to-end until `2_add_link_columns` is adopted. The migration was **not** adopted here; the ledger was **not** touched; production was **not** repaired.
- OWNER DECISION REQUIRED: treatment of the 3 `NO_MATCH` rows (create tasks / leave unlinked / retire) — the `EXACT`-only backfill would link nothing.

### 21.8 Multitenant integrity (FACT)

- **Rows with NULL `workspaceId`:** `Activity` 21 · `Cliente` 8 · `Factura` 1 · `Notification` 2 · `Proyecto` 10 · `Tarea` 4 · `Transaccion` 5 · `User` 14 (all User rows; observation — `User` is auth-level and its workspace column is legacy-nullable). All other workspace-scoped tables: 0.
- **Rows pointing at a nonexistent workspace:** `Activity` **4**. All others: 0.
- **FK orphans (all manifest-derived relations checked):** `Activity.workspaceId → Workspace.id` **4** · `Conversation.connectionId → ChannelConnection.id` **5** · `Message.connectionId → ChannelConnection.id` **25**. **Every other relation: 0 orphans.**
- **Cross-tenant mismatches:** **0** across every relation where both sides carry `workspaceId`.

INFERENCE: integrity damage is real but narrow — concentrated in `Activity` (orphaned workspace refs) and in conversations/messages whose `ChannelConnection` was deleted (unenforced `SetNull`/`Cascade` semantics, exactly the F-WS-06/§8 prediction). OWNER DECISION REQUIRED (M2/D3): per-relation repair rule (re-parent / null out / delete) before any FK is enforced on those 3 relations; the clean relations are FK-ready data-wise.

### 21.9 Method note on supplementary queries

The three §21.4 supplementary aggregates were issued outside the audit tool (which was deliberately not modified) as single-statement `SELECT COUNT(*)` queries under a verbatim copy of `assertReadOnlySql`, against the same environment credentials, printing counts only. They implement §12-A/§12-G of `CORE-03C-CANONICAL-SCHEMA-DECISIONS.md` verbatim. RECOMMENDATION FOR M2: fold these three counts into the audit tool if M2 wants them re-runnable via `npm run db:audit-m1` alone.
