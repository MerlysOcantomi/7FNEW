# CORE-03C-D6 — Production Adoption

- **Date:** 2026-08-22 (single window: pre-flight, owner gate, adoption, post-audit)
- **Branch:** `7f-evolution` · started from SHA `b99cf2a` (= `origin/7f-evolution`, the D6B PASS commit); pre-write tooling committed as `cc68d44`; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`
- **Verdict:** **COMPLETE — migrations `1_add_missing_indexes`, `2_add_link_columns` and `3_create_portal_tables` are ADOPTED in Sevenef/7F production.** Final production schema: **52 business tables / 93 explicit indexes**, no ledger (Option A), every preexisting row intact, the InboxTodo production HIGH **STRUCTURALLY RESOLVED**.
- **Scope discipline:** `0_baseline` was never parsed or executed (the baseline already existed). **No D3 repair, no D2 drop, no D5 tightening, no backfill, no synthetic WorkspaceTask, no QRCode workspace default, no merge to `master`** — this window was additive schema adoption only.

Labels: **FACT**, **INFERENCE**. No token, JWT, URL-with-credentials, row content, PII or customer identifier appears in this document; every number is an aggregate count.

---

## 1. Production target — positive identity (FACT)

Read-only identification before anything else (SELECT/PRAGMA only):

| Check | Result |
|---|---|
| Hostname | `7f-7frames.aws-eu-west-1.turso.io` (`libsql://`, no embedded credentials, no query params) — **distinct from** the rehearsal branch `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io` |
| Credentials used | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (names only ever referenced; values never read into output). `D6B_*` variables absent from the environment |
| Schema baseline | **48 business tables · 61 explicit indexes · no `_prisma_migrations` · no `_sevenef_migrations` · no `_d6b_rehearsal_marker`** · `InboxTodo.workspaceTaskId` absent · `QRCode.workspaceId` absent · portal tables absent — the exact M1 §21.1 pre-adoption shape |
| Row-count identity | all 20 M1-audited tables matched M1 §21.2 **exactly** (Workspace 12, WorkspaceMember 11, User 14, Usuario 2, Cliente 27, Proyecto 18, Tarea 15, WorkspaceTask 13, InboxTodo 3, Conversation 18, Message 74, Factura 18, D2 trio 0, QRCode 0, Documento 0, InboxEntry 0, Vertical 0, ClientAuth 0) |

INFERENCE: hostname + ledger-free baseline + absent rehearsal marker + exact M1 row identity = the target is positively Sevenef/7F production, not the rehearsal branch and not any other database.

## 2. Tooling — fail-closed production applier (committed `cc68d44`)

`scripts/apply-core-03c-production-adoption.ts` (npm: `db:adopt-core03c`), deliberately separate from the D6B rehearsal driver (whose guard still refuses production, unchanged):

- Production hostname is a **compile-time pin**; the D6B rehearsal hostname is refused **by name**; every other host, plaintext `http`, embedded credentials and local files are refused. No env var can widen the pin.
- Every phase requires `--target-production`; `apply` additionally requires `--owner-authorized` (asserting the owner's exact gate phrase was received in-window). Unknown flags abort: **no `--force`, no `--skip-gates`, no `--ignore-drift` exists**.
- The three migration files are verified **byte-identical to the D6B rehearsal** via pinned sha256 on every phase.
- Applied-state is classified from **schema preconditions** (APPLIED / PENDING / INCONSISTENT; partial → hard stop). No ledger is ever created; `status` fails if one appears.
- `apply` refuses to run without a **restore-verified, fresh** local recovery checkpoint, re-runs the M2 §8 blocking gates immediately before the first write, and validates structure + per-table row counts after **each** migration.
- Guard behavior is unit-tested with zero network: `scripts/apply-core-03c-production-adoption.test.ts` (hostname pin incl. the rehearsal host, flag requirements, forbidden-switch rejection, checksum tamper detection, structural expectations).

## 3. Backup / recovery checkpoint (mission §8) — created and restore-verified (FACT)

- Mechanism: **logical dump** of production (schema DDL + every row, read over the wire) into a local SQLite file **outside the repo**, permissions `0600`, contents never printed.
- Captured the exact PRE-ADOPTION state: **48 tables · 61 explicit indexes · 476 rows**; restore verification on the local copy: structure equal, **0 row-count mismatches** per table; freshness verification against the live database immediately before the write window: **0 drift**.
- Owner-controlled recovery besides the local file: Turso's own platform snapshot/point-in-time capability on the production database, plus the still-existing `7f-d6b-rehearsal` branch (an owner-created copy seeded from the production baseline; see D6B §8.12).
- Disposition: the local checkpoint lived in session-local storage for the whole window and was securely deleted at mission end (it holds real data and the ephemeral session container cannot retain it safely; verification documented here, per mission §25). It was never committed, uploaded or included in any artifact.

## 4. Fresh M2 §8 gates (run in-window, aggregate-only) — ALL GREEN, zero delta vs M1/M2/D6B (FACT)

| Gate | Production result (2026-08-22) | Verdict |
|---|---|---|
| D2 trio | ClientProject/ClientInvoice/ClientFile = 0/0/0 | PASS |
| D5 Factura.items | 18 total: 0 null / 0 empty / 0 whitespace / 0 invalid JSON / 0 non-arrays | PASS |
| D5 Documento.url | 0 rows (0 NULL) | PASS |
| D5 Cliente.tipo | 0 NULL | PASS |
| D5 Factura.fechaEmision | 0 NULL · 0 unparseable | PASS |
| QRCode | total 0 → proceed structurally | PASS |
| InboxTodo | 3 rows: EXACT 0 / AMBIGUOUS 0 / NO_MATCH 3 (per M2 §6.3: stay NULL) | PASS |
| Integrity | identical to M1 §21.8, zero delta: NULL-workspace {Activity 21, Cliente 8, Factura 1, Notification 2, Proyecto 10, Tarea 4, Transaccion 5, User 14}; nonexistent-workspace Activity 4; fkOrphans 4/5/25 on the 3 known relations; cross-tenant 0 | PASS |

The gates were re-run **again inside `apply`**, immediately before the first write — same results.

## 5. Owner authorization (mission §13) — received (FACT)

The pre-write report (target identity, baseline, verified backup, PENDING×3 classification, gates, ledger Option A, planned writes, READY=YES) was delivered with **zero production writes executed**. The owner then supplied the exact required phrase:

> `AUTORIZO CORE-03C-D6 PRODUCTION ADOPTION`

Only after that phrase did the write window open.

## 6. Ledger decision (mission §12) — Option A confirmed and applied

Conditions re-verified in-window: migrations 1–3 are strictly additive; applied-state fully inferable from schema (the applier's parser refuses any non-additive statement shape); PENDING/APPLIED/INCONSISTENT classification is fail-closed; second-run idempotence holds; no rebuild-class migration participates. **No `_prisma_migrations`, no `_sevenef_migrations` was created** — post-adoption `status` verifies their absence.

## 7. Adoption — migrations applied and validated (FACT)

One atomic batch per migration, validated individually before proceeding:

| Step | Result |
|---|---|
| Pre-write state | PENDING / PENDING / PENDING (by schema preconditions); backup fresh (0 drift); gates green |
| `1_add_missing_indexes` | **48 / 82** — all 48 preexisting business-table row counts identical to the checkpoint capture |
| `2_add_link_columns` | **48 / 84** — `InboxTodo.workspaceTaskId` and `QRCode.workspaceId` both `TEXT · nullable · no default` (PRAGMA-verified); **all 3 legacy InboxTodo rows kept `workspaceTaskId = NULL`** (no synthetic WorkspaceTask); **0 QRCode rows gained a workspace** (0 exist); rows intact |
| `3_create_portal_tables` | **52 / 93** — ClientAsset, ClientRequest, ClientRequestAsset, ForteSnapshot created **empty**; rows intact |
| Post-adoption classification | APPLIED / APPLIED / APPLIED; re-running `apply` would skip everything (idempotent by preconditions); no ledger exists |

## 8. Final schema validation (mission §17) — FACT

Production: **52 business tables / 93 explicit indexes** = `npm run db:verify-history`: `tables=52 indexes=93 integrity=ok fkViolations=0 drift=57 manifest=57`. **actual production schema == expected migration history**; no unexplained drift.

## 9. Row safety (mission §18) — FACT

Post-adoption freshness check against the pre-adoption checkpoint: **0 row-count drift across all 48 preexisting business tables** (also enforced after each individual migration). The four new tables hold 0 rows. `existing row count delta = 0` — no incident.

## 10. InboxTodo HIGH (mission §19–§20) — STRUCTURALLY RESOLVED

Pre-adoption state of the HIGH: `createTodo()` writes `InboxTodo.workspaceTaskId` → column absent in production → transaction rollback / 500.

Post-adoption evidence (NO PERSISTENT PRODUCTION SMOKE DATA mode — no provable sandbox workspace exists in production, so nothing was persisted):

1. **Schema validation**: column exists, `TEXT · nullable · no default`, index `InboxTodo_workspaceId_workspaceTaskId_idx` present (in-window PRAGMA validation, §7).
2. **Application query**: the real generated Prisma client + libSQL adapter selected `workspaceTaskId` on production — 3 rows, 0 linked (counts only). The exact select the broken path needs now succeeds.
3. **No-partial-write proof**: a rollback-only dual-write probe with `d6prod-` synthetic ids was rejected by the enforced `Workspace` FK with **zero partial rows** (counts unchanged, probe ids absent) — a failing transactional write leaves nothing behind. A re-run with a real workspace id was declined by the session's permission layer, so per mission §19 the remaining write-path evidence is delegated to item 4.
4. **D6B E2E evidence**: the full `createTodo` dual-write (InboxTodo + mirror WorkspaceTask + link, atomic, no orphan/duplicate) plus injected-failure rollback ran on real Turso Cloud against a branch with this exact schema (D6B §8.8).

The 3 legacy NO_MATCH rows remain `workspaceTaskId = NULL` per M2 §6.3. **STRUCTURALLY RESOLVED ≠ full product QA** — no product-level QA was executed or is claimed.

## 11. Post-adoption audit (mission §21) — FACT

Full `npm run db:audit-m1` re-run post-adoption: every preexisting row count unchanged; portal tables present at 0 rows; `workspaceTaskIdColumnPresent=true, linked=0, NO_MATCH=3`; `workspaceIdColumnPresent=true, withWorkspaceId=0`; D2 trio 0/0/0; D5 gates unchanged; integrity block identical to M1 §21.8.

**PREEXISTING D3 DATA DEBT — UNCHANGED**: NULL-workspace rows in 8 tables, Activity 4 nonexistent-workspace refs, FK orphans 4/5/25, cross-tenant 0. This debt predates the adoption, was deliberately **not** repaired in this window, and belongs to a future D3 mission.

## 12. Checks (mission §23) — FACT

`npm run typecheck` clean · `npm test` **1329/1329 pass** (1322 D6B baseline + 7 new production-applier guard tests) · `npm run build` OK · `npm run db:verify-history` OK (52/93/integrity ok/drift 57 = manifest 57) · `git diff --check` clean.

## 13. Repository changes in this mission

- `scripts/apply-core-03c-production-adoption.ts` + `scripts/apply-core-03c-production-adoption.test.ts` + `db:adopt-core03c` npm script (commit `cc68d44`, pushed before the owner gate — tooling only, zero production writes).
- This document, plus minimal status pointers in the D6B and M2 documents.
- **No historical migration file was touched** (byte-identity enforced by pinned sha256 and re-verified by `db:verify-history`). No `master` touch, no PR, no merge, no new branch.

## 14. Exit — COMPLETE, and what happens next

Production adoption is COMPLETE. Nothing further starts automatically: **D3 deterministic repairs, D2 retirement, D5 tightenings, final Evolution validation, checkpoint/clone and the `7f-evolution` → `master` merge all remain separate owner-gated decisions.** The `7f-d6b-rehearsal` branch was not touched and its deletion stays an owner decision.
