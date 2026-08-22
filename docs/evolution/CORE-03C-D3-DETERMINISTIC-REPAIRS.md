# CORE-03C-D3 — Deterministic Data Repairs

- **Date:** 2026-08-22 (single window, same day as the D6 production adoption)
- **Branch:** `7f-evolution` · started from SHA `d652444`; pre-write tooling committed as `0866cbe`; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`
- **Verdict:** **COMPLETE — every row classified DETERMINISTIC under the owner-ratified M2 policy was repaired (38 UPDATEs, 0 DELETEs) and validated.** COMPLETE does **not** mean all legacy data is clean: 28 ORPHANED rows and 21 deferred Activity rows remain, all requiring owner decisions (§7).
- **Scope discipline:** DML only. **No D5 tightening, no D2 retirement, no schema change, no migration, no ledger, no DELETE, no archive, no InboxTodo cleanup, no QRCode backfill, no default workspace, no fuzzy matching, no invented relation, no merge to `master`.**

Labels: **FACT**, **INFERENCE**. Aggregate counts only — no row content, no real IDs, no PII, no token appears in this document.

---

## 1. Target, backup, gate (FACT)

- **Target:** `7f-7frames.aws-eu-west-1.turso.io`, positively identified (same compile-time hostname pin as the D6 applier; the D6B rehearsal branch is refused by name). Post-D6 shape verified before every phase: **52 business tables / 93 explicit indexes**.
- **Backup:** fresh post-D6 logical dump (wire-level) → local SQLite outside the repo, `0600`: **52 tables · 476 rows · 0 restore mismatches**, freshness re-verified (0 live drift) immediately before the write window. Disposition: securely deleted at mission end after the post-audit (real data, ephemeral session storage; owner-side recovery remains Turso snapshot/PITR).
- **Owner authorization:** the pre-write gate (baseline, classification, exact planned writes) was delivered with zero production writes; the owner replied with the exact phrase `AUTORIZO CORE-03C-D3 DETERMINISTIC REPAIRS`; only then did `apply` run.

## 2. Tooling (committed `0866cbe`)

`scripts/apply-core-03c-d3-deterministic-repairs.ts` (npm: `db:repair-d3`): phases `classify | backup | verify-backup | apply | post-audit`; requires `--target-production` (+ `--owner-authorized` for `apply`); no `--force` / `--skip-gates` / `--repair-all` exists. `apply` re-classifies every row live, requires exact aggregate equality with the recorded gate plan, then executes per-row guarded `UPDATE`s (`WHERE … IS NULL` / the exact orphan anti-join) inside per-group transactions — an affected-count ≠ expected rolls the group back — with cross-tenant = 0 and row-total preservation enforced after every group. Classification and the full write sequence are unit-tested against a local SQLite fixture with zero network (6 tests).

## 3. Fresh D3 baseline (read-only, in-window) — zero delta vs M1/M2 (FACT)

NULL `workspaceId`: Activity 21 · Cliente 8 · Factura 1 · Notification 2 · Proyecto 10 · Tarea 4 · Transaccion 5 · User 14. FK orphans: `Activity.workspaceId→Workspace` 4 · `Conversation.connectionId→ChannelConnection` 5 · `Message.connectionId→ChannelConnection` 25. Cross-tenant mismatches: 0.

## 4. Row-by-row classification (M2 §5 unanimity rule, parents-first) — FACT

| Model | NULL/orphan | DETERMINISTIC | AMBIGUOUS | ORPHANED | LEGITIMATE_NULL | Rule / evidence |
|---|---|---|---|---|---|---|
| Cliente | 8 | 0 | 0 | **8** | — | witnesses = children with non-NULL ws across Proyecto/Factura/Tarea/Transaccion/Documento/Contact/Conversation; 4 rows have **zero children**, 4 only NULL-ws children → no witness anywhere (INFERENCE: one pre-tenancy cluster) |
| Proyecto | 10 | 0 | 0 | **10** | — | parent Cliente (incl. projected repairs) + children Tarea/Factura/Transaccion/Documento/Evento/Nota — no witness |
| Tarea | 4 | 0 | 0 | **4** | — | parents Proyecto/Cliente — no witness |
| Factura | 1 | 0 | 0 | **1** | — | parents Cliente/Proyecto — no witness (financial: never guessed) |
| Transaccion | 5 | 0 | 0 | **5** | — | parents Cliente/Proyecto — no witness (financial: never guessed) |
| Notification | 2 | 0 | — | — | **2** | delivery reads are user-scoped (`core/notifications.ts`, re-verified); M2 §5.6 closed |
| User | 14 | 0 | — | — | **14** | `WorkspaceMember` is canonical (`core/workspace-context.ts`, re-verified); M2 §4 closed — excluded from repair |
| Activity (pool 25 = 21 NULL + 4 orphan refs) | 25 | **4** | 21 (deferred) | 0 | — | orphan refs → SetNull first (M2 §7.2.1); then `module→parent` map (§7.2.2). The 4 DETERMINISTIC are exactly the 4 former orphan refs — their parents exist in valid workspaces. The 21 deferred have parents that exist but are themselves NULL-ws (the unrepairable cluster above) |
| Conversation | 5 orphan `connectionId` | **5** (SetNull) | — | — | — | M2 §7.1 SetNull convergence (declared `onDelete: SetNull`; transport fallback re-verified in `modules/inbox/transport/email-transport.ts`) |
| Message | 25 orphan `connectionId` | **25** (SetNull) | — | — | — | same rule |

Planned writes = classified deterministic repairs = **38 UPDATEs** (Activity SetNull 4 + Activity derive 4 + Conversation 5 + Message 25). Nothing else.

## 5. Execution (FACT)

Order: parent models (0 planned each, skipped) → Activity orphan SetNull (**4**, affected==expected) → Activity deterministic derivation (**4**, per-row guarded, cross-tenant 0) → Conversation connection SetNull (**5**) → Message connection SetNull (**25**, post-check 0 orphans remain). Live re-classification before the first write matched the gate plan exactly; checkpoint freshness drift 0. Global post-conditions: **row totals preserved in all 52 tables, cross-tenant 0, DELETE statements 0.**

## 6. Post-repair audit — BEFORE / AFTER / DELTA (FACT)

| Metric | BEFORE | AFTER | DELTA |
|---|---|---|---|
| `Activity.workspaceId` → nonexistent Workspace | 4 | **0** | −4 (SetNull convergence) |
| `Conversation.connectionId` orphans | 5 | **0** | −5 (SetNull) |
| `Message.connectionId` orphans | 25 | **0** | −25 (SetNull) |
| fkOrphans (all manifest relations) | 4 / 5 / 25 | **{} — all clean** | resolved |
| Activity NULL-workspace | 21 | 21 | net 0 (+4 converged orphan refs, −4 derived to their live parents' workspaces) |
| Cliente / Proyecto / Tarea / Factura / Transaccion NULL | 8/10/4/1/5 | 8/10/4/1/5 | 0 (no deterministic witness — untouched by policy) |
| Notification / User NULL | 2 / 14 | 2 / 14 | 0 (LEGITIMATE_NULL preserved) |
| Cross-tenant mismatches | 0 | **0** | 0 |
| Row totals (all 52 tables) | — | identical | **0** (UPDATE-only) |
| Schema | 52/93 | 52/93 | none (`db:verify-history` OK, drift 57 = manifest 57) |

**DETERMINISTIC REPAIRS COMPLETE ≠ ALL LEGACY DATA CLEAN** — see §7.

## 7. Remaining D3 debt (all owner-decision, deliberately untouched)

- **ORPHANED, no deterministic derivation (28 rows):** Cliente 8, Proyecto 10, Tarea 4, Factura 1, Transaccion 5 — a self-contained NULL-workspace cluster with no non-NULL witness anywhere (4 clientes have no children at all; 4 only NULL-ws children). Options per M2 (owner review): assign after human identification, archive, or retire. Never auto-repairable under the ratified policy.
- **Activity deferred (21 rows):** parents exist but belong to that same unrepaired cluster; they become DETERMINISTIC automatically (re-run `db:repair-d3 classify`) the moment the owner resolves the parents.
- **LEGITIMATE_NULL (16 rows):** Notification 2, User 14 — permanent by closed decision; User.workspaceId's future is column retirement (M2 §4), not backfill.

## 8. Application validation (read-only, real Prisma client on production) — FACT

Activity: 79 total = 58 workspace-scoped (**every one points at a live Workspace**) + 21 NULL; workspace-scoped reader query shapes work. Conversation: 16 rows now have `connectionId = NULL` (11 pre-existing + 5 converged), every non-NULL link points at a live ChannelConnection; Message: 56 NULL (31 + 25), all links valid; the email transport's documented fallback covers NULL connections (code re-verified; suite green). Untouchables intact: User 14 NULL, Notification 2 NULL, InboxTodo 3 unlinked.

## 9. Checks (FACT)

`npm run typecheck` clean · `npm test` **1335/1335 pass** (includes the 6 D3 fixture tests) · `npm run build` OK · `npm run db:verify-history` OK (52/93, drift 57 = manifest 57 — D3 changed no schema) · `git diff --check` clean.

## 10. Repository changes

`scripts/apply-core-03c-d3-deterministic-repairs.ts` + `.test.ts` + `db:repair-d3` npm script (commit `0866cbe`); this document plus a minimal status pointer in the M2 decisions doc. No migration touched, no `master` touch, no PR.

## 11. Exit

D3 deterministic repairs are COMPLETE. Next mission (owner-gated, not started): **CORE-03C-D5 · SCHEMA TIGHTENINGS** — with the note that FK enforcement for `Conversation/Message.connectionId` is now data-clean (0 orphans), while `Activity.workspaceId` FK-with-SetNull is data-clean too (0 nonexistent refs); the NULL-workspace cluster (§7) does not block any planned D5 tightening (none of the four D5 columns is involved).
