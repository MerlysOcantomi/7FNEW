# 7F Evolution — Final Validation (Pre-Merge Release Gate)

- **Date:** 2026-08-22/23 (validation window)
- **Branch:** `7f-evolution` @ `93e09ac` (= `origin/7f-evolution`); `master` @ `312785f` (intact); **37 ahead / 0 behind**; working tree clean.
- **Verdict: READY FOR CHECKPOINT.** Blockers: **0**. This is NOT merge authorization — the agreed sequence remains FINAL VALIDATION → full clone/checkpoint → pre-merge check → merge.
- **Discipline:** production was touched with SELECT/PRAGMA only; nothing was repaired, applied or written; the only repository change of this mission is documentation (this file + two status pointers).

Labels: **FACT** unless noted. Aggregate counts only — no PII, no customer IDs, no secrets.

---

## 1. Commit range review (37 commits, `origin/master..origin/7f-evolution`)

Grouped: CORE-00 baseline audit (1) · CORE-01/02 security hardening (5: legacy user containment, error containment/identity, clean-container safety net, fail-open closures, blank-secret rejection) · CORE-03B schema audit + declarations (2) · CORE-03C canonical decisions/2A/2B (9: baseline, indexes, link columns, portal tables, drift verifier) · M1/M2 (4) · D6/D6B rehearsals (4) · D6 adoption, D3, D5, D2 (8: one pre-write + one completion commit each) · docs corrections/closures (4). **No WIP, no debug commits, no incomplete reverts, no foreign changes, no accidental generated artifacts.** One `chore` commit removes a stale transcript (legitimate). History is append-only; no rewrite needed or performed.

## 2. Diff vs master (83 files, +16714/−389)

By area: `app/api` (22 files — CORE-01/02 error-boundary and auth containment, adversarially tested), `docs/evolution` (13), `prisma/migrations` (8: history 0–5 + drift manifest), CORE-03C tooling under `scripts/` (appliers + rehearsals + audit + history verifier, all with zero-network guard tests), `core/auth`, `modules/usuarios|tareas`, `prisma/schema.prisma` (canonical, D2 models removed), `prisma/push-turso.ts` (legacy stanzas removed), `package.json` (scripts only), CI workflow. **Found none of:** temporary code, critical TODO/FIXME, hardcoded tokens, debug logging additions, production fixtures, test bypasses, accidental feature flags, dead code, unguarded destructive scripts. The rehearsal hostname constant in the D6B driver is a deliberate fail-closed pin (refuses production), not a defect.

## 3. Secret / artifact audit

Diff-wide scan for JWT-shaped strings, credentialed URLs, hardcoded Authorization/API keys: **only doc prose and test assertions with `user:pass` placeholders**. Env files: only `.env.example` (placeholders exclusively). No `.db`/`.sqlite`/dump/log artifacts in the diff or the working tree. Variable *names* (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `D6B_*`) appear by design; no value exists anywhere.

## 4. Migration history integrity + reproducibility

History `0_baseline → 1_add_missing_indexes → 2_add_link_columns → 3_create_portal_tables → 4_d5_schema_tightenings → 5_d2_retire_legacy_portal_tables`, correct order and names, 0–3 preserved historically (sha256-pinned in the appliers). `npm run db:verify-history` (real `prisma migrate deploy` into a throwaway local DB): **49 tables / 93 explicit indexes / integrity ok / fkViolations 0 / drift 51 = manifest 51** — the full history reproduces from empty.

## 5. Schema vs history vs manifest — drift accounting

Remaining 51 manifest entries, all documented and intentional: **41 foreign-key** (37 never-deployed FKs + the 4 `ConversationRead` FK-action entries) → `NEON_CUTOVER`; **3 column-nullability** (the §7 "relax" trio: `Transaccion.descripcion`, `Transaccion.categoria`, `Notification.message`) → Stage-5; **7 column-default** (informational, hand-written-DDL era) → `NEON_CUTOVER`. **Unexplained drift: 0.**

## 6. Production read-only verification (pinned host `7f-7frames.aws-eu-west-1.turso.io`; rehearsal host refused)

**Object-by-object structural comparison** between production and a freshly history-built local DB (tables, columns with type/nullability/default/PK, foreign keys, explicit indexes with uniqueness and column lists; column order excluded by the repo's own comparison semantics): **49 vs 49 tables, zero differences.** `production schema == expected deployed history`, not just 49/93 counts. This subsumes the named checks: D2 trio absent; canonical portal tables + ClientAuth present; `InboxTodo.workspaceTaskId` and `QRCode.workspaceId` present; D5 shapes effective (`Factura.items` NOT NULL, `Documento.url` NOT NULL, `Cliente.tipo` NOT NULL DEFAULT `'empresa'`, `Factura.fechaEmision` NOT NULL DEFAULT `CURRENT_TIMESTAMP`). Production `integrity_check` ok, `foreign_key_check` 0.

## 7. Data integrity final (fresh, read-only)

- D3-repaired relations: `fkOrphans` **{}** (Activity→Workspace, Conversation→ChannelConnection, Message→ChannelConnection all 0); `rowsWithNonexistentWorkspace` **{}**; **cross-tenant mismatches 0**.
- D5 gates hold: items 0 NULL / 0 invalid / 0 non-array; url 0 NULL; tipo 0 NULL; fechaEmision 0 NULL / 0 invalid.
- D2: legacy tables absent (audit reports `TABLE_ABSENT` by design).
- Remaining D3 debt (fresh counts, **exactly as documented**): Cliente 8, Proyecto 10, Tarea 4, Factura 1, Transaccion 5 NULL-workspace (the self-contained pre-tenancy cluster) + 21 deferred Activities + LEGITIMATE_NULL (Notification 2, User 14); InboxTodo 3 unlinked NO_MATCH. **Classification: NON-BLOCKING (ACCEPTED DEBT)** — every runtime reader filters by a mandatory `workspaceId` (M2 FACT, re-verified), so NULL-workspace rows are dark data reachable by **no** tenant; they cannot be exposed cross-tenant. They await owner identification/archival decisions.

## 8. Multitenancy final audit

No runtime read/write of `User.workspaceId` (only a doc comment; `WorkspaceMember` canonical via `core/workspace-context.ts`). No default-workspace fallback anywhere. Isolation suites pass (`test:isolation` 28/28; `test:usuarios`; workspace-governance). The one direct `findUnique` on a tenant model outside workspace scope (`app/api/cliente/perfil`) is the client-portal route where the **authenticated portal identity is the boundary** — it can only fetch the caller's own Cliente, PATCH restricted to an allowlist: safe by design. CORE-03C introduced no new tenancy surface (its app-code diff is the CORE-01/02 hardening, which tightened scoping). Findings: 0 BLOCKER, 0 new FOLLOW-UP beyond the accepted debt above.

## 9. Auth / public error boundary + CORE-03A lazy DB init

The CORE-01/02 protections are intact and covered by the suite (public API error identity, internal error containment, middleware fail-closed, AI-route authorization, DDL/backfill ban — all green inside the 1347). CORE-03A: `test:db` **10/10** — importing `core/db` (and transitively the inbox transport) with no DB variables works; first real access without a URL fails closed; no remote connection during tests. CI runs the entire suite with zero secrets, proving both properties on every push.

## 10. Test matrix / checks

`npm run typecheck` clean · `npm test` **1347/1347** (baseline exactly; growth over master explained by the CORE-03C tooling suites) · `npm run build` OK · `npm run db:verify-history` OK · `test:db` 10/10 · `test:isolation` 28/28 · lint: **0 errors**, 671 warnings — all preexisting app-code style (`no-explicit-any`, `no-console`); every new CORE-03C file lints clean · `git diff --check` clean.

## 11. CI

`.github/workflows/ci.yml`: npm ci → prisma generate → typecheck → lint → test → build; explicitly requires **no secrets**, touches **no database**, `permissions: contents: read`, no migrations/seeds/deploys. **All 24 CI runs on `7f-evolution` are green, including the run at `93e09ac`.**

## 12. push-turso.ts

Classification: **DEPRECATED TOOL** (superseded by the migration history; not wired to npm scripts; manual-only; requires env credentials). Post-D2 it can no longer recreate the retired trio (stanzas removed on this branch). Residual risk: if run manually it applies `CREATE TABLE IF NOT EXISTS`-era DDL outside migration discipline — recommend deleting it in a post-merge cleanup mission (`master`'s copy still carries the legacy stanzas until the merge lands). NON-BLOCKING.

## 13. Historical appliers (D6 / D3 / D5 / D2 + rehearsal drivers)

All remain fail-closed: pinned hostnames (production or rehearsal, mutually exclusive), mandatory `--target-production`/`--owner-authorized`, **no** `--force`/`--skip-gates`/`--drop-nonempty`/`--ignore-dependencies` (unknown flags abort — unit-tested), pinned migration sha256, no secrets. Their historical shape expectations (48/61, 52/93) make any post-D2 re-run stop correctly — deliberate; left untouched. None is invoked from CI, build, start or postinstall. A future D3 re-classification run will need a one-line shape update in its own mission.

## 14. Master → evolution compatibility (the live gap)

Today `master`'s runtime serves against the post-CORE-03C 49/93 database. Verified compatible: `master`'s canonical `prisma/schema.prisma` already declares the D5 shapes (that is *why* they were drift entries), so its generated client expects exactly what production now enforces; the two added link columns and four portal tables are invisible to code that doesn't query them; the retired trio exists in `master`'s client surface but **no runtime code queries it** (audited: the only reference is the manual push-turso script); `master`'s writers satisfy the D5 constraints (audited in the D5 window — the inbox Cliente auto-create is actually *safer* now thanks to the DB default). The merge changes: docs, migration history + verifier, CORE-03C tooling, the CORE-01/02 security fixes (already tested), schema/push-turso cleanup, test suites, CI. No DB assumption in the merge is ahead of or behind production.

## 15. Deployment compatibility

Build = `prisma generate && next build` — generation reads only the schema file; no migrate, no seed, no applier, no push-turso in any build/deploy/start path. Env var names unchanged (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`/`DATABASE_URL` fallback, `AUTH_SECRET`, `CHANNEL_ENCRYPTION_KEY`, per `.env.example`). **The deploy path cannot mutate the production schema automatically.** Post-merge, the first Vercel build regenerates the client without the retired models — compatible with the live 49/93 schema.

## 16. Product smoke (read-only / local)

Covered without production writes: auth + workspace resolution + isolation (suites), Cliente/Proyecto/Tarea/Factura/Conversation/Message/Activity reads (this window's read-only audits + the D2/D5 in-window app validations through the real generated client), portal canonical models queryable, inbox transport (suite), Finesse/Presence build + imports green (full build). No full product QA claimed.

## 17. Documentation consistency

The nine evolution docs carry dated HISTORICAL STATE with appended CURRENT STATE pointers; the M2 decisions doc chains every execution status (D6 → D3 → D5 → D2). One gap fixed in this mission: the canonical decisions doc now carries a final status pointer (49/93, history 0–5, executed missions, still-open endgame). No contradiction remains that describes production as 48/61 or 52/93 outside explicitly dated historical context; no evidence deleted.

## 18. Blocker matrix

| ID | Finding | Severity | Blocks checkpoint? | Required action |
|---|---|---|---|---|
| F1 | D3 legacy cluster (28 NULL-workspace rows + 21 deferred Activities) | ACCEPTED DEBT | No — dark data, unreachable by any tenant reader; cross-tenant 0 | Owner decision mission (identify / archive / retire) |
| F2 | LEGITIMATE_NULL populations (Notification 2, User 14) | ACCEPTED DEBT | No — closed M2 decisions; User column retirement is a future gated migration | Future column-retirement mission |
| F3 | 51 documented drift entries (FKs, relax trio, defaults) | ACCEPTED DEBT | No — 1:1 manifested, expiries assigned (Stage-5 / NEON_CUTOVER) | Stage-5 / Neon missions |
| F4 | `push-turso.ts` deprecated manual DDL tool (master copy still has legacy stanzas until merge) | MEDIUM | No — manual-only, credential-gated, no auto-run | Post-merge cleanup: delete the script |
| F5 | 671 preexisting lint warnings (style) | LOW | No — 0 errors; new files clean | Optional cleanup mission |
| F6 | Historical appliers pinned to historical shapes | LOW (deliberate) | No — fail-closed on re-run | Touch only inside their own future missions |
| F7 | InboxTodo legacy rows (3, unlinked) | ACCEPTED DEBT | No — closed M2 §6.3; invisible to the product read path | Model-retirement mission |

**BLOCKER count: 0.**

## 19. Verdict

**READY FOR CHECKPOINT.** All §34 gate items check: clean tree · 0 behind master · history 0–5 reproducible · production == expected schema (object-level) · unexplained drift 0 · cross-tenant 0 · D3 debt classified · tests/typecheck/build/verify-history green · 0 new lint errors · no secrets/artifacts · no runtime refs to retired models · deploy path safe · merge auto-runs nothing destructive · blockers 0.

Next step (separate mission, owner-gated): **PRE-MERGE FULL CHECKPOINT / CLONE**, then the pre-merge check, then `7f-evolution → master`.
