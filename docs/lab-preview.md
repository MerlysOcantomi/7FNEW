# Mr Forte Lab Preview — deployment & security

Status after `DEV-PREVIEW-01A`: gate + namespace only. No access flow, no
identity, no demo data yet. Design background: `docs/lab-preview-audit.md`.

## Purpose

Mr Forte Lab is a reusable preview environment to show, test and review
Sevenef (design reviews, experiments, demos) **without Google login and
without ever mixing data or behavior with production**. Everything the Lab
renders uses fictional data only.

## Separation: Sevenef Production vs Mr Forte Lab

The Lab runs on a **dedicated Vercel project** connected to the same
repository. The code is shared and may live in `master`, but it is completely
inert in the Sevenef production project because activation requires private
configuration that only the Lab project defines.

Important consequence: the Lab project's stable deployment is technically
`VERCEL_ENV === "production"` — **of the Lab project**. That is not Sevenef
production. The gate therefore never uses `VERCEL_ENV` alone to decide;
it identifies the project explicitly (see below) and treats `production` and
`preview` of the *dedicated* project as valid environments.

## The gate (fail-closed)

Implementation: pure policy in `core/lab/gate-policy.ts` (`decideLabGate`),
server wiring in `core/lab/gate.ts` (`getLabGateDecision`,
`requireLabAvailability`), env reader in `core/lab/config.ts`. `/lab` is
available only when ALL of the following hold:

1. `SEVENEF_LAB_PREVIEW_ENABLED` is exactly `"true"` (not `"1"`, `"yes"`, `"TRUE"`).
2. `SEVENEF_LAB_DEPLOYMENT_MODE` is exactly `"dedicated"`.
3. `SEVENEF_LAB_EXPECTED_PROJECT_ID` is defined (private server config).
4. `VERCEL_PROJECT_ID` is defined (injected by Vercel, never client-controlled).
5. Both project ids match **exactly** (no partial matches).
6. `SEVENEF_LAB_ALLOWED_HOSTS` parses to a non-empty list of exact hostnames
   (comma-separated, `host[:port]`, no wildcards).
7. The request's hostname matches one allowed entry **exactly** (lowercased,
   trimmed; `evil-lab.example.com` and `lab.example.com.attacker.test` never
   match `lab.example.com`).
8. The environment is allowed: `VERCEL_ENV` ∈ {`production`, `preview`} of the
   dedicated project, or — only with the separate exact flag
   `SEVENEF_LAB_LOCAL_DEV_ENABLED="true"` — local `next dev`
   (`VERCEL_ENV` absent or `development`).
9. No required configuration is missing.

Anything else denies. Denials are represented internally with typed reasons
(`disabled`, `project-mismatch`, `host-not-allowed`, …) for tests and safe
logs, but the visitor-facing response is always a plain **404** — never a
redirect to login, never "Lab disabled", never a configuration error, never a
project id or host list.

Explicit non-mechanisms: no `NEXT_PUBLIC_*` gating, no `?demo=true`-style
query params, no activation via `VERCEL_ENV` or hostname alone, no
client-sent headers as project identity, no wildcards.

## Why the Sevenef production project can never serve the Lab

- It does not define `SEVENEF_LAB_PREVIEW_ENABLED` / `_DEPLOYMENT_MODE` /
  `_EXPECTED_PROJECT_ID` / `_ALLOWED_HOSTS` → conditions 1–3 and 6 fail.
- Even if the flags leaked into it, its `VERCEL_PROJECT_ID` differs from the
  Lab's expected id → condition 5 fails (exact match, server-side, private).
- Its domains are not in the Lab allowlist → condition 7 fails.

Three independent server-side conditions must all be misconfigured at once
for a crossover, and none is reachable from the client.

## The `/lab/*` namespace

- **Primary enforcement is at the edge.** `middleware.ts` detects exactly
  `/lab` and `/lab/...` (predicate `isLabNamespacePath`, unit-tested against
  `/laboratory`, `/labyrinth`, `/api/lab`…) and evaluates the full pure policy
  there — it only needs private env + the request host. Denied requests are
  rewritten to a routeless path so Next serves its standard 404 page with a
  real 404 status. (Enforcing only via `notFound()` in the lab layout was
  verified to answer HTTP 200 and stream the page subtree inside the RSC
  payload — a Next.js layout behavior — so the edge layer is required.)
- `app/lab/layout.tsx` (`force-dynamic`) and each lab page still call
  `requireLabAvailability()` as a second, defense-in-depth layer, so nothing
  lab-branded renders or streams even if the edge layer were bypassed. The
  layout renders the `LabEnvironmentBanner`
  (`components/lab/lab-environment-banner.tsx`: "Mr Forte Lab · Preview ·
  Fictional data").
- `app/lab/page.tsx` is a sober placeholder catalog — no business data, no
  links into real routes, no session-creating actions.
- **Nothing else changed**: `/api/*` and every normal Sevenef route keep the
  exact same authentication as before.
- Any future `/api/lab/*` handler is NOT exempted from the normal middleware
  auth: it must call `getLabGateDecision()` itself and add its own
  authentication.

## Two independent access levels

The Lab has two separate controls. Both must pass. Keeping them separate is
deliberate — the infrastructure gate never depends on a key, and the access
session never weakens the gate.

**Level 1 — infrastructure gate (DEV-PREVIEW-01A).** Flag + dedicated mode +
project id + host + environment, described above. Failure → 404, the Lab's
existence is never revealed.

**Level 2 — access session (DEV-PREVIEW-01B).** When level 1 passes, the
visitor must still present the Lab access key at `/lab/enter` and receive a
short-lived, namespace-scoped session. Failure → they stay on `/lab/enter`
with one generic message; the protected surfaces redirect back to it.

### Flow

```
/lab (no session)         → redirect to /lab/enter
/lab/enter  (POST key)    → gate → origin → config → key → token → cookie → /lab
/lab (valid session)      → catalog (protected shell)
/lab/enter (has session)  → redirect to /lab
POST /lab/exit            → clear cookie → /lab/enter
```

Implementation: pure, unit-tested pieces in `core/lab/access-config.ts`,
`access-key.ts`, `access-token.ts`, `access-cookie.ts`, `access-origin.ts`;
server wiring in `access-session.ts`; UI in `app/lab/enter` (server action +
`useActionState` form) and `app/lab/exit` (POST-only route). Protected pages
wrap their content in `components/lab/lab-protected-shell.tsx`, which calls
`requireLabAccessSession()`.

> The protected guard lives in a server-component shell rather than a
> `(protected)/layout.tsx` route-group layout: Next 16 did not apply a
> route-group layout at this segment (the catalog rendered without it), so the
> guard is placed in an explicit shell every protected page renders. Runtime
> smoke tests confirm `/lab` without a session never streams catalog content.

### Synthetic identity & token

The access token represents ONLY a temporary, non-persistent visitor —
`sub: lab-preview-visitor`, `scope: lab:preview`, `iss: mr-forte-lab`,
`aud: sevenef-lab-preview`, plus the current `projectId`, `iat`, `exp`, `jti`.
It carries no email, role, platformRole, userId or workspaceId. There is no
`User`/`WorkspaceMember` row (that lands in DEV-PREVIEW-01C with the demo DB).
Verification requires EXACTLY the issuer, audience, subject, scope, expiry,
signature and current project id — a merely valid signature is never enough.

**The access session is not a Sevenef login.** It grants no access to `/api/*`
or business data, and never mints a `7f-session` or `wf_workspace` cookie.

### Access key & cookie

- The human key is never stored: config holds only its SHA-256 digest
  (`SEVENEF_LAB_ACCESS_KEY_SHA256`, 64 hex). The server hashes the exact
  submitted key (no trimming) and compares digests with `timingSafeEqual`.
- The cookie `sevenef-lab-access` is `HttpOnly`, `SameSite=Strict`,
  `Path=/lab`, host-only (no `Domain`), `Secure` in deployments, with
  `Max-Age` equal to the TTL. `Path=/lab` means it is never sent to `/today`,
  `/api/*` or any normal route — it can never act as a general credential.
- The enter action validates the request `Origin` server-side against the
  gate-approved host; a hostname in the form body is never trusted, and the
  post-login destination is always `/lab` (no `returnTo`).

### Rate limiting

There is no distributed rate limiter in the repo (only best-effort in-memory
limiters that are unreliable on serverless). This mission does NOT add a false
in-memory limiter. The first barrier is **Vercel Deployment Protection** plus a
high-entropy access key. A distributed limiter (e.g. Upstash) on `/lab/enter`
is a prerequisite before opening the Lab to a wide audience — tracked for a
later mission.

## Required variables (Lab project only)

| Variable | Value |
|---|---|
| `SEVENEF_LAB_PREVIEW_ENABLED` | `true` |
| `SEVENEF_LAB_DEPLOYMENT_MODE` | `dedicated` |
| `SEVENEF_LAB_EXPECTED_PROJECT_ID` | the Lab project's `prj_...` id |
| `SEVENEF_LAB_ALLOWED_HOSTS` | e.g. `lab.example.com,project-lab.vercel.app` |
| `SEVENEF_LAB_LOCAL_DEV_ENABLED` | unset in Vercel; `true` only in a local `.env` |
| `SEVENEF_LAB_ACCESS_KEY_SHA256` | 64-hex SHA-256 of the human access key |
| `SEVENEF_LAB_ACCESS_TOKEN_SECRET` | independent signing secret, ≥ 32 chars, ≠ `AUTH_SECRET` |
| `SEVENEF_LAB_ACCESS_TTL_MINUTES` | integer in `[15, 480]`; default `120` |

Generate the level-2 secrets safely (examples, never commit real values):

```bash
KEY=$(openssl rand -base64 24)                       # the human key (share out-of-band)
printf %s "$KEY" | shasum -a 256                      # → SEVENEF_LAB_ACCESS_KEY_SHA256 (64 hex)
openssl rand -base64 48                               # → SEVENEF_LAB_ACCESS_TOKEN_SECRET
```

Keep Vercel Deployment Protection enabled on the Lab project as an outer
layer. Never add any of these variables to the Sevenef production project.

## Hard rules

- **Never** point the Lab at production data: the Lab project must use its own
  demo Turso database (arrives in DEV-PREVIEW-01C), never production
  `TURSO_DATABASE_URL`/`DATABASE_URL`.
- **Never** share `AUTH_SECRET` between the Lab project and production —
  tokens minted in one environment must be worthless in the other.
- **Never** reuse `AUTH_SECRET` (or any Google/Turso/Voice Lab secret) as
  `SEVENEF_LAB_ACCESS_TOKEN_SECRET`; the config check rejects an equal value.
- **Never** weaken normal Sevenef authentication for the Lab; the Lab must not
  use `DISABLE_GOOGLE_AUTH`.
- All Lab checks are server-side; public/browser variables are never trusted.

## Level 3 — demo database, identity & application session (DEV-PREVIEW-01C)

Once the access key is verified, the deployment confirms it is wired to the
expected demo database and issues a real (demo) Sevenef session.

### Isolated demo database

- The Lab project points `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` at a
  **dedicated demo Turso database**, never production. Create it separately and
  push the schema (`npx prisma db push` against the demo DB).
- `SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256` is a private SHA-256 of the
  **normalized** URL (`core/lab/database-fingerprint.ts`: scheme + lowercased
  host + path; query/`authToken` dropped; token never hashed or logged). At
  runtime the connected URL is fingerprinted and compared with
  `timingSafeEqual`. A database whose NAME merely contains "demo"/"lab" is not
  accepted — only an exact fingerprint match is. Compute the expected value:

  ```bash
  npx tsx -e "import {computeTursoFingerprint} from './core/lab/database-fingerprint.ts'; console.log(computeTursoFingerprint(process.env.TURSO_DATABASE_URL))"
  ```

### Synthetic identity & workspace

Fixed internal identity (`core/lab/demo-identity.ts`): user `lab-preview-user`
(`lab-preview@sevenef.invalid`, reserved `.invalid` TLD, `User.role = editor`,
never a platform admin), workspace `lab-preview-workspace`
(slug `finesse-preview`, Beauty/Finesse vertical, flagged
`config.demo = { enabled, type: "finesse-internal" }`), and exactly one
`WorkspaceMember` with the canonical `ADMIN` role. "editor" (D5) is the session
role; `ADMIN` is the workspace RBAC role — the two role systems reconciled.

### Provisioning is CLI-only, never from a web request

A web request may only verify, read, set cookies and redirect. Provisioning is
an explicit, idempotent admin command:

```bash
npm run lab:provision-demo   # config → fingerprint → connect → safety preflight
                             # → idempotent user/workspace/membership → Finesse
                             # seed → post-assess → safe report
npm run lab:verify-demo      # strictly read-only; non-zero exit on any failure
```

The provisioner refuses to write unless the fingerprint matches and the
database is safe (only the demo workspace + synthetic user, or empty). It never
deletes unknown rows, never prints secrets/token/full URL, and never falls back
to another database. Two consecutive runs leave exactly one user, one
workspace, one membership and the same logical rows (the Finesse seed is
marker-idempotent; `performSeed` is exported and reused). If the seed is ever
incomplete, re-run `lab:provision-demo` — it updates in place.

### assessLabDemoEnvironment (fail-closed)

`core/lab/demo-environment.ts` checks, in order: data config → fingerprint →
connectivity → safe database (≤ 1 workspace, no foreign users, workspace
demo-flagged) → synthetic user (id/email/role) → workspace (id/slug/vertical) →
membership (`ADMIN`) → minimum dataset. Any failure returns a typed internal
reason; the visitor only ever sees "The preview environment is not ready."

### Enter flow & cookies

`/lab/enter` (POST key) runs gate → origin → access config → key → data config
→ fingerprint → provisioned environment, and only if ALL pass sets **three**
cookies together: `sevenef-lab-access`, `7f-session`, `wf_workspace`. No cookie
is set on any failure.

- `7f-session`: the repo's official session (via `createSession`), claims
  `{ userId, email, role: "editor", nombre, avatar: null, platformRole: null }`
  — **no `isLab`/`demoMode` claim**; isolation is environmental. `HttpOnly`,
  `Secure` (deployments), `SameSite=Lax`, `Path=/`.
- `wf_workspace`: exactly `lab-preview-workspace` (never from query/body/header).
- Both expire with the lab access window (same TTL as `sevenef-lab-access`), so
  the demo app session never outlives approved access.

`/lab` links into the REAL Sevenef surfaces (Today, Calendar, Clients, Tasks,
Inbox, Finance, Business Profile) on the Lab deployment — no `/lab/*`
duplicates. `POST /lab/exit` clears all three cookies; afterwards `/lab`
requires the key again and `/today` / `/api/*` require login. A server-derived
permanent banner (`components/lab/lab-demo-overlay-banner.tsx`) shows
"Mr Forte Lab · Preview · Fictional data" on real routes ONLY when the active
session is exactly the demo identity + workspace on a gated Lab deployment —
never in production, never for another user/workspace, never via a public var.

### Google OAuth in the Lab project

The demo session never uses Google OAuth or `dev-login`. Do NOT put production
Google OAuth credentials in the Lab project. (Fully hiding/blocking the Google
login UI inside the Lab deployment is deferred to DEV-PREVIEW-01D.)

## Not implemented yet (later missions)

- `DEV-PREVIEW-01D` — Vercel project creation/wiring, Deployment Protection
  setup, distributed rate limiting on `/lab/enter`, hiding Google OAuth UI in
  the Lab deployment, final guardrail checks and runbook completion.

## Tests

`npm run test:lab` runs the pure policy suites (97 tests):

- `gate-policy.test.ts` — level-1 gate: every deny branch (flag variants, mode,
  project ids, hosts incl. malicious prefix/suffix and port handling,
  environments, local-dev opt-in, incomplete config), no config leak, and the
  namespace predicate.
- `access-config.test.ts` — key-hash / token-secret / TTL validation.
- `access-key.test.ts` — SHA-256 + `timingSafeEqual`, no trimming, length caps.
- `access-token.test.ts` — token create/verify: signature, expiry, issuer,
  audience, subject, scope, project id, missing claims, malformed.
- `access-cookie.test.ts` — cookie attributes (name, HttpOnly, SameSite=Strict,
  Path=/lab, Secure, Max-Age=TTL, no Domain, clear).
- `access-origin.test.ts` — server-side origin/host match, scheme, suffix
  attacks.

Runtime smoke tests (Playwright + curl) additionally verify: gate-closed → 404
with no leak; gate-open no-session → `/lab/enter` without catalog leak; wrong
key → generic error, no cookie; correct key → catalog + lab cookie and NO
`7f-session`/`wf_workspace`; exit clears the cookie; and `/today`, `/api/*`,
`/laboratory` remain protected exactly as before.
