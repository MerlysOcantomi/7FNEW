# CORE-02B — Security closure: fail-open paths, insecure secrets, dangerous operational endpoints

- **Date:** 2026-08-16
- **Branch:** `7f-evolution`
- **Starting SHA:** `a78c1f35f7315b841f6abcaabe00e00d6b7b0527` (= `origin/7f-evolution` at preflight; `origin/master` at `312785fb270ed334ff2af121e280c1a03bed02bd`, 6 ahead / 0 behind)
- **Scope:** completes the remaining half of CORE-02 as sequenced in `CORE-00-AUDIT.md` §Evolution. CORE-02A (error-detail containment in `handleError`) was already shipped.

## Findings closed

| Finding | Status |
|---|---|
| **F-AUTH-01** — middleware fails open on `/api/**` when `AUTH_SECRET` unset | **Closed** |
| **F-AUTH-02** — `core/crypto.ts` all-zero fallback key + key reuse with `AUTH_SECRET` | **Closed** (rotation/re-encryption deliberately pending, see below) |
| **F-AUTH-04** — `/api/health` leaks env metadata + cross-tenant counts | **Closed** |
| **F-AUTH-05** — `/api/ai/*` unauthenticated-in-handler LLM proxies | **Closed** (authorization; quotas/rate limiting remain future work) |
| **F-WS-05** — `/api/setup/*` DDL + 23-table global backfill over HTTP | **Closed** (routes deleted) |

Bonus hardening (same intervention, same files): public-path matching in the
middleware is now segment-boundary aware, so a prefix like `/api/auth` can no
longer accidentally make `/api/auth-malicious` public; and the nine AI routes
now route their failures through `handleError` instead of returning raw
`error.message` text (residual F-AUTH-03 surface).

## Files affected

**Modified**

- `middleware.ts` — fail-closed + segment-boundary public matching.
- `core/crypto.ts` — dedicated `CHANNEL_ENCRYPTION_KEY`, no fallback key.
- `app/api/health/route.ts` — reduced to a minimal liveness probe.
- `app/api/ai/{,tareas/,clientes/,proyectos/,finanzas/,facturacion/,resume/,correct/,chat/}route.ts` — in-handler `requireReadAccess(request)` + `handleError`.
- `app/api/workspaces/[id]/connections/route.ts` — one client-facing hint no longer names `AUTH_SECRET`.
- `.env.example` — documents `CHANNEL_ENCRYPTION_KEY` (name + guidance only, no value).

**Deleted**

- `app/api/setup/client-auth-table/route.ts` (runtime `CREATE TABLE` / `CREATE UNIQUE INDEX` via `@libsql/client`).
- `app/api/setup/workspace-backfill/route.ts` (cross-tenant `updateMany` of null-workspace rows into `ws_default`).

**Created (tests + this document)**

- `middleware.security.test.ts`
- `core/crypto.test.ts`
- `app/api/health/route.test.ts`
- `app/api/ai/ai-security.test.ts`
- `app/api/no-http-ddl.test.ts`
- `docs/evolution/CORE-02B-SECURITY-CLOSURE.md`

## Behaviour: before → after

### Middleware (`middleware.ts`)

- **Before:** with `AUTH_SECRET` missing/empty, every internal `/api/**` request passed through with `NextResponse.next()` — no session required. Portal APIs with a token redirected to a login page instead of answering as an API. `PUBLIC_PATHS` used bare `startsWith`, so `/api/auth-malicious` inherited `/api/auth`'s bypass.
- **After:** with the secret missing, empty **or whitespace-only** (spaces, tabs, newlines — hardened in the CORE-02B.1 follow-up: `getSecret()` treats a blank value as absent, while a *valid* secret is encoded as-is, never trimmed), protected APIs (internal and portal) answer a deterministic generic `503 {"success":false,"error":{"code":"SERVICE_UNAVAILABLE","message":"Servicio no disponible"}}` — never `next()`, never the secret's name/length/value, never an exception with internals. Protected pages keep their existing `…/login?error=config` redirect. Public paths (auth, webhooks, inbound email, public inbox/Presence reception, widget, sites) are matched at segment boundaries and keep working. Presence custom-domain routing decision untouched. No new imports — the middleware stays Edge-safe (`jose` + `next/server` only).

### Crypto (`core/crypto.ts`)

- **Before:** key derived from `AUTH_SECRET` (reuse across signing + encryption); when unset, **fell back to `Buffer.alloc(32, 0)`** — every stored channel credential decryptable from a DB dump alone.
- **After:** key comes exclusively from `CHANNEL_ENCRYPTION_KEY`, validated (absent/empty/whitespace ⇒ throw) at encrypt/decrypt time — never at module scope, so builds/imports/tests without credentials keep working. No fallback of any kind. Errors never contain the secret's value. AES-256-GCM, the `iv + tag + ciphertext` hex payload format, and the scrypt derivation over the same constant salt are all preserved, so equivalent key material produces the identical historical key. **No ciphertext was re-encrypted and no data was touched.**

### `/api/health`

- **Before:** returned `DATABASE_URL`/`TURSO_DATABASE_URL` previews, auth-token lengths, raw libSQL/Prisma error strings, and a platform-wide un-tenanted `Cliente` count; opened a direct libSQL connection per request.
- **After:** `{ "ok": true }`. No env reads, no DB connection, no counts, no error text. An exhaustive repo search found **no consumer** of the previous payload (no scripts, no components, no `vercel.json` reference), so no operational contract was broken. The route deliberately stays out of `PUBLIC_PATHS` and behind normal middleware auth.

### `/api/ai/*`

Inventory at the time of this change (10 route files under `app/api/ai/`):

| Route | Guard before | Consumers found | Action |
|---|---|---|---|
| `/api/ai` | none | `components/calendar/intelligence-panel.tsx` | guarded |
| `/api/ai/chat` | none | `components/content-ai.tsx` | guarded |
| `/api/ai/tareas`, `/clientes`, `/proyectos`, `/finanzas`, `/facturacion`, `/resume`, `/correct` | none | none found (likely legacy) | guarded — per mission rule, ambiguous routes are protected, not deleted |
| `/api/ai/agent` | `requireReadAccess` already | Forte agent UI | untouched |

- **Before:** the nine flagged handlers accepted any request that got past the middleware (which F-AUTH-01 could void entirely) and forwarded free-form prompts to OpenAI/DeepSeek; their `catch` returned raw provider/internal error text.
- **After:** each handler calls `requireReadAccess(request)` first — valid session + workspace membership via the canonical helpers (`getSessionFromCookies` → `resolveRequiredWorkspace` → `checkMembership`), before the body is read and before any provider call. A client-supplied `x-workspace-id` header is ignored on these paths (they are not in `HEADER_ALLOWLIST`), so no client-chosen workspace/slug/role is trusted. Failures go through `handleError` (401/403/404 for auth/tenancy, generic 500 otherwise). The success contract (`successResponse({ result, … })`) is unchanged. No agent architecture, no billing/quotas/rate limiting — explicitly future missions. Fanny/Presence public routes untouched.

### `/api/setup/*`

- **Before:** any workspace `OWNER` (of any tenant) could run production DDL (`client-auth-table`) or a 23-table cross-tenant backfill into the deprecated shared `ws_default` (`workspace-backfill`) via HTTP POST.
- **After:** both routes **deleted** — no consumer existed in the repo. Next.js now answers 404 for those URLs with zero code behind them, so no compatibility stub was needed and none was kept. The operation was not moved elsewhere: a repo-wide scan confirms no DDL, no `@libsql/client` import, and no null-workspace `updateMany` remains anywhere under `app/api/**`, enforced from now on by `app/api/no-http-ddl.test.ts`. The legitimate replacement is the versioned migration history to be designed in **CORE-03C**.

## Test matrix

| File | Covers | Count |
|---|---|---|
| `middleware.security.test.ts` | protected internal/portal API + missing secret ⇒ 503 (never `next()`); whitespace-only secret (spaces/tabs/newlines) equally rejected on APIs and pages, and a valid padded secret is used untrimmed (CORE-02B.1); generic body (no secret name/length/internals); protected pages keep `error=config` redirect; public paths work without secret; lookalike prefixes (`/api/auth-malicious`, `/loginx`, …) don't inherit the bypass; exact public paths + sub-segments still match; invalid/forged JWT still 401 + page redirect; valid session passes; control plane still 403s without `platformRole` and admits with it; portal rejects non-client tokens and admits client tokens | 16 |
| `core/crypto.test.ts` | missing/empty/whitespace key ⇒ encrypt & decrypt fail; `AUTH_SECRET` alone no longer enables crypto; secret value never in the failure; zero-key payloads never decrypt (fallback gone both directions); round-trip (text + JSON) with synthetic key; two encryptions differ by random IV; wrong key fails; historical scrypt+salt derivation and `iv+tag+ct` layout stay valid; env restored after every test | 11 |
| `app/api/health/route.test.ts` | 200 `{ok:true}` with ALL DB env vars deleted; body contains no URL/hostname/token/length/count/error content; exactly one key; safe with no session/request context; no connection possible (no DB import) | 3 |
| `app/api/ai/ai-security.test.ts` | all 9 routes reject unauthenticated callers with 401 and **zero provider calls** (fetch spy, with synthetic provider keys set so a broken guard would reach it); workspace-less user rejected, zero provider calls; client-supplied `x-workspace-id` cannot select a foreign workspace; invalid JWT rejected; authorized OpenAI-path and DeepSeek-path contracts preserved against stubbed providers; validation intact post-guard. Local temp SQLite only | 7 |
| `app/api/no-http-ddl.test.ts` | `app/api/setup` gone; no DDL statements, no `@libsql/client`, no null-workspace backfill anywhere under `app/api/**` | 4 |

All suites run against local test doubles: no Turso, Neon, OpenAI, DeepSeek, Resend, IMAP, SMTP or any external service is contacted.

## Guarantees

- **No schema change:** `prisma/schema.prisma` untouched; no migration created or applied; `CORE-03B` baseline SQL untouched.
- **No data change:** no DDL executed, no backfill executed or simulated, no remote database contacted, nothing re-encrypted.
- **No secrets:** no secret value appears in code, tests, docs or logs introduced by this mission; all test values are synthetic.

## Deployment requirement — read before deploying

1. **`CHANNEL_ENCRYPTION_KEY` must exist in the environment before this change is deployed.** Without it, channel-credential encryption/decryption fails closed (connection create/test and IMAP/SMTP flows will error safely instead of using an insecure key).
2. **Compatibility with existing encrypted credentials:** rows encrypted before CORE-02B used key material derived from the then-current `AUTH_SECRET`. To keep them decryptable, initially set `CHANNEL_ENCRYPTION_KEY` to that historical value. The derivation and payload format were preserved exactly so this works.
3. **Rotation is pending and was NOT executed.** Moving to a fresh, independent key and re-encrypting existing `ChannelConnection.credentials` rows is a separate, controlled future mission. Do not rotate as a side effect of this deploy.

## Remaining risks (future missions)

- Key rotation + re-encryption of existing channel credentials (see above).
- AI quotas, per-workspace attribution/billing and distributed rate limiting (F-AUTH-05 residual; explicitly out of scope here).
- Legacy global RBAC page gating (F-AUTH-06) and the other findings sequenced outside CORE-02.
- The seven unconsumed `/api/ai/*` legacy routes are now guarded but still candidates for deletion once a product decision confirms they are dead.
- Null-workspace orphan rows (F-WS-06) still exist in the schema — CORE-03C+ territory.

## Next step

**Decision: the next mission is `CORE-03C`** — the canonical Sevenef schema and its versioned migration history. Nothing from that mission was started here.
