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
- Any future `/api/lab/*` handler is NOT exempted: it must call
  `getLabGateDecision()` itself and add its own authentication
  (DEV-PREVIEW-01B).

## Required variables (Lab project only)

| Variable | Value |
|---|---|
| `SEVENEF_LAB_PREVIEW_ENABLED` | `true` |
| `SEVENEF_LAB_DEPLOYMENT_MODE` | `dedicated` |
| `SEVENEF_LAB_EXPECTED_PROJECT_ID` | the Lab project's `prj_...` id |
| `SEVENEF_LAB_ALLOWED_HOSTS` | e.g. `lab.example.com,project-lab.vercel.app` |
| `SEVENEF_LAB_LOCAL_DEV_ENABLED` | unset in Vercel; `true` only in a local `.env` |

Keep Vercel Deployment Protection enabled on the Lab project as an outer
layer. Never add any of these variables to the Sevenef production project.

## Hard rules

- **Never** point the Lab at production data: the Lab project must use its own
  demo Turso database (arrives in DEV-PREVIEW-01C), never production
  `TURSO_DATABASE_URL`/`DATABASE_URL`.
- **Never** share `AUTH_SECRET` between the Lab project and production —
  tokens minted in one environment must be worthless in the other.
- **Never** weaken normal Sevenef authentication for the Lab; the Lab must not
  use `DISABLE_GOOGLE_AUTH`.
- All Lab checks are server-side; public/browser variables are never trusted.

## Not implemented yet (later missions)

- `DEV-PREVIEW-01B` — Lab access key + `/api/lab/session` (gate + own auth),
  synthetic Lab identity and session cookies.
- `DEV-PREVIEW-01C` — demo Turso database, schema push, Finesse demo seed,
  entry into the real surfaces (Today, Calendar, …) on the Lab deployment.
- `DEV-PREVIEW-01D` — Vercel project creation/wiring, Deployment Protection
  setup, final guardrail checks and runbook completion.

## Tests

`npm run test:lab` → `core/lab/gate-policy.test.ts` covers every deny branch
(flag variants, mode, project ids, hosts incl. malicious prefix/suffix and
port handling, environments, local-dev opt-in, incomplete config), verifies
denials never leak configuration, and pins the namespace predicate.
