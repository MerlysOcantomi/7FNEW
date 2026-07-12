# Mr. Forte Lab — Side Door Strategy

> **Status:** Direction / strategy document. **Docs-only — no product, route,
> schema, API or UI change in this task.** It defines what Mr. Forte Lab is
> (and is not) as an *internal* surface of 7F, how internal 7F capabilities
> become activable products, and records the *real* state of the repository as
> of the audit date.
>
> **Audit date:** 2026-07-12 · **Base:** `master`.
>
> **Companion documents (do not duplicate — this file points at them):**
> - `docs/product/7f-professional-direction-audit.md` — the Beauty compass
>   (surface map, real-vs-demo, agent reality, anti-chaos rules).
> - `docs/product/beauty-brand-web-i18n-architecture.md` — brand kit,
>   palette-from-logo, premium instant website (builder deferred), i18n,
>   6-phase roadmap.
> - `docs/ways-of-working.md` — the operating contract (no-fake-product,
>   verticals = core + configuration, "Mr. Forte is the future orchestrator").
> - `docs/vertical-specialist-agents.md` — the Finesse-leads-Beauty specialist
>   doctrine.
> - `docs/agents-surface.md` — the AI-team roster and the honesty rule (only
>   Fanny is wired; the rest are "coming online").
>
> Prose in English (repo rule). Spanish product labels (`Hoy`, `Agenda`,
> `Clientas`, `Mensajes`, `Cobros`…) are preserved as-is by design.
>
> **Status legend used in this document:** `real` = built and wired today ·
> `preview` = visible but over sample/gated data · `concept` = designed, not
> built · `absent` = not present in the repo.

---

## 1. Executive decision

**Mr. Forte Lab is part of 7F. It is a side door into the same house.**

The metaphor we freeze:

> **7F is a complete house. Mr. Forte Lab is a side door that opens directly
> into one of the rooms of that same house.**

A visitor does not always enter through the front door thinking *"I want the
whole operating system for my business."* They often arrive looking for one
concrete thing — a website, a logo, a chatbot, post templates, an automation, a
way to organize messages. Mr. Forte Lab is the side door that lets them enter
through that concrete need, and then discover that it lives inside a much bigger
house they can grow into.

What this decision rules out and rules in:

- **Not** a separate store, a second SaaS, an external marketplace, a parallel
  app, or a copy of 7F. It never duplicates logic or data.
- **Is** an internal entrance to 7F: a room inside the house where real 7F
  capabilities are discovered, tried, presented, activated, and packaged as
  reusable digital products.

The promise is **not** *"buy a loose tool."* The promise is: *"the thing you
need lives inside 7F and can grow with you until it becomes the operating system
of your business."*

Grounding in the repo: 7F is already a multi-tenant "intelligent operating
system for SMBs" (`docs/ways-of-working.md §2`), Mr. Forte already carries the
role tagline **`Architecture · Modules · Lab`** and the description *"runs Forte
Lab to build reusable systems"* (`modules/agents/roster.ts`), and verticals
already grow from **a clean core + configuration**, never copy/pasted apps
(`docs/ways-of-working.md §3`, `docs/today-layout-modes.md §7`). Mr. Forte Lab is
the named surface for that existing doctrine — not a new architecture.

---

## 2. What Mr. Forte Lab is

Mr. Forte Lab is, all at once and always **inside 7F**:

- **An internal room of 7F** — a surface of the same app, on the same data, with
  the same agents.
- **A discovery surface** — where a business owner meets a capability by the
  problem it solves, not by a feature list.
- **A capability laboratory** — where Mr. Forte investigates, designs, prototypes
  and packages reusable capabilities and modules.
- **A showcase of activable products** ("vitrina") — where a capability is
  presented with a clear value, an honest status, and an activation path.
- **An entrance by concrete need** — the side door: website, logo, content,
  chatbot, module, automation.
- **A bridge to the full use of 7F** — the user can enter for one small product
  and end up understanding (and adopting) the whole ecosystem.

The user can enter through a small product, but always ends up understanding the
complete system.

---

## 3. What Mr. Forte Lab is not

Strict limits, so the side door never turns into a different house:

- ❌ Not an external ecommerce.
- ❌ Not a second app.
- ❌ Not a generic, disconnected marketplace. (When we use words like
  *"internal storefront"* it always means a room **inside** 7F, never a separate
  system.)
- ❌ Not a loose landing page floating outside the product.
- ❌ Not a library of fake demos.
- ❌ Not a collection of disconnected tools.
- ❌ Not a parallel module system with its own data models.
- ❌ Not a place that sells capabilities 7F does not have or cannot sustain.

If any of these start to be true, we have stopped building the side door and
started building a second house. That is the failure mode this document exists to
prevent.

---

## 4. Side-door entry model

Each side door starts from a concrete need and leads to the connected value of
7F. The status tag on each door is **honest about the repo today** — some doors
are real capabilities, others are concept/absent and must be presented as such
(never as if they were live).

### Website side door — `concept` / `absent`
The user enters looking for a website. Mr. Forte Lab shows a website capability.
They then discover the site can connect with: services, working hours, prices,
Google Maps, chatbot, Smart Inbox, clients, and full 7F.
*Repo reality:* there is **no** website builder or public business page today
(only the embeddable chat widget). The direction is specified in
`docs/product/beauty-brand-web-i18n-architecture.md §7` as a *premium instant
website fed by real data* — **preview over real data first, builder deferred.**
This door must be presented as **concept**, not real.

### Logo side door — `concept` / `absent`
The user enters looking for a logo. Mr. Forte Lab shows logo / brand kit. They
then discover that brand kit can feed: website, posts, PDFs, messages,
reminders, communications, and the workspace's visual identity.
*Repo reality:* the **theming/token system is `real`** (5 palettes, ~316 vars,
`core/theme.ts`), but a per-business **brand kit** (stored logo, brand palette,
fonts, photos) and *palette-from-logo* are **`absent`** — designed only in
`beauty-brand-web-i18n-architecture.md §4–§6`. Logo *generation* is not built.

### Content side door — `real` (content) / `concept` (template library)
The user enters looking for templates or content. Mr. Forte Lab shows adaptable
content / post templates. They then discover it can connect with campaigns,
content calendar, marketing, website and the business brand.
*Repo reality:* the content module is **`real`** — full CRUD over `ContentPiece`
/ `ContentIdea`, a content calendar, and AI content assist (`modules/contenido/`,
`app/contenido/`), with a real sibling campaigns module (`modules/campanas/`). A
reusable **post-template library** is **`concept`** (not built). The PDF document
templates in `components/templates/*` are real *documents* (invoice/proposal/
report), not social post templates.

### Chatbot side door — `real` (widget → inbox) / `concept` (AI bot that "knows your business")
The user enters looking for a chatbot. Mr. Forte Lab shows a business chatbot.
They then discover it can connect with Smart Inbox, messages, services, clients,
and actions inside 7F.
*Repo reality:* an embeddable **live-chat widget is `real`** (`public/widget.js`,
`app/widget/chat/page.tsx`) and it feeds the Smart Inbox as conversations. But it
is a **human live-chat widget**, not an autonomous AI chatbot; AI is applied
downstream in the inbox (classification/draft), not as an auto-responder. A
"chatbot that knows your business" is **concept**.

### Module side door — `real` (activation pattern exists)
The user enters looking for a concrete tool. Mr. Forte Lab shows a module. They
then discover that module can be activated inside their 7F workspace.
*Repo reality:* the **activation pattern is `real`** — modules live in `@modules`
(inbox, clients, content, billing, finance, calendar, services, automations…),
visibility is toggled per vertical as **data** (`core/vertical-packs/beauty.ts`
`BEAUTY_MODULE_VISIBILITY`), and Mr. Forte's playbooks compose only from a
declared catalog (`agents/forte/verticals/beauty.ts`, `agents/forte/phase1/
catalog.ts`). See §7 for how Mr. Forte generates and governs modules.

### Automation side door — `real`
The user enters looking to automate a task. Mr. Forte Lab shows an automation.
They then discover that automation can connect with agents, inbox, clients,
services, agenda or finances.
*Repo reality:* the automations engine is **`real`** — CRUD over the
`Automatizacion` model with triggers/conditions/actions plus domain trigger
handlers for invoices, projects and tasks (`modules/automatizaciones/`), surfaced
at `/motor`. The inbox has its own real auto-task follow-up policy
(`modules/inbox/auto-task-policy.ts`). Beauty reminders/rebooking are described as
inbox-driven and in-scope but **not yet vertical-wired**.

---

## 5. Relationship between 7F and Mr. Forte Lab

A clear architecture — one system, distinct roles:

| Layer | Role |
|---|---|
| **7F Core** | Where the **real reusable capabilities** live (multi-tenant, `workspaceId` everywhere). |
| **Workspace** | Where the business **uses** the activated capabilities every day. |
| **Vertical Packs** | How capabilities **adapt** per business type (data: visibility, nav, labels, theme, specialist). |
| **Agents** | Who **guide, execute or recommend** (Mr. Forte, Fanny, Freya, Fiona, Felix, Francis, Fathom + vertical specialists). |
| **Mr. Forte Lab** | The **internal side door** to discover, prototype, test, activate and package capabilities. |
| **Product Pages** | **Internal/commercial presentations** of existing or planned capabilities, each with a clear status. |

**Activation flow:**

1. The user enters through a concrete need.
2. Mr. Forte Lab presents a specific capability.
3. The capability is explained with clear value.
4. The user can preview, configure, request or activate it.
5. On activation, it lives inside their 7F workspace.
6. 7F becomes the daily operating system of the business.

No parallel data. No duplicated logic. The Lab is a *view and an activation
surface* over the same core — not a second backend.

---

## 6. Productization doctrine

Rules to turn internal 7F capabilities into products activable from Mr. Forte
Lab:

- A capability must **live in 7F or have a clear architecture inside 7F** before
  it is presented as activable.
- Mr. Forte Lab **does not duplicate**; it **presents and activates**.
- Every product must **declare its status** honestly: real, preview, gated beta,
  concept, or future (§8).
- **No demo is sold as a real product.**
- **No isolated tools.** No product that is disconnected from the core.
- **No parallel data.** No new data model that shadows a 7F model.
- **No hardcoded vertical** inside a generic product — verticals are adaptation
  data, not baked-in code.
- Every product must have an **owner agent** (§9).
- Every product must have an **activation path into the workspace**.
- Every product must have a **clear data source**.

These are the same guardrails already encoded in `docs/ways-of-working.md §5`
(no-fake-product) and `§3` (verticals = core + configuration). This section names
them for the productization context; it does not invent new ones.

---

## 7. Mr. Forte as the module generator

This is the doctrine the owner asked to make explicit. Mr. Forte **is** 7F's
module generator — but a **governed** one, inside 7F.

**1. Mr. Forte is 7F's module generator.** He detects missing modules, proposes
new modules, designs modules, turns repeated business patterns into reusable
capabilities, decides what can enter the Lab, decides what can be activated inside
7F, and decides what can later become a product activable from Mr. Forte Lab.
This matches the real engine in `agents/forte/` (semantic dictionary →
recommendation → runtime pipeline → business gap-analysis, live at
`/forte/improvements` and `/api/forte/*`) and the README rule *"There is one
orchestrator. Extend it, don't duplicate it."*

**2. His generation is not free or chaotic.** It is a **restricted, governed
factory**, not vibe-coding. The existing playbooks already state the principle:
*"Solo componer desde el catálogo declarado; nunca inventar módulos ni escribir
código libre"* (`agents/forte/verticals/beauty.ts`).

**3. Every generated module must pass through rules:**

- **core capability** — it maps to a real 7F capability or a clearly architected
  one.
- **vertical adaptation** — it adapts by configuration, never by copy/paste.
- **data source** — a clear, multi-tenant (`workspaceId`) source of truth.
- **owner agent** — a responsible agent (§9).
- **product status** — one of §8's statuses.
- **activation path** — a defined route into the workspace.
- **real vs preview** — never shown as real if it is preview/concept.
- **tests / quality bar** — where applicable, before it counts as real.
- **no fake product** — nothing with demo data appears as real.

**4. Mr. Forte can generate a module even if it does not yet belong to an active
vertical.** A capability can exist in the core and be adapted to a vertical later.

**5. Mr. Forte can detect that a business pattern should become a reusable
module** — turning a one-off need into a core capability instead of a bespoke,
throwaway build.

**6. Mr. Forte Lab can present those modules as activable products** — but always
inside 7F, never as an external catalog.

**7. A module can start as `idea` or `lab prototype`, but must not be sold as
real** until it has a real base (see §8).

> **The distinction to remember:**
> *Mr. Forte Lab is **not** an uncontrolled module generator. It is the
> **governed module-generation room** inside 7F.*

**Governed generation (SÍ):** internal module generator; governed by
architecture; modules connected to the 7F core; clear data source; owner agent;
real status; activation path; vertical adaptation; can live in 7F and also be
presented from Mr. Forte Lab as a side door.

**Chaotic generation (NO):** external generator; generator without rules;
generator of parallel apps; generator of fake modules; demos sold as product;
loose disconnected tools; duplicated logic outside 7F.

---

## 8. Product status model

Statuses to prevent fake product:

| Status | Meaning | Commercially allowed |
|---|---|---|
| **idea** | A named opportunity, nothing designed. | Not shown as available. |
| **concept** | Designed / architected, not built. | May be *described*, never sold as available. |
| **lab prototype** | An internal build to learn from. | May be shown as **lab / preview, clearly labeled**. |
| **internal preview** | Visible over sample or partial data, for review. | Internal review only; labeled as preview. |
| **gated beta** | Real, activatable for selected users. | Activatable for gated users only. |
| **real capability** | Exists and is wired inside 7F. | Can back an activable product. |
| **productized offer** | Packaged, priced, presentable as an activable product. | Fully presentable/activable. |
| **deprecated** | Being retired. | Not offered; migration only. |

Rules:

- `idea` and `concept` are **not** sold as available.
- `lab prototype` may be shown as **lab**, clearly labeled.
- `internal preview` may be used for review.
- `gated beta` may be activated for selected users.
- `real capability` exists inside 7F.
- `productized offer` can be presented as an activable product.
- **Nothing with demo data appears as real.** (Consistent with the visible
  *"Vista previa · datos de ejemplo"* chip and the gated appointment demo already
  in the repo.)

---

## 9. Product families inside Mr. Forte Lab

Families of side doors / capabilities. Each item carries an honest status tag.

1. **Website Products** — business website `concept`, landing pages `concept`,
   public pages `concept`, Google Maps / contact sections `absent`, services /
   pricing pages `concept` (services catalog is real, pricing is not — §12),
   website chatbot `concept` (widget is real → inbox).
2. **Brand Products** — logo `absent`, brand kit `concept`, palette-from-logo
   `concept`, typography suggestions `concept`, visual identity package
   `concept`. (Theming tokens are `real`; per-business brand storage is not.)
3. **Content Products** — post templates `concept`, story templates `concept`,
   campaign visuals `concept`, image/video assets `absent`, content blocks
   `concept`, visual templates adapted to business data `concept`. (Content CRUD
   + calendar + campaigns are `real`.)
4. **Communication Products** — chatbot `concept` (AI bot) / `real` (live-chat
   widget → inbox), Smart Inbox `real`, message templates `concept`, client
   replies `real` (drafts in inbox), follow-up flows `real`.
5. **Business Modules** — services catalog `real` (no price/duration yet),
   booking / agenda `stub/gated` (generic calendar is `real`; real appointment
   backend is `absent`), client modules `real`, billing / payment modules `real`
   (records; **no payment gateway**), inventory modules `absent`, team /
   operations modules `real` (users), vertical-specific modules `real` (Beauty).
6. **Automation Products** — reminders `concept`/`real-engine`, follow-ups
   `real`, intake flows `real` (manual intake + auto-task), reusable business
   workflows `real` (automations engine).
7. **Vertical Packs** — Beauty pack `real` (the only fully built pack), future
   vertical packs `concept`/`stub` (construction, clinic, law, florals are
   seeded stubs), packaged setups for specific business types `concept`.

---

## 10. Owner agents

Conceptual responsibilities (the 7 core agents are defined once in
`modules/agents/roster.ts`; vertical specialists are layered additively):

- **Mr. Forte** — owner of the Lab; architecture; modules; verticals; reusable
  systems; **module generation** (governed, §7); productization; decides what can
  become a product.
- **Freya** — visuals; interfaces; website visuals; logo / brand creative
  direction; post templates; visual blocks; assets.
- **Fiona** — growth packaging; positioning; campaigns; SEO/AEO/email marketing
  (later); commercial use of the digital products.
- **Fanny** — communication; inbox; chatbot handoff; replies; message flows.
  (The one truly wired agent today.)
- **Felix** — pricing; charges; billing; monetization; commercial packages.
- **Francis** — product governance; priorities; readiness; approval of what is
  ready.
- **Fathom** — market research; competitor signals; trends; product
  opportunities.

**Vertical specialists** adapt a capability to a sector. They are **not** new
core agents (never an 8th `AGENT_ROSTER` entry); they are layered in additively,
scoped to the workspace's `verticalKey`. Example: **Finesse** adapts capabilities
to the Beauty world (`core/vertical-packs/specialists.ts`,
`docs/vertical-specialist-agents.md`).

---

## 11. Product record template

The standard record every Mr. Forte Lab product / capability should use:

| Field | Description |
|---|---|
| **Product name** | Human, benefit-oriented name. |
| **Product family** | One of §9. |
| **Side-door entry problem** | The concrete need the user enters with. |
| **Core 7F capability** | The real/architected capability it maps to. |
| **7F module / source** | The `@modules` / `core` / `agents` source of truth. |
| **Vertical adaptation** | How it adapts by configuration per vertical. |
| **Target customer** | Who it is for. |
| **Value proposition** | The value in one line. |
| **Required data** | Multi-tenant data it needs. |
| **Output** | What the user gets. |
| **Owner agent** | §9. |
| **Supporting agents** | Collaborating agents. |
| **Product status** | §8. |
| **Activation path into workspace** | How it becomes part of the 7F workspace. |
| **Pricing model idea** | One-time / monthly / included in 7F. |
| **Dependencies** | What must exist first. |
| **Risks** | Product and technical risks. |
| **What is real today** | Honest current state. |
| **What is not real yet** | The gap. |
| **Next implementation step** | The next honest move. |

---

## 12. Example product records

Conceptual examples. Each is classified **honestly** against the repo. Nothing is
claimed as implemented unless the code proves it.

### 12.1 Instant Business Website — `concept`
- **Entry problem:** "I need a website for my business."
- **Core capability / source:** none built; direction in
  `beauty-brand-web-i18n-architecture.md §7`. Would feed from `businessProfile`,
  services catalog, brand kit.
- **Owner / supporting:** Mr. Forte (architecture) + Freya (visuals) + Fiona
  (growth).
- **Activation path:** publish a workspace-owned page from real business data.
- **What is real today:** nothing (only the chat widget). **Not real yet:** the
  page, blocks, Maps, publishing. **Next step:** structured business-profile
  fields (address, hours, phone, socials) + read-only preview over real data.

### 12.2 Logo / Brand Kit — `concept`
- **Entry problem:** "I need a logo / a consistent look."
- **Core capability / source:** theming tokens are `real` (`core/theme.ts`); a
  per-business brand kit (logo, palette, fonts, photos) is `absent` — designed in
  `beauty-brand-web-i18n-architecture.md §4–§6`.
- **Owner / supporting:** Freya + Mr. Forte.
- **Activation path:** store a brand kit on the workspace; feed app/web/PDF/
  messages. **What is real today:** app-wide theming. **Not real yet:** stored
  logo, palette-from-logo, logo generation. **Next step:** a `brandKit` schema on
  the workspace config (Forte-shaped core work).

### 12.3 Smart Inbox for Business — `real capability`
- **Entry problem:** "I need to organize my messages."
- **Core capability / source:** `modules/inbox/` (classification, email sync,
  auto-task, drafts), `app/inbox/`, agent **Fanny** (the wired agent).
- **Owner / supporting:** Fanny + Mr. Forte.
- **Activation path:** already part of the workspace. **What is real today:**
  multi-channel inbox with AI triage/drafts. **Not real yet:** full vertical
  Beauty framing. **Next step:** vertical Smart Inbox presentation.

### 12.4 Post Template Generator — `concept` (library) over `real` (content)
- **Entry problem:** "I need templates for my posts."
- **Core capability / source:** content CRUD + calendar + AI assist are `real`
  (`modules/contenido/`); a reusable template library is `concept`.
- **Owner / supporting:** Freya + Fiona.
- **Activation path:** generate posts into the content calendar. **What is real
  today:** content pieces/ideas/campaigns. **Not real yet:** a reusable
  template/block library adapted to business data. **Next step:** define a
  template model over the existing content module.

### 12.5 Services Catalog Module — `real capability`
- **Entry problem:** "I need to present my services."
- **Core capability / source:** `core/services/catalog.ts`, `app/services/`,
  seeded by `core/vertical-packs/beauty.ts`.
- **Owner / supporting:** Mr. Forte + Felix.
- **Activation path:** already activatable; stored in `Workspace.config`. **What
  is real today:** catalog of active service names. **Not real yet:** price,
  duration, staff, packages (deliberately out of scope). **Next step:** add
  pricing/duration (a website/billing enabler).

### 12.6 Website Chatbot — `concept` (AI bot) over `real` (widget → inbox)
- **Entry problem:** "I want a chatbot that knows my business."
- **Core capability / source:** `public/widget.js`, `app/widget/chat/page.tsx`,
  `/api/inbox/public/*`.
- **Owner / supporting:** Fanny + Mr. Forte.
- **Activation path:** embed the widget; messages land in Smart Inbox. **What is
  real today:** a human live-chat widget feeding the inbox. **Not real yet:** an
  autonomous AI responder that "knows the business." **Next step:** an inbox-side
  auto-answer policy grounded in `businessProfile`.

### 12.7 Appointment Reminder Flow — `concept` over `real` (automations)
- **Entry problem:** "I want to remind clients about appointments."
- **Core capability / source:** automations engine is `real`
  (`modules/automatizaciones/`); a **real appointment backend is `absent`**
  (`modules/today/appointments.ts` is a gated stub).
- **Owner / supporting:** Fanny + Mr. Forte (+ Finesse for Beauty).
- **Activation path:** trigger reminders from real appointment data. **What is
  real today:** the automations engine and inbox follow-ups. **Not real yet:**
  appointments carrying client/service/status. **Next step:** a real appointment
  model before wiring reminders.

### 12.8 Beauty Business Starter Pack — `real capability`
- **Entry problem:** "I run a beauty business and want it set up."
- **Core capability / source:** `core/vertical-packs/beauty.ts` (visibility, nav,
  labels, themes, service seed), `agents/forte/verticals/beauty.ts` playbook,
  Finesse specialist.
- **Owner / supporting:** Mr. Forte + Finesse (+ Freya, Fanny).
- **Activation path:** apply the Beauty pack to a workspace (core + config).
  **What is real today:** the fully built Beauty pack. **Not real yet:** real
  appointment backend, brand kit, website. **Next step:** finish Beauty per
  `beauty-brand-web-i18n-architecture.md §2`.

---

## 13. Current repo audit

Legend: `real` / `preview` / `concept` / `absent` / `stub`.

| Area | File / path | Current state | Productization potential | Risk | Recommendation |
|---|---|---|---|---|---|
| Smart Inbox | `modules/inbox/`, `app/inbox/` | **real** (strongest) | High — flagship side door | Low | Package as first productized offer. |
| Clients (CRM + portal) | `modules/clientes/`, `app/clientes/` | **real** | Medium | Low | Present as module side door. |
| Content + campaigns | `modules/contenido/`, `modules/campanas/` | **real** | High | Low | Template library on top (concept). |
| Billing / finance | `modules/facturacion/`, `modules/finanzas/` | **real** (no gateway) | Medium | Med (no payments) | Do not promise payment collection. |
| Calendar / events | `modules/calendario/` | **real** (generic) | Medium | Low | Keep distinct from appointments. |
| Services catalog | `core/services/catalog.ts`, `app/services/` | **real** (no price) | High | Med | Add price/duration before web/billing offers. |
| Automations | `modules/automatizaciones/`, `app/motor/` | **real** | High | Low | Package reminder/follow-up flows honestly. |
| Business profile | `app/business-profile/`, `core/verticals.ts` | **real** (thin) | High (feeds web/brand) | High (missing fields) | Add structured fields (Forte core work). |
| Theming / tokens | `core/theme.ts`, `docs/theme-token-map.md` | **real** | Medium | Low | Basis for brand kit; not a brand kit yet. |
| Chat widget | `public/widget.js`, `app/widget/chat/` | **real** (→ inbox) | Medium | Med | Label as live-chat, not AI bot. |
| PDF templates | `components/templates/*` | **real** (documents) | Low | Low | Do not confuse with post templates. |
| Website / builder | — | **absent** | High (future) | High | Concept only; preview-first per Beauty doc. |
| Brand kit / logo | — | **absent** | High (future) | High | Concept only; needs `brandKit` schema. |
| Appointments (real) | `modules/today/appointments.ts`, `…/appointment-mock.ts` | **stub / gated** | High | High | Never show demo as real; build backend first. |
| Product catalog / inventory / payments | — | **absent** | Low/Med | Med | Do not offer until built. |
| Verticals | `core/vertical-packs/*`, `agents/forte/verticals/*` | **real** (Beauty only) | High | Low | Beauty pack = a real activable product. |
| Agents roster | `modules/agents/roster.ts` | **real** (display; only Fanny wired) | — | Med (honesty) | Respect "coming online" labels. |
| Forte engine | `agents/forte/*`, `/forte/improvements`, `/api/forte/*` | **real** (engine) / preview (UI) | High (the generator) | Med | Promote as governed module generator (§7). |

---

## 14. Packaging strategy

How Mr. Forte Lab presents products commercially **without** separating from 7F.

Example entrances (labels stay internal, always "inside 7F"):

- "Create your business website"
- "Create your logo and brand kit"
- "Add a chatbot that knows your business"
- "Organize your messages with Smart Inbox"
- "Activate a Beauty business pack"
- "Generate social post templates"
- "Add reminders and follow-up flows"
- "Upgrade to the 7F monthly plan"

Mechanics:

- **Product landing pages** — internal pages inside 7F, one per capability, each
  with an honest status badge (§8).
- **Preview / demo** — clearly labeled (reuse the existing *"Vista previa · datos
  de ejemplo"* pattern); never dressed as real.
- **Activation CTA** — the button that turns a presented capability into part of
  the workspace (the activation path of §5).
- **Pricing** — one-time, monthly, or **included in 7F**. Owned conceptually by
  Felix.
- **Transition** — from a single side-door product to the full 7F subscription:
  the small entry proves value, then reveals the connected system.
- **Avoid over-promising** — a product page must never promise a feature that is
  `concept`/`absent` as if it were `real`. Status badge first, copy second.

---

## 15. Anti-chaos rules

- Mr. Forte Lab is **part of 7F**, not another system.
- Do not duplicate logic.
- Do not duplicate data.
- Do not build loose, disconnected tools.
- Do not sell prototypes as finished products.
- Do not create a second module architecture.
- **Mr. Forte Lab is not an uncontrolled module generator — it is the governed
  module-generation room inside 7F.** (Generation is allowed and expected; it
  must be governed by §7's rules, not chaotic.)
- Do not hardcode verticals inside generic products.
- Do not create products without an owner agent.
- Do not create products without an activation path.
- Do not create pages that promise unavailable features.
- Do not confuse internal preview with a customer-ready offer.
- Do not turn Mr. Forte Lab into a generic marketplace.

---

## 16. Roadmap

**Phase 1 — Strategy documentation** *(this document)*
- Document the side-door doctrine.
- Classify current capabilities honestly.
- Define the product record template.

**Phase 2 — Internal product catalog foundation**
- Internal catalog of productizable capabilities (as data).
- Status model.
- Owner agents.
- Activation mapping.

**Phase 3 — First real side-door offers**
- Choose 1–3 real (or near-production) capabilities (e.g. Smart Inbox, Services
  Catalog, Beauty pack).
- Package them honestly. No fake claims.

**Phase 4 — Mr. Forte Lab internal storefront**
- Product pages **inside** 7F.
- Categories, CTAs, preview flows.
- Connection to the workspace.

**Phase 5 — Reusable builders**
- Website Builder, Brand Kit / Logo Builder, Content Template Builder, Module
  Builder, Chatbot product, Automation packs. (All deferred; preview-first.)

**Phase 6 — Vertical product bundles**
- Beauty starter pack, future vertical packs, business-type-specific offers.

---

## 17. Next 5 implementation moves

Recommended next PRs. **Do not implement in this task** — documentation only.

**PR 1 — Internal productizable-capability catalog (data + docs).**
- *Objective:* an internal, honest list of productizable capabilities with status,
  owner agent, data source, and activation path.
- *Likely files:* a new `core/` data module or a docs table; reads from
  `agents/forte/phase1/catalog.ts` and `modules/`.
- *Risk:* low. *Success:* every real capability listed with a correct status.
- *Does NOT include:* any UI, any product page, any activation code.

**PR 2 — Product status enum + record schema (as data/types).**
- *Objective:* encode §8 statuses and the §11 record as types, so future product
  pages can't drift from the doctrine.
- *Likely files:* a new `core/products/status.ts` (types only), tests.
- *Risk:* low. *Success:* types compile; no runtime behavior added.
- *Does NOT include:* persistence, API, UI, any real product.

**PR 3 — Structured business-profile fields (web/brand enabler).**
- *Objective:* add address, phone, WhatsApp, structured hours, socials to
  `businessProfile` (the data a website/brand kit needs).
- *Likely files:* `core/verticals.ts` (type), `app/business-profile/`, API route.
- *Risk:* medium (touches config shape). *Success:* fields save/read;
  backward-compatible. *Does NOT include:* website, brand kit, Maps.

**PR 4 — Activation-path mapping (capability → workspace).**
- *Objective:* document/encode how each real capability activates into a
  workspace (the §5 flow), as a lookup used later by product pages.
- *Likely files:* a new `core/products/activation-map.ts` (data), tests.
- *Risk:* low. *Success:* every real capability has a defined activation path.
- *Does NOT include:* the activation UI or checkout.

**PR 5 — One honest product landing (Smart Inbox), preview-first.**
- *Objective:* the first internal product page for a **real** capability, inside
  7F, with an honest status badge and an activation CTA to the existing inbox.
- *Likely files:* a new internal page under `app/` reusing inbox surfaces; no new
  module.
- *Risk:* medium (new surface). *Success:* page presents Smart Inbox honestly,
  links to the real inbox. *Does NOT include:* checkout, pricing engine, fake
  features, any concept/absent product.

---

_End of document._
