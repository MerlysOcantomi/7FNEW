# CORE-00 — Current Core Audit and Baseline

> **Mission:** CORE-00 (7F Evolution, Core-first track).
> **Branch:** `7f-evolution`. **Scope:** audit only — no production code, schema,
> migration, data, infrastructure or Finesse/Beauty change was made.
> **Language:** English (product/code source language, per `AGENTS.md` §6).

---

## 1. Executive summary

7F is a **Next.js 16 / React 19 App Router multi-tenant SaaS** running on
**Turso/libSQL through Prisma 7 with the libSQL driver adapter**. The Core is
**substantially better than its reputation in some areas and substantially worse
in others**, and the gap is not where a name-based reading would suggest.

**What is genuinely solid:**

- The **workspace authorization layer** (`core/auth/workspace-auth.ts`,
  `core/workspace-context.ts`) is well designed, documents its own threat model,
  and already closed a real cross-tenant escalation with
  `requireRoleInWorkspace` (path-scoped) vs `requireWorkspaceRole` (cookie-scoped).
- **Guard coverage on the API surface is high**: **125 of 153** route files carry
  an in-handler guard (**314** workspace-guard call sites, 386 counting the
  platform and portal guards); almost every module service takes `workspaceId` as
  a mandatory parameter.
- The **control plane** (`PlatformAdmin` + `/system` + `PlatformAuditLog`) is
  correctly orthogonal to workspace membership, with defence-in-depth (JWT
  fast-path + DB re-check).
- The **test baseline is real and green**: **1,199 tests, 0 failures**, and
  `tsc --noEmit` and `next build` both pass clean.

**What is genuinely broken or dangerous:**

1. **`Usuario` is a global, un-tenanted model** exposed through
   `/api/usuarios` with zero workspace filtering — a confirmed cross-tenant read
   *and write* path (Critical).
2. **Schema deployment has no migration history.** `prisma/migrations/` does not
   exist. The schema reaches production through a hand-written
   `prisma/push-turso.ts` (42 tables) plus 6 ad-hoc `scripts/migrate-*.ts` plus 2
   loose `prisma/sql/*.sql` files — and **7 models declared in
   `schema.prisma` have no `CREATE TABLE` statement anywhere in the repo**,
   including `Workspace` and `WorkspaceMember` (Critical).
3. **Uploaded files are stored publicly with no tenant in the path**
   (`core/storage.ts` → Vercel Blob, `access: "public"`, `addRandomSuffix: false`,
   path `uploads/<timestamp>-<filename>`) (High).
4. **The middleware fails open** on `/api/**` when `AUTH_SECRET` is missing, and
   `core/crypto.ts` falls back to an **all-zero encryption key** in the same
   condition — the two failure modes compound (High).
5. **`/api/inbox/public/send` is unauthenticated, unrate-limited, and triggers
   AI + outbound email** using a workspace slug as the only key (High).
6. **Mock-only pages sit in primary navigation** (`/comunicacion`,
   `/departamentos`, `/finanzas`, `/biblioteca`, `/motor`, `/identidad`), directly
   contradicting `docs/ways-of-working.md` §5 which states stubs are hidden
   (High, product-integrity).

**Verdict on the central question — can Smart Inbox stand alone on this Core?**
**Yes, structurally.** The Inbox module is the most mature part of the codebase
(transport contracts, ingestion envelope, identity resolution, delivery
projection, `WorkspaceTask` canonicalisation all exist and are tested). Its
coupling to "full 7F" is mostly **navigation and config**, not data or service
coupling. The blockers are Core-wide, not Inbox-specific: schema deployment
discipline, file storage tenancy, and the `Usuario`/`Tarea` legacy plane.

**Recommended first mission:** **CORE-01 — tenant-scope `Usuario` reads and close
the `/api/usuarios` cross-tenant hole.** It is small, isolated, has a confirmed
security impact, and needs no schema change to be made *safe* (see §17).

---

## 2. Verified repository baseline

All values verified on 2026-08-05 from the live remote, not assumed.

| Item | Value |
|---|---|
| Repository | `https://github.com/MerlysOcantomi/7FNEW` (`origin`, fetch + push) |
| Branch used | `7f-evolution` (tracking `origin/7f-evolution`) |
| `origin/7f-evolution` HEAD | `312785fb270ed334ff2af121e280c1a03bed02bd` |
| `origin/master` HEAD | `312785fb270ed334ff2af121e280c1a03bed02bd` |
| Ahead / behind | `0 / 0` — the two branches are **identical** |
| Last commit date | `2026-07-26 15:27:44 +0000` |
| Last commit message | `LEGACY-COPILOT-REMOVAL-02: remove legacy Copilot UI` |
| Working tree at start | **Clean** (`git status --short` empty) |
| Foreign/unknown changes | **None found** |
| `git diff --check` | Clean |

Commands run, in order:

```
git status --short                      # empty
git remote -v
git fetch origin --prune
git ls-remote --heads origin            # refs/heads/7f-evolution present
git checkout -B 7f-evolution origin/7f-evolution
git pull --ff-only origin 7f-evolution  # Already up to date
```

The mission brief's stated origin commit `312785fb…` **is still the current HEAD**
of both `7f-evolution` and `master`. No divergence has occurred since the branch
was created.

> **Note on branch naming:** the execution harness for this session pre-created a
> branch named `claude/7f-evolution-core-audit-gd90ob`. That branch was **not
> used and not modified**; all work happened on `7f-evolution` as the mission
> requires. No new branch was created — `7f-evolution` already existed on the
> remote and was simply checked out.

---

## 3. Current Core architecture map

### 3.1 Stack and tooling

| Concern | Reality (evidence) |
|---|---|
| Framework | Next.js **16.1.6**, React **19.2.4**, App Router (`package.json`) |
| Language | TypeScript **5.7.3**, `strict: true`, `target: ES6`, `moduleResolution: bundler` (`tsconfig.json`) |
| Package manager | **npm** — `package-lock.json` (488 KB) is the only lockfile present |
| ORM / client | **Prisma 7.4.1** with `@prisma/adapter-libsql` 7.4.1 + `@libsql/client` 0.17.0 |
| Prisma generator | `provider = "prisma-client"`, output `../generated/prisma` (gitignored) |
| Datasource | `provider = "sqlite"` (`prisma/schema.prisma:6-8`) — **no `url` in the schema block**; the URL is injected at runtime by `core/db.ts` |
| Styling | Tailwind CSS 4.1.13 + shadcn/radix; single `styles/globals.css` |
| Auth | Custom — `jose` JWT in an httpOnly cookie; Google OAuth; no NextAuth |
| Deployment | Vercel (`vercel.json`) |
| CI | **None.** There is no `.github/` directory and no workflow file anywhere in the repo |

### 3.2 Path aliases (`tsconfig.json`)

`@/*` → repo root · `@core/*` → `core/` · `@modules/*` → `modules/` ·
`@engines/*` → `engines/` · `@tools/*` → `tools/`

### 3.3 Directory shape (file counts)

```
components 284 · app 261 · modules 172 · core 170 · agents 56 · engines 42
lib 33 · scripts 25 · hooks 13 · tools 9 · prisma 6
```

### 3.4 Layer responsibilities

- **`core/`** — cross-cutting foundation: `db.ts`, `api.ts`, `auth/*`,
  `workspace.ts`, `workspace-context.ts`, `verticals.ts`, `crypto.ts`,
  `storage.ts`, `activity.ts`, `i18n/*`, `inbox/*` (channel & filter registries),
  `registry/*` (module manifests), `system/*` (control plane),
  `vertical-packs/*`, `voice/*`, `notifications/*`, `personalization/*`,
  `services/*`.
- **`modules/`** — 19 business modules, each typically `service.ts` +
  `validation.ts` + `types.ts` (+ `manifest.ts` for registered ones).
- **`engines/`** — `ai/` (OpenAI + DeepSeek providers, prompts, modes) and
  `presence/` (public site engine, 24 files, heavily tested).
- **`agents/`** — `fanny/`, `forte/` (phase1, phase2, runtime, semantic,
  verticals), `finesse/`, `freya/`.
- **`lib/`** — **thin re-export shims** pointing at `core/`. Every file in
  `lib/auth/*`, `lib/db.ts`, `lib/workspace.ts`, `lib/workspace-context.ts`,
  `lib/storage.ts`, `lib/activity.ts`, `lib/ai/index.ts` carries the comment
  `// Re-export from new location — will be removed after full migration`.
  A partially-completed `lib/` → `core/` migration.

### 3.5 Routes

- **153 API route files** under `app/api/**`.
- **~78 page routes** under `app/**/page.tsx`.
- **Zero server actions** — `grep '"use server"'` returns **0 files**. All
  mutations go through API routes. This is architecturally consistent and
  simplifies the audit: there is exactly one class of entry point to secure.

### 3.6 Middleware (`middleware.ts`, 6.8 KB)

Matcher: `/((?!_next/static|_next/image|favicon.ico).*)` — effectively everything.

Three gates, in order:

1. **Public bypass** — `PUBLIC_PATHS = ["/login", "/api/auth", "/cliente/login",
   "/api/cliente/auth", "/api/inbox/public", "/api/inbox/email/inbound",
   "/api/inbox/webhooks", "/widget", "/sites", "/api/sites"]`.
2. **Client-portal gate** — cookie `7f-client-session`, JWT `type === "client"`,
   injects `x-client-id` / `x-client-email`.
3. **Internal gate** — cookie `7f-session`, injects `x-user-id`,
   `x-user-email`, `x-user-role`; then a **legacy global RBAC** level check
   (`admin`=3 / `editor`=2 / `viewer`=1) against `ADMIN_PATHS = ["/admin"]` and
   `EDITOR_PATHS = ["/finanzas","/facturacion","/motor","/calendario","/contenido","/agente"]`;
   then a **platform gate** on `/system` + `/api/system` using the
   `platformRole` JWT claim.

Presence custom-domain routing is **deliberately not** in the middleware — the
comment at `middleware.ts:66-72` records that a previous host-rewrite hijacked the
production domain and was reverted.

### 3.7 Persistence

`core/db.ts` (22 lines) is the single DB entry point:

```ts
const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
const dbToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN
if (!dbUrl) { throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set") }
const adapter = new PrismaLibSql({ url: dbUrl, authToken: dbToken })
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })
```

The `throw` is at **module scope**, so any file importing `@core/db` — directly or
transitively — cannot be loaded without DB env. This is why `test:inbox-transport`
fails in a bare environment (§13).

`prisma/schema.prisma`: **1,581 lines, 52 models, 0 enums, 0 `Json` columns,
0 `@db.*` native types, 0 `Bytes` columns, 10 `Float` columns, 10 `Boolean`
columns, 61 `@default(now())`, 36 `@updatedAt`, 45 `onDelete: SetNull`.**

### 3.8 Jobs / cron / deferred work

- **One cron**: `vercel.json` → `/api/cron/imap-sync` every 5 minutes.
- **No queue, no worker, no durable job store.** Deferred work is fire-and-forget
  `void (async () => {...})()` inside request handlers — e.g.
  `app/api/attachments/route.ts:runScanInBackground`,
  `app/api/inbox/public/send/route.ts` (identity dual-write, ack email,
  `runConversationIntelligence`).

### 3.9 Files / attachments

`core/storage.ts` → `@vercel/blob`:
`put(path, file, { access: "public", contentType, addRandomSuffix: false })`,
with `getStoragePath(module, fileName) = "${module}/${timestamp}-${safeName}"`.

### 3.10 Internationalisation

`core/i18n/` — locale cookie, resolve chain, formatters, and a typed UI
dictionary under `core/i18n/ui/{en,es,de,fr,it}`. `SUPPORTED_LOCALES` are
canonical codes; `User.locale` is the personal UI language,
`Workspace.config.locale` is the business default. `de` is partially populated in
`core/workspace.ts:WS_CTX_LABELS`; `fr`/`it` fall back to English by design
(documented at the lookup site). **148 i18n tests pass.**

### 3.11 Theming

Single `styles/globals.css` with CSS custom properties (`--app-surface-dark`,
`--border-dark`, `--tab-info`, …) plus `next-themes`. Multiple theme-related
docs exist (`docs/theme-token-map.md`, `docs/theme-safe-bulk-migration-plan.md`,
`docs/theme-status-color-pass-plan.md`, `docs/theme-light-visual-qa-plan.md`) and
about a dozen unmerged `claude/theme-*` remote branches — theming is an
**in-flight, unlanded workstream**.

### 3.12 Modules / verticals configuration

- `core/registry/module-registry.ts` — an in-memory `ModuleRegistry` with manual
  registration (`Phase 0: manual registration only (no auto-discovery)`).
- `core/registry/pilot-manifests.ts` — registers only `usuarios` and `inbox`.
- `Vertical` table + `core/vertical-packs/*` built-in packs. `core/verticals.ts`
  exposes `BUILTIN_VERTICALS` (currently just Beauty) so a vertical is selectable
  before the DB is seeded; a real DB row always wins.
- Module enablement lives in `Workspace.config.modules` (a JSON string), is
  **platform-admin-only** (`sanitizeTenantConfig` strips `modules` from tenant
  patches — `core/auth/workspace-governance.ts`), and is written via
  `POST /api/workspaces/[id]/modules` guarded by `requirePlatformAdmin()`.

### 3.13 Classification of the codebase

| Class | Examples (evidence) |
|---|---|
| **Productive** | `core/auth/*`, `core/workspace*.ts`, `modules/inbox/*`, `modules/tasks/*`, `modules/today/*`, `engines/presence/*`, all `app/api/**` with guards |
| **Prototype / lab** | `app/voice-lab/**` (17 test files, gated by `VOICE_LAB_ENABLED`), `agents/forte/phase1`, `agents/forte/phase2` |
| **Simulated by design (honest)** | `app/voice-lab/tools.ts` — header: *"Voice Lab fake tools (CORE-VOICE-0B.1) — read-only / simulated, NEVER write"*; `app/voice-lab/scope.ts:42` `name: "scope-placeholder-core-voice-2-pending"` |
| **Mock UI presented as product** | `app/comunicacion/page.tsx`, `app/departamentos/page.tsx`, `app/finanzas/page.tsx`, `app/biblioteca/page.tsx`, `app/motor/page.tsx`, `app/identidad/page.tsx`, `app/entrada/page.tsx` — all hardcoded arrays, all in the sidebar |
| **Demo data** | `modules/overview/demo-data.ts`, `scripts/finesse-demo-data.ts`, `scripts/seed-finesse-demo.ts`, `scripts/seed-presence-demo.ts`, `prisma/seed.ts` |
| **Dead code / dead models** | `ClientProject`, `ClientInvoice`, `ClientFile` (0 code references); `migration.sql` at repo root |
| **Doc ≠ implementation** | `docs/ways-of-working.md` §4/§5 says stubs are hidden from primary nav — they are not (§11) |

---

## 4. Authentication and authorization findings

### 4.1 How identity works

- **Internal users:** Google OAuth → `app/api/auth/callback/google/route.ts` →
  `createSession()` signs an HS256 JWT (`jose`) with
  `{ userId, email, role, nombre, avatar, platformRole }`, 7-day expiry, stored in
  the httpOnly cookie `7f-session`. `AUTH_SECRET` is the signing key.
- **Dev bypass:** `POST /api/auth/dev-login` — only when
  `DISABLE_GOOGLE_AUTH === "true"`; creates the `User` *and* an `AllowedEmail`
  row and issues a session with an arbitrary caller-chosen role
  (`role` defaults to `"admin"`).
- **Portal clients:** email + password (`scrypt`, `core/auth/password.ts`) →
  `7f-client-session` cookie, 30-day expiry, `type: "client"` claim.
- **Invite model:** `AUTH_INVITE_ONLY` defaults to **true** (invite-only via
  `AllowedEmail`); `AUTH_INVITE_ONLY=false` enables self-serve signup with
  `AUTH_DEFAULT_USER_ROLE`.
- **Platform bootstrap:** `PLATFORM_BOOTSTRAP_EMAILS` auto-promotes listed emails
  to `PlatformAdmin{SUPER_ADMIN}` on login (promote-only, never demote).

### 4.2 Findings

---

**F-AUTH-01 — Middleware fails open on `/api/**` when `AUTH_SECRET` is unset**
**Severity: High** · Evolution

*Evidence* — `middleware.ts:110-117`:

```ts
const secret = getSecret()
if (!secret) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()          // ← no session required
  }
  return NextResponse.redirect(new URL("/login?error=config", request.url))
}
```

*Affected* — `middleware.ts:getSecret`, `middleware.ts` internal gate.

*Impact* — If `AUTH_SECRET` is ever missing or empty in an environment (a fresh
Vercel preview, a misconfigured redeploy), **every API route becomes reachable
without a session**. Routes that rely on the in-handler guards still 401 (the
guards call `getSessionFromCookies()`, which throws on a missing secret and is
converted to a 500 by `handleError`), but the ~28 routes without in-handler
guards (§4.3) are fully open, including `/api/health` and every `/api/ai/*` LLM
proxy.

*Recommended treatment* — Fail **closed**: return 401/503 for `/api/**` when the
secret is absent, matching the UI branch which already redirects.

---

**F-AUTH-02 — `core/crypto.ts` falls back to an all-zero key**
**Severity: High** · Evolution

*Evidence* — `core/crypto.ts:12-19`:

```ts
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.warn("[crypto] AUTH_SECRET is not set — credentials will use insecure fallback key")
    return Buffer.alloc(32, 0)
  }
  return scryptSync(secret, SALT, 32)
}
```

*Affected* — `core/crypto.ts` (`encryptJson`/`decryptJson`), consumed by
`ChannelConnection.credentials` (IMAP/SMTP passwords) via
`modules/inbox/imap-sync.ts:82` and `modules/inbox/email-smtp.ts:45`.

*Impact* — Under the same misconfiguration as F-AUTH-01, **customer mailbox
passwords are AES-256-GCM encrypted with a publicly-derivable all-zero key**.
Anyone with a DB dump can decrypt them. Secondary issue: the key is derived from
`AUTH_SECRET`, the *same* secret used to sign session JWTs — key reuse across two
security purposes with a constant salt (`"7f-channel-credentials"`).

*Recommended treatment* — Throw instead of falling back; introduce a dedicated
`CHANNEL_ENCRYPTION_KEY`. Re-encryption of existing rows is a separate, planned
migration — **not** an Evolution side effect.

---

**F-AUTH-03 — `handleError` returns raw internal error text to clients**
**Severity: Medium** · Evolution

*Evidence* — `core/api.ts:45-46`:

```ts
const detail = error instanceof Error ? error.message : String(error)
return errorResponse("INTERNAL_ERROR", `Internal error: ${detail}`, 500)
```

*Impact* — Prisma/libSQL error strings (table names, column names, constraint
names, sometimes parameter values) are returned to any authenticated caller.
Useful reconnaissance for an attacker; noisy for support.

*Recommended treatment* — Log the detail server-side, return a generic message
plus a correlation id.

---

**F-AUTH-04 — `/api/health` leaks environment metadata and cross-tenant counts**
**Severity: Medium** · Evolution

*Evidence* — `app/api/health/route.ts` returns `DATABASE_URL_preview` (first 15 +
last 10 characters of the connection URL), `DATABASE_AUTH_TOKEN: "set (N chars)"`,
and a **global, un-tenanted** `SELECT COUNT(*) FROM Cliente` plus
`db.cliente.count()`.

*Impact* — Discloses the Turso host, token length, and the platform-wide customer
count to any authenticated user of any workspace. Combined with F-AUTH-01, to
anyone at all.

*Recommended treatment* — Gate behind `requirePlatformAdmin()` or reduce to a
bare `{ ok: true }`.

---

**F-AUTH-05 — `/api/ai/*` are unauthenticated-in-handler LLM proxies with no
tenant, no quota and no rate limit**
**Severity: Medium** · Evolution

*Evidence* — `app/api/ai/route.ts`, `app/api/ai/tareas/route.ts`,
`app/api/ai/clientes/route.ts`, `app/api/ai/proyectos/route.ts`,
`app/api/ai/finanzas/route.ts`, `app/api/ai/facturacion/route.ts`,
`app/api/ai/resume/route.ts`, `app/api/ai/correct/route.ts`,
`app/api/ai/chat/route.ts` — none call any auth or workspace helper; they accept a
free-form `prompt` (up to 15,000 chars) and forward it to `askMotorIA`.

*Impact* — Any authenticated user in any workspace can use the platform's OpenAI /
DeepSeek keys as a general-purpose LLM at the platform's cost. No per-workspace
attribution exists, so abuse is neither detectable nor billable.

*Recommended treatment* — Add `requireReadAccess()` + per-workspace rate limiting.
These routes also appear to be **legacy** (the modern surfaces are
`/api/assistant/finesse`, `/api/inbox/composer/assist`,
`/api/inbox/conversations/[id]/ask`) — verify usage and prefer deletion.

---

**F-AUTH-06 — Legacy global RBAC still gates real pages**
**Severity: Medium** · Evolution

*Evidence* — `middleware.ts:37-46` gates `/finanzas`, `/facturacion`, `/motor`,
`/calendario`, `/contenido`, `/agente`, `/admin` on `User.role`
(`admin|editor|viewer`), a column the schema itself marks
`@deprecated` (`prisma/schema.prisma:318-322`): *"SHOULD migrate to per-workspace
`WorkspaceMember.role` … Do not introduce new dependencies on this column."*

*Impact* — A user who is `OWNER` of workspace B but has global `User.role =
"viewer"` is blocked from `/calendario` in **their own** workspace. Conversely a
global `admin` passes the page gate for every workspace (the API guards still
protect the data, so this is a UX/consistency bug rather than a data breach).

*Recommended treatment* — Replace the Edge page gate with a
`WorkspaceMember`-derived claim, or drop it and rely purely on the API guards.

---

### 4.3 Routes with no in-handler auth or workspace guard

28 route files. Classified:

| Route | Assessment |
|---|---|
| `/api/auth/callback/google`, `/api/auth/login/google`, `/api/auth/logout`, `/api/cliente/auth/login`, `/api/cliente/auth/logout` | **Correct** — these *are* the auth endpoints |
| `/api/auth/dev-login` | **Correct-ish** — refuses unless `DISABLE_GOOGLE_AUTH === "true"` |
| `/api/inbox/email/inbound` | **Correct** — validates `RESEND_WEBHOOK_SECRET`, returns 503 when unconfigured (fails closed) |
| `/api/cron/imap-sync` | **Correct** — `CRON_SECRET` bearer; **fails closed in production** if the secret is missing (`isAuthorized`, `status: 500`) |
| `/api/inbox/webhooks/[provider]` | **Correct, and honest** — resolves tenant from `[provider, providerAccountId]` on `ChannelConnection`, never from the payload; answers `accepted: false` because no integration is live |
| `/api/system/audit`, `/api/system/me`, `/api/system/workspaces` | **False positive** — they use `requireAnyPlatformRole()`, which the guard-name grep did not match |
| `/api/i18n/locale` | Low risk — writes a locale cookie only |
| `/api/health` | **F-AUTH-04** |
| `/api/ai/*` (9 routes) | **F-AUTH-05** |
| `/api/inbox/public/send`, `/api/inbox/public/conversations/[id]/messages` | **F-WS-02, F-WS-03** |
| `/api/inbox/track/confirm/[token]`, `/api/inbox/track/open/[token]` | Token-scoped by design; not reviewed in depth |
| `/api/sites/[slug]/reception` | Public presence reception — **has** its own rate limiting + sanitisation (`engines/presence/reception-security.ts`) |

---

## 5. Workspace and multitenancy matrix

`resolveRequiredWorkspace` (`core/workspace-context.ts`) resolves the tenant in a
documented order, **validating membership at every step**:

1. `x-workspace-id` header → `db.workspaceMember.findUnique` → 403 if absent.
2. `wf_workspace` cookie → membership check → falls through if invalid.
3. First membership by `createdAt asc` → sets the cookie.
4. Otherwise `WorkspaceError("NO_WORKSPACE", …, 404)`.

`requireWorkspaceRole` additionally **strips the `x-workspace-id` header** unless
the path is in `HEADER_ALLOWLIST = ["/api/ai/agent", "/api/admin"]`, and when it
is allowed requires `ADMIN`+ in that workspace. This is a well-constructed guard.

### 5.1 Entry-point matrix

| Entry point | Tenant source | Verdict |
|---|---|---|
| App pages (authenticated) | `requireReadAccess()` in the API they call | OK |
| `app/api/**` (125 of 153 files) | `requireXAccess()` → `resolveRequiredWorkspace` | **OK** |
| `/api/workspaces/[id]/**` | `requireViewerInWorkspace(id)` / `requireAdminInWorkspace(id)` — **path param, not cookie** | **OK** (this is the fix for the documented escalation) |
| `/api/workspaces/[id]/modules` | `requirePlatformAdmin()` | OK (governance) |
| `/api/system/**` | `requirePlatformRole` + Edge `platformRole` claim | OK |
| `/api/cliente/**` (portal) | `getRequiredPortalContext()` → `Cliente.workspaceId` | OK |
| `/api/usuarios/**` | **none** | **F-WS-01 (Critical)** |
| `/api/inbox/public/send` | `Workspace.slug` from the request body | **F-WS-02 (High)** |
| `/api/inbox/public/conversations/[id]/messages` | `siteKey` + `visitorId` from the query string | **F-WS-03 (Medium)** |
| `/api/inbox/webhooks/[provider]` | `ChannelConnection[provider, providerAccountId]` | OK |
| `/api/inbox/email/inbound` | resolved inside `processInboundEmail` | OK (webhook secret enforced) |
| `/api/cron/imap-sync` | intentionally cross-tenant sweep; each connection carries its own `workspaceId` | OK, documented |
| Uploads (`/api/attachments`, `/api/inbox/attachments/upload`) | DB row is scoped; **the blob path is not** | **F-WS-04 (High)** |
| Server actions | none exist | N/A |
| Jobs / queues | none exist | N/A |

### 5.2 Service-layer scoping

Every `modules/*/service.ts` takes `workspaceId` as a **required** parameter and
filters on it — except one:

```
automatizaciones 11 · calendario 11 · campanas 11 · clientes 14 · contenido 20
documentos 11 · facturacion 11 · finanzas 11 · inbox 73 · notas 11 · overview 8
proyectos 12 · tareas 11 · tasks 29 · usuarios 0     ← ***
```

### 5.3 Findings

---

**F-WS-01 — `Usuario` is a global model; `/api/usuarios` reads and writes across
every tenant**
**Severity: CRITICAL** · Evolution

*Evidence* —

`prisma/schema.prisma:282-293` — the `Usuario` model has **no `workspaceId`
column and no `Workspace` relation**:

```prisma
model Usuario {
  id           String   @id @default(cuid())
  nombre       String
  email        String   @unique
  rol          String   @default("miembro")
  departamento String?
  estado       String   @default("activo")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  tareas Tarea[]
}
```

`modules/usuarios/service.ts` — every function is un-scoped:

```ts
export async function list(params: ListParams) {
  const where: Prisma.UsuarioWhereInput = { ...(rol && { rol }), ... }   // no workspaceId
  const [data, total] = await Promise.all([
    db.usuario.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.usuario.count({ where }),
  ])
}
export async function getById(id: string)  { return db.usuario.findUnique({ where: { id }, include: { tareas: true } }) }
export async function update(id: string, data) { return db.usuario.update({ where: { id }, data }) }
export async function remove(id: string)   { return db.usuario.delete({ where: { id } }) }
```

`app/api/usuarios/route.ts` and `app/api/usuarios/[id]/route.ts` call them with
only a *presence* check:

```ts
export async function GET(request: NextRequest) {
  await requireReadAccess(request)          // ← result discarded; workspaceId never used
  const { data, total } = await service.list({ ...query, skip, take: pageSize })
}
export async function DELETE(request: NextRequest, { params }: Params) {
  await requireAdminAccess(request)         // ← ADMIN in *any* workspace
  await service.remove(id)
}
```

*Affected files/symbols* — `prisma/schema.prisma:282` (`model Usuario`),
`modules/usuarios/service.ts` (all 5 exports),
`app/api/usuarios/route.ts` (GET, POST),
`app/api/usuarios/[id]/route.ts` (GET, PATCH, DELETE),
`app/usuarios/page.tsx`, `core/registry/pilot-manifests.ts` (registers
`usuariosManifest`).

*Practical impact* —
**Read:** any `VIEWER` in any workspace can `GET /api/usuarios` and enumerate
every `Usuario` row on the platform — name, email, role, department — plus, via
`GET /api/usuarios/{id}`, that person's `tareas` (task titles, descriptions,
deadlines) regardless of tenant. `getById` uses `include: { tareas: true }` with no
filter, so **another tenant's task content leaks through the relation**.
**Write:** any `ADMIN` of *any* workspace can `PATCH` or `DELETE` any `Usuario` on
the platform. Because `Tarea.usuarioId` is `onDelete: SetNull`, deleting a foreign
`Usuario` silently unassigns that tenant's tasks.
`Usuario.email @unique` is also platform-global, so two tenants cannot have the
same team member email — and a `POST` collision (409) reveals that the email
exists in another tenant.

*Recommended treatment* — Two stages. **Stage 1 (CORE-01, no schema change):**
route all `Usuario` access through the workspace's `WorkspaceMember` set, or —
faster and fully safe — make `/api/usuarios` return only rows correlated to the
active workspace's members by email, and make PATCH/DELETE refuse any row not in
that set. **Stage 2 (CORE-DB block):** add `Usuario.workspaceId`, backfill,
change `@unique(email)` to `@@unique([workspaceId, email])`. Stage 2 is a schema
change and belongs with the DB block, not with CORE-01.

*Evolution or 7F Next* — **Evolution.** This is a live data-exposure bug, not an
architecture preference. (The longer-term convergence of `Usuario` into `User` +
`WorkspaceMember` is 7F Next.)

---

**F-WS-02 — `/api/inbox/public/send` is an unauthenticated, unrate-limited write
+ AI + email amplifier keyed on a public slug**
**Severity: High** · Evolution

*Evidence* — `app/api/inbox/public/send/route.ts`. The route is in
`PUBLIC_PATHS`, serves `Access-Control-Allow-Origin: "*"`, and its only tenant
key is:

```ts
const workspace = await db.workspace.findUnique({ where: { slug: siteKey } })
```

`Workspace.slug` is public (it is the `/sites/<slug>` URL segment, and
`ensureUserHasDefaultWorkspace` derives it from the local part of the user's
email). With a valid slug the handler will, per request and with **no rate limit
and no captcha**:

1. `db.contact.create(...)` — unbounded contact rows,
2. `db.conversation.create(...)`,
3. `addMessage(...)` — unbounded message rows,
4. `recordInboundIdentity(...)` — `ExternalIdentity` + `ContactIdentityLink` rows,
5. `notifyNewConversation(...)` — one `Notification` row **per workspace member**,
6. `sendAcknowledgmentEmail({ contactEmail: visitorEmail, ... })` — an email to an
   **attacker-supplied address**, from the tenant's configured sender,
7. `runConversationIntelligence(...)` — a **paid LLM call**.

The only gate is `isWebChatReceptionEnabled(workspace.config)` (403 when web chat
is off). `content` is not length-bounded here (contrast
`engines/presence/reception-security.ts`, which has `MAX_MESSAGE_LENGTH = 2000`,
`sanitizeVisitorText`, `isValidVisitorId` and `DEFAULT_RATE_LIMIT = 20/min` — and
is used by the *other* public surface, `/api/sites/[slug]/reception`).

*Practical impact* — Inbox flooding, notification spam for every member,
uncapped LLM spend, and use of the tenant's verified sender to email arbitrary
third parties (reputation / abuse-report risk). Prompt-injection surface into
Fanny with no sanitisation.

*Recommended treatment* — Reuse the primitives that already exist in
`engines/presence/reception-security.ts` (sanitise, length-cap, validate
`visitorId`, rate-limit per `siteKey`+IP) and require a separate, rotatable
`siteKey` distinct from `Workspace.slug`.

---

**F-WS-03 — Public conversation read is authorised by a client-chosen `visitorId`**
**Severity: Medium** · Evolution

*Evidence* — `app/api/inbox/public/conversations/[id]/messages/route.ts`:

```ts
const conversation = await db.conversation.findFirst({
  where: { id, workspaceId: workspace.id, channel: "web_chat", contact: { source: visitorId } },
  include: { messages: { where: { isInternal: false }, ... } },
})
```

`visitorId` is generated and stored by the browser widget and echoed back by the
caller; `id` is a `cuid`. There is no signature, no `isValidVisitorId` check
(the validator exists but is used only by the presence route), and no rate limit.

*Impact* — Anyone who obtains or predicts a `(conversationId, visitorId)` pair
can read the full non-internal transcript of that conversation. `cuid` makes
blind enumeration impractical, so this is exposure-on-leak rather than open
access — but the pair is stored in browser `localStorage` and travels in a URL
query string (log-visible).

*Recommended treatment* — Sign the visitor session (short-lived HMAC token)
instead of trusting a raw client identifier; apply `isValidVisitorId` and a rate
limit.

---

**F-WS-04 — Uploaded files are world-readable and carry no tenant in their path**
**Severity: High** · Evolution

*Evidence* — `core/storage.ts`:

```ts
export async function uploadToStorage(file: Buffer, path: string, contentType: string) {
  const blob = await put(path, file, { access: "public", contentType, addRandomSuffix: false })
  return blob.url
}
export function getStoragePath(module: string, fileName: string): string {
  const timestamp = Date.now()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${module}/${timestamp}-${safeName}`      // ← no workspaceId
}
```

Call sites: `app/api/attachments/route.ts:30` (`getStoragePath("uploads", …)`) and
`app/api/inbox/attachments/upload/route.ts:44`
(`getStoragePath("inbox-attachments", file.name)`).

*Impact* — Every customer document, invoice scan, ID photo and inbox attachment
across all tenants lands in **two flat, public, tenant-less namespaces**. The DB
row (`Attachment.workspaceId`) is correctly scoped, but the blob URL bypasses the
application entirely: anyone holding the URL reads the file, forever, with no
auth. `addRandomSuffix: false` makes the object key fully determined by
`(module, epoch-ms, sanitised filename)` — a far smaller search space than a
random key. There is no deletion of the blob on `DELETE /api/attachments/[id]`
either; that handler still tries `unlink(join(process.cwd(), "public",
attachment.url))`, a **local-filesystem path from the pre-Blob era applied to a
full URL** — it always fails silently, so **deleted attachments remain publicly
downloadable indefinitely**.

*Recommended treatment* — Prefix paths with `workspaceId`, re-enable
`addRandomSuffix`, move to private/token-scoped access with a signed-URL proxy
route, and fix the delete path to call `deleteFromStorage`. Existing objects need
a separate re-keying migration.

*Evolution or 7F Next* — Path/randomisation/delete fixes are **Evolution**; the
private-access + signed-URL proxy is Evolution too but larger — split it.

---

**F-WS-05 — `POST /api/setup/workspace-backfill` reassigns null-tenant rows to a
shared global workspace, and any workspace `OWNER` can trigger it**
**Severity: High** · Evolution

*Evidence* — `app/api/setup/workspace-backfill/route.ts`:

```ts
await requireOwnerAccess(request)                    // OWNER of *any* workspace
const workspace = await getOrCreateDefaultWorkspace() // creates/uses ws_default
for (const table of tables) {                        // 22 models
  await (db[table] as any).updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } })
}
await db.user.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } })
```

`getOrCreateDefaultWorkspace` and `DEFAULT_WORKSPACE_ID = "ws_default"` are both
marked `@deprecated` in `core/workspace.ts` with the note *"creates a shared
'default' workspace that breaks tenant isolation."*

*Impact* — A live, HTTP-reachable, unauthenticated-by-tenant endpoint that
performs a 23-table `updateMany` and **assigns other tenants' orphan rows to a
single shared workspace**. Any `OWNER` of any workspace can fire it. Combined with
the 13 models whose `workspaceId` is nullable (`String?`), the blast radius is
real.

*Recommended treatment* — Delete the route, or gate it behind
`requirePlatformSuper()` and make it a script rather than an endpoint. The same
applies to `POST /api/setup/client-auth-table`, which executes raw
`CREATE TABLE` / `CREATE UNIQUE INDEX` DDL against production from an HTTP
request with only `requireOwnerAccess`.

---

**F-WS-06 — 13 models have a nullable `workspaceId`**
**Severity: Medium** · Evolution (hardening) / 7F Next (schema convergence)

*Evidence* — `prisma/schema.prisma`, `workspaceId String?` on: `Cliente`,
`Proyecto`, `Tarea`, `Documento`, `Transaccion`, `Factura`, `Evento`, `Nota`,
`Automatizacion`, `Notification`, `Activity`, `InboxEntry`, `QRCode`,
`Attachment`, `Campaign`, `ContentPiece`, `ContentIdea`, plus `User.workspaceId`.
45 relations use `onDelete: SetNull`.

*Impact* — A null-tenant row is invisible to every scoped query (correct, and
`modules/today/aggregator.ts:27-29` documents exactly this) but is also
*unreachable and unowned* — it accumulates silently and is the exact input
F-WS-05 sweeps into a shared workspace. Deleting a `Workspace` `SetNull`s its
`Tarea`/`Evento`/`Cliente` rows instead of removing them, manufacturing more
orphans.

*Recommended treatment* — Audit and count orphans (read-only), then make
`workspaceId` non-nullable model by model with `onDelete: Cascade`. Schema work —
sequence it into the DB block.

---

**Confirmed non-findings (checked, correct):**
`/api/qr/**` (all three routes filter on `workspaceId`), `/api/search`,
`/api/contacts/search`, `/api/notifications/**` (scoped by `userId` +
`workspaceId`), `/api/attachments/**` DB access, all `modules/*/service.ts`
except `usuarios`, `modules/today/aggregator.ts` (explicit `workspaceId` guard
clause), `/api/cliente/**` portal routes.

---

## 6. Roles and permissions findings

**Three independent role systems coexist.**

| System | Values | Stored in | Checked by |
|---|---|---|---|
| **Legacy global** | `admin` / `editor` / `viewer` | `User.role` (`@deprecated`) | `middleware.ts` page gate; `AllowedEmail.role`; `/api/auth/dev-login` |
| **Workspace (canonical)** | `OWNER` / `ADMIN` / `MEMBER` / `VIEWER` | `WorkspaceMember.role` | `core/auth/workspace-auth.ts` — 314 guard call sites in `app/api` |
| **Platform (control plane)** | `SUPER_ADMIN` / `ADMIN` / `SUPPORT` / `BILLING` | `PlatformAdmin.role` | `core/auth/platform-auth.ts` + `middleware.ts` `platformRole` claim |

A **fourth, unrelated** role string exists: `Usuario.rol` (default `"miembro"`) —
an HR/directory attribute, not an authorisation input. It is never checked.

**Findings:**

- **F-ROLE-01 (Medium)** — `User.role` and `WorkspaceMember.role` are **not
  correlated**. Nothing keeps them consistent; `/api/auth/dev-login` lets the
  caller pick `User.role` freely (defaulting to `"admin"`), while
  `ensureUserHasDefaultWorkspace` always creates `WorkspaceMember{role: "OWNER"}`.
  Two sources of truth for "what may this person do".
- **F-ROLE-02 (Low, well-handled)** — `platformRole` is a JWT claim, so
  promotion/revocation only takes effect at next login. This is **explicitly
  documented** at `core/auth/session.ts:14-27` and mitigated: `requirePlatformRole`
  re-reads `PlatformAdmin` from the DB on every call
  (`core/auth/platform-auth.ts:88-101`). The Edge gate is a fast path only.
  **No action needed** — record it as understood.
- **F-ROLE-03 (Medium)** — Governance is enforced in exactly one place and it is
  correct: `sanitizeTenantConfig` (`core/auth/workspace-governance.ts`) strips
  `modules` from tenant config patches, `PATCH /api/workspaces/[id]` returns 403
  for `verticalKey`, and `POST /api/workspaces/[id]/modules` requires
  `requirePlatformAdmin()`. **The gap:** `TENANT_FORBIDDEN_CONFIG_KEYS` contains
  only `"modules"`. `Workspace.config` also holds `businessProfile`,
  `serviceCatalog`, `locale` and channel settings — anything plan-gated added
  later must be added to that list manually. There is no allow-list.
- **F-ROLE-04 (Medium)** — `Workspace.status` (`active|trial|suspended|archived`)
  is **not enforced anywhere**. The schema comment says so verbatim
  (`prisma/schema.prisma:35-40`): *"this column is observational — no part of the
  runtime reads it to gate access. Suspension is administrative-only until a
  future enforcement layer is added."* A suspended tenant keeps full access.
- **F-ROLE-05 (Low)** — Sensitive operations lacking a second factor: platform
  bootstrap via `PLATFORM_BOOTSTRAP_EMAILS` (env-driven self-promotion — the
  `.env.example` comment already warns to clear it), and the two `/api/setup/*`
  DDL/backfill endpoints (F-WS-05).

---

## 7. Data sources of truth

| Entity | Source of truth | Competing / legacy | Status |
|---|---|---|---|
| **Users (auth)** | `User` | `Usuario` (directory, global, no FK, correlated by email only) | **Split, unsafe** — F-WS-01 |
| **Workspaces** | `Workspace` | `DEFAULT_WORKSPACE_ID = "ws_default"` (deprecated but reachable via `/api/setup/workspace-backfill`) | Mostly clean |
| **Memberships** | `WorkspaceMember` | `User.workspaceId` (`@deprecated` single-workspace pointer) | Clean in code, stale column in DB |
| **Business Profile** | `Workspace.config.businessProfile` (JSON string) | — | Single source; JSON-in-TEXT |
| **Service catalog** | `Workspace.config.serviceCatalog` | `core/services/catalog.ts` resolution | Single source, layered |
| **Contacts** | `Contact` | `Cliente` (CRM) — **not** unified | Two people-models by design |
| **Multichannel identities** | `ExternalIdentity` + `ContactIdentityLink` | `Contact.source` (legacy visitor key, still used by `/api/inbox/public/send`) | Dual-write in progress |
| **Conversations** | `Conversation` | `InboxEntry` (legacy, still written by the widget path) | **Two entry models** |
| **Messages** | `Message` | — | Clean |
| **Message delivery** | `Message` + `modules/inbox/delivery-projection.ts` | — | Projection, documented |
| **Attachments (inbox)** | `MessageAttachment` (+ `attachmentKey` idempotency) | `Message.metadata` attachment arrays (backfilled by `scripts/backfill-message-attachments.ts`) | Migration in progress |
| **Attachments (generic)** | `Attachment` | — | Clean (DB); storage is not — F-WS-04 |
| **Tasks** | **`WorkspaceTask`** | `InboxTodo` (write-frozen, dual-written, `workspaceTaskId` link) + `Tarea` (legacy CRM, still live) | **Three task models** |
| **Events / calendar** | `Evento` | — | Clean |
| **Files (portal)** | `ClientAsset` | `ClientFile` — **dead** | Dead model |
| **Config** | `Workspace.config` (JSON string) merged over `Vertical.defaultConfig` | `BUILTIN_VERTICALS` in code | Documented precedence |
| **Modules** | `Workspace.config.modules` | `core/registry` in-memory manifests (only `usuarios` + `inbox` registered) | Two half-systems |
| **Verticals** | `Vertical` table | `core/vertical-packs/*` built-ins | Documented precedence (DB wins) |
| **Activity** | `Activity` | — | Clean |
| **Platform audit** | `PlatformAuditLog` (append-only, no FK by design) | — | Clean, well-designed |
| **AI classification** | `AIClassification` (1:1 with `Conversation`) | `Conversation.intent` vs `Conversation.category` — **separate by contract** | Clean |

---

## 8. Shared entity map

```
Workspace ──┬── WorkspaceMember ── User ──┬── PlatformAdmin (control plane, orthogonal)
            │                             └── Notification
            ├── Contact ──┬── Conversation ──┬── Message ── MessageAttachment
            │             │                  ├── ConversationAction
            │             │                  ├── ConversationRead
            │             │                  ├── ConversationDraft
            │             │                  ├── ConversationHandoff
            │             │                  ├── AIClassification (1:1)
            │             │                  └── InboxTodo (legacy) ⇢ WorkspaceTask
            │             └── ContactIdentityLink ── ExternalIdentity
            ├── ChannelConnection ──(conversations, messages)
            ├── WorkspaceTask  ◀── canonical work item
            ├── Cliente ──┬── Proyecto ── Tarea ── Usuario  ⚠ Usuario has NO workspaceId
            │             ├── Factura / Transaccion / Documento
            │             ├── ClientAuth (portal login, email @unique GLOBAL)
            │             ├── ClientAsset / ClientRequest ── ClientRequestAsset
            │             └── ClientProject / ClientInvoice / ClientFile   ⚠ DEAD (0 refs)
            ├── Evento · Nota · Automatizacion · Activity · Attachment · QRCode
            ├── Campaign · ContentPiece · ContentIdea
            ├── InboxEntry  ⚠ legacy entry model
            ├── ForteSnapshot (1:1)
            └── PresenceSite ──┬── PresencePublication
                               ├── PresenceDomain
                               ├── PresenceMedia
                               └── PresenceSubscription
Vertical  (global catalogue, no workspaceId — correct)
AllowedEmail (global invite list, no workspaceId — a workspace admin cannot invite)
PlatformAuditLog (global, append-only, actorId intentionally not an FK)
```

**Models with no `workspaceId`:** `Vertical`, `Workspace`, `Usuario` ⚠,
`PlatformAdmin`, `PlatformAuditLog`, `AllowedEmail`, `ClientAuth`,
`ClientProject` ⚠dead, `ClientInvoice` ⚠dead, `ClientFile` ⚠dead,
`ClientRequestAsset`. All are legitimate except `Usuario` (F-WS-01), the three
dead client models, and `AllowedEmail` (a product limitation, not a leak).

---

## 9. Legacy, duplicates and dual-write

### 9.1 Three task models (`docs/ways-of-working.md` §3 confirms this as known debt)

- **`WorkspaceTask`** — canonical. Read by `modules/today/aggregator.ts:107`,
  `modules/overview/service.ts:98`, `modules/agents/activity-aggregator.ts:70`,
  `modules/inbox/inbox-tasks-read.ts` (3 query sites). Written by
  `modules/tasks/service.ts:187`, `modules/inbox/todo-service.ts:377`,
  `modules/inbox/intelligence.ts:1091`, `modules/inbox/service.ts:1820`,
  `modules/inbox/inbox-tasks-write.ts:403`.
- **`InboxTodo`** — write-frozen, dual-written. `modules/inbox/todo-service.ts:374`
  creates the `InboxTodo` and the `WorkspaceTask` **in one transaction**, then
  writes `InboxTodo.workspaceTaskId` back. Backfill:
  `scripts/backfill-workspace-tasks.ts`. Still **read** at
  `modules/inbox/inbox-tasks-write.ts:274` (legacy fallback lookup) and
  `modules/inbox/todo-service.ts:196`.
- **`Tarea`** — legacy CRM, **fully live**: `/tareas` pages, `/api/tareas`,
  `modules/tareas/service.ts`, and the Today aggregator, which dedupes it against
  `WorkspaceTask` via `WorkspaceTask.tareaId` and
  `ConversationAction.resultId` (`modules/today/aggregator.ts:44-56`).

**Status:** the dual-write is **correct, transactional and documented**. The debt
is that three models are simultaneously live, so every new read path must know
the dedup rules.

### 9.2 Two conversation-entry models

`Conversation` (current) vs `InboxEntry` (legacy). `InboxEntry` is still in the
schema and in `/api/setup/workspace-backfill`'s table list.

### 9.3 Two user-like models

`User` (auth, `WorkspaceMember`) vs `Usuario` (directory, assignee of `Tarea`).
Correlated by email, **no FK**. See F-WS-01.

### 9.4 `lib/` → `core/` migration, unfinished

11 files in `lib/` are pure re-export shims carrying the identical comment
`// Re-export from new location — will be removed after full migration`:
`lib/db.ts`, `lib/storage.ts`, `lib/activity.ts`, `lib/workspace.ts`,
`lib/workspace-context.ts`, `lib/ai/index.ts`, `lib/auth/{session,client-session,
password,platform-auth,portal-context,workspace-auth}.ts`.
Both import styles are used across `app/api/**` (`@/lib/db` and `@core/db`).
**Cosmetic, zero behavioural risk, but it doubles the surface a reader must map.**

### 9.5 Duplicate / redirect routes

- `app/projects/page.tsx` → `redirect("/proyectos")`
- `app/automatizaciones/page.tsx` → `redirect("/motor")` — **redirects a real
  module (there is a working `/api/automatizaciones` + `modules/automatizaciones/
  service.ts`) into a mock page**.
- `/api/cliente/projects` and `/api/cliente/proyectos` — two routes, same query
  against `Proyecto`, different `select`.
- `app/inbox/overview/page.tsx` still exists as a sibling route despite
  `docs/ways-of-working.md` §4 declaring Inbox Briefing should live **inside**
  Smart Inbox.

### 9.6 Dead code and artefacts

- **`migration.sql`** (repo root, 1.6 KB) is **not SQL**. It is a captured Windows
  PowerShell error dump: `node.exe : npm warn Unknown env config "devdir"` …
  `Error: '--to-schema-datamodel' was removed`. It is a committed failed-command
  transcript.
- **`ClientProject`, `ClientInvoice`, `ClientFile`** — declared in the schema,
  created by `push-turso.ts`, **zero code references**.
- `prisma/backfill-connections.ts` sits in `prisma/` rather than `scripts/`.

### 9.7 Schema deployment — no migration history

**This is the most consequential structural finding.**

- `prisma.config.ts` declares `migrations: { path: "prisma/migrations" }` and
  `datasource: { url: "file:./dev.db" }`. **`prisma/migrations/` does not exist.**
  The pinned datasource means `prisma db push` targets a *local* file, never
  production — this is deliberate and documented in
  `scripts/migrate-workspace-task.ts:8-12`.
- Production schema is applied by **three uncoordinated mechanisms**:
  1. `prisma/push-turso.ts` — 36.7 KB of hand-written `CREATE TABLE IF NOT
     EXISTS`, covering **42 tables**;
  2. `scripts/migrate-*.ts` — 6 one-shot libSQL scripts
     (`migrate-platform-admin`, `migrate-platform-audit-log`,
     `migrate-workspace-task`, `migrate-workspace-status`,
     `migrate-conversation-category`, `migrate-inbox-todo-link`);
  3. `prisma/sql/*.sql` — 2 hand-authored additive scripts
     (`2026-07-19-inbox-data-04b-additive.sql`,
     `2026-07-21-presence-persistence-additive.sql`).
- **Coverage gap (computed):** the schema declares **52 models**. `push-turso.ts`
  creates 42. The side scripts create 11 more. **7 models have no `CREATE TABLE`
  statement anywhere in the repository:**

  ```
  Vertical, Workspace, WorkspaceMember, ClientAsset,
  ClientRequest, ClientRequestAsset, ForteSnapshot
  ```

  `Workspace` and `WorkspaceMember` are **the two tables multi-tenancy depends on.**

*Severity: Critical* · Evolution · *Impact:* the production schema cannot be
reproduced from the repository. A new environment (staging, a Neon target, a
disaster-recovery restore) cannot be built without manual archaeology. Drift
between `schema.prisma` and the live DB is undetectable. This is also the single
biggest blocker for the Neon/PostgreSQL migration (§18).

---

## 10. Demo, mock and test-data findings

### 10.1 What exists

| Artefact | Location | Reaches production? |
|---|---|---|
| Beauty overview demo snapshot | `modules/overview/demo-data.ts` (~380 lines: `DEMO_CLIENTS`, `DEMO_SERVICES`, revenue/weekday/source weights) | **Yes, but opt-in and labelled** |
| Finesse demo seeder | `scripts/seed-finesse-demo.ts` + `scripts/finesse-demo-data.ts` | Script only (guarded) |
| Presence demo seeder | `scripts/seed-presence-demo.ts` | Script only (`PRESENCE_DEMO_CONFIRM`) |
| Vertical seed | `prisma/seed.ts` | Script only |
| Voice Lab simulated tools | `app/voice-lab/tools.ts` | Gated by `VOICE_LAB_ENABLED` + platform admin |
| Hardcoded page data | `/comunicacion`, `/departamentos`, `/finanzas`, `/biblioteca`, `/motor`, `/identidad`, `/entrada` | **Yes — in primary nav** |

### 10.2 Findings

---

**F-DEMO-01 — Fully mock pages are in the primary navigation**
**Severity: High (product integrity)** · Evolution

*Evidence* — `components/sidebar-nav.tsx` links, and the pages themselves:

| Nav label | `sidebar-nav.tsx` | Page | Content |
|---|---|---|---|
| Finance | line 221 `href: "/finanzas"` | `app/finanzas/page.tsx` | `const CASHFLOW = [...]`, `const FUNDS = [{ name: "Operating reserve", balance: "$640K", … }]`, `const RECENT_INVOICES = [{ id: "INV-0042", amount: "$48,000", … }]` |
| Tools | line 236 `href: "/biblioteca"` | `app/biblioteca/page.tsx` | `const resources = [{ name: "7F Brand Guide", type: "PDF", size: "4.2 MB", … }]` |
| Communication | line 246 `href: "/comunicacion"` | `app/comunicacion/page.tsx` | `const channels`, `const directMessages` — invented people and messages |
| Departments | line 249 `href: "/departamentos"` | `app/departamentos/page.tsx` | `const departments = [{ lead: "Ana Rodriguez", members: [...] }]` |
| AI workspace | line 251 `href: "/motor"` | `app/motor/page.tsx` | static (445 lines) |
| Contact Matching | line 247 `href: "/identidad"` | `app/identidad/page.tsx` | static (338 lines) |
| Manual Intake | line 230 `href: "/entrada"` | `app/entrada/page.tsx` | static; `{/* AI processing preview placeholder */}` at line 147 |

None of these fetch anything. `/finanzas` in particular shows **invented
financial figures** while a real `/api/finanzas` + `modules/finanzas/service.ts`
exist and are correctly workspace-scoped — the mock page shadows a working
backend. `/automatizaciones` redirects into `/motor`, shadowing the real
`/api/automatizaciones`.

*Practical impact* — Direct violation of `docs/ways-of-working.md` §5 ("No fake
product") and §4 ("Stubs are hidden from primary nav until they have a real
backend (`/entrada`, `/comunicacion`, `/motor`, `/finanzas`, `/departamentos`,
`/biblioteca` were mock at audit time)"). The documentation asserts a state the
code does not have. A customer navigating 7F today sees fabricated financial and
team data presented as their own.

*Recommended treatment* — Either hide these from `sidebar-nav.tsx` (smallest safe
change) or wire `/finanzas` to its existing API. **Evolution.**

---

**F-DEMO-02 — Demo overview snapshot is reachable in production via a query param**
**Severity: Low** · Evolution

*Evidence* — `components/overview/beauty-business-overview-page.tsx:88`
`const demoMode = searchParams.get("overviewDemo")`; when non-null the page renders
`resolveDemoSnapshot(...)` with `isDemo` and `showPreviewChip`. `app/page.tsx:48`
renders this component as the **home page** for Beauty workspaces.

*Impact* — Any user can append `?overviewDemo=1` to `/` and see fabricated KPIs.
Mitigated: it is opt-in, never the default, visibly chipped, and `isDemo` is
threaded through. **Low risk, but it is a QA affordance shipped to production.**

*Recommended treatment* — Gate on a platform-admin/dev check, or accept and
document. Not urgent.

---

**F-DEMO-03 — No `isDemo` / `seedBatchId` flag exists on any model**
**Severity: Medium** · Evolution

*Evidence* — `grep "isDemo|seedBatchId" prisma/schema.prisma` → **0 hits.**
The Finesse seeder instead encodes markers **inside business columns**
(`scripts/seed-finesse-demo.ts:22-30`):

```
Cliente.customId       = "FINESSE_DEMO:client:01"
Contact.source         = "FINESSE_DEMO:contact:01"
Evento.descripcion     = "FINESSE_DEMO:cita:01"
Conversation.source    = "FINESSE_DEMO:conv:01"
Factura.numero         = "DEMO-FINESSE-<workspace>-001"
Tarea.descripcion      (last line) = "FINESSE_DEMO:tarea:01"
WorkspaceTask.sourceType/sourceId  = finesse_demo / FINESSE_DEMO:task:01
```

*Impact* — Demo rows are indistinguishable from real rows at the schema level.
Cleanup is string-matching on user-visible fields; `Evento.descripcion` and
`Tarea.descripcion` are **editable by the operator**, so an edit orphans the
marker permanently. Aggregates (`/api/overview`, Today, search) count demo rows
as real.

*Mitigations that do exist and are good* — the seeder is **genuinely hardened**:
idempotent, atomic (`db.$transaction`), config-validating, and it **refuses a
workspace that is not flagged as demo and holds unmarked clients/conversations**
(`assessDemoTarget`), overridable only with the workspace-bound
`FINESSE_DEMO_ALLOW_UNFLAGGED=ALLOW:<workspaceId>`. `scripts/finesse-demo-data.test.ts`
contributes 54 passing tests. `demo:presence:clean` exists; there is **no
`demo:finesse:clean`**.

*Recommended treatment* — Add a first-class `isDemo Boolean @default(false)` +
`seedBatchId String?` to the seeded models and migrate the markers. Schema work —
sequence with the DB block.

*Risk of mixing demo with real data:* **Medium.** The guard rails are good and the
seeder is explicitly opt-in, but once demo rows land in a real workspace there is
no reliable, schema-level way to find or remove them.

---

## 11. Modules and verticals assessment

### 11.1 How modules are represented today — three overlapping mechanisms

1. **`Workspace.config.modules`** — `Record<string, boolean>` inside the JSON
   config string. Merged over `Vertical.defaultConfig` by
   `mergeConfigs` (`core/verticals.ts`). **This is what actually gates anything.**
   Written only by `POST /api/workspaces/[id]/modules` (`requirePlatformAdmin()`),
   and protected from tenant writes by `sanitizeTenantConfig`.
2. **`core/registry/module-registry.ts`** — a rich in-memory `ModuleRegistry`
   (modules, engines, tools, agents; capabilities; lifecycle hooks; namespaces).
   `core/registry/pilot-manifests.ts` registers exactly **two** modules:
   `usuarios` and `inbox`. Header comment: *"Phase 0: manual registration only
   (no auto-discovery)."* **It gates nothing today.**
3. **`components/sidebar-nav.tsx`** — a hand-maintained nav tree keyed on vertical
   vocabulary (`v.client.plural`, `v.project.plural`, …) from
   `core/vertical-packs/*`. Navigation is **not** derived from either of the
   above (this is how the mock pages of F-DEMO-01 stay visible).

**Assessment:** module enablement is *governed* correctly but *represented* three
times. Nav is the weakest link — it is the user-visible contract and it is
hand-written.

### 11.2 Verticals

`Vertical` table + `core/vertical-packs/{beauty,experience,nav-profile,specialists}`.
`core/verticals.ts:BUILTIN_VERTICALS` makes Beauty selectable before the DB is
seeded; a real DB row always wins (documented). `resolveWorkspaceExperience`
returns `todayMode`/`theme` keys as **data, not behaviour**
(`core/workspace.ts:getWorkspaceWithResolvedConfig`). Vertical changes are
platform-admin-only (`PATCH /api/workspaces/[id]` 403s on `verticalKey`).
**49 vertical tests pass.** This layer is in good shape.

### 11.3 Plans

`Workspace.plan String @default("free")`. Written by
`PATCH /api/system/workspaces/[id]/plan`. **Nothing in the runtime reads
`plan` to gate a feature** — plan enforcement is entirely absent, exactly like
`Workspace.status` (F-ROLE-04).

### 11.4 Could Smart Inbox ship standalone on this Core? — **Yes**

**Reusable infrastructure the Inbox already owns (Keep):**
`modules/inbox/transport/*` (channel-neutral send contracts),
`modules/inbox/ingestion/*` (`InboundEnvelope` + pipeline),
`modules/inbox/identity-resolution.ts` + `identity-service.ts`
(`ExternalIdentity`/`ContactIdentityLink`),
`modules/inbox/delivery-projection.ts`, `modules/inbox/attachment-keys.ts`
(idempotency), `core/inbox/channel-registry.ts` + `filter-registry.ts`,
`modules/inbox/auto-task-policy.ts` + `auto-task-write-planner.ts` (pure planner
pattern per `docs/inbox-pipeline-testing.md`), `modules/tasks/*`
(`WorkspaceTask`).

**Core it must keep sharing (Keep, do not fork):**
`core/auth/*`, `core/workspace*.ts`, `core/db.ts`, `core/api.ts`, `core/i18n/*`,
`core/notifications/*`, `core/storage.ts`, `core/crypto.ts`, `Workspace` +
`WorkspaceMember` + `Workspace.config`. Per
`docs/workspace-profile-for-inbox.md`, a **minimal Workspace Profile is core
infrastructure**, not an add-on — Fanny needs it. "Inbox-only" means
**Inbox + profile lite**, never an empty shell.

**What ties Inbox to full 7F today (must be cut for standalone):**

- `components/sidebar-nav.tsx` renders the whole 7F tree unconditionally;
  Inbox filters are injected at lines 148-153 but the CRM/Finance/Departments
  groups are not conditional on anything.
- `modules/inbox/service.ts` promotes conversations into `Tarea` via
  `ConversationAction.resultModule = "tareas"` — a CRM dependency inside the
  Inbox write path.
- `app/page.tsx` (Home) renders the Beauty overview, so the "landing" surface
  assumes a full-product workspace.
- `Contact` vs `Cliente` remain two people-models; a standalone Inbox needs only
  `Contact`.

**What belongs to 7F Next, not Evolution:** collapsing `Usuario` into
`User`+`WorkspaceMember`, unifying `Contact`/`Cliente`, retiring `Tarea` and
`InboxEntry`, replacing the config-JSON module system with the `core/registry`
manifests, and deriving navigation from the registry.

---

## 12. Shared services assessment

| Service | State | Evidence |
|---|---|---|
| **Notifications** | Working, workspace-scoped, with dedup | `core/notifications/inbox.ts` — `hasUnreadNotification` prevents repeat rows; fan-out to `WorkspaceMember` ids. In-app only, no email/push |
| **Activity** | Working | `core/activity.ts` (`logActivity`, `detectChanges`, `logChanges`); `Activity.workspaceId` nullable |
| **Platform audit** | Working, well-designed | `PlatformAuditLog` append-only; `actorId` deliberately **not** an FK so deleting a user cannot erase evidence; 4 indexes; read-only endpoint |
| **Files** | **Broken tenancy** | F-WS-04 |
| **Webhooks** | Mixed | Resend inbound: secret enforced, fails closed. Provider webhooks: skeleton, resolves tenant from `ChannelConnection`, **no signature verification yet** (honestly declared: `accepted: false, reason: "not_processed"`) |
| **Integrations** | Real: Google OAuth, Resend, IMAP/SMTP (`imapflow`/`nodemailer`), Vercel Blob, OpenAI, DeepSeek, `tesseract.js` OCR, `pdf-parse`. Skeleton only: Meta/Twilio/TikTok | `package.json`; `modules/inbox/webhooks.ts` |
| **Error handling** | Centralised but leaky | `core/api.ts:handleError` — maps `RbacError`/`WorkspaceError`/`ZodError`/Prisma `P2025`/`P2002`; **leaks raw detail on 500** (F-AUTH-03) |
| **Logging** | `console.*` only | 290 `no-console` ESLint warnings. No structured logger, no request id, no log levels, no aggregation |
| **Rate limits** | **Two places only** | `engines/presence/reception-security.ts` (sliding window, 20/min) and `app/api/voice/realtime-token/route.ts`. Both **in-memory per instance** — on Vercel serverless this resets per cold start and does not coordinate across instances. Everything else is unlimited |
| **Idempotency** | **Good where it exists** | `modules/inbox/attachment-keys.ts` (tiered `attachmentKey`); `syncImapConnection` UID cursor + `findWorkspaceScopedDuplicate`; `processInboundEmail` `alreadyProcessed`; cron cooldown `RECENT_SYNC_THRESHOLD_MS = 2min`. **No idempotency on outbound send or on public chat POST** |
| **Retries** | **None** | No retry/backoff anywhere. `void (...).catch(() => null)` fire-and-forget is the pattern |
| **Background work** | **No infrastructure** | One Vercel cron; everything else is a detached promise inside a request. On serverless, work started after the response may be killed mid-flight — `runScanInBackground` and `runConversationIntelligence` are both exposed to this |
| **Approval-gated operations** | **Well designed** | `modules/inbox/auto-task-policy.ts` — pure, deterministic, conservative-by-default gate with `AUTO_CREATE_MIN_CONFIDENCE = 0.85` and a broad EN/ES deny-list (external communication, billing, refunds, contracts). 35 tests pass. This is the strongest safety component in the codebase |
| **Distributed locking** | None | Documented as accepted in `app/api/cron/imap-sync/route.ts` |

---

## 13. Test and build baseline

Environment: Node v22.22.2, Linux. `node_modules` was absent at session start and
installed with `npm ci` (lockfile **not** modified). `generated/prisma` is
gitignored and was produced by `prisma generate`.

| # | Command | Result | Notes |
|---|---|---|---|
| 1 | `npm ci --no-audit --no-fund` | **exit 0** | Lockfile unchanged |
| 2 | `npx prisma generate` | **exit 0** | Prisma Client 7.4.1 → `./generated/prisma` in 508 ms |
| 3 | `npx tsc --noEmit` | **exit 0 — clean** | Zero type errors across the whole repo |
| 4 | `npx eslint .` | **exit 1** | **661 problems: 5 errors, 656 warnings** |
| 5 | 39 `npm run test:*` scripts | 38 pass, **1 fail** | `test:inbox-transport` — see below |
| 6 | Full suite, all 108 test files, one run | **1,199 tests · 1,199 pass · 0 fail · 0 skipped** | With `DATABASE_URL` set |
| 7 | 6 orphan test files (see below) | **42 pass, 0 fail** | Not covered by any npm script |
| 8 | `npm run build` (`prisma generate && next build`) | **exit 0** | Full production build succeeds |
| 9 | `git diff --check` | **clean** | |

### 13.1 The one test failure — environmental, pre-existing

`npm run test:inbox-transport` → `pass 7, fail 1`:

```
/home/user/7FNEW/core/db.ts:12
  throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")
  at Object.<anonymous> (/home/user/7FNEW/core/db.ts:21:69)
Subtest: modules/inbox/transport/transport.test.ts
not ok 1 - modules/inbox/transport/transport.test.ts
```

Re-run with a throwaway local `DATABASE_URL=file:…/probe.db` (no external
database touched): **28 tests, 28 pass, 0 fail.**

**Root cause:** `core/db.ts` throws at **module scope**. `transport.test.ts`
transitively imports it, so a pure-logic test cannot run without DB env.
**Pre-existing — not introduced by this mission.** It also means the test suite is
not runnable in a clean CI container without secrets, which is one reason no CI
exists.

### 13.2 ESLint — the 5 errors

```
app/api/activity/route.ts:12:5          @next/next/no-assign-module-variable
app/api/attachments/route.ts:37:5       @next/next/no-assign-module-variable
app/api/attachments/route.ts:60:5       @next/next/no-assign-module-variable
app/system/layout.tsx:67:13             @next/next/no-html-link-for-pages
components/project-tabs.tsx:838:9       @next/next/no-html-link-for-pages
```

The first three come from destructuring a query/form field literally named
`module` — cosmetic but a real Next.js rule violation. All 5 are **pre-existing**.

### 13.3 ESLint — warnings by rule

```
290  no-console
277  @typescript-eslint/no-explicit-any
 64  @typescript-eslint/no-unused-vars
 11  @next/next/no-img-element
 11  react-hooks/exhaustive-deps
  3  (rule id null)
```

### 13.4 Test coverage gaps

- **108 test files exist; 102 are wired into `npm run test:*`. 6 are orphaned**
  and would never run in an automated pipeline:
  ```
  components/calendar/beauty/appointment-model.test.ts
  components/calendar/beauty/datetime.test.ts
  agents/forte/runtime/business/settings-handoff.test.ts
  agents/forte/runtime/business/snapshot-store.test.ts
  agents/forte/runtime/business/recommendation-routing.test.ts
  agents/forte/runtime/business/improvements-loader.test.ts
  ```
  All 6 pass (42 tests) — they are simply unreferenced.
- There is **no `npm test`** aggregate script. Running "the suite" means running
  39 separate commands.
- **There is no test for multi-tenancy isolation.** `core/auth/workspace-governance.test.ts`
  (4 tests) covers only `sanitizeTenantConfig`. Nothing tests
  `resolveRequiredWorkspace`, `requireRoleInWorkspace`, or that a service refuses
  a foreign `workspaceId`. Given that multi-tenancy is the canonical architecture
  rule, **this is the single largest coverage gap.**
- **No CI** — nothing runs any of this automatically.

---

## 14. Risk register

| ID | Finding | Sev | Area | Track |
|---|---|---|---|---|
| **F-WS-01** | `Usuario` global model; `/api/usuarios` cross-tenant read **and** write | **Critical** | Multitenancy | Evolution |
| **F-DB-01** | No migration history; 7 models (incl. `Workspace`, `WorkspaceMember`) have no `CREATE TABLE` in repo | **Critical** | Persistence | Evolution |
| **F-AUTH-01** | Middleware fails **open** on `/api/**` when `AUTH_SECRET` missing | High | Auth | Evolution |
| **F-AUTH-02** | `core/crypto.ts` all-zero key fallback; key reuse with JWT secret | High | Secrets | Evolution |
| **F-WS-02** | `/api/inbox/public/send` — unauth, unrate-limited, triggers LLM + outbound email | High | Multitenancy / cost | Evolution |
| **F-WS-04** | Blob uploads public, no tenant in path, `addRandomSuffix: false`, delete never removes the blob | High | Files | Evolution |
| **F-WS-05** | `/api/setup/workspace-backfill` + `/api/setup/client-auth-table` — DDL & 23-table backfill over HTTP, any workspace OWNER | High | Data safety | Evolution |
| **F-DEMO-01** | Mock pages (incl. fabricated finance) in primary nav, contradicting `ways-of-working.md` §5 | High | Product integrity | Evolution |
| **F-WS-03** | Public conversation read authorised by client-chosen `visitorId` | Medium | Multitenancy | Evolution |
| **F-WS-06** | 13 models with nullable `workspaceId`; 45 `onDelete: SetNull` manufacturing orphans | Medium | Schema | Evolution → DB block |
| **F-AUTH-03** | `handleError` leaks raw error text on 500 | Medium | Auth/DX | Evolution |
| **F-AUTH-04** | `/api/health` leaks DB host/token length + platform-wide client count | Medium | Info leak | Evolution |
| **F-AUTH-05** | `/api/ai/*` — 9 unguarded LLM proxies, no tenant, no quota | Medium | Cost / abuse | Evolution |
| **F-AUTH-06** | Legacy `User.role` still gates real pages despite `@deprecated` | Medium | Roles | Evolution |
| **F-ROLE-01** | `User.role` vs `WorkspaceMember.role` uncorrelated | Medium | Roles | Evolution |
| **F-ROLE-03** | `TENANT_FORBIDDEN_CONFIG_KEYS` is a deny-list of one | Medium | Governance | Evolution |
| **F-ROLE-04** | `Workspace.status` / `Workspace.plan` are observational — never enforced | Medium | Governance | Evolution |
| **F-DEMO-03** | No `isDemo`/`seedBatchId`; markers live in editable business columns | Medium | Data hygiene | Evolution → DB block |
| **F-SVC-01** | Rate limiting in 2 places only, in-memory per instance (useless on serverless) | Medium | Shared services | Evolution |
| **F-SVC-02** | No retries, no queue; background work is detached promises that serverless may kill | Medium | Shared services | 7F Next (infra) |
| **F-SVC-03** | `console.*`-only logging (290 sites); no request id, no aggregation | Medium | Observability | Evolution |
| **F-TEST-01** | **Zero multi-tenancy isolation tests** | Medium | Testing | Evolution |
| **F-TEST-02** | No CI at all; 6 orphan test files; no `npm test` | Medium | Testing | Evolution |
| **F-DB-02** | `core/db.ts` throws at module scope — blocks DB-free unit tests and clean-container CI | Medium | Persistence | Evolution |
| **F-LEG-01** | Three task models live simultaneously (`WorkspaceTask` / `InboxTodo` / `Tarea`) | Medium | Legacy | 7F Next |
| **F-LEG-02** | Two entry models (`Conversation` / `InboxEntry`) | Medium | Legacy | 7F Next |
| **F-LEG-03** | 11 `lib/` shims; mixed `@/lib/*` and `@core/*` imports | Low | Legacy | Evolution |
| **F-LEG-04** | Dead models `ClientProject`, `ClientInvoice`, `ClientFile` (0 refs) | Low | Legacy | Evolution |
| **F-LEG-05** | `migration.sql` is a committed PowerShell error dump | Low | Hygiene | Evolution |
| **F-LEG-06** | `/automatizaciones` redirects a real module into a mock page; `/api/cliente/projects` duplicates `/proyectos` | Low | Duplication | Evolution |
| **F-DEMO-02** | `?overviewDemo=` reachable in production (opt-in, labelled) | Low | Demo data | Evolution |
| **F-AUTH-07** | `ClientAuth.email` is globally `@unique`; register 409 leaks cross-tenant existence | Low | Multitenancy | Evolution → DB block |
| **F-ROLE-05** | `PLATFORM_BOOTSTRAP_EMAILS` env self-promotion door | Low | Control plane | Evolution (ops) |

---

## 15. Classification

### KEEP — correct, reusable, do not touch

- `core/auth/workspace-auth.ts` — including the `requireRoleInWorkspace` /
  `requireWorkspaceRole` split and the `HEADER_ALLOWLIST` mechanism.
- `core/workspace-context.ts` — `resolveRequiredWorkspace` with membership
  validation at every resolution step.
- `core/auth/platform-auth.ts` + `PlatformAdmin` + `PlatformAuditLog` — orthogonal
  control plane with DB re-check defence in depth.
- `core/auth/workspace-governance.ts` — the sanitiser, and its enforcement in
  `PATCH /api/workspaces/[id]` and `POST /api/workspaces/[id]/modules`.
- `modules/inbox/transport/*`, `modules/inbox/ingestion/*`,
  `modules/inbox/identity-resolution.ts`, `delivery-projection.ts`,
  `attachment-keys.ts` — the multichannel foundation.
- `modules/inbox/auto-task-policy.ts` + `auto-task-write-planner.ts` — the pure
  planner pattern; make it the template for all future write-heavy flows.
- `modules/tasks/*` / `WorkspaceTask` — canonical, correctly scoped.
- `modules/today/aggregator.ts` — explicit tenant guard clause and documented
  dedup.
- `core/i18n/*` (148 tests), `core/vertical-packs/*` (49 tests),
  `engines/presence/*` (157 tests).
- 18 of 19 `modules/*/service.ts` — mandatory `workspaceId` parameter.
- `app/api/cron/imap-sync/route.ts` — fails closed in production, documents its
  own trade-offs honestly.
- `app/api/inbox/webhooks/[provider]/route.ts` — resolves tenant from the DB, and
  is honest about not being implemented.

### CORRECT — fix in place, in Evolution

- **F-WS-01** `/api/usuarios` tenant scoping. *(→ CORE-01)*
- **F-AUTH-01** middleware fail-closed; **F-AUTH-02** crypto key fallback. *(→ CORE-02)*
- **F-WS-04** blob path tenancy + `addRandomSuffix` + working deletion. *(→ CORE-04)*
- **F-WS-02 / F-WS-03** public inbox surface — reuse the presence security
  primitives. *(→ CORE-05)*
- **F-WS-05** remove or platform-gate the `/api/setup/*` endpoints. *(→ CORE-02)*
- **F-AUTH-03** stop leaking error detail; **F-AUTH-04** lock down `/api/health`. *(→ CORE-02)*
- **F-DEMO-01** hide mock pages from primary nav. *(→ CORE-06)*
- **F-DB-01** reconstruct a real migration baseline. *(→ CORE-03)*
- **F-DB-02** make `core/db.ts` lazy so pure logic is testable DB-free. *(→ CORE-03)*
- **F-TEST-01 / F-TEST-02** add multi-tenancy isolation tests, an `npm test`
  aggregate, wire the 6 orphans, add CI. *(→ CORE-03)*
- **F-LEG-05** delete `migration.sql`; **F-LEG-04** delete the 3 dead models.

### REPLACE — needs a new design, sequence deliberately

- **Persistence deployment** — replace `push-turso.ts` + 6 ad-hoc scripts + 2 loose
  SQL files with a single versioned migration history. *(CORE-03 → CORE-DB-01)*
- **File storage** — replace public-by-default blobs with tenant-prefixed,
  private objects behind a signed-URL proxy. *(CORE-04)*
- **Rate limiting** — replace the two in-memory stores with a shared, durable
  limiter. *(Evolution, later block)*
- **Logging** — replace `console.*` with a structured logger + request id.
- **Legacy RBAC** — replace the `User.role` Edge page gate with a
  `WorkspaceMember`-derived claim.
- **Module representation** — eventually replace `Workspace.config.modules` +
  hand-written nav with the `core/registry` manifests. **7F Next.**

### POSTPONE — do not touch in Evolution

- Collapsing `Usuario` → `User` + `WorkspaceMember`. *(7F Next; Evolution only
  makes the current model **safe**.)*
- Unifying `Contact` and `Cliente`.
- Retiring `Tarea` and `InboxEntry`; reducing three task models to one.
- Any Finesse/Beauty work — **explicitly out of scope for the whole Evolution
  track until the end.**
- Voice Lab (`app/voice-lab/**`) and the Forte phase1/phase2 prototypes.
- Presence custom-domain auto-routing (`middleware.ts:66-72` records why it was
  reverted).
- The `lib/` → `core/` shim removal — safe but noisy; batch it once, late.
- Theming work — a large unlanded workstream on its own branches.
- Any visual redesign.

---

## 16. Recommended Evolution sequence

Each block is one focused mission with its own review → push → review cycle.
Ordering rationale: **stop the active leak first**, then close fail-open paths,
then build the safety net (migrations + CI + isolation tests) *before* touching
storage or the public surface, because those two need a migration path and a
regression net to be done safely.

| Block | Mission | Why here |
|---|---|---|
| **CORE-01** | **Tenant-scope `Usuario`.** Make `/api/usuarios` and `modules/usuarios/service.ts` workspace-safe **without a schema change**. Add isolation tests. | The only confirmed *live* cross-tenant read+write. Smallest possible blast radius. **See §17.** |
| **CORE-02** | **Close fail-open and info-leak paths.** Middleware fails closed on `/api/**`; `core/crypto.ts` throws instead of a zero key; `handleError` stops leaking detail; `/api/health` gated; `/api/ai/*` guarded or deleted; `/api/setup/*` removed or `requirePlatformSuper()`. | All small, independent, all High. No schema change. |
| **CORE-03** | **Reproducible schema + safety net.** Reconstruct a baseline migration from the live DB (`prisma migrate diff --from-empty`), commit it, cover the 7 missing models, retire `push-turso.ts` as the deploy path. Make `core/db.ts` lazy. Add `npm test`, wire the 6 orphan tests, add GitHub Actions CI (typecheck + lint + test + build). Add the first multi-tenancy isolation test suite. | **Prerequisite for everything after it** and for CORE-DB-01. Nothing else is safe to change at schema level until this exists. |
| **CORE-04** | **File storage tenancy.** `getStoragePath` prefixes `workspaceId`; re-enable `addRandomSuffix`; fix `DELETE /api/attachments/[id]` to call `deleteFromStorage`; add a signed-URL proxy route; plan (do not run) re-keying of existing objects. | Needs CORE-03's regression net. High severity, but requires a data migration plan. |
| **CORE-05** | **Harden the public inbox surface.** Apply `sanitizeVisitorText`, `MAX_MESSAGE_LENGTH`, `isValidVisitorId` and a durable rate limit to `/api/inbox/public/*`; replace `Workspace.slug` as `siteKey` with a rotatable key; sign the visitor session. | Reuses primitives that already exist and are tested in `engines/presence/reception-security.ts`. |
| **CORE-06** | **Product-integrity pass.** Hide `/comunicacion`, `/departamentos`, `/finanzas`, `/biblioteca`, `/motor`, `/identidad`, `/entrada` from primary nav (or wire `/finanzas` to its real API). Fix `/automatizaciones`. Delete `migration.sql` and the 3 dead client models. Reconcile `docs/ways-of-working.md` §4/§5 with reality. | Independent of everything above; can run in parallel. Restores the "no fake product" rule. |
| **CORE-07** | **Roles convergence.** Replace the `User.role` Edge page gate; correlate `User.role` with `WorkspaceMember.role`; enforce `Workspace.status` (suspension) and `Workspace.plan`; turn `TENANT_FORBIDDEN_CONFIG_KEYS` into an allow-list. | Depends on CORE-03's isolation tests to change auth safely. |
| **CORE-08** | **Observability & resilience.** Structured logger + request id; durable shared rate limiter; retry/backoff on the fire-and-forget paths; idempotency keys on outbound send. | Quality-of-service; nothing above depends on it. |
| **CORE-DB-01** | **Neon/PostgreSQL migration** — separate mission, see §18. | **Hard dependency on CORE-03.** Must not start before a reproducible migration baseline exists. |

**Explicitly after all of the above:** Smart Inbox standalone packaging, then
Finesse/Beauty.

---

## 17. First small implementation mission — exact proposal

### CORE-01 — Tenant-scope the `Usuario` directory

**Objective.** Eliminate the confirmed cross-tenant read and write path through
`/api/usuarios`, **without changing the schema, without a migration, and without
touching any data.**

**Why this one first.**
It is the only finding in this audit that is (a) Critical, (b) confirmed with
concrete code, (c) actively exploitable by any authenticated user of any tenant,
and (d) fixable in a handful of files with no schema change, no backfill and no
infrastructure dependency. It is the smallest possible unit of real risk
reduction.

**Files that may change (and only these).**

```
modules/usuarios/service.ts          — add a required workspaceId parameter to all 5 exports
app/api/usuarios/route.ts            — pass workspaceId from requireReadAccess/requireAdminAccess
app/api/usuarios/[id]/route.ts       — pass workspaceId; 404 on foreign rows
modules/usuarios/validation.ts       — only if a query field must be added
modules/usuarios/manifest.ts         — only if the manifest declares the scope
core/auth/usuarios-scope.test.ts     — NEW: isolation tests (or modules/usuarios/scope.test.ts)
package.json                         — NEW script: "test:usuarios"
```

**Explicitly out of scope for CORE-01.**
`prisma/schema.prisma` (no `Usuario.workspaceId` column yet), any migration, any
backfill, `Tarea`, `User`, `WorkspaceMember`, the `app/usuarios/page.tsx` UI, and
every other finding in this audit.

**Approach (no schema change).**
`Usuario` has no `workspaceId`, so the tenant boundary must be derived. The
workspace's real membership set is `WorkspaceMember → User.email`. Scope every
`Usuario` operation to the set of emails belonging to members of the active
workspace:

1. Add a small pure helper that, given a `workspaceId`, returns the member email
   set (one query on `WorkspaceMember` + `User`).
2. `list()` / `getById()` filter `Usuario.email IN (memberEmails)`.
   `getById` additionally scopes the `tareas` include with
   `where: { workspaceId }` so no foreign task content leaks through the relation.
3. `update()` / `remove()` refuse (404) any `Usuario` whose email is not in the
   set — check **before** the write, in the service, not in the route.
4. `create()` records the row only when the email belongs to the workspace, or
   returns a clear validation error.

This is deliberately a **containment** fix, not the final model. The permanent
fix (`Usuario.workspaceId` + `@@unique([workspaceId, email])`) is a schema change
and is sequenced into the DB block after CORE-03.

**Tests to add (this is the deliverable's real value).**

- A member of workspace A cannot `list` a `Usuario` belonging only to workspace B.
- `getById` on a foreign `Usuario` returns null/404.
- `getById` on a shared-email `Usuario` returns **only** workspace-A `tareas`.
- `update` and `remove` on a foreign `Usuario` are refused and perform **no write**.
- Passing an empty/undefined `workspaceId` throws (defence in depth, mirroring
  `modules/today/aggregator.ts`).

These become the **first entries in the multi-tenancy isolation suite** that
CORE-03 will grow.

**Checks to run.** `npx tsc --noEmit` · `npx eslint .` (must not exceed the
recorded baseline of 5 errors / 656 warnings) · the new `npm run test:usuarios` ·
the full 1,199-test suite · `npm run build` · `git diff --check`.

**Risk: Low.** Additive parameters on a 5-function service consumed by exactly 2
route files and 1 page. Reversible by revert. No data is written, migrated or
deleted.

**Success criteria.** The five isolation tests pass; the 1,199-test baseline stays
green; typecheck and build stay clean; `/api/usuarios` returns only rows the
active workspace legitimately owns.

---

## 18. Neon / PostgreSQL readiness assessment

Requested addition. **No code, schema, data or infrastructure was changed; nothing
was executed against Turso, Neon or any external database.** The only database
touched during this audit was a throwaway local `file:` SQLite path used solely to
prove that one test failure was environmental.

### 18.1 Client and ORM actually in use

| Layer | Reality |
|---|---|
| ORM | Prisma **7.4.1** (`@prisma/client`, `prisma`) |
| Driver adapter | `@prisma/adapter-libsql` **7.4.1** → `PrismaLibSql` |
| Raw driver | `@libsql/client` **0.17.0** |
| Datasource block | `provider = "sqlite"`, **no `url`** (`prisma/schema.prisma:6-8`) |
| Runtime URL | `core/db.ts` — `DATABASE_URL || TURSO_DATABASE_URL`, token from `DATABASE_AUTH_TOKEN || TURSO_AUTH_TOKEN` |
| Direct libSQL usage outside Prisma | **10 files**: `prisma/push-turso.ts`, `app/api/setup/client-auth-table/route.ts`, `app/api/health/route.ts`, and 7 `scripts/*.ts` |

**Good news:** the application layer talks to Prisma almost exclusively. Switching
the datasource to `postgresql` + `@prisma/adapter-pg` (or Neon serverless) is a
**small change in `core/db.ts` and the schema header**. The hard parts are the
schema translation, the raw SQL, and the absence of a migration baseline.

### 18.2 SQLite/libSQL-specific surface — the actual inventory

| Aspect | Count / state | Postgres impact |
|---|---|---|
| `enum` blocks | **0** | ✅ None. All enums are `String` + runtime validation (`WORKSPACE_TASK_VALID_STATUSES`, `VALID_PLATFORM_ROLES`, …). Portable as-is. |
| `Json` columns | **0** | ✅ All JSON is stored as `String` (TEXT): `Workspace.config`, `*.metadata`, `ChannelConnection.{config,credentials,syncState}`, `Vertical.defaultConfig`, `PlatformAuditLog.metadata`. Works unchanged on Postgres; converting to `jsonb` is an **optional** later improvement, not a requirement. |
| `@db.*` native types | **0** | ✅ Nothing SQLite-specific pinned. |
| `Bytes` columns | **0** | ✅ (`sizeBytes` is an `Int`.) |
| `Decimal` | **0** | ⚠️ **10 `Float` columns carry money**: `Proyecto.presupuesto`, `Transaccion.monto`, `Factura.{subtotal,impuesto,total}`, `ClientInvoice.monto`, `Campaign.presupuesto`. `Float` → `double precision`. Migration is the right moment to consider `Decimal`; doing so is a **behaviour change** and must be its own decision. |
| `Boolean` | 10 columns | ⚠️ SQLite stores `0/1`; Postgres needs real `boolean`. Prisma handles this — but **raw SQL comparing `isInternal = 0` does not** (see below). |
| `DateTime` | 61 `@default(now())`, 36 `@updatedAt` | ⚠️ SQLite/libSQL stores these as TEXT/NUMERIC; Postgres uses `timestamp`. **This is the single largest data-transformation risk** in the export/import. |
| IDs | `@default(cuid())`, all `String` | ✅ Fully portable. No sequences, no autoincrement, no UUID type coupling. |
| `mode: "insensitive"` | **0 usages** | ⚠️ **Inverted risk:** all search uses `contains` (`/api/search`, `/api/contacts/search`, every `modules/*/service.ts`). On SQLite `LIKE` is case-**insensitive** for ASCII by default; on Postgres `LIKE` is case-**sensitive**. **Search will silently stop matching** unless `mode: "insensitive"` is added or `citext`/`ILIKE` is used. `app/api/contacts/search/route.ts:20` even documents the current constraint: *"no relevance ranking available on SQLite/Turso"*. |
| Raw SQL | **3 statements in 2 files** | ⚠️ See below. |
| `NULL` in unique indexes | Relied upon | ⚠️ `ExternalIdentity` doc (`prisma/schema.prisma:1130-1134`): *"All routing-key columns are NON-NULL (SQLite treats NULLs as distinct in unique indexes, which would break the uniqueness guarantee)."* **Postgres behaves the same way**, and the schema already compensates by making the columns non-null — so this is **already safe**. Worth re-verifying per index during the migration. |

### 18.3 Raw SQL that will break on Postgres

**Three statements, all fixable, all in the Inbox.**

`app/api/inbox/attention-count/route.ts:18` and `:32`:

```sql
SELECT COUNT(*) as cnt
FROM Conversation c
LEFT JOIN ConversationRead cr ON cr.conversationId = c.id AND cr.userId = ?
WHERE c.workspaceId = ? AND c.assignedTo = ? ...
```

`modules/inbox/unanswered.ts:buildUnansweredCandidateQuery` (executed at
`modules/inbox/service.ts:466` via `$queryRawUnsafe`):

```sql
SELECT c.id AS id FROM Conversation c
JOIN Message m ON m.id = ( SELECT m2.id FROM Message m2
  WHERE m2.conversationId = c.id AND m2.isInternal = 0
  ORDER BY m2.createdAt DESC, m2.id DESC LIMIT 1 )
WHERE c.workspaceId = ? AND c.status NOT IN (...) AND m.direction = 'inbound' AND m.createdAt <= ?
```

Four distinct incompatibilities:

1. **Placeholders** — `?` is SQLite/libSQL. Postgres needs `$1, $2, $3`.
2. **Identifier case** — unquoted `Conversation`, `ConversationRead`, `Message`,
   `conversationId`, `workspaceId`, `isInternal` are folded to **lowercase** by
   Postgres. Prisma creates these tables/columns with the exact mixed case from
   the schema, so every identifier must be **double-quoted**:
   `FROM "Conversation" c … c."workspaceId"`.
3. **Boolean literal** — `m2.isInternal = 0` must become
   `m2."isInternal" = false`.
4. **Date parameter** — `params.push(threshold.toISOString())` binds a **string**
   against a timestamp column; Postgres requires an explicit cast or a real
   `Date` binding.

`buildUnansweredCandidateQuery` is a pure function with a documented SQL-mirror
contract and its own tests — it is the right place to add a dialect switch.

### 18.4 Indexes, constraints and foreign keys

- Prisma will recreate every `@@index`, `@@unique` and FK from `schema.prisma` on
  Postgres — **provided the schema is the source of truth**, which today it is
  not for the 7 missing models (§9.7).
- Postgres **enforces foreign keys strictly by default**; SQLite/libSQL enforcement
  depends on `PRAGMA foreign_keys`. Given 13 nullable `workspaceId` columns and 45
  `onDelete: SetNull` relations, **there is a real chance the current Turso data
  contains rows that violate constraints Postgres will refuse to import.**
  A pre-flight orphan/violation audit is mandatory.
- `ChannelConnection` has `@@unique([workspaceId, externalAccountId])` — if any
  duplicate exists today it will block the import.
- `AllowedEmail.email`, `User.email`, `Usuario.email`, `ClientAuth.email` are all
  globally `@unique` — duplicates across tenants would already be impossible, but
  verify.

### 18.5 Safe export/import strategy (proposed; **not executed**)

1. **Establish the baseline first (CORE-03, hard prerequisite).** Generate a
   migration from the *live* Turso schema, commit it, confirm it reproduces all
   52 models — including the 7 with no `CREATE TABLE` today.
2. **Snapshot Turso read-only.** `turso db shell … .dump` or a libSQL read
   replica. **Turso is never written to and never decommissioned.**
3. **Pre-flight data audit (read-only).** Count: null `workspaceId` per model;
   FK orphans; unique-constraint duplicates; `DateTime` values that do not parse
   as ISO-8601; `String`-JSON columns that fail `JSON.parse`.
4. **Create the Neon project.** New, independent project. Apply the committed
   Prisma migration to build an empty, correct schema — **do not** translate the
   SQLite dump's DDL.
5. **Transform and load data, not DDL.** Row-level ETL (a script reading via the
   libSQL client and writing via the Postgres Prisma client), which naturally
   normalises `DateTime`, `Boolean` and numeric types. Load in FK-dependency
   order: `Workspace` → `User` → `WorkspaceMember` → `Vertical` → `Cliente` →
   `Contact` → `Conversation` → `Message` → everything else.
6. **Row-count and checksum parity** per table, plus targeted spot checks on the
   highest-risk tables (`Message`, `Conversation`, `WorkspaceTask`,
   `ChannelConnection`).
7. **Re-encrypt or re-verify `ChannelConnection.credentials`.** They are
   AES-256-GCM ciphertext derived from `AUTH_SECRET`. If `AUTH_SECRET` differs
   between environments, **every channel silently breaks after cutover.**
   Verify decryption in the target *before* cutover. (Fixing F-AUTH-02 first makes
   this cleaner.)
8. **Dual-read verification window.** Point a staging deployment at Neon while
   production still uses Turso; compare Inbox lists, Today, Overview and search
   results.
9. **Cutover** by changing `DATABASE_URL` only. Turso stays intact and untouched.
10. **Rollback** = revert the env var. Because Turso is never written to during
    the migration and never dropped, rollback is instant and lossless. The only
    caveat is **write divergence**: any writes made against Neon after cutover are
    not in Turso. Therefore the cutover needs a short, announced write freeze, or
    an accepted "roll back and replay" window.

### 18.6 Data requiring transformation

| Data | Why | Handling |
|---|---|---|
| All `DateTime` columns (97 defaults/updatedAt sites) | TEXT/NUMERIC → `timestamp` | ETL parses to JS `Date`; reject unparseable values loudly |
| 10 `Boolean` columns | `0/1` → `boolean` | ETL coerces |
| 10 `Float` money columns | `REAL` → `double precision` | Straight copy; a `Decimal` change is a separate decision |
| JSON-in-TEXT columns | Stay `String` | Validate parseability; **do not** convert to `jsonb` in the same mission |
| `ChannelConnection.credentials` | Encrypted blob | Copy verbatim; verify decryption in target |
| Rows with `workspaceId = NULL` | Postgres FK still allows NULL, but they are unreachable | Decide explicitly: import as-is, or quarantine. **Do not** sweep them into a default workspace (that is F-WS-05's mistake) |
| `Message.metadata` legacy attachment arrays | Mid-migration to `MessageAttachment` | Complete or freeze `scripts/backfill-message-attachments.ts` **before** the DB move |

### 18.7 Risks specific to multitenancy, webhooks, Inbox and `WorkspaceTask`

- **Multitenancy** — the 7 missing `CREATE TABLE` statements include `Workspace`
  and `WorkspaceMember`. If the Neon schema is built from anything other than a
  verified migration, tenant isolation could be rebuilt subtly wrong (a missing
  `@@unique([userId, workspaceId])` on `WorkspaceMember` would let duplicate
  memberships with conflicting roles exist). **Highest-priority verification.**
- **Webhooks** — `ChannelConnection` routing depends on
  `@@index([provider, providerAccountId])` and
  `@@unique([workspaceId, externalAccountId])`. A missing index degrades webhook
  resolution to a table scan; a violated unique blocks the import. Inbound email
  correctness additionally depends on `RESEND_WEBHOOK_SECRET` and on IMAP
  `syncState` cursors surviving the move — **if `syncState` is lost, the next
  sync re-ingests the mailbox.** `Message` idempotency
  (`findWorkspaceScopedDuplicate` + UID cursor) is the safety net; verify it
  before enabling the cron against Neon.
- **Inbox search** — the case-sensitivity inversion (§18.2) will silently degrade
  `/api/search` and `/api/contacts/search` with **no error**. This is the most
  likely "it migrated fine but users say it's broken" outcome.
- **`WorkspaceTask`** — it has **7 composite indexes**, is read by Today, Overview,
  the agents aggregator and 3 Inbox read paths, and participates in a transactional
  dual-write with `InboxTodo` (`InboxTodo.workspaceTaskId`, no FK). The ETL must
  preserve that link exactly, and must import `InboxTodo` and `WorkspaceTask`
  consistently or the dual-write backfill will re-run and create duplicates.
- **Raw SQL** — the 3 statements in §18.3 will throw on Postgres. `unanswered` is
  a user-facing Inbox filter; `attention-count` drives the sidebar badge.

### 18.8 Validations required before cutover

1. The committed migration reproduces all 52 models on an empty Neon database.
2. Row-count parity per table, Turso vs Neon.
3. Zero FK violations and zero unique-constraint violations after import.
4. `ChannelConnection.credentials` decrypt successfully in the target.
5. `syncState` cursors present and correct for every active IMAP connection.
6. The 3 raw SQL statements rewritten and covered by tests.
7. `contains` searches return the same result sets (case-insensitivity restored).
8. The full **1,199-test** suite green against Postgres.
9. `npm run build` green.
10. Multi-tenancy isolation tests (added in CORE-01/CORE-03) green against Postgres.
11. Manual smoke: login, workspace switch, Inbox list + filters, send, Today,
    Overview, search, attachment upload/download.

### 18.9 Rollback strategy

Turso remains **fully intact and read-only** throughout. Rollback is reverting
`DATABASE_URL` (+ `DATABASE_AUTH_TOKEN`). Keep both configurations available for
at least one full billing/sync cycle. The only real constraint is the write-freeze
window described in step 10 of §18.5.

### 18.10 Complexity estimate

**MEDIUM — trending HIGH until CORE-03 lands.**

*Lower than feared because:* zero enums, zero `Json` columns, zero native types,
zero `Bytes`, all-`cuid()` string IDs, no sequences, only 3 raw SQL statements,
one centralised DB entry point, and a 1,199-test suite to validate against.

*Not Low because:* there is **no migration baseline**, 7 models (including
`Workspace` and `WorkspaceMember`) have no `CREATE TABLE` in the repository, the
`DateTime` transformation touches nearly every table, encrypted channel
credentials must survive, IMAP cursors must survive, and the search
case-sensitivity inversion fails **silently**.

**It would be HIGH — bordering on unsafe — if attempted today.** With CORE-03
completed first, it is a well-bounded MEDIUM.

### 18.11 Proposed mission — CORE-DB-01

> **CORE-DB-01 — Neon/PostgreSQL migration readiness and execution.**
>
> **Hard prerequisite:** CORE-03 (reproducible migration baseline + CI + isolation
> tests). Do not start before it.
>
> **Phase A — Readiness (no writes anywhere).** Verify the committed migration
> reproduces all 52 models on an empty Postgres. Run the read-only pre-flight data
> audit (§18.5 step 3). Rewrite the 3 raw SQL statements behind a dialect switch
> and add `mode: "insensitive"` to every `contains` search, **verified against
> both dialects**. Deliverable: a readiness report + a dry-run ETL with per-table
> row counts.
>
> **Phase B — Parallel environment.** Create the Neon project. Apply the
> migration. Run the ETL into Neon. Point a **staging** deployment at Neon.
> Production stays on Turso. Deliverable: parity report + full test suite green
> against Postgres.
>
> **Phase C — Cutover.** Announced write freeze, final incremental ETL, flip
> `DATABASE_URL`, run the §18.8 smoke list, monitor. Turso untouched and retained.
>
> **Non-goals:** `Float` → `Decimal`, `String` → `jsonb`, dropping Turso, any
> schema redesign, any Finesse/Beauty work.

---

## 19. Method and integrity statement

- Every finding in this document cites a file, and where it matters a symbol or
  line number. Nothing was inferred from a route name, a model name or a
  directory name; the code was read in each case.
- **No production code, schema, migration, seed, dependency or lockfile was
  modified.** `npm ci` installed from the existing lockfile without changing it.
  `prisma generate` wrote only to the gitignored `generated/` directory.
- **No migration, backfill, seed, REINDEX or destructive script was executed.**
- **No data in Turso, Neon or any external database was read or written.** The
  only database used was a throwaway local `file:` SQLite path in a scratch
  directory, used solely to prove that one test failure was environmental.
- **No Vercel, domain, webhook or environment-variable configuration was
  changed.** Environment variables are referenced **by name only**; no secret
  value appears anywhere in this document.
- **No Finesse/Beauty work, no visual redesign, no bug was fixed.** Every defect
  found is documented here rather than corrected, per the mission's rules.
- The only file changed by CORE-00 is this one:
  `docs/evolution/CORE-00-AUDIT.md`.
