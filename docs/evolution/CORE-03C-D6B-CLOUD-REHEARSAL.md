# CORE-03C-D6B — Turso Cloud Branch Migration Rehearsal

- **Date:** 2026-08-20 (attempt 1) · 2026-08-22 (attempt 2 — resume)
- **Branch:** `7f-evolution` · attempt 1 from SHA `1a9e1c416d689aac8bbd8470f617364c8cec3afc`; attempt 2 from SHA `eae6f8b` (= attempt-1 closure; `master` intact at `312785fb270ed334ff2af121e280c1a03bed02bd`)
- **Verdict:** **BLOCKED.** Attempt 1: no branch could be created from the environment (§1). Attempt 2: the owner created the disposable branch manually and it is reachable at the expected hostname, but **the database auth credential provided to the environment is not a valid token** — the Turso server rejects it (`JWT error: InvalidToken`) and refuses unauthenticated access (401) — so not even the read-only baseline audit could run (§7). Production was **not** used as a substitute and no rehearsal was faked. The local D6 result (PASS 8/8, `CORE-03C-D6-MIGRATION-REHEARSAL.md`) stands as the only migration-adoption evidence so far; the cloud-specific validation remains pending.
- **Production zero-write:** zero connections to the production database in both attempts (not even read-only). Attempt 1's only network operations were capability probes against `api.turso.tech`/`docs.turso.tech` (refused at the network layer). Attempt 2's only network operations were against the disposable branch hostname itself: one unauthenticated `GET /health` (200) and three single-statement `SELECT 1` attempts, all refused by the server's auth layer before any query ran. **Zero writes anywhere, branch included.**

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

## 5. Unblock requirements — to re-run D6B (attempt 1; superseded in part by §7 — the branch now exists and egress is open, only the token remains)

1. **Owner provisions platform authorization**, rehearsal-scoped: a Turso Platform API token with database create/delete permission for the organization (plus the org slug), exposed to the session as e.g. `TURSO_API_TOKEN` + `TURSO_ORG` — or an environment with an authenticated `turso` platform CLI.
2. **Egress policy allows** `api.turso.tech` (and the regional hostname the new branch database will get).
3. Re-run this mission: create `sevenef-core03c-d6b-<timestamp>` seeded from production; prove independent identity; run the M1 auditor + M2 §8 gates against the branch (48/61/no-ledger + real point-in-time counts); extend `scripts/rehearse-core-03c-d6.ts` with an **explicitly authorized** remote-branch target mode (guard pinned to the branch's exact hostname, marker protocol unchanged, production hostname permanently refused); apply migrations 1–3 with per-migration validation; cloud-specific validation (auth, PRAGMAs, transactions, schema visibility); InboxTodo E2E; idempotence; then delete the branch and confirm production intact.

## 6. Repository changes in this mission

This document only. No code, no tooling, no migration, no data, no ledger anywhere.

---

## 7. Attempt 2 (2026-08-22) — branch exists and is reachable; credential invalid (FACT)

The owner resolved attempt 1's blocker manually: a disposable Turso Cloud branch **`7f-d6b-rehearsal`** now exists, with the exact expected hostname `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io`, and the environment carries two credentials for it by name: `D6B_DATABASE_URL` and `D6B_AUTH_TOKEN` (values never printed).

### 7.1 What was verified before stopping

| Check | Result |
|---|---|
| Repo preflight | `7f-evolution` @ `eae6f8b` = `origin/7f-evolution`, clean tree, `master` untouched |
| Target identification | `D6B_DATABASE_URL` parses as `libsql://` with hostname **exactly** `7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io` — the owner-declared disposable branch; no embedded credentials, no query params. Egress to that hostname is now allowed: `GET /health` → HTTP 200 (the blocker of attempt 1 §1.2 is resolved for the branch hostname) |
| Auth, without token | `@libsql/client` `SELECT 1` with no `authToken` → **HTTP 401** — the branch requires authentication (it is not an open database) |
| Auth, with `D6B_AUTH_TOKEN` | Hrana `v2/pipeline` `SELECT 1` with the provided value as bearer → **HTTP 400 `{"error":"JWT error: InvalidToken"}`** — the Turso server itself parses and rejects the value |
| Credential shape (metadata only, value unread) | 27 characters; **not** JWT-shaped (no `header.payload.signature` structure — a Turso database token is a JWT of several hundred characters); all-lowercase words separated by non-alphanumeric characters, several matching common natural-language words. INFERENCE: the value stored in `D6B_AUTH_TOKEN` is a human-written placeholder note, not a token. It was deliberately **not** read or printed (the mission prohibits printing credential-slot values, and the permission layer independently blocked it) |
| Other credential sources | none: no `.env*` with values (only `.env.example`), no `TURSO_*`/`DATABASE_*` vars, no token embedded in the URL |

### 7.2 Why this is a hard stop

The mission requires positive identification **and** access to the branch before any phase. The branch is positively identified (exact hostname, reachable, auth-protected), but with no valid credential neither the read-only baseline audit (M2 §8 gates) nor any later phase can run. No fallback exists that respects the rules: production credentials are absent (and prohibited), and the Platform API path is out of scope by the mission's own terms.

### 7.3 What was NOT done (attempt 2)

No connection beyond the four probes above; no query ever executed on the branch (every attempt was refused at the auth layer); no write, DDL, DML, marker, ledger or migration anywhere; no production contact of any kind; no code or tooling change — this document is again the only repository change.

### 7.4 Unblock requirement (single, precise)

Generate a **database auth token for the branch** `7f-d6b-rehearsal` (Turso dashboard → the branch database → *Generate token*, or `turso db tokens create 7f-d6b-rehearsal` from an authenticated owner CLI; full-access, since the rehearsal writes to the branch) and place its JWT value in the session environment as **`D6B_AUTH_TOKEN`** (keeping `D6B_DATABASE_URL` as is). Everything else — egress, hostname, mission plan, driver design (§5.3) — is ready; on the next run the mission resumes directly at the read-only baseline audit.
