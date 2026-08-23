# CORE-03C-D2 — Legacy Portal Retirement

- **Date:** 2026-08-22 (single window; the last CORE-03C production mission of the day after D6, D3 and D5)
- **Branch:** `7f-evolution` · started from SHA `7b9fc1e`; pre-write tooling + migration committed as `7d2651e`; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`
- **Verdict:** **COMPLETE — `ClientProject`, `ClientInvoice` and `ClientFile` are retired from production** (the only destructive migration of the family), applied as one atomic batch after the 0/0/0-row gate, with the canonical portal tables untouched and every remaining row intact.
- **Scope discipline:** exactly the three legacy tables. **ClientAsset, ClientRequest, ClientRequestAsset, ForteSnapshot and ClientAuth were verified present before AND after. No D3 repair, no D5 change, no DELETE of any row, no data migration, no merge to `master`.** Migrations 0–4 byte-intact (sha256-pinned).

Labels: **FACT**, **INFERENCE**. Aggregate counts only — no row content, no real IDs, no PII, no token.

---

## 1. Approval basis and the owner rule

M2 approved D2 retirement on production evidence (M1 §21.3: all three tables 0 rows, no functional references). The owner rule enforced by this mission: **`COUNT(*) == 0` in all three tables immediately before the DROP; one row anywhere → STOP.** The applier cannot DELETE, cannot export-and-drop, and aborts on any non-empty table by construction (proven by the fail-closed rehearsal, §6).

## 2. Runtime reference audit — 0 active references (FACT)

Every occurrence of the three names was classified on both audited trees:

| Tree | Occurrences | Classification |
|---|---|---|
| `7f-evolution` HEAD | `prisma/schema.prisma` (models — removed in this mission), `prisma/push-turso.ts` (legacy manual DDL pusher — the three `CREATE TABLE IF NOT EXISTS` stanzas removed so no tool can resurrect the tables), `scripts/audit-core-03c-m1.ts` (absence-tolerant audit tooling, reports `TABLE_ABSENT` by design), `scripts/audit-core-03c-m1.test.ts` (fixture, pinned to the 0–3 legacy history), `scripts/apply-core-03c-production-adoption.ts` (historical D6-window gate), docs + `0_baseline` (historical evidence, preserved) | **ACTIVE RUNTIME REFERENCES = 0** |
| `origin/master` | only `prisma/push-turso.ts` (manual script; not wired to npm scripts; never imported by app code; no API route, server action, cron or webhook touches the models) | **ACTIVE RUNTIME REFERENCES = 0** |
| Deployed SHA | the repo's delivery flow defines `master` = production; the `origin/master` audit therefore covers the deployed code. Deployment compatibility: dropping tables that no deployed code path queries cannot break the running app | compatible |

## 3. Prisma / DB dependency audit (FACT)

All three models are **leaves**: PK `id`, single outbound FK `clienteId → Cliente` (`onDelete: Cascade`), no unique constraints beyond the PK, **zero explicit indexes** (verified in the deployed `sqlite_schema`), no inbound relation from any model (`ClientInvoice` does not reference `ClientProject`), and no other table's deployed DDL mentions them. Drop order `ClientFile → ClientInvoice → ClientProject` (all leaves; order-independent, kept child-first by convention). Deliberately **no `IF EXISTS`** (a missing table must surface as INCONSISTENT, not be skipped) and **no CASCADE-equivalent** anywhere.

## 4. Fresh D2 gate (in-window; re-run again inside `apply` immediately before the DROP) — FACT

`ClientProject = 0 · ClientInvoice = 0 · ClientFile = 0` rows; inbound DDL references = 0; protected tables present 5/5. Production shape pre-D2 verified: 52 business tables / 93 explicit indexes.

## 5. Repository changes (commit `7d2651e`, pre-write)

- `prisma/schema.prisma`: the three models and Cliente's three relation fields removed (canonical `clientAuth`/`clientAssets`/`clientRequests` untouched); `npx prisma generate` + `npm run typecheck` clean — the application compiles without the models, proving zero runtime dependence.
- `prisma/migrations/5_d2_retire_legacy_portal_tables/migration.sql`: exactly the three `DROP TABLE` statements.
- `prisma/push-turso.ts`: the three legacy `CREATE TABLE IF NOT EXISTS` stanzas removed.
- `scripts/build-db-from-history.ts`: history 0–5, `EXPECTED_TABLES` 49 (indexes stay 93 — derived from the real `sqlite_schema`: the trio carried no explicit index). Drift manifest **unchanged at 51 entries** — no entry referenced the trio (history and canonical schema retire them together); `db:verify-history` green.
- `scripts/apply-core-03c-d2-legacy-portal-retirement.ts` + `.test.ts` + `db:retire-d2` npm script.
- M1-audit fixture: legacy scenario now built from migrations 0–3 (it seeds D2 rows the retirement forbids).

## 6. Tooling and rehearsals — FACT

`db:retire-d2` phases: `status | gates | backup | verify-backup | rehearse | rehearse-fail-closed | apply`; `--target-production` everywhere + `--owner-authorized` for `apply`; **no `--force`, `--skip-gates`, `--drop-nonempty`, `--ignore-dependencies`**. All six migration sha256 pinned (0–4 immutability + 5 as rehearsed). State by table presence + column shape: PENDING / APPLIED / INCONSISTENT (partial set or shape mismatch → STOP). `apply` additionally requires a recorded PASS of **both** rehearsals for the exact migration bytes:

1. **Success rehearsal** (production-data checkpoint copy): exactly 3 tables retired, shape 49/93, canon intact, remaining row counts intact, `integrity_check` ok, second run = APPLIED/no-op. History 0–5 independently reproduced by `db:verify-history` (real `prisma migrate deploy` on an empty DB).
2. **Fail-closed rehearsal** (checkpoint copy + one seeded synthetic row in `ClientProject`): the applier **STOPPED before any DROP** — tables still present, row still present, DDL executed = 0. The gate was not weakened to make the rehearsal pass.

## 7. Backup / recovery — FACT

Fresh post-D5 logical dump → local SQLite outside the repo, `0600`: **52 tables · 476 rows · 0 restore mismatches**, and the restored copy verified to carry **the three legacy tables with their original schema, column by column** — the recovery path if the retirement ever needed reversal (plus `0_baseline` preserves their DDL in history). Freshness re-verified (0 live drift) immediately before the write. Disposition: securely deleted at mission end; owner-side recovery remains Turso snapshot/PITR.

## 8. Owner authorization — FACT

The pre-write gate (fresh counts, reference audit, dependency audit, both rehearsals, expected delta) was delivered with zero D2 production writes; the owner replied with the exact phrase `AUTORIZO CORE-03C-D2 LEGACY PORTAL RETIREMENT`; only then did `apply` run.

## 9. Execution and post-validation — FACT

Pre-DDL re-checks inside `apply`: checkpoint FRESH (0 drift), state PENDING, gate green (0/0/0, inbound 0, canon 5/5); `decideDrop` re-classified and re-gated one final time. **One atomic batch** executed the three DROPs. Post-validation:

- `ClientProject` / `ClientInvoice` / `ClientFile`: **ABSENT**.
- `ClientAsset`, `ClientRequest`, `ClientRequestAsset`, `ForteSnapshot`, `ClientAuth`: **present** (live, and readable through the regenerated Prisma client).
- Shape **49 / 93** (no additional table retired; explicit index count unchanged, as derived); `PRAGMA integrity_check` = ok; `PRAGMA foreign_key_check` = 0 violations; state = APPLIED; second `apply` = "already applied — nothing to do" (live idempotence); `_prisma_migrations` / `_sevenef_migrations` still absent (Option A held).

## 10. Row safety — FACT

Business rows deleted: **0** (the tables were empty; the tool cannot DELETE). Every remaining table's row count identical to the checkpoint (Workspace 12 … Cliente 27, Conversation 18, Message 74, Factura 18, …). No unexplained delta.

## 11. App validation — FACT

Real generated client against production (read-only): canonical portal models all queryable (0 rows each), retired models absent from the client surface, core reads intact (Cliente 27, Conversation 18, Message 74, Factura 18) — no inbox/Finesse/Presence regression surface touched by the retirement. Full checks: `prisma generate` OK · typecheck clean · **tests 1347/1347** · build OK · `db:verify-history` OK (**49/93**, integrity ok, drift 51 = manifest 51) · `git diff --check` clean. Not full product QA and not claimed.

## 12. Post-audit — FACT

`db:audit-m1` post-retirement: the trio reports `TABLE_ABSENT` (by design), every other row count unchanged, integrity block identical (D3 debt untouched: NULL-workspace cluster 8/10/4/1/5 + Activity 21 + Notification 2 + User 14; fkOrphans {}; cross-tenant 0). Not all portal legacy is claimed eliminated — only these three tables were in D2 scope; other legacy models (e.g. the InboxTodo retirement path, `User.workspaceId` column) remain separate gated missions.

## 13. Exit

D2 is COMPLETE. CORE-03C's production sequence (D6 adoption → D3 deterministic repairs → D5 tightenings → D2 retirement) is closed. Next recommended step, owner-gated and NOT started here: **7F EVOLUTION — FINAL VALIDATION** (and afterwards the owner's decisions on the D3 orphaned cluster, checkpoint/clone, and the `7f-evolution` → `master` merge).
