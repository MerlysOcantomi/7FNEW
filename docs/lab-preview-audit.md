# DEV-PREVIEW-01 — Mr Forte Lab Preview: audit & technical design

Status: `01 — PLANNED` (audit delivered, awaiting owner approval — no implementation yet).
Branch: `claude/mr-forte-lab-preview-e8rdas`. Master baseline: `1f535d4ca039570ec470e4de937f2734621ae45b`.

Goal: a reusable, safe preview infrastructure (`/lab/*`) to show, test and review
Sevenef without Google login, without touching production data, and disabled by
default everywhere.

---

## 1. Repository state at audit time

- `master` (local == `origin/master`): `1f535d4` — "Make Today empty-state inbox link direct".
- Working branch `claude/mr-forte-lab-preview-e8rdas`: HEAD `dd66abc`, working tree clean.
- The branch is **23 commits ahead of master** and `git cherry` confirms none of
  them exist in master under other SHAs. They contain two unrelated pending
  fronts: the INBOX-DATA/TRANSPORT multi-channel work and the completion of the
  Finesse demo dataset (`d6e86a2`, `9213322`, `c223e1b`, plus overview/today real
  data and i18n fixes). The Lab depends on the demo-seed commits; the inbox work
  rides along. See Decision D2.

## 2. Current authentication flow (as-built)

Hand-rolled JWT auth — **no NextAuth/Auth.js** (`NEXTAUTH_URL` is only a redirect
base). Signed with `jose` HS256 using `AUTH_SECRET`.

- Cookies: `7f-session` (staff JWT: `userId, email, role, platformRole`, 7d),
  `7f-client-session` (client portal, `type:"client"`), `wf_workspace`
  (active-tenant id, unsigned, membership-validated on every read),
  `oauth-state` (CSRF).
- `middleware.ts` — edge gate only: public paths (`/login`, `/api/auth`,
  `/widget`, inbox public/webhooks…), verifies the JWT, coarse role gating
  (`/finanzas`, `/calendario` etc. need `editor`+; `/admin` needs `admin`;
  `/system` needs `platformRole`), injects `x-user-*` headers.
  **The `x-user-*` headers are read nowhere** — every server guard re-reads the
  cookie via `getSessionFromCookies()` (`core/auth/session.ts:76`).
  ⚠️ If `AUTH_SECRET` is unset the middleware **fails open for `/api/*`**
  (`middleware.ts:102-108`).
- Server guards: `core/auth/workspace-auth.ts` (`requireReadAccess` →
  `requireWorkspaceRole` → `resolveRequiredWorkspace` + DB `checkMembership`),
  `core/auth/platform-auth.ts` (`requirePlatformRole`, DB re-check), path-scoped
  `requireRoleInWorkspace` for `/api/workspaces/[id]/*`.
- Workspace resolution (`core/workspace-context.ts:32-97`): `x-workspace-id`
  header (allowlisted routes only) → `wf_workspace` cookie → first-membership
  fallback (auto-writes the cookie). Zero memberships ⇒ 404 `NO_WORKSPACE`.
- Existing alternate login: `POST /api/auth/dev-login` — 403 unless
  `DISABLE_GOOGLE_AUTH === "true"`; creates a real `User` + default workspace and
  mints a normal session. Closest precedent for a synthetic identity.
- Data loading: every top surface (Today, Calendar, Clients, Tasks, Finance,
  Inbox, Overview) is a client component fetching `/api/*`; all those routes go
  through `requireReadAccess`/`requireWriteAccess`. There is no server-component
  Prisma read that bypasses the resolver.

Isolation boundary: **a real `WorkspaceMember` row keyed on a real `User.id`**.
A purely token-based synthetic identity cannot pass the guards; `Notification`
and `WorkspaceMember` have hard FKs to `User`.

## 3. Existing gated-lab precedent (Voice Lab)

`app/voice-lab/*` is the template the repo already trusts:

- Pure policy (`gate-policy.ts`: `decideLabGate(signals)`) + server wiring
  (`gate.ts`, `"server-only"`, never throws, re-derives session/workspace from
  cookies each call).
- Flag `VOICE_LAB_ENABLED` must equal exactly `"true"`; off ⇒ **404** (the lab
  is invisible), only "authenticated admin with bad workspace" ⇒ 403.
- Pages `export const dynamic = "force-dynamic"`; API adds
  `Cache-Control: no-store` and re-checks auth after the gate.
- Not in `PUBLIC_PATHS` — a normal session is still required in front of the gate.
- Tests: pure-policy `node:test` table (ALL_OK baseline, one test per deny
  branch), env-flag tests with save/restore. Dedicated `test:voice-lab` script.
- No `headers()`/`rewrites()`/`redirects()` in `next.config.mjs`; no
  `VERCEL_ENV` usage anywhere yet; env idiom is per-flag exact `"true"` match.

Anonymous tenant resolution precedents: `/api/inbox/public/*` (workspace slug as
`siteKey` + client `visitorId`) and `/api/inbox/webhooks/[provider]`
(tenant from the resolved DB row, never from the payload; uniform
`accepted:false` to avoid existence leaks).

## 4. Existing demo data

- `scripts/finesse-demo-data.ts` (pure dataset) + `scripts/finesse-demo-utils.ts`
  (config + real-workspace guard) + `scripts/seed-finesse-demo.ts`
  (discover/dry-run/seed CLI) + `docs/finesse-demo-seed.md` (Turso runbook) +
  `scripts/finesse-demo-data.test.ts` (`npm run test:finesse-demo`).
- Seeds into an **existing Beauty-vertical workspace** (it does not create one):
  8 Clientes+Contacts, 30 Eventos (citas, incl. history), 5 Conversations /
  12 Messages, 16 Facturas, 6 WorkspaceTasks (incl. Fanny proposals),
  3 legacy Tareas, 4 ContentPieces, businessProfile + serviceCatalog fallback.
  All idempotent via `FINESSE_DEMO:*` markers, single transaction.
- Guard (`assessDemoTarget`): refuses any workspace holding unmarked data unless
  flagged `config.demo = { enabled, type: "finesse-internal" }`; plus
  Beauty-vertical check, owner-membership check and `FINESSE_DEMO_CONFIRM` token.
  Real workspaces (`7f-business`, Skina) are structurally excluded.
- Surface coverage: Today, Calendar, Clients, Tasks, Finance, Inbox, Overview,
  Services, Business Profile ✔. Gaps: no Projects data, no multi-channel inbox
  identities/delivery, citas carry no service/price/status, no extra team
  members, Marketing is a client-side preview adapter only.
- Other demo adapters: `modules/overview/demo-data.ts` (behind
  `?overviewDemo=`), `modules/marketing/demo-data.ts`, Today mock
  (`?todayData=mock`) — QA-only, not runtime demo modes.

## 5. Concrete risks of opening previews without Google

1. **Token replay across environments.** A lab-minted `7f-session` verifies in
   production if both share `AUTH_SECRET`. Mitigation: the lab environment MUST
   use its own `AUTH_SECRET` (and ideally its own DB), so lab cookies are
   cryptographically worthless in production.
2. **Fail-open middleware.** Missing `AUTH_SECRET` lets `/api/*` through
   unauthenticated (`middleware.ts:102-108`). The lab env must always define it;
   worth a hardening fix later (out of scope here).
3. **Real user row leverage.** Any lab identity must be a real `User` +
   exactly one `WorkspaceMember` (the demo workspace). If it lived in the
   production DB it would be a live editor-level account; keeping it in a
   separate demo DB removes that class of risk entirely.
4. **Vercel Preview env vars are shared by all preview branches.** Setting
   `SEVENEF_LAB_PREVIEW_ENABLED=true` at the "Preview" scope would enable the
   lab on every branch preview. Mitigation: branch-scoped env vars (Vercel
   supports per-branch values) or host allowlist check in the gate.
5. **Accidental production activation.** Guarded three ways: exact-`"true"` flag
   unset in production, a server-side environment check that hard-blocks when
   `VERCEL_ENV === "production"` regardless of the flag, and no query-param
   activation path at all.
6. **Edge role gating.** `/calendario`, `/finanzas`… require `role: editor`+ in
   the JWT — the lab session must carry `editor` (not `viewer`) or those pages
   bounce before any workspace check.
7. **Existence leak.** Follow Voice Lab semantics: everything about the lab
   answers 404 when disabled or unauthorized.

## 6. Architecture options compared

| Option | Isolation | Effort | Fidelity | Verdict |
|---|---|---|---|---|
| A. Flagged demo workspace inside the production DB (guard exists) | Medium — lab user is a real account in prod DB; shared secrets | Low | High | Rejected as primary: violates "total separation" |
| B. **Dedicated demo database + lab-scoped deployment** (own Turso DB, own `AUTH_SECRET`; lab session mints a normal JWT valid only there) | High — prod rows and secrets unreachable by construction | Medium (provision DB, `prisma/push-turso.ts`, run existing seed) | High — the real app renders real DB rows | **Recommended** |
| C. Typed fixtures / mock repository, no DB | Maximum | High — every surface fetches `/api/*` backed by Prisma; would need parallel adapters for each page and drift forever | Low | Rejected for the full app; allowed for standalone `/lab/experiments/*` |
| D. Query-param demo mode (`?demo=true`) | None | — | — | Forbidden by requirements |

Recommended: **B, plus C for future isolated experiments** (an experiment page
may render from fixtures without any DB).

## 7. Recommended architecture

One lab-enabled deployment (branch-scoped preview or dedicated subdomain) whose
environment points at a **demo Turso DB** seeded with the Finesse dataset and a
**distinct `AUTH_SECRET`**. Activation requires ALL of:

1. `SEVENEF_LAB_PREVIEW_ENABLED === "true"` (exact match, unset by default).
2. Environment allowed: `VERCEL_ENV !== "production"` (hard fail-closed) and,
   when configured, host ∈ `SEVENEF_LAB_ALLOWED_HOSTS`.
3. Access key: visitor presents `SEVENEF_LAB_ACCESS_KEY` (constant-time compare)
   at `/lab/enter` — on top of Vercel Deployment Protection, which stays on.

Flow: `/lab` (catalog, gated, 404 when off) → `/lab/enter` (key form) →
`POST /api/lab/session` → idempotent provision of `lab-preview-user` (real User,
`role: editor`) + `lab-preview-workspace` (Beauty vertical, flagged
`config.demo`) + single membership → mints a **normal** `7f-session` +
`wf_workspace` → redirect to `/lab/finesse` or straight into Today/Calendar/etc.
Normal routes stay middleware-protected (never added to `PUBLIC_PATHS`); they
work because the visitor now holds a real session — valid only against the demo
DB/secret. A persistent `LabBanner` ("Preview environment — fictitious data")
renders for any session whose workspace is demo-flagged.

Reusable pieces (final names may adjust): `core/lab/gate-policy.ts` (pure),
`core/lab/gate.ts` (server), `core/lab/provision.ts`, `core/lab/session.ts`,
`core/lab/config.ts` (experiment catalog), `components/lab/lab-banner.tsx`.

## 8. Approximate file tree (new ▸ / modified ✎)

```
▸ core/lab/gate-policy.ts            # pure decision: flag / env / host / key
▸ core/lab/gate-policy.test.ts
▸ core/lab/gate.ts                   # "server-only" wiring (mirrors voice-lab)
▸ core/lab/config.ts                 # lab constants + experiment catalog
▸ core/lab/config.test.ts
▸ core/lab/provision.ts              # ensure lab user/workspace/membership (idempotent, pure planner + thin tx)
▸ core/lab/provision.test.ts
▸ core/lab/session.ts                # mint lab 7f-session + wf_workspace
▸ components/lab/lab-banner.tsx
▸ app/lab/layout.tsx                 # force-dynamic, gate, banner
▸ app/lab/page.tsx                   # preview/experiment catalog
▸ app/lab/enter/page.tsx             # access-key form
▸ app/lab/finesse/page.tsx           # Finesse demo landing (links into surfaces)
▸ app/api/lab/session/route.ts       # POST enter / DELETE leave, no-store
▸ docs/lab-preview.md                # deploy + security runbook
✎ middleware.ts                      # add /lab + /api/lab to PUBLIC_PATHS (server-gated)
✎ package.json                       # test:lab script
✎ .env.example                       # document the new variables
✎ scripts/seed-finesse-demo.ts       # (only if needed) allow targeting the lab workspace explicitly
```

## 9. Mission plan

- **DEV-PREVIEW-01A — Lab gate & namespace skeleton.** `core/lab/gate-policy`
  + `gate` + `/lab` catalog + `/lab/enter` + banner + middleware public-path
  entry + full deny-branch tests. Off by default ⇒ 404 everywhere. No session
  minting yet.
- **DEV-PREVIEW-01B — Lab identity & session.** `provision.ts` + `session.ts` +
  `POST /api/lab/session` (key check, constant-time), edge-role `editor`,
  single-membership invariant, tests (planner + policy).
- **DEV-PREVIEW-01C — Demo environment & data.** Provision demo Turso DB, push
  schema (`prisma/push-turso.ts`), run the Finesse seed against the lab
  workspace, verify Today/Calendar/Clients/Tasks/Finance/Inbox render; document
  gaps (Projects, multi-channel inbox).
- **DEV-PREVIEW-01D — Vercel wiring, docs & guardrails.** Env vars in Vercel,
  Deployment Protection, `docs/lab-preview.md` (threat model + runbook),
  allowed/blocked integration checks, `lint` + `tsc --noEmit` + `next build`
  + `test:lab` green.

## 10. Tests & guardrails

- `gate-policy.test.ts`: ALL_OK baseline; flag off ⇒ 404; production env ⇒ 404
  even with flag on; bad/missing key ⇒ 404; ok ⇒ allowed. Env-flag exact-match
  tests (`"1"`, `"false"` ⇒ off) with save/restore.
- `provision.test.ts`: pure write-planner (per `docs/inbox-pipeline-testing.md`)
  — creates user/workspace/membership only when missing; never touches a
  workspace holding unmarked data (reuse `assessDemoTarget`).
- Session route: no cookie minted on any gate failure; `no-store`; DELETE clears
  both cookies (mirror logout).
- Manual acceptance: production URL with flag unset ⇒ `/lab` 404 and normal
  routes still redirect to `/login`; lab URL without key ⇒ blocked; with key ⇒
  demo workspace with banner.
- Existing suites to keep green: `test:finesse-demo`, `test:governance`, plus
  `eslint .`, `npx tsc --noEmit`, `next build`.

## 11. Environment variables & manual Vercel configuration

New (all server-side; **no `NEXT_PUBLIC_*` gating**):

| Variable | Scope | Value |
|---|---|---|
| `SEVENEF_LAB_PREVIEW_ENABLED` | lab deployment only | `true` (unset in Production) |
| `SEVENEF_LAB_ACCESS_KEY` | lab deployment only | long random secret |
| `SEVENEF_LAB_ALLOWED_HOSTS` | lab deployment (optional) | comma-separated hostnames |
| `AUTH_SECRET` | lab deployment | **distinct** value from production |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | lab deployment | demo DB credentials |

Manual steps in Vercel: create the demo Turso DB; add the branch-scoped env
values (Settings → Environment Variables → scope to the lab branch, or a
separate Vercel project for the lab); keep Deployment Protection enabled for
previews; never add the lab vars to the Production environment. Production needs
no changes at all.

## 12. Decisions requiring owner approval before coding

- **D1 — Data source:** dedicated demo Turso DB (recommended) vs flagged demo
  workspace inside the production DB.
- **D2 — Pending branch history:** the designated branch carries 23 unmerged
  commits (INBOX-DATA/TRANSPORT + Finesse demo). Integrate them into `master`
  first (per the anti-duplication rule), or accept that the Lab front stacks on
  top of them?
- **D3 — Deployment model:** long-lived lab branch with branch-scoped preview
  env vars vs a separate Vercel project for the lab.
- **D4 — Access layering:** keep Vercel Deployment Protection + app access key
  (recommended) vs app key only.
- **D5 — Lab identity capabilities:** `editor` role with write access inside the
  demo workspace (interactive demos; recommended, data is fake and isolated) vs
  read-only `VIEWER` membership.
- **D6 — Navigation model:** after entering the lab, link into the normal
  surfaces (`/today`, `/calendario`…) on the lab deployment (recommended — full
  fidelity, zero duplication) vs wrapping everything under `/lab/*` re-renders.
