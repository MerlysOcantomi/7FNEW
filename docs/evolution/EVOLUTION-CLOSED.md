# 7F Evolution — CLOSED

## CURRENT STATE — 2026-08-23

- CORE-00 → CORE-03C complete.
- FINAL VALIDATION = READY (`FINAL-EVOLUTION-VALIDATION.md`).
- Durable pre-merge checkpoint created (kept outside the repository).
- `7f-evolution` merged to `master` by fast-forward.
- Merge SHA = `6e0ec76a2d35cddf7cbeca6ba63706c8c9112526`.
- CI on `master` = SUCCESS.
- Production DB = 49 business tables / 93 explicit indexes.
- Migration history = `0_baseline` → `5_d2_retire_legacy_portal_tables` (0–5).
- `master` and `7f-evolution` were identical immediately after the merge
  (divergence 0 / 0).
- Evolution cycle = **CLOSED**.

## Source of truth for schema deployment

The migration history `0`–`5` under `prisma/migrations/` plus the Prisma
migration workflow (validated in CI by `npm run db:verify-history` against
`prisma/migrations/drift-manifest.json`) are the current source of truth.

`prisma/push-turso.ts` — the deprecated manual DDL deploy runner — was audited
post-merge (zero runtime / npm-script / CI / build / start references) and
removed. Historical documents in this directory still reference it; those
references describe the past and are intentionally preserved. The historical
CORE-03C appliers and rehearsal tooling (`db:adopt-core03c`, `db:repair-d3`,
`db:tighten-d5`, `db:retire-d2`, `db:rehearse-d6`, `db:rehearse-d6b`) are kept
as fail-closed evidence/tooling; none of them run automatically.

## Known pending work (future — NOT blockers of the completed merge)

- D3 residual legacy cluster.
- InboxTodo legacy.
- `User.workspaceId` retirement.
- Stage-5 relaxations.
- FK enforcement.
- Neon/Postgres.
- Future platform architecture / Entitlements / Telemetry / Usage Meter.

None of these were started as part of the Evolution cycle; they are deliberate
future work.
