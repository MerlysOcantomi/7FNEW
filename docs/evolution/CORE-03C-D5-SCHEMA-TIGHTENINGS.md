# CORE-03C-D5 — Schema Tightenings

- **Date:** 2026-08-22 (single window, same day as D6 adoption and D3 repairs)
- **Branch:** `7f-evolution` · started from SHA `a895ce9`; pre-write tooling + migration committed as `00d1855`; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`
- **Verdict:** **COMPLETE — the four owner-approved D5 tightenings are live in production**, applied as one atomic batch, with every row and value preserved verbatim and the constraints proven active on the live database.
- **Scope discipline:** exactly the four approved columns. **No workspaceId NOT NULL, no D3 repair, no D2 retirement, no legacy cleanup, no new FK enforcement, no jsonb conversion, no merge to `master`.** Migrations `0_baseline`–`3_create_portal_tables` byte-intact.

Labels: **FACT**, **INFERENCE**. Aggregate counts only — no row content, no real IDs, no PII, no token.

---

## 1. Approval basis and gate rule

M2 closed D5 as **APPROVED WITH RECHECK** (canonical decisions doc §7): execute only if fresh in-window gates show zero incompatible rows; one incompatible row → STOP; no invented values, no fictitious backfill, no semantically false defaults. The two defaults added are the canonical `prisma/schema.prisma` declarations (`@default("empresa")`, `@default(now())`) — not inventions.

## 2. Before / after (deployed PRAGMA shapes, production) — FACT

| Column | CURRENT (pre-D5) | TARGET = POST-D5 (verified live) | Reason |
|---|---|---|---|
| `Factura.items` | TEXT · NULL · no default | **TEXT · NOT NULL · no default** | every read does `JSON.parse(f.items)` (`modules/facturacion/service.ts`) — a NULL row crashes list & detail |
| `Documento.url` | TEXT · NULL · no default | **TEXT · NOT NULL · no default** | validation requires a URL; a NULL url is a dead document |
| `Cliente.tipo` | TEXT · NULL · no default | **TEXT · NOT NULL · DEFAULT `'empresa'`** | canonical declaration; also closes the latent NULL-writer in the inbox auto-create path (§4) |
| `Factura.fechaEmision` | DATETIME · NULL · no default | **DATETIME · NOT NULL · DEFAULT `CURRENT_TIMESTAMP`** | canonical declaration; Prisma engine already supplies `now()` client-side — the DB default adds server-side safety |

Schema shape 52 business tables / 93 explicit indexes before **and** after (the rebuilds recreate equivalent structures).

## 3. Fresh D5 data gates (in-window, re-run again inside `apply` immediately before the DDL and again after) — ALL PASS, FACT

| Gate | Production result |
|---|---|
| `Factura.items` | 18 total: 0 NULL / 0 empty / 0 whitespace / 0 invalid JSON / 0 non-array (18 valid arrays, len 66–89) |
| `Documento.url` | 0 rows → 0 NULL (vacuously clean) |
| `Cliente.tipo` | 27 total, 0 NULL |
| `Factura.fechaEmision` | 0 NULL, 0 unparseable |

## 4. Writer audit — PASS (FACT, code-verified)

- `Factura.items`: create validates `z.array(...).min(1)` then `JSON.stringify`; update is partial and not nullable — no path writes NULL or non-array. Canonical representation stays TEXT JSON; the future Postgres/jsonb conversion is explicitly **outside** D5.
- `Factura.fechaEmision`: zod optional (never null); Prisma's engine injects `now()` when omitted; the new DB default is a second net.
- `Documento.url`: `z.string().url()` required on create; update partial, not nullable.
- `Cliente.tipo`: `createClienteSchema` enum-defaults `"empresa"`; the inbox auto-create (`modules/inbox/service.ts`) omits `tipo` — pre-D5 that wrote NULL (latent), post-D5 the DB default fills `'empresa'`. **D5 closes an active latent NULL-writer.**
- No serializer/parser depends on the previous nullable behavior; no importer writes these columns outside the audited paths.

## 5. Migration — `4_d5_schema_tightenings` (committed `00d1855`)

- **Mechanism:** SQLite/libSQL cannot ALTER an existing column's nullability, so the three affected tables are rebuilt with **Prisma's own SQLite redefine-table pattern** (`defer_foreign_keys` → `CREATE new` → `INSERT…SELECT` verbatim → `DROP` → `RENAME`). Everything except the four columns — column set/order, types, other defaults, PK, FK constraints (`Documento_*_fkey`, `Factura_*_fkey`), and `Factura_numero_key` — is preserved byte-for-byte from the deployed DDL (captured live pre-design). Cliente/Documento/Factura carry no triggers (verified).
- **History discipline:** migrations 0–3 untouched; sha256 of the new file pinned in the applier (`b7e8249a…9129ba`); `db:verify-history`'s `EXPECTED_MIGRATIONS` now lists 0–4; the drift manifest dropped the six entries D5 resolves (4× column-nullability + Cliente.tipo/Factura.fechaEmision column-defaults): **57 → 51 entries**.
- **Rehearsal (both PASS, before the owner gate):**
  1. *Empty-DB / real Prisma:* `prisma migrate deploy` over the full history 0–4 → 52/93, integrity ok, fkViolations 0, **drift 51 = manifest 51**.
  2. *Real-data:* the exact migration bytes applied to a copy of the fresh production checkpoint → state APPLIED, rows and value fingerprints verbatim, FKs + unique index preserved, NULL rejected on all four columns, valid writes work, both canonical defaults fill, second classification = APPLIED (no-op).

## 6. Tooling — fail-closed applier (`db:tighten-d5`)

`scripts/apply-core-03c-d5-tightenings.ts`: phases `status | gates | backup | verify-backup | rehearse | apply | negative-probe`; `--target-production` everywhere plus `--owner-authorized` for `apply`; no `--force`, no `--skip-gates`, no `--ignore-invalid-data`. `apply` refuses to run without: pinned checksum match, recorded rehearsal PASS **for those exact bytes**, restore-verified FRESH checkpoint, PENDING classification (PRAGMA shape; mixed → INCONSISTENT → STOP), and green gates — then executes the whole migration as **one atomic libSQL batch** and re-validates (shape, state, row counts, value fingerprints, FKs, unique index, gates). Guard behavior unit-tested with zero network (6 fixture tests).

## 7. Backup / recovery — FACT

Fresh post-D6/D3 logical dump → local SQLite outside the repo, `0600`: **52 tables · 476 rows · 0 restore mismatches**; freshness (0 live drift) verified immediately before the write. Disposition: securely deleted at mission end (real data, ephemeral session storage); owner-side recovery remains Turso snapshot/PITR. Never committed, never printed.

## 8. Owner authorization — FACT

The pre-write gate (current/target shapes, gates, writer audit, migration checksum + double rehearsal, planned delta) was delivered with zero D5 production writes; the owner replied with the exact phrase `AUTORIZO CORE-03C-D5 SCHEMA TIGHTENINGS`; only then did `apply` run.

## 9. Execution and validation — FACT

- Pre-DDL re-checks inside `apply`: checkpoint FRESH (0 drift), state PENDING, gates 4/4 PASS.
- **One atomic batch** applied the three rebuilds; post-validation: state **APPLIED**, shape **52/93**, all row counts identical to the checkpoint, value fingerprints identical (items lengths, JSON validity, fecha min/max, totals), FK clauses and `Factura_numero_key` present, gates 4/4 PASS again.
- Explicit PRAGMA introspection (not just migration success): the four columns at the exact target shapes of §2.
- **Negative constraint probe on production:** an INSERT with NULL `items` was rejected by the live constraint; `Factura` row count unchanged (18); nothing persisted. Fuller negative coverage (all four columns + valid-write + default-fill) ran on the real-data rehearsal copy. SQLite genuinely enforces NOT NULL; no CHECK-style JSON enforcement was added and none is claimed — JSON validity remains guarded by the writers and the recurring gates.

## 10. Row / data safety — FACT

0 rows lost, 0 rows fabricated, 0 business-data updates: every table's count identical to the checkpoint; aggregate value fingerprints of the three rebuilt tables identical before/after; post-D5 `db:audit-m1` shows row counts and integrity **unchanged** (D3 debt exactly as documented: NULL-workspace cluster 8/10/4/1/5 + Activity 21 + Notification 2 + User 14; fkOrphans {}; cross-tenant 0).

## 11. App validation — FACT (read-only, real Prisma client on production)

18/18 `Factura.items` parse as JSON arrays through the app client; 18/18 `fechaEmision` valid dates; `Cliente.tipo` 0 NULL of 27; `Documento` reader query OK (0 rows). Full suite green (create/update paths, serializers, JSON handling covered by the module tests). Not full product QA and not claimed as such.

## 12. Checks — FACT

`npm run typecheck` clean · `npm test` **1341/1341 pass** (1335 + 6 new D5 guard/fixture tests; the M1 audit fixture now builds its legacy scenario from migrations 0–3, since its deliberately dirty seed rows are exactly what D5 now forbids — scenario preserved, not weakened) · `npm run build` OK · `npm run db:verify-history` OK (52/93, integrity ok, **drift 51 = manifest 51**) · eslint clean on new/modified files · `git diff --check` clean.

## 13. Repository changes

`prisma/migrations/4_d5_schema_tightenings/migration.sql` (new; 0–3 untouched) · `scripts/apply-core-03c-d5-tightenings.ts` + `.test.ts` · `db:tighten-d5` npm script · `EXPECTED_MIGRATIONS` + manifest update (57→51) · M1-audit fixture scenario pin · this document · minimal status pointers in the M2 decisions doc. No `master` touch, no PR.

## 14. Exit

D5 is COMPLETE. Remaining owner-gated work, none of it started here: **CORE-03C-D2 · LEGACY PORTAL RETIREMENT** (next recommended), the D3 orphaned cluster decision (28 rows + 21 deferred Activities), and the Stage-5 relaxations / FK enforcement / Neon endgame.
