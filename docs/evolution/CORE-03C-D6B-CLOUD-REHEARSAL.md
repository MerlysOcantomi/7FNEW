# CORE-03C-D6B — Turso Cloud Branch Migration Rehearsal

- **Date:** 2026-08-20
- **Branch:** `7f-evolution` · starting SHA `1a9e1c416d689aac8bbd8470f617364c8cec3afc` (= CORE-03C-D6 closure; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`)
- **Verdict:** **BLOCKED — no Turso platform capability exists in this execution environment, and the environment's egress policy blocks the Turso Platform API.** No cloud branch could be created; per the mission's rules, production was **not** used as a substitute and no rehearsal was faked. The local D6 result (PASS 8/8, `CORE-03C-D6-MIGRATION-REHEARSAL.md`) stands as the only migration-adoption evidence so far; the cloud-specific validation remains pending.
- **Production zero-write:** zero connections to the production database in this mission (not even read-only). The only network operations were capability probes against `api.turso.tech`/`docs.turso.tech` — both refused at the network layer before any request (or credential) was transmitted.

Labels: **FACT**, **INFERENCE**, **RECOMMENDATION**, **OWNER DECISION REQUIRED**.

---

## 1. Why BLOCKED — exact missing capabilities (FACT)

Creating a disposable Turso Cloud database/branch seeded from production is a **Platform API operation** (or an authenticated `turso` platform CLI session). Two independent blocks exist:

1. **Authorization capability absent.** Present in the environment (by name only, values never read): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — a **database-level** credential pair. Absent under every plausible name: `TURSO_API_TOKEN`, `TURSO_PLATFORM_TOKEN`, `TURSO_TOKEN`, `TURSO_ORG`, `TURSO_ORGANIZATION`, `TURSO_GROUP`; no `~/.config/turso` / `~/.turso` CLI session; no `.env` files; no `turso` platform CLI binary (and its installer pulls from GitHub releases, which this environment's egress blocks). Per the mission rule — ratified here — a database auth token is **not** authorization to create databases, and no attempt was made to use it as one.
2. **Network egress blocked.** `https://api.turso.tech` is unreachable both through the configured proxy (CONNECT tunnel refused, HTTP 403 — the request, and therefore any credential, was never transmitted) and directly from Node (403 at the gateway). `docs.turso.tech` is equally blocked, so the current official platform documentation could not be consulted from here either. Even with a platform token, the branch could not be created **from this environment**.

## 2. What D6B verified before stopping (FACT)

- Repo preflight: `7f-evolution` @ `1a9e1c4` = `origin/7f-evolution`, clean tree, `master` untouched, 26 ahead / 0 behind.
- Credential inventory as above (presence only).
- Reachability probes: proxy CONNECT to `api.turso.tech` → 403 (tunnel refused, nothing sent); direct Node fetch (no credentials attached) → 403; `docs.turso.tech` → blocked both ways.
- Nothing else was executed: no cloud branch, no migrations anywhere, no production connection, no local re-run of D6 (not needed — no difference to diagnose).

## 3. Ledger decision (§8 of the mission) — analysis prepared; OWNER DECISION REQUIRED

The question "does Sevenef need a remote migration ledger on Turso?" was evaluated; **no ledger of any kind was created**, and this remains an owner decision for the cloud rehearsal / production mission:

| Option | Assessment |
|---|---|
| **A — no remote ledger** (migration files + schema-precondition gates + committed deployment evidence) | Sufficient for *this* window: the three deltas are additive and their applied-state is fully decidable from schema introspection (column/index/table existence). Weakness: not durable — future rebuild-class migrations (Stage 5 §7 relaxations, FK subset) are not reliably inferable from schema shape alone, so every future window would re-derive state ad hoc. |
| **B — Sevenef-owned ledger** (an explicitly own table, e.g. `_sevenef_migrations`, storing migration name + sha256 checksum + applied_at, mirroring the `prisma/migrations` names/checksums) | **RECOMMENDATION.** Honest (no imitation of another tool's internals — the mission's stated safety preference), durable for future migrations, trivially convertible later because names/checksums are identical to the Prisma history; local/CI keeps using the real Prisma CLI against file databases, and `db:verify-history` already enforces history↔schema equivalence. Cost: one additive table plus applier support. |
| **C — Prisma-compatible `_prisma_migrations`** | Proven feasible and row-equal to a real Prisma run in D6, and it would become natively readable if Prisma ever supports remote sqlite datasources — but it means hand-maintaining another tool's internal, unsupported table format, with checksum/format coupling to the installed Prisma version. Only justified if that native-support bet is made explicit; no strong reason exists today. |

INFERENCE: whichever option is chosen, the **fail-closed idempotence** contract stays the same as D6 rehearsed: the deployment tool determines "no pending migrations" from its state source (ledger or schema preconditions) and never re-executes DDL blindly.

## 4. Recovery strategy (§16) — prepared, requires platform access to verify

The production window needs a Turso-side recovery mechanism (branch-from-parent, point-in-time restore, and/or dump) — exactly the capability this mission could not reach. FACT: nothing about it could be verified from this environment (API and docs both blocked). The D6-rehearsed principle stands: snapshot before applying, **verify the restore path before the window proceeds**, never treat `DROP COLUMN` as rollback. The cloud rehearsal must demonstrate the real mechanism on the disposable branch before production is ever touched.

## 5. Unblock requirements — to re-run D6B

1. **Owner provisions platform authorization**, rehearsal-scoped: a Turso Platform API token with database create/delete permission for the organization (plus the org slug), exposed to the session as e.g. `TURSO_API_TOKEN` + `TURSO_ORG` — or an environment with an authenticated `turso` platform CLI.
2. **Egress policy allows** `api.turso.tech` (and the regional hostname the new branch database will get).
3. Re-run this mission: create `sevenef-core03c-d6b-<timestamp>` seeded from production; prove independent identity; run the M1 auditor + M2 §8 gates against the branch (48/61/no-ledger + real point-in-time counts); extend `scripts/rehearse-core-03c-d6.ts` with an **explicitly authorized** remote-branch target mode (guard pinned to the branch's exact hostname, marker protocol unchanged, production hostname permanently refused); apply migrations 1–3 with per-migration validation; cloud-specific validation (auth, PRAGMAs, transactions, schema visibility); InboxTodo E2E; idempotence; then delete the branch and confirm production intact.

## 6. Repository changes in this mission

This document only. No code, no tooling, no migration, no data, no ledger anywhere.
