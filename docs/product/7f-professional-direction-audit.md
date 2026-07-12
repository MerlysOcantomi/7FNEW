# 7F Professional Direction Audit

> Direction document. Companion to `docs/ways-of-working.md` (the operating
> contract) and `docs/vertical-specialist-agents.md` (the specialist doctrine).
> This file is the **compass** for the next changes to 7F / SevenEF, with a
> focus on the Beauty / Finesse vertical. It classifies the *real* state of the
> repository as of this audit — it does not change product, routes, schema,
> APIs or UI.
>
> Audit date: 2026-07-12 · Scope: architecture, navigation, surfaces, agents,
> real-vs-demo, Beauty experience, commercial direction.
> Prose in English (repo rule); Spanish product labels (`Hoy`, `Agenda`,
> `Clientas`, `Mensajes`, `Cobros`…) are preserved as-is by design.

---

## 1. Executive diagnosis

**What is good (and should not be broken).**
7F has a genuinely strong core and — importantly — an *honest* one. The
foundations are real and well-tested:

- **Multi-tenancy is real and disciplined.** Workspace resolution is
  per-request and membership-validated (`core/workspace-context.ts`), the old
  shared-tenant default now *throws* (`core/workspace.ts:getActiveWorkspaceId`),
  and the canonical models carry a required `workspaceId` with
  `onDelete: Cascade`. Enforcement is at the query layer (no Postgres RLS), and
  the Today aggregator is a model example of defensive scoping.
- **The vertical architecture is clean and additive.** `core/vertical-packs/*`
  is pure data + pure resolvers (no `@core/db`, no React, no icons). A vertical
  overrides *visibility, order, labels, specialist voice* without inventing
  routes or duplicating modules. `resolveWorkspaceExperience` even distinguishes
  `"complete"` (Beauty) from `"default"` (seeded-but-unbuilt) — this is mature.
- **Honesty is encoded in code, not just docs.** The agent roster marks only
  Fanny as wired; every demo Today layout is an isolated, deletable mock; the
  Beauty preview renders a visible "Vista previa · datos de ejemplo" chip. The
  team has already killed footguns instead of hiding them.
- **Real surfaces exist and are wired**: Inbox, Today (work_first), Clients,
  Calendar, Content/Marketing, Billing, Services (new), Business Profile, Forte
  Improvements, the Overview dashboard, Activity/History, Notifications, Users.

**What is drifting.**
The disorder the owner feared is real but *contained*, and it lives in three
places:

1. **Navigation carries dead weight.** The core sidebar still lists demo-only
   surfaces as if they were product — `/finanzas`, `/motor`, `/comunicacion`,
   `/entrada`, `/departamentos`, `/identidad`, `/biblioteca` — even though
   `ways-of-working.md §4` already *decided* to hide them. The doctrine ran
   ahead of the code.
2. **Route language is mixed and partly duplicated.** Internal routes are
   mostly Spanish (`/clientes`, `/proyectos`, `/tareas`, `/facturacion`,
   `/contenido`, `/calendario`), wrapped by a few English aliases (`/projects`,
   `/services`, `/agents`, `/requests`, `/assistant`). Some pairs overlap in
   *intent*, not just language: `/agents` vs `/agente` vs `/assistant`;
   `/facturacion` (real) vs `/finanzas` (demo); `/archivos` (real) vs
   `/biblioteca` (demo).
3. **Beauty's protagonist surface — "Hoy" — is still a labeled preview.** A real
   Beauty workspace auto-switches into the `appointment_first` layout and sees
   **mock bookings** (honestly chip-labeled), because there is no appointment
   backend yet. This is a deliberate, honest choice, but it means the first
   thing a manicurist sees is *not her real day*.

**The single biggest risk.**
Not the core — the core is fine. The risk is **letting Beauty's *impression* run
ahead of Beauty's *reality* without a written line between them.** If "Hoy" keeps
showing sample bookings, if demo modules stay in the menu, and if new
vertical-specific pages get added on impulse, 7F Beauty will *look* finished
while being a demo — the exact "fake product" failure mode `ways-of-working.md
§5` was written to prevent. The gap is presentation discipline, not engineering.

**The correct direction.**
Freeze the doctrine (this document), *subtract* before you add: clean the
navigation to only-real surfaces, draw one hard line for what "Hoy" shows a real
operator, and make the real Beauty surfaces (Agenda, Clientas, Mensajes,
Servicios, Cobros — all already backed by real data) the felt value. Beauty is
**one honest decision and a handful of subtractions away from being sellable**,
not a rebuild.

---

## 2. Product north star

> **7F is an intelligent operating system for small and medium businesses:
> verticalizable, agent-driven, that orders the daily work and turns chaos into
> clear actions.**

7F is **not** — and must never collapse into — any single one of these:

- not a CRM,
- not a calendar,
- not an inbox,
- not a dashboard,
- not a chatbot,
- not a module generator.

It *contains* those capabilities, but its job is higher: understand how a
business actually runs, organise the day around that, and let a team of agents
(led by Francis, specialised by vertical — Finesse for Beauty) do or propose the
work while the operator stays in control. The test for any feature is not "does
it add a surface?" but **"does it make the day clearer and the next action
obvious?"**

For Beauty the north star reads in one sentence: *"7F Beauty understood my salon
and organised my day — I open it and I know exactly what to do."*

---

## 3. Core vs vertical doctrine

The repo already encodes most of this; the rules below make it explicit and
enforceable.

**What belongs to the core.**
- Every *surface* and *route* (`app/**`). Verticals never own a route.
- Every *data model* and API. Persistence is core, keyed by `workspaceId`.
- The 7 core agents (`AGENT_ROSTER`) and their engines.
- Cross-cutting infrastructure: auth, workspace context, personalization/i18n,
  theme foundation, service catalog, notifications, activity.

**What belongs to a vertical pack (`core/vertical-packs/*`).**
- **Declarative data only**: module *visibility* (not code), label overrides,
  nav profile (order/label/group over *existing* routes), recommended
  channels/modules, theme keys, service-catalog seed, the specialist agent
  (branding + voice strings), Today operating-mode *declaration*.
- A pack must keep the current constraints: **no `@core/db` import, no React, no
  icon library, no new route.** If a pack needs any of those, the need belongs in
  core, and the pack only points at it.

**What can be configuration.**
- Anything that varies *per workspace* rather than *per vertical*: enabled
  modules, business profile, service catalog contents, theme choice, timezone,
  automation caps. Config lives in `Workspace.config` (JSON) and is merged over
  the vertical default via `mergeConfigs`.

**What may become a new surface.**
- Only when a *real question* has no home. A new surface requires: a real data
  source named up front, a place in the surface map (§5), and a nav decision. If
  an existing surface can answer the question by *evolving*, evolve it.

**What must never be duplicated.**
- Home / Overview, Today, Inbox / Inbox Briefing, Calendar, a work queue, or a
  "dashboard". Each answers exactly one question (`ways-of-working.md §4`).

**How to decide core vs vertical (the one test).**
> If two verticals would want it, it is **core** (surface it via config/visibility).
> If only this vertical wants it *and it is data, not behaviour*, it is a **pack**.
> If only this vertical wants it *and it needs code*, stop — it is almost always
> core behaviour behind a vertical-scoped flag, not vertical code.

**How to avoid hardcoding Beauty inside core modules.**
- Spanish/Beauty strings live in the pack, never inside a core module (already
  the rule in `beauty.ts`). A core component receives labels/voice as props or
  resolves them from `resolveWorkspaceExperience(verticalKey)` — it never
  branches on `verticalKey === "beauty"` for copy.
- The one current exception to watch is the Beauty Today wiring in
  `components/today/today-page-client.tsx` (it branches on the *resolved
  experience*, which is acceptable, but see the §5 / §10 note on its demo data).

**How to avoid creating routes because a vertical asked.**
- A vertical that wants a surface that does not exist yet **points its nav item
  at the closest existing real route** (as `nav-profile.ts` already documents),
  and the dedicated surface is a separate, later, core step — never a
  vertical-owned page.

---

## 4. Navigation doctrine

**Language and routes.**
- **Internal routes are English.** New routes are created in English
  (`/services`, `/agents`, `/requests` already follow this).
- **Visible copy may be Spanish** (and *is*, for Beauty). Labels live in packs /
  personalization, decoupled from the route.
- **Do not create duplicate ES/EN routes.** No new Spanish route when an English
  one exists (or vice versa). The existing Spanish routes stay — a mass rename is
  a *dedicated* migration PR (`ways-of-working.md §6`), never a side effect.
- **Do not mix core nav with vertical nav ad hoc.** The mechanism already exists:
  `resolveNavProfile(verticalKey)` returns a profile or `null`; the sidebar
  renders the vertical profile or the byte-for-byte core default. Never fork the
  sidebar per vertical by hand.

**Surface priority rules.**
- **Today is the main entry.** First click of the day, above Inbox.
- **Calendar / Agenda sits high for Beauty** (appointment businesses live in the
  day book).
- **Inbox / Mensajes is essential** (Fanny's real home; the only fully wired
  agent).
- **Marketing is a hook, not the product.** It may lead visually, but 7F is not a
  social-media tool — Marketing must not swallow the operating system.
- **Services must be a real surface if it is in nav.** ✅ It now is (`/services`,
  real, config-JSON backed).
- **"Más" (More) holds the secondary.** Cobros, Equipo, Mr Forte, Herramientas,
  Notificaciones.

**Proposed ideal Beauty MVP navigation** (the target, validated against the repo
below):

```
Primary:
- Hoy         → /today
- Agenda      → /calendario
- Clientas    → /clientes
- Mensajes    → /inbox
- Marketing   → /contenido
- Servicios   → /services

More (Más):
- Cobros         → /facturacion
- Equipo         → /usuarios
- Mr Forte       → /forte/improvements
- Herramientas   → /biblioteca
- Notificaciones → /notificaciones
```

**Validation against the real repo** (`core/vertical-packs/nav-profile.ts` —
`BEAUTY_NAV_PROFILE`). The profile already matches this proposal exactly. Data
reality of each target:

| Beauty nav item | Route | Real? | Note |
|---|---|---|---|
| Hoy | `/today` | ⚠️ preview | Auto-switches to `appointment_first` **demo** for Beauty (labeled chip). See §5 / §10-#1. |
| Agenda | `/calendario` | ✅ real | `Evento` feed. |
| Clientas | `/clientes` | ✅ real | `Cliente` model. |
| Mensajes | `/inbox` | ✅ real | Fanny pipeline, live. |
| Marketing | `/contenido` | ✅ real | `ContentPiece`/`Campaign`/`ContentIdea`. |
| Servicios | `/services` | ✅ real | Config-JSON catalog + Beauty seed. |
| Cobros | `/facturacion` | ✅ real | `Factura`. Currency hardcoded CHF — should be EUR for Beauty/ES (§10-#4). |
| Equipo | `/usuarios` | ✅ real | `Usuario` CRUD. |
| Mr Forte | `/forte/improvements` | ✅ real | DB-derived improvements + snapshot. |
| Herramientas | `/biblioteca` | ❌ demo | Static resource list, no backend. Repoint or hide (§10-#4). |
| Notificaciones | `/notificaciones` | ✅ real | `Notification`. |

**Verdict:** the Beauty menu is **almost entirely backed by real surfaces** —
the only two soft spots are *Hoy* (preview data) and *Herramientas* (demo). The
Beauty nav is *cleaner than the core default nav*, which still carries several
demo surfaces (see §5). Beauty's navigation is essentially correct; the work is
in the two soft spots, not a redesign.

---

## 5. Surface map

Legend — **State**: real / preview (gated demo, honestly labeled) / placeholder
(demo, *not* labeled/gated) / duplicate / legacy-debt. **Priority**: P0 (decide
now), P1 (next), P2 (later).

| Surface | Route | State | Data source | Related agent | Recommendation | Prio |
|---|---|---|---|---|---|---|
| Overview / Home | `/` | real | `/api/dashboard/summary` (Prisma) | Francis (narrative) | Keep. Do not let it compete with Today. | P2 |
| **Today / Hoy** | `/today` | real (core) · **preview (Beauty)** | `WorkspaceTask`+`Tarea`+`Evento` (real); Beauty→`appointment_first` **mock** | Fanny; Finesse (declared) | **Decide Beauty Today doctrine** (§10-#1). Core Today is fine. | **P0** |
| Smart Inbox / Mensajes | `/inbox` | real | `Conversation`/`Message`/… + IMAP | **Fanny (wired)** | Keep. This is the strongest surface. | P1 |
| Inbox Briefing | `/inbox/overview` | preview | `overview-data.ts` placeholder | Fanny | Wire to real data or keep clearly as briefing stub. Not in Beauty nav. | P2 |
| Agenda | `/calendario` | real | `Evento` feed | — | Keep. High priority for Beauty. | P1 |
| Clientas / Clients | `/clientes` | real | `Cliente` | Fiona (7F Growth · declared) | Keep. Make usable for Beauty (§9 phase 2). | P1 |
| Servicios / Services | `/services` | real | `Workspace.config.serviceCatalog` JSON + seed | — | Keep. Consider a real model later if agenda/billing reference services. | P1 |
| Marketing / Contenido | `/contenido` | real | `ContentPiece`/`Campaign`/`ContentIdea` | **Fiona (7F Growth, owns Marketing)**; Freya supplies the visuals | Keep as visual hook. Attribution **resolved** (§8): Marketing → Fiona; creative pieces → Freya. | P1 |
| Cobros / Billing | `/facturacion` | real | `Factura` | Felix (declared) | Keep. Fix currency for ES/Beauty (EUR). | P1 |
| Finance | `/finanzas` | **placeholder** | static `CASHFLOW/FUNDS/…` | Felix (declared) | Hide from primary nav (doctrine already says so). | P0 |
| Business Profile | `/business-profile` | real | `Workspace.config.businessProfile` JSON | Fanny (context) | Keep. Core infra for Fanny. | P2 |
| Forte / Improvements | `/forte/improvements` | real | `resolveForteCapabilities`→signals; `ForteSnapshot` | **Mr. Forte (real engine)** | Keep. Reconcile "coming online" on `/agents` vs real engine (§8). | P1 |
| Agents (Control Center) | `/agents` | real (honest-live) | `/api/agents/activity` projection | all (only Fanny live) | Keep. Canonical AI surface. | P2 |
| Projects | `/proyectos` | real | `Proyecto` | — | Keep (not in Beauty MVP). `/projects` is a redirect alias. | P2 |
| Tasks | `/tareas` | real | `/api/tareas` (`Tarea`) | Fanny | Keep. Legacy `Tarea`↔`WorkspaceTask` convergence is known debt. | P2 |
| Reports | — | n/a | — | — | Does not exist as a route. Do not build for Beauty MVP. | — |
| Inventory | — | n/a | — | — | Only a hidden module flag; no surface. Do not build now. | — |
| Manual Intake | `/entrada` | placeholder | static `recentEntries` | Fanny | Hide from primary nav. | P0 |
| Communication | `/comunicacion` | placeholder | static channels/DMs | Fanny | Hide from primary nav. | P0 |
| AI workspace | `/motor` | placeholder | static config; Save = no-op | — | Hide from primary nav. `/automatizaciones` redirects here. | P0 |
| Contact Matching | `/identidad` | placeholder | static `identityGroups` | Fiona | Hide from primary nav. | P1 |
| Departments | `/departamentos` | placeholder | static `departments` | — | Hide from primary nav. | P1 |
| Tools / Herramientas | `/biblioteca` | placeholder | static `resources` | — | In Beauty "Más" → repoint or hide (§10-#4). | P0 |
| Files | `/archivos` | real | `/api/documentos` | — | Keep. Overlaps `/biblioteca` in intent. | P2 |
| Agent insights | `/agente` | placeholder | static "Francis" consts | Francis | Duplicate of `/agents`. Redirect or hide. | P1 |
| Assistant | `/assistant` | placeholder | `INITIAL_MESSAGES`; fake reply | Fanny | Demo chat overlapping `/agents`/Ask-Fanny. Gate or hide. | P1 |
| Requests | `/requests` | real | `/api/requests` | — | Keep (client-portal). | P2 |
| Notifications | `/notificaciones` | real | `/api/notifications` | — | Keep. | P2 |
| History | `/historial` | real | `/api/activity` | — | Keep. | P2 |
| Users | `/usuarios` | real | `/api/usuarios` | — | Keep (Beauty "Equipo"). | P2 |
| Administration | `/administracion` | real | resolved workspace config | — | Keep. | P2 |
| System (control plane) | `/system` | real (partial) | platform session; `Admins`/`Billing` = "Soon" | — | Keep; stubs are honestly labeled. | P2 |

**Duplicate / alias routes (already redirecting, keep documented):**
`/projects → /proyectos`, `/automatizaciones → /motor`.

**Route-intent overlaps to resolve (not language, but purpose):**
`/agents` (real) ⟂ `/agente` (demo) ⟂ `/assistant` (demo); `/facturacion` (real)
⟂ `/finanzas` (demo); `/archivos` (real) ⟂ `/biblioteca` (demo);
`/inbox` (real) ⟂ `/comunicacion` (demo) ⟂ `/entrada` (demo).

---

## 6. Beauty / Finesse product experience

**What the user sees on entry.**
The target (per `docs/claude-design-brief-beauty-hoy.md`) is "Hoy" in
`appointment_first`: a Beauty header (business, date, day status, mini summary),
a short Fanny brief, the **Agenda de hoy** as the protagonist canvas, and a right
rail of one-tap actions (unconfirmed / open gaps / follow-ups / one marketing
nudge / a Cobros glance). Premium, calm, Rose-Nude, *not* a metrics dashboard.

**Reality today:** that screen exists and renders (`BeautyStudioOverview`) — but
**over demo bookings**, marked "Vista previa · datos de ejemplo". So the *shape*
is right; the *data* is not real yet.

**First 5 minutes (target).** Confirm today's appointments, see the next client
and the "now" line, spot an open gap and act on it, glance at pending WhatsApp
confirmations with Fanny-suggested replies, and approve one marketing post from a
recent photo. No setup wall, no empty CRM.

**What 7F should make her feel it solved.** "It organised my day, it is chasing
my unconfirmed clients, and it is turning my work into content and rebookings —
without me thinking like an administrator or an influencer."

**Agent roles — real vs future (do not present future as done).**

| Agent | Beauty role | Reality today |
|---|---|---|
| **Fanny** | Operations & messages: triage, drafts, follow-ups, confirmations. | **Real & wired.** The only fully live core agent (AI inbox pipeline + DB-backed activity). |
| **Finesse** | Beauty specialist / lead voice: interprets context, coordinates the day, presents actions on Beauty surfaces. | **Declared only.** Data + voice strings + resolver; **not yet rendered** as the voice on Hoy/Home/Overview. Branding, not execution. |
| **Freya** | Creative Studio: visual content, imagery, video, design, interfaces and assets (the pieces Fiona needs for growth and that dress Forte's modules). | **Declared only.** Roster row + `/contenido` link. No engine. |
| **Felix** | Cobros: prepare charges, invoices, payment risk. | **Declared only.** Roster row + finance link. No engine. |
| **Mr Forte** | Configuration / vertical fit: proposes modules & adaptations, learns the operating model in onboarding. | **Real engine** (deterministic recommendations + DB-derived improvements + approval runtime), wired to `/forte/improvements` & `/api/forte/*` — **but shown as "coming online" on `/agents`** because it emits no live activity lane. |

**Also declared-only** (for honesty): Francis (CEO · operations & coordination),
Fiona (7F Growth: campaigns, CRM, SEO/AEO, email marketing, relationships),
Fathom (research; no route).

**Doctrine for the experience:** Finesse *leads the voice*, the core agents keep
their attributions. Every action that belongs to a core agent shows that agent
("Fanny detected 3 unconfirmed", "Felix can prepare the charge"). Do not invent
Finesse "doing" things it does not do — until a real voice layer is built,
Finesse is branding on top of Fanny's real work.

---

## 7. Professional quality bar

A feature is "real product" in 7F only when **all** of these hold:

- **Real data** — reads/writes real records or clearly-labeled real config
  (JSON config counts; static consts do not).
- **Persistence by `workspaceId`** — every read and write is scoped; no
  null-tenant leakage.
- **Multi-tenant safe** — membership-validated resolution; query-layer filter
  present and defensive (see the Today aggregator as the reference).
- **Honest empty states** — an empty workspace shows a true empty state, never
  seeded demo rows presented as the user's.
- **Loading & error states** — every fetch has both; failures degrade honestly
  (Forte Improvements' empty fallback is the reference).
- **Clear copy** — Spanish (ES) for Beauty, human words; no technical jargon in
  the UI (`run`, `execution`, `pipeline`, `overview` as a label).
- **Mobile considered** — content-density budgets respected
  (`docs/content-density-guard.md`): preview first, then "ver todo"; never an
  unbounded `.map()` in a card.
- **No demo data in real workspaces** — or, if a preview is deliberately shown,
  it carries a visible "datos de ejemplo" chip and performs **no fake writes**.
- **No duplicate routes** — one canonical surface per question.
- **Tests when there is pure logic** — resolvers/planners are pure and unit
  tested (`node:test`), as the vertical packs, Today modes and Forte runtime
  already are.
- **Integrated or explicitly deferred** — either wired into the rest of the
  system, or the deferral is written down.

---

## 8. Anti-chaos rules

1. **Evolve before you add.** No new page if an existing one can answer the
   question by growing.
2. **Config before vertical code.** No vertical-specific code if it can be
   declarative data or a workspace flag.
3. **Never mix demo with real** in the same workspace without a visible
   "datos de ejemplo" chip and zero fake writes.
4. **No dashboards for their own sake.** A screen must be *actionable*, not
   merely informative. If it only informs, demote it into a rail or a glance.
5. **No new Spanish routes.** Internal routes are English; a language migration
   is its own PR, never a side effect.
6. **No large feature without a named data source.** State the model/API up
   front or it does not start.
7. **Never duplicate Overview / Today / Dashboard / Inbox Briefing.** One
   question, one surface.
8. **No CRUD that does not improve the main moment.** Beauty's main moment is the
   day (Hoy/Agenda) and the client relationship — build there first.
9. **No important decision hidden inside a visual component.** The Beauty Today
   demo-vs-real decision currently lives inside `today-page-client.tsx`
   (`enableVerticalAutoSwitch: !!beauty`) and bypasses the declared
   `BEAUTY_PACK.today.activateRealForRealWorkspaces` flag — exactly the kind of
   product decision that must be explicit and doctrine-driven, not implicit in a
   render branch.
10. **Keep persona→surface attribution single-sourced — RESOLVED (frozen doctrine).**
    The former drift is closed. The agent doctrine is now: **Fiona = 7F Growth**
    (owns Marketing, campaigns, CRM, relationships, audiences, SEO, AEO/GEO, email
    marketing and digital presence) and **Freya = Creative Studio** (produces the
    visual content, imagery, video, interfaces and assets Fiona uses to execute
    growth). Attributing Marketing/`/contenido` to **Fiona** ("por Fiona") is
    therefore **correct, not an error** — the navs, `roster.ts` and this document
    now agree. Freya is *not* the owner of strategic marketing; Fiona is *not*
    reduced to CRM.
11. **Doctrine and code must match.** `ways-of-working.md §4` already decided to
    hide the demo stubs from primary nav; the sidebar still shows them. Close
    gaps like this instead of letting them accumulate.

---

## 9. Recommended roadmap

**Phase 1 — Stabilise direction (this doc + small subtractions).**
- Document the doctrine (this file). ✅
- Close the navigation: hide demo-only surfaces from the *core* primary nav
  (`/finanzas`, `/motor`, `/comunicacion`, `/entrada`, `/departamentos`,
  `/identidad`), per the decision already in `ways-of-working.md §4`.
- Classify surfaces (this doc §5) and resolve the intent-overlap routes
  (`/agente`, `/assistant`, `/biblioteca`).
- Resolve the two critical ambiguities: the **Beauty Today demo-vs-real line**
  and the **persona attribution drift**.

**Phase 2 — Turn Beauty into real sellable product.**
- **Hoy Beauty: real or honest fallback.** Either wire a minimal real
  appointment source, or fall Beauty back to a real `work_first`/agenda-backed
  Hoy until the appointment backend exists — no unlabeled demo as the hero.
- **Agenda useful** — Beauty reads/writes real `Evento`s from the day book.
- **Servicios real** — already landed; connect it so Agenda/Cobros can reference
  a service.
- **Clientas usable** — Beauty-flavoured client cards (rebooking, last visit).
- **Mensajes useful** — Fanny confirmations/reminders for appointments.
- **Marketing as a visual hook** — photo → suggested post, approve-not-create.

**Phase 3 — Mobile Beauty.**
- Less information, fast actions, appointments, messages, the beauty photo
  moment; voice/microphone later.

**Phase 4 — Commercial professionalisation.**
- Onboarding (Mr Forte configures the operating model), a *separate* demo
  workspace (never demo data inside a real one), pricing, website/chatbot,
  WhatsApp/Instagram when the integrations are real.

---

## 10. Immediate next 5 moves

> Recommendations only — **do not implement these in this task.**

**Move 1 — Decide and encode the Beauty "Hoy" demo-vs-real line.**
- *Objective:* stop showing a real Beauty operator mock bookings as their day;
  either wire a minimal real source or fall back to a real Hoy, gated by the
  already-declared `activateRealForRealWorkspaces` flag.
- *Why it matters:* Hoy is Beauty's protagonist; a labeled demo hero is the
  "fake product" risk (§1) and undermines the "it organised my day" promise.
- *Likely files:* `components/today/today-page-client.tsx`,
  `core/vertical-packs/beauty.ts` (the `today` flag),
  `modules/today/today-layout-mode.ts`, `modules/today/beauty-today.ts`.
- *Risk:* medium — touches the render decision for a live vertical.
- *Success:* a real Beauty workspace never sees unlabeled mock bookings; the
  behaviour is driven by an explicit flag, not an inline `!!beauty` branch.
- *Type:* **decision + small implementation** (deferred).

**Move 2 — Clean the core primary navigation to only-real surfaces.**
- *Objective:* hide `/finanzas`, `/motor`, `/comunicacion`, `/entrada`,
  `/departamentos`, `/identidad` from primary nav (execute the standing
  `ways-of-working.md §4` decision); keep the pages reachable, just not promoted.
- *Why it matters:* the menu currently advertises demo as product — the fastest
  credibility win, and it aligns code with doctrine.
- *Likely files:* `components/sidebar-nav.tsx` (`buildNavSections`).
- *Risk:* low — nav-only, no data/route/schema change.
- *Success:* every primary-nav item resolves to a real surface; demo surfaces
  are hidden or clearly marked "próximamente".
- *Type:* **implementation** (deferred).

**Move 3 — Single-source the agent→surface attribution. ✅ DONE (frozen doctrine).**
- *Objective:* resolve Freya-vs-Fiona for Marketing/`/contenido` and align
  `roster.ts`, both navs, and `vertical-specialist-agents.md`.
- *Resolution:* **Fiona = 7F Growth** owns Marketing (campaigns, CRM, SEO, AEO,
  email marketing, relationships, growth); **Freya = Creative Studio** produces the
  visual content, interfaces and assets Fiona uses. The navs already said
  "por Fiona" / "by Fiona"; `roster.ts` and this doc now match. One agent owns
  Marketing everywhere; no contradicting "por X" helper remains.
- *Files touched:* `modules/agents/roster.ts`, `docs/agents-surface.md`,
  this document. Navigation was intentionally **not** changed (Marketing stays
  "por Fiona" / "by Fiona"). `vertical-specialist-agents.md` already read
  consistently (Fiona → campaigns, Freya → creative pieces).
- *Type:* **implementation** — done, high coherence value.

**Move 4 — Fix the two Beauty-nav soft spots (Herramientas + currency).**
- *Objective:* repoint or hide Beauty "Herramientas" (`/biblioteca` is demo) and
  set the Beauty/ES currency to EUR (Cobros currently hardcodes CHF).
- *Why it matters:* these are the only non-real leaks in an otherwise real Beauty
  menu; CHF on a Spanish salon breaks the illusion instantly.
- *Likely files:* `core/vertical-packs/nav-profile.ts` (Beauty "Más"),
  the billing/`facturacion` currency source.
- *Risk:* low.
- *Success:* every Beauty nav item resolves to real (or honestly labeled)
  content; amounts show €.
- *Type:* **implementation** (deferred).

**Move 5 — Consolidate the intent-overlap routes.**
- *Objective:* make `/agents` the single AI surface (redirect/hide `/agente` and
  gate `/assistant`); document the ES/EN route posture and the
  `/facturacion` vs `/finanzas`, `/archivos` vs `/biblioteca` overlaps so no new
  duplicate is added.
- *Why it matters:* prevents the "which page is real?" confusion the `/agents`
  file header already warns about.
- *Likely files:* `app/agente/page.tsx`, `app/assistant/page.tsx` (redirect/gate),
  a short note appended to `ways-of-working.md`.
- *Risk:* low–medium (behaviour change on two demo routes).
- *Success:* one canonical AI surface; overlaps documented; no orphan demo pages
  competing with real ones.
- *Type:* **audit + small implementation** (deferred).

---

## 11. Final recommendation

**What NOT to do now.**
- Do not build new surfaces (Reports, Inventory, a second dashboard, a new
  Beauty-only page). Do not start WhatsApp/Instagram/website/chatbot. Do not
  attempt the `Tarea → WorkspaceTask` convergence or a mass ES→EN route rename as
  a side effect — those are dedicated PRs.

**What to do first.**
- Freeze this doctrine, then *subtract*: clean the core nav (Move 2), fix the
  attribution and Beauty soft spots (Moves 3–4), and make the one real product
  decision about Beauty "Hoy" (Move 1). Small, honest, high-credibility steps.

**The product decision to freeze.**
- **Beauty MVP is the honest daily operating surface over real data (Agenda,
  Clientas, Mensajes, Servicios, Cobros), led by Fanny's real work and Finesse's
  voice — not a metrics dashboard, and not a demo hero.** "Hoy" either shows the
  real day or an honest fallback; it never shows unlabeled sample bookings as
  production. Freeze this and measure every change against it.

**What is already good and must not be broken.**
- The multi-tenant core, the pure additive vertical-pack architecture, the honest
  agent roster (Fanny wired, the rest labeled), the real surfaces (Inbox, Today
  work_first, Clients, Calendar, Content, Billing, Services, Business Profile,
  Forte Improvements), the demo-gating discipline, and the test coverage on the
  pure resolvers. This is a healthy foundation — the next moves are about
  *presentation discipline and subtraction*, not rebuilding what works.

_End of audit._
