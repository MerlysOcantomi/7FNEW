# CORE-03C-M1 — Read-Only Data & Legacy Audit

- **Date:** 2026-08-18
- **Branch:** `7f-evolution` · starting SHA `44fb8a8060a4015624ac1fa49ab4c617687f0b82` (= CORE-03C-2B closure)
- **Status:** **PARTIALLY COMPLETE — BLOCKED ON DATA ACCESS.** The code-level half of the audit is complete (application dependencies, reader/writer paths, successor mapping). The production **row-level** half could not run: this execution environment has **no database credentials of any kind** (§4). A deterministic, fail-safe, read-only audit tool was built and tested so the row-level half is a single command the moment an authorized environment provides credentials.
- **NO DATA MUTATIONS PERFORMED.** Zero INSERT/UPDATE/DELETE/DDL against any real database; zero remote connections attempted (no credentials existed to attempt one); all executions used throwaway local SQLite files with synthetic data.

Labels used throughout: **FACT** (verified from repository or executed locally), **INFERENCE** (reasoned from facts), **RECOMMENDATION** (proposal for M2 — nothing implemented), **OWNER DECISION REQUIRED**, **EVIDENCE UNAVAILABLE**.

---

## 1. Executive summary

- The three D2 retirement candidates (`ClientProject`, `ClientInvoice`, `ClientFile`) have **zero references in the entire codebase outside `prisma/schema.prisma`** — no runtime, no scripts, no tests, no UI (FACT, §6). At code level they are dead; only their production **row counts** remain unknown (EVIDENCE UNAVAILABLE) and are exactly what blocks D2.
- The four legacy parallel concepts (`Usuario`, `Tarea`, `InboxTodo`, `InboxEntry`) are all **STILL_LIVE at code level**, each with active writer *and* reader paths (FACT, §8). "Legacy" does not mean dead anywhere in this repo.
- **High-priority discovery:** the current InboxTodo write path (`modules/inbox/todo-service.ts:374-383`) creates the InboxTodo **and** its WorkspaceTask **and links them via `workspaceTaskId` inside one transaction**. On the deployed production database that column does not exist yet, so **the whole transaction fails today** — creating inbox todos in production is structurally broken until migration `2_add_link_columns` is adopted (FACT; INFERENCE on production impact).
- A read-only audit tool (`scripts/audit-core-03c-m1.ts`, `npm run db:audit-m1`) now exists: guarded to SELECT/PRAGMA only, opens local files read-only, emits aggregate-only JSON (no row content, no PII, no secrets), degrades absent structures into explicit `TABLE_ABSENT`/`COLUMN_ABSENT` findings, and is proven byte-non-mutating by test (§5).
- No schema, migration, config or data change was made. `db:verify-history` still passes (52 tables / 93 indexes / drift 57 = manifest 57).

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
| Production Turso | TURSO_REMOTE | `core/db.ts`, scripts (env vars) | yes | **no credentials present**: `DATABASE_URL`, `TURSO_DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TURSO_AUTH_TOKEN` all unset; no `.env`/`.env.local` file exists here (presence checked by name only; no value read or printed) | **EVIDENCE UNAVAILABLE** |
| Neon / other remote | OTHER_REMOTE | not configured anywhere | — | none | n/a (out of scope) |

Credentials note (FACT): nothing to redact — no secret value was ever present in this environment. When the row-level audit runs, a Turso token would technically permit writes; the tool never issues one (guard, §5) and this must be recorded in that future run too.

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

**Provisional classification:** all three = **SAFE_TO_CONSIDER_RETIREMENT at code level; UNKNOWN at data level.** D2 remains **blocked** exactly as the frozen decision requires: it needs the row counts plus the owner's sign-off. RECOMMENDATION FOR M2: if counts come back 0 → retirement can proceed without data migration; if > 0 → inspect ages and decide export/preserve before any drop. Nothing retired now.

## 7. D5 evidence

### Factura.items

- **Consumers (FACT):** `modules/facturacion/service.ts` calls `JSON.parse(f.items)` on **every list and detail read** (L38, L48) — a NULL/invalid value crashes those reads; `createFactura` writes `JSON.stringify(items)` (L55); validation requires ≥1 item on create (`modules/facturacion/validation.ts:16`); `components/forms/factura-form.tsx` builds the array. Assumption made by code: `items` is always a parseable JSON array — **never NULL-checked**.
- **Deployed reality (FACT via CORE-03B):** the production column is **nullable with no default** (Prisma declares it required) — drift entry `column-nullability:Factura.items`.
- **Row-level states (EVIDENCE UNAVAILABLE):** the tool computes total/NULL/empty/whitespace/valid-vs-invalid JSON/array-vs-non-array/length stats (`d5FacturaItems`).
- **Repair categories (RECOMMENDATION FOR M2):** (a) NULL/empty → `'[]'` only with product sign-off (D5); (b) invalid JSON → quarantine list for manual review, never auto-repair; (c) valid non-array shapes → classify before deciding. Conversion risk: SQLite tightening = table rebuild; PostgreSQL `jsonb` cast needs 100 % parseability first. **No UPDATE performed; no default introduced.**

### Documento.url

- **Consumers (FACT):** validation requires a URL on create (`modules/documentos/validation.ts:6`, `z.string().url()`); `modules/documentos/service.ts` passes it through; UI renders it as a link/download target. Deployed column is nullable (drift `column-nullability:Documento.url`) while Prisma declares it required — legacy rows may be NULL and render broken documents.
- **Row-level states (EVIDENCE UNAVAILABLE):** the tool computes NULL/empty/whitespace/https/http/relative/blob-provider/other-shape counts + duplicate-URL groups (`d5DocumentoUrl`). No external fetching/crawling is performed by design.
- **RECOMMENDATION FOR M2:** NULL/empty rows are broken records → owner decides quarantine vs deletion vs re-upload; no fallback URL is ever invented (frozen rule).

## 8. Legacy parallel concepts (code-level FACT; row-level EVIDENCE UNAVAILABLE)

| Concept | Writers (create/update/delete call sites) | Readers | Successor | Liveness verdict |
|---|---|---|---|---|
| `Usuario` | 4 | 8 | `User` (correlated by email, deliberately no FK — AGENTS.md) | **STILL_LIVE** — `modules/usuarios/service.ts` CRUD + scope module |
| `Tarea` | 5 | 24 | `WorkspaceTask` (`sourceType='legacy_tarea'` mapping exists) | **STILL_LIVE** — 12 productive files incl. dashboards, calendar feed, Forte executor, portal dashboard |
| `InboxTodo` | 5 | 5 | `WorkspaceTask` (`sourceType='inbox_todo'`) | **STILL_LIVE** — and its only create path now **dual-writes** the WorkspaceTask and links `workspaceTaskId` in one transaction (`modules/inbox/todo-service.ts:374-383`) |
| `InboxEntry` | 6 | 6 | `Conversation` | **STILL_LIVE** — `app/api/inbox/route.ts`, convert flow, `modules/inbox/service.ts` |

Blocking dependencies for retirement (FACT): every one of the four has active reader/writer paths, so none can be retired on code evidence alone; each needs its own convergence mission (already the AGENTS.md rule). Fields without an obvious successor equivalent: `Usuario.rol/departamento/estado` (workspace-less HR-ish fields); `InboxTodo` audit-trail fields are explicitly covered by `modules/tasks/inbox-todo-mapping.ts`.

## 9. QRCode.workspaceId audit

- **FACT:** column exists in the migration history (2B), nullable, no default; production adoption pending. Runtime now write-path-safe (POST stores the server-resolved workspace; hostile client values proven ignored by tests).
- **Derivability design (FACT, implemented in the tool):** UI writes `module` values `clientes|proyectos|tareas|facturacion|documentos` (counted in components); the tool maps them to `Cliente|Proyecto|Tarea|Factura|Documento` and classifies unscoped rows: `DETERMINISTIC` (target row exists with a workspace), `AMBIGUOUS` (target exists but itself has no workspace), `ORPHANED` (no target row), `UNKNOWN` (unmapped module). Classification verified against seeded synthetic data.
- **Row-level counts: EVIDENCE UNAVAILABLE** (production). **No backfill performed; no constraint changed.** Future safe backfill needs: the production derivability counts + an owner rule for AMBIGUOUS/ORPHANED rows (never a default workspace).

## 10. InboxTodo.workspaceTaskId audit

- **FACT:** column exists in history (2B), nullable; production column absent until adoption. Mapping key confirmed in code: `WorkspaceTask(sourceType='inbox_todo', sourceId=InboxTodo.id, workspaceId=InboxTodo.workspaceId)`; `scripts/backfill-workspace-tasks.ts` (NOT executed) uses this linkage; `modules/inbox/inbox-tasks-write.ts` already follows the link when present.
- **HIGH finding (FACT + INFERENCE):** the only InboxTodo create path links todo→task transactionally and **fails on production today** (column absent). Production impact: new inbox todos cannot be created until `2_add_link_columns` is adopted — raises the urgency of the (separately authorized) migration adoption.
- **Mapping classes (tool-implemented, verified on synthetic data):** linked / `EXACT` (exactly 1 candidate task) / `AMBIGUOUS` (>1) / `NO_MATCH` (0). Production counts: **EVIDENCE UNAVAILABLE.** **No mapping was written.**

## 11. Multitenant integrity findings

- **Tool coverage (FACT):** for every table with a `workspaceId` column: NULL-workspace counts and nonexistent-workspace counts; for all 39 manifest-derived missing-FK relations: orphan counts; for relations where both sides carry `workspaceId`: cross-tenant mismatch counts. All verified against seeded orphans/mismatches.
- **Production counts: EVIDENCE UNAVAILABLE.** Known structural facts meanwhile (CORE-03B): 37 FK relations unenforced in production; 17+ models have nullable `workspaceId` (F-WS-06) — orphan accumulation is expected, not hypothetical.

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

## 13. Application dependency matrix

See §6–§10: D2 trio → zero dependencies; `Factura.items` → facturacion service/form (JSON.parse, no NULL handling); `Documento.url` → documentos validation/UI; quartet → active writers/readers enumerated; QR routes → workspace-guarded; todo-service → transactional dual-write (prod-breaking pre-adoption).

## 14. Data quality findings

Structural (FACT, from source of truth): 3 production columns stricter than the model (write-failure paths), 4 weaker (possible NULLs under required types — `Factura.items` NULLs would crash list/detail reads today), 37 unenforced FKs, unscoped production `QRCode`. Row-level quantification: pending credentials (§15).

## 15. Unknowns / unavailable evidence

**Everything row-level in production**, because no database credential exists in this execution environment: D2 counts; D5 content states; legacy row counts and recency; QR derivability counts; InboxTodo mapping counts; all integrity counts. **To obtain:** run `npm run db:audit-m1` in an environment where the owner provides `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (or a read-only replica URL, preferred). Estimated runtime: seconds; output: one JSON document of counts, safe to commit after review.

## 16. Risks

- Acting on D2/D5 without the row-level counts (mitigated: decisions remain blocked).
- Production inbox-todo creation is structurally broken pre-adoption (HIGH; surfaced to owner — adoption timing is D6/Stage 5, not M1's call).
- The remote (`libsql`) path of the audit tool is code-reviewed but untested against a live Turso (no credentials here); first authorized run should start with the row-count section and be supervised.

## 17. Decisions now enabled

- M2 can already **plan** D2 with the code-level half settled (zero dependencies): the only remaining input is row counts.
- The QR/InboxTodo backfill **designs** (classification rules) are fixed and testable; only production numbers are missing.
- Adoption urgency of `2_add_link_columns` is now evidence-backed (broken create path), strengthening the case for scheduling the Stage-5 rehearsal.

## 18. Decisions still blocked

D2 (needs counts + owner), D5 (needs content states + owner), D3 (needs orphan counts), backfill rules for AMBIGUOUS/ORPHANED QR rows and AMBIGUOUS/NO_MATCH todos (owner), D6 timing (needs rehearsal).

## 19. Recommended M2 inputs

1. The production run of `npm run db:audit-m1` (owner-authorized, read-only), committed as `CORE-03C-M1-PRODUCTION-COUNTS` evidence.
2. Owner rulings: D2 per-model, D5 repair values, QR/todo ambiguous-row policy.
3. Then M2 emits the repair/retirement plan; execution stays in later gated stages.

## 20. No-mutation statement

**NO DATA MUTATIONS PERFORMED.** No INSERT/UPDATE/DELETE/UPSERT/DDL against any real database; no remote connection was attempted (none was possible); no backfill, normalization, mapping, retirement, constraint, nullability, default, relation or schema change; `prisma/schema.prisma`, `prisma.config.ts`, all migrations, the baseline and the drift manifest are byte-identical to `44fb8a8`. The only repository changes are: this document, the read-only audit tool, its tests, and one npm script entry.
