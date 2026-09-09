# 7F — Navigation & Route Audit (PR-N2)

Status: **Diagnostic only** · 2026-07-04 · Scope: read-only inventory + debt
map. **No product code, sidebar, routes, i18n, or schema changed.**

This is the real map of 7F's routes and navigation, produced before deciding
PR-N3/PR-N4/PR-N5. It **inventories and diagnoses** — it proposes nothing that
edits product. Every "recommendation" here is a note for a *future, separate*
PR, not an action taken in this one.

Companion doc: [`docs/vertical-navigation-model.md`](./vertical-navigation-model.md) (PR-N1, the doctrine).

Sources inventoried (read-only):

- Routes: `app/**/page.tsx` (UI) and `app/**/route.ts` (API).
- Default nav: `NAV_SECTIONS` in [`components/sidebar-nav.tsx`](../components/sidebar-nav.tsx).
- Vertical resolution: `resolveNavProfile` / `BEAUTY_NAV_PROFILE` in [`core/vertical-packs/nav-profile.ts`](../core/vertical-packs/nav-profile.ts).

Method notes / limits:

- UI route list = every `app/**/page.tsx` (54 routes). API list = every
  `app/**/route.ts` (140 endpoints), summarized not enumerated.
- "Referenced in N files" = a grep for the literal path across `app/` +
  `components/` (excluding the route's own folder). It catches `<Link>`, `href`,
  and `router.push` string literals; it will **miss** dynamically built paths
  and references outside those two dirs. Treat low counts as *candidates to
  verify in PR-N5*, not proof of an orphan.

---

## 0. Legend

- **Lang** — path language: **EN**, **ES**, or **mixed/segment**.
- **In nav?** — appears in the default sidebar (`D`), the Beauty profile (`B`),
  both, or neither (`—`).
- **Debt** — 🟢 none · 🟡 minor/cosmetic · 🟠 worth a decision · 🔴 real
  duplicate/orphan candidate.

---

## 1. Priority 1 — routes that drive main nav / sidebar / vertical profiles

### 1a. Default sidebar (`NAV_SECTIONS`)

Sidebar **labels are English**; several **targets are Spanish paths**. This
label↔path language split is the single biggest theme of the audit (see §6).

| Section | Label | Route | Lang | Debt |
| --- | --- | --- | --- | --- |
| Overview | Overview | `/` | — | 🟢 |
| Main | Today | `/today` | EN | 🟢 |
| Main | Smart Inbox | `/inbox/overview` | EN | 🟢 |
| Main | Smart Inbox (subitems) | `/inbox`, `/inbox?filter=…` | EN | 🟢 |
| Main | Clients | `/clientes` | ES | 🟡 |
| Main | Projects | `/proyectos` | ES | 🟡 |
| Main | Tasks | `/tareas` | ES | 🟡 |
| Main | Billing | `/facturacion` | ES | 🟡 |
| Main | Finance | `/finanzas` | ES | 🟡 |
| Main | Marketing | `/contenido` | ES | 🟠 |
| More | Manual Intake | `/entrada` | ES | 🟡 |
| More | Requests | `/requests` | EN | 🟢 |
| More | Calendar | `/calendario` | ES | 🟡 |
| More | Documents | `/archivos` | ES | 🟡 |
| More | Notifications | `/notificaciones` | ES | 🟡 |
| More | History | `/historial` | ES | 🟡 |
| More | Tools | `/biblioteca` | ES | 🟠 |
| Workspace | Business Profile | `/business-profile` | EN | 🟢 |
| Workspace | Communication | `/comunicacion` | ES | 🟡 |
| Workspace | Contact Matching | `/identidad` | ES | 🟠 |
| Workspace | Members | `/usuarios` | ES | 🟡 |
| Workspace | Departments | `/departamentos` | ES | 🟡 |
| Workspace | Improvements | `/forte/improvements` | EN | 🟢 |
| Workspace | AI workspace | `/motor` | ES | 🟠 |

Notes:
- `Marketing → /contenido` ("content"), `Tools → /biblioteca` ("library"),
  `Contact Matching → /identidad` ("identity"), `AI workspace → /motor`
  ("engine"): label and path describe **different words**, not just different
  languages. These are the "weird UX name" links (§5).

### 1b. Vertical resolution (`resolveNavProfile`)

| Input `verticalKey` | Resolves to | Notes |
| --- | --- | --- |
| `beauty`, `salon`, `nails`, `barber`, `barbershop`, `spa`, `lashes`, `estetica` | `BEAUTY_NAV_PROFILE` | 8 keys, one profile (`BEAUTY_NAV_VERTICAL_KEYS`) |
| anything else (incl. `creative-agency`, `null`, unknown) | `null` → default nav | Pure fallback; total, never throws |

Registry today: `VERTICAL_NAV_PROFILES = { beauty }`. Beauty is the **only**
vertical with a nav profile. Everything else rides the default sidebar.

---

## 2. Priority 2 — routes used by Beauty (`BEAUTY_NAV_PROFILE`)

Every Beauty href points at an **existing** default-sidebar route (no invented
routes) — the policy from PR-N1 §5 holds. What varies is how cleanly the label
maps to the path.

| Group | Label (es) | Route | Also in default nav as | Mapping quality |
| --- | --- | --- | --- | --- |
| primary | Hoy | `/today` | Today | 🟢 clean |
| primary | Agenda | `/calendario` | Calendar (More) | 🟡 label≠path word |
| primary | Clientas | `/clientes` | Clients | 🟢 clean (same concept) |
| primary | Mensajes | `/inbox` | Smart Inbox | 🟢 clean |
| primary | Marketing | `/contenido` | Marketing | 🟠 path = "contenido" |
| primary | Servicios | `/business-profile` | Business Profile | 🔴 **interim/UX debt** |
| more | Cobros | `/facturacion` | Billing | 🟢 clean (same concept) |
| more | Equipo | `/usuarios` | Members | 🟢 clean (same concept) |
| more | Mr Forte | `/forte/improvements` | Improvements | 🟢 clean |
| more | Herramientas | `/biblioteca` | Tools | 🟠 not in PR-N1 target list |
| more | Notificaciones | `/notificaciones` | Notifications | 🟢 clean |

Beauty-specific findings:
- **`Servicios → /business-profile`** is the one true UX-debt link: Servicios is
  not a real page, it borrows Business Profile (where the service catalog is
  configured today). Already flagged in PR-N1 §8; carried here as the top Beauty
  debt item for PR-N4.
- **`Herramientas` (→ `/biblioteca`) is in Beauty's "More"** but is **not** in
  the PR-N1 recommended Beauty pilot nav (which lists only Cobros/Equipo/Mr
  Forte/Notificaciones under More). Reconciliation is a PR-N4 decision.
- No Beauty href is broken; all 11 resolve to live routes.

---

## 3. Priority 3 — important core routes (exist, not all in nav)

Detail/dynamic and secondary core surfaces reachable by deep-link or from within
a parent page:

| Route | Purpose | In nav? | Debt |
| --- | --- | --- | --- |
| `/clientes/[id]` | Client detail | via list | 🟢 |
| `/proyectos/[id]` | Project detail | via list | 🟢 |
| `/tareas/[id]` | Task detail | via list | 🟢 |
| `/facturacion/[id]` | Invoice detail | via list | 🟢 |
| `/finanzas/[id]` | Finance record detail | via list | 🟢 |
| `/archivos/[id]` | Document detail | via list | 🟢 |
| `/contenido` | Marketing/content hub | D / B | 🟠 lang |
| `/automatizaciones` | Automations | — | 🔴 orphan candidate (0 in-app refs) |
| `/agents` | AI Team Control Center (real) | top toolbar (not sidebar) | 🟢 |
| `/agente` | "Francis" business-insights **mock** (legacy) | — | 🔴 overlap/legacy |
| `/assistant` | Chat **mock** (legacy) | — | 🟠 overlap/legacy |
| `/administracion`, `/administracion/[seccion]`, `/administracion/canales` | Workspace settings (module toggles) | context bar (not sidebar) | 🟠 overlaps `/motor` |

Agent-surface overlap (documented in `app/agents/page.tsx` itself): **three**
"agent" surfaces coexist — `/agents` (real, live, kept), `/agente` (static
Francis mock), `/assistant` (chat mock). Consolidation is a product decision
(not this track), but it is real navigation debt worth recording.

---

## 4. Priority 4 — system / admin / client-portal / internal routes

| Route | Purpose | Scope | Debt |
| --- | --- | --- | --- |
| `/system`, `/system/workspaces`, `/system/workspaces/[id]`, `/system/users`, `/system/allowed-emails`, `/system/audit` | Platform control plane (server components, platform-role gated) | Platform admin | 🟢 |
| `/admin/usuarios` | Admin user management (RoleGate) | Workspace admin | 🟠 overlaps below |
| `/usuarios` | Workspace members CRUD | Workspace | 🟠 |
| `/system/users` | Read-only platform user directory | Platform | 🟠 |
| `/motor` | "AI workspace" engine view (mock-ish) | Workspace | 🟠 |
| `/login`, `/cliente/login` | Auth entry (staff / client portal) | Auth | 🟢 |
| `/cliente/*` (`dashboard`, `perfil`, `proyecto[/id]`, `facturas`, `archivos`, `solicitudes`) | **Client portal** — separate area with its own `app/cliente/layout.tsx` | External client | 🟢 (intentionally separate) |
| `/widget/chat` | Embeddable chat widget | External embed | 🟢 (not nav) |

**Three user-management surfaces** (`/admin/usuarios`, `/usuarios`,
`/system/users`) exist at three different scopes (workspace-admin,
workspace-members, platform-directory). Not strict duplicates, but the naming
(`/admin/usuarios` vs `/usuarios`) invites confusion — worth a naming decision
in PR-N5. The `/cliente/*` portal is a deliberately separate app surface (own
layout), **out of scope for the main-nav vertical work** — noted so PR-N5 does
not accidentally sweep it.

API routes: 140+ endpoints under `/api/**`, overwhelmingly Spanish-named
(`/api/clientes`, `/api/facturacion`, `/api/proyectos`, `/api/contenido`,
`/api/automatizaciones`, …) with English islands (`/api/today`, `/api/inbox/*`,
`/api/agents/activity`, `/api/forte/*`, `/api/system/*`). API paths are **not a
navigation concern** and are explicitly **out of scope** for any nav/route
rename — listed only so PR-N5 knows renaming a UI route ≠ renaming its API.

---

## 5. "Weird UX name" links — real routes, confusing labels

Links that resolve to a live core route but whose **label word ≠ path word**
(highest confusion first):

| Where | Label | Route | Why it reads odd |
| --- | --- | --- | --- |
| Beauty | Servicios | `/business-profile` | Not a services page at all (interim) |
| Both | Marketing | `/contenido` | Path says "content" |
| Default | Tools | `/biblioteca` | Path says "library" |
| Default | Contact Matching | `/identidad` | Path says "identity" |
| Default | AI workspace | `/motor` | Path says "engine" |
| Default | Manual Intake | `/entrada` | Path says "entry/inbox" |
| Beauty | Agenda | `/calendario` | Path says "calendar" (close, but ES) |

These are **not broken** — they are naming/coherence debt. Fixing them means
touching labels (i18n/UX) and/or route rename (PR-N5), neither in scope here.

---

## 6. Mixed Spanish/English route inventory

The core was built Spanish-first; newer surfaces are English. Current split of
**UI** routes:

- **Spanish paths:** `/clientes`, `/proyectos`, `/tareas`, `/facturacion`,
  `/finanzas`, `/contenido`, `/calendario`, `/archivos`, `/notificaciones`,
  `/historial`, `/biblioteca`, `/entrada`, `/comunicacion`, `/identidad`,
  `/departamentos`, `/usuarios`, `/motor`, `/administracion`,
  `/automatizaciones`, `/agente`, `/admin/usuarios`, `/cliente/*`.
- **English paths:** `/today`, `/inbox(/overview)`, `/requests`, `/agents`,
  `/assistant`, `/projects` (stub), `/business-profile`, `/forte/improvements`,
  `/system/*`, `/login`, `/widget/chat`.

There is **one existing precedent** for reconciling this: `/projects` is a
**redirect stub** → `/proyectos` (`app/projects/page.tsx`, 5 lines, 0 inbound
refs). PR-N5 can follow this exact pattern (EN alias → canonical) if the team
decides to canonicalize on English.

---

## 7. Debt table (consolidated)

| # | Item | Type | Severity | Suggested owner PR |
| --- | --- | --- | --- | --- |
| D1 | `Servicios → /business-profile` (no real services page) | Interim/UX debt | 🔴 | PR-N4 |
| D2 | `/agente` (mock) vs `/assistant` (mock) vs `/agents` (real) | Overlap/legacy | 🔴 | product decision (post-N5) |
| D3 | `/automatizaciones` — page exists, 0 in-app references | Orphan candidate | 🔴 | PR-N5 (verify) |
| D4 | Beauty "More" carries `Herramientas` not in PR-N1 target | Profile drift | 🟠 | PR-N4 |
| D5 | 3 user surfaces: `/admin/usuarios`, `/usuarios`, `/system/users` | Naming/scope overlap | 🟠 | PR-N5 |
| D6 | `/motor` vs `/administracion` (settings/AI overlap) | Overlap | 🟠 | PR-N5 |
| D7 | Label≠path-word links (Marketing, Tools, Identidad, Motor, Entrada) | Naming coherence | 🟠 | PR-N5 (+ i18n later) |
| D8 | Spanish-first vs English route split (core-wide) | Language debt | 🟡 (broad) | PR-N5 |
| D9 | `/projects` redirect stub | Resolved precedent | 🟢 | reference only |

None of D1–D9 is acted on in this PR.

---

## 8. Recommended sequencing (input to N3/N4/N5)

- **PR-N3 — tests for `resolveNavProfile`.** Independent of all debt above. Lock
  the current contract: 8 Beauty keys → `BEAUTY_NAV_PROFILE`; everything else →
  `null`; every Beauty href ∈ the real route set (this audit is the reference
  list). Safe, pure, no product change.
- **PR-N4 — refine Beauty nav profile.** Decide D1 (Servicios destination) and
  D4 (drop/keep Herramientas in More) against the PR-N1 target. Scope: only
  `BEAUTY_NAV_PROFILE`.
- **PR-N5 — legacy/duplicate/orphan route audit → redirects/archive.** Act on
  D3 (verify `/automatizaciones`), D5/D6 (user + settings surfaces), and choose
  a language canonicalization policy for D7/D8 using the `/projects → /proyectos`
  stub (D9) as the pattern. Rename/redirect/archive live here — **not before**.
- **Not in this track:** D2 (agent-surface consolidation) is a product call
  beyond navigation plumbing; recorded so it is not lost.

Guardrail carried from PR-N1: any vertical without a complete profile keeps the
full default core nav, so none of this debt blocks adding verticals — it only
shapes how focused each one can feel.

---

## 9. What this PR did / did not touch

**Did:** added this one doc (`docs/navigation-route-audit.md`). Pure diagnosis.

**Did not:** modify product, sidebar, any route, i18n, or Prisma schema; rename
anything; create redirects; change `BEAUTY_NAV_PROFILE`; or fix any debt item.
