# Beauty Brand, Website & i18n Architecture

> **Status:** Direction + architecture document. **Docs/audit only — no product,
> route, schema, or API change in this task.** It sets the direction for the next
> phase of 7F Beauty (brand kit, 7F Clear, premium instant website, i18n) and
> records the *real* state of the repository as of the audit date.
>
> **Audit date:** 2026-07-12 · **Base:** `master`.
>
> **Companion documents (do not duplicate — this file points at them):**
> - `docs/product/7f-professional-direction-audit.md` — the Beauty compass
>   (surface map, real-vs-demo, agent reality, anti-chaos rules).
> - `docs/theme-token-map.md` — the token system, hardcoded-color audit, and the
>   three Beauty palettes (`rose-nude`, `sage-luxe`, `noir-or`) already defined.
> - `docs/i18n-localization-architecture.md` — the canonical i18n doctrine
>   (locale resolution, `User.locale`, namespaces, Spanish Beauty pilot). §10 here
>   *extends* it for the client/public-web language axis; it does not replace it.
> - `docs/vertical-specialist-agents.md` — Finesse specialist doctrine.
> - `docs/ways-of-working.md` — the operating contract (language rule, no-fake
>   product, evolve-before-add).
>
> Prose in English (repo rule). Spanish product labels (`Hoy`, `Agenda`,
> `Clientas`, `Cobros`…) are preserved as-is by design.

---

## 1. Executive decision

**We stop before advanced Fiona Growth and finish 7F Beauty as a professional
product first.** SEO/AEO, email marketing, campaign automation, and an
agency-style growth engine are explicitly *deferred* — not cancelled.

Why:

- **Beauty is one honest decision and a handful of subtractions away from
  sellable** (per `7f-professional-direction-audit.md §1`), but its *brand,
  mobile polish, vertical Smart Inbox, clean visual base, and correct
  localization* are not finished. Selling growth on top of an unfinished product
  amplifies weaknesses instead of value.
- **Growth needs a finished surface to grow.** Fiona turns real clients, real
  content, and a real web presence into campaigns. Today there is no business
  website, no brand kit, no logo storage, and no per-workspace visual identity —
  so there is nothing for advanced growth to point at yet.
- **The biggest risk is impression running ahead of reality** (same audit, §1).
  A premium-looking but half-real Beauty product is the "fake product" failure
  mode. Finishing Beauty *first* keeps impression and reality aligned.

**The line we are freezing:** finish Beauty's *product* (design, mobile, vertical
Smart Inbox, 7F Clear, brand kit, a premium basic website, correct i18n) **before**
turning on advanced growth marketing. Everything below serves that line.

---

## 2. Beauty finish scope

"Finishing Beauty" — the definition of done *before* advanced marketing — means:

1. **Visual finish.** A clean, premium, mobile-first look. 7F Clear as a light
   premium base (§3), coexisting with the existing Beauty palettes. No unbounded
   hardcoded-color debt on Beauty's core surfaces.
2. **Mobile Beauty.** Less information, fast actions, the day (Hoy/Agenda),
   messages, and the "beauty photo" moment — per `7f-professional-direction-audit
   §9 Phase 3`.
3. **Vertical Smart Inbox.** Fanny's inbox (the one truly-wired agent) presented
   in a Beauty-appropriate, appointment-aware, vertical way — confirmations,
   reminders, rebooking nudges. (i18n of Inbox internals stays deferred per
   `i18n-localization-architecture.md §11/§15`.)
4. **Brand kit per business (§4).** A place to store the business's own identity
   (logo, colors, fonts, tone, key photos) so app, web, and communications stop
   using only the generic 7F mark.
5. **Premium basic website (§7).** A premium, instant, *personalized-feeling*
   business page fed by real business data — not a generic template picker.
6. **Correct i18n (§10).** English code/routes/keys; translatable UI; user
   language, client language, and public-web languages separated. Beauty stops
   being hardcoded Spanish as the single source of truth.

**Out of finish scope (deferred to after Beauty is stable):** advanced Fiona
Growth, SEO/AEO, email-marketing campaigns, a full website *builder*, real logo
*generation*, real visual AI, WhatsApp/Instagram integrations as production
channels.

---

## 3. 7F Clear visual direction

**What 7F Clear is.** A **clean, premium, light, mobile-friendly base palette** —
a calm neutral canvas that reads as professional out of the box, suitable as the
default "no strong brand yet" look for a Beauty business and as a base other
palettes and brand colors layer onto.

**What 7F Clear is NOT.** Not a redesign. Not a replacement for the existing
palettes. Not a new token system. Not an auto-applied theme.

**How it fits the existing system (already built — see `theme-token-map.md`).**
The repo already has a mature token architecture and **five** palettes, each
expressed as a `[data-theme="…"]` block in `app/globals.css` that overrides token
*values only* (components never change):

| Palette | Plane | Role today |
|---|---|---|
| `midnight` | dark | global default |
| `lavender-mist` | light | light primary (dormant) |
| `rose-nude` | light | **Beauty default** (dusty rose) |
| `sage-luxe` | light | wellness / spa |
| `noir-or` | dark | luxury / glam salon |

**7F Clear is added the same way** — a new `[data-theme="clear"]` (or
`sevenf-clear`) block that overrides the same source-token set the Beauty palettes
already override (surface ramp, `--accent-*`, `--text-*-light`,
`--border-dark(-strong)`, shadows, shell overlays, `--status-*`, `--inbox-*`,
`--agent-*`). No `--clear-*` tokens, no `@theme inline` change, no base-shadcn
redefinition. It **coexists** with Midnight, Lavender Mist, Rose Nude, Sage Luxe,
Noir Or, and any future per-logo palette; it does **not** replace them.

**Doctrine.**
- **Tokens, never hardcoded colors.** 7F Clear must be defined purely as token
  values. It only looks correct on already-tokenized surfaces; the ~900+
  hardcoded-color references catalogued in `theme-token-map.md §3` will *not*
  follow it until migrated (their existing debt, not 7F Clear's job).
- **Opt-in only.** Like the other palettes, nothing auto-applies. Activation is
  `?theme=clear` or the toggle allow-list (`components/theme-mode-toggle.tsx` +
  the pre-paint list in `app/layout.tsx`). Per-workspace/per-vertical
  auto-theming remains a later step (§5, and `theme-token-map.md` "Out of scope").
- **Accessibility bar.** Match the WCAG-AA contrast discipline already applied to
  the Beauty palettes (`theme-token-map.md` "Accessibility" table): text ≥ 4.5,
  large/UI ≥ 3.0.
- **Relationship to per-logo palettes (§5).** 7F Clear is the *fallback identity*
  for a business with no logo/brand yet. A per-logo brand palette, once
  approved, becomes that workspace's palette; until then 7F Clear (or the vertical
  default `rose-nude`) is the premium neutral.

---

## 4. Business brand kit

**Concept.** A per-workspace record of the *business's own* visual and
communication identity, so 7F stops representing every salon with the generic
"7F" wordmark. Applied across app chrome, the website (§7), social posts, PDFs,
reminders, and messages.

**Proposed brand-kit data (future — not built yet):**

| Field | Purpose |
|---|---|
| `logo` (image) | The business logo (uploaded or, later, generated — §6). |
| `brandPalette` | Colors, ideally derived from the logo (§5). Stored as token values. |
| `fonts` (suggested) | 1–2 recommended typefaces / pairing. |
| `visualStyle` | Style descriptor (minimal, glam, natural, bold…). |
| `communicationTone` | Voice for messages/reminders (warm, professional, playful…). |
| `keyPhotos` (gallery) | Hero/service/space photos reused by web, posts, PDFs. |

**What exists today (audit):**
- **Theme/palette system** — strong (§3). Can already express a brand palette as
  token values; what is missing is *storing one per workspace* (§5).
- **Communication tone** — partially present: `Workspace.config.businessProfile.tone`
  (free text) and the Finesse voice strings (`core/vertical-packs/specialists.ts`).
- **Generic file/image upload** — `@vercel/blob` + `core/storage.ts` +
  `app/api/attachments/route.ts` / `app/api/inbox/attachments/upload/route.ts`.
  Reusable plumbing, but **not** logo/brand-specific.

**What is absent today (audit):**
- **No brand-kit concept anywhere** — grep for `brandKit`/`BrandKit`/`logoUpload`/
  `brandPalette` = 0 matches.
- **No logo storage** — no `logo`/`brand`/`brandKit` field in `prisma/schema.prisma`
  or in `Workspace.config.businessProfile` (`core/verticals.ts`
  `WorkspaceBusinessProfile`). The only wordmark is the hardcoded "7F" text in
  `components/sidebar-nav.tsx`.
- **No business photo/gallery**, **no per-workspace stored brand palette**, **no
  fonts/visual-style fields**.

**Direction.** The brand kit lives per workspace (config-first, matching the
existing `Workspace.config` pattern for `businessProfile` and `serviceCatalog`),
reuses the existing blob-upload plumbing for the logo/photos, and expresses colors
as token values so the app (§3), website (§7), and communications share one
identity. **Schema changes are proposed for a future phase (§12), not made here.**

---

## 5. Palette from logo

**Future flow (architecture — not implemented; document only):**

1. **Upload.** The user uploads the business logo (reusing the existing blob
   upload plumbing).
2. **Analyze (Freya).** Freya (Creative Studio) analyzes the logo visually and
   proposes **2–3 premium palettes** derived from it.
3. **Adapt (Finesse).** Finesse frames the recommendation for the Beauty world
   (which palette suits this salon's positioning) and presents it in the operator's
   language.
4. **Approve (user).** The user approves one. Nothing auto-applies without
   approval.
5. **Store.** The system saves **one brand palette per workspace** (as token
   values, so it plugs into the existing `[data-theme]` mechanism / a
   workspace-scoped palette).
6. **Apply.** The approved palette drives the app chrome, the website (§7), and
   communications — the same token cascade that already powers the Beauty palettes.

**Where it is stored.** Per workspace, alongside the brand kit (§4). The current
theme system stores *no* palette per workspace — a workspace's default theme is
*derived* from its vertical (`core/theme.ts` `resolveWorkspaceDefaultThemeKey`),
and any user override lives only in browser `localStorage` (`7f-theme`). A stored
per-workspace brand palette is **new** and belongs to the future brand-kit schema
step (§12).

**Approval & safety.** Per `7f-professional-direction-audit` anti-chaos rules: the
palette is a **proposal**, never an auto-applied surprise. It is applied only after
explicit user approval, and only via token values (no hardcoded color churn).

**Do not build yet.** No logo image analysis, no real color extraction, no
per-workspace palette persistence in this phase. This section is the target
architecture; §12/§13 sequence the safe first steps.

---

## 6. Logo creation flow

**The gap.** Many small Beauty businesses have no usable logo. 7F should be able
to *help create one* rather than leaving a blank.

**Future flow (document only — no generation implemented):**

1. **Detect.** During onboarding / brand-kit setup, if no logo exists, 7F offers
   to help create one.
2. **Guide (Finesse).** Finesse guides style direction (name, vibe, Beauty
   positioning, do's/don'ts) in the operator's language.
3. **Produce (Freya).** Freya (Creative Studio) produces visual proposals.
4. **Approve → brand kit.** The approved logo flows into the brand kit (§4) and
   feeds the per-logo palette (§5).

**Explicitly out of scope now.** No real logo generation, no image model, no
visual AI. This is the intended *responsibility split and flow*, not a feature to
implement in this phase. Until it exists, the fallback is 7F Clear / the vertical
default palette (§3) plus the generic mark.

---

## 7. Premium instant website

**Positioning — not a template picker.** The experience must *not* feel like
"choose a template". It must feel like:

> "Give me your logo, services, hours, prices, address, photos, and socials — 7F
> creates a premium website for your business, instantly."

**Internally** it may be composed of reusable blocks and sections. **Externally**
each result must feel personalized to that specific business — driven by its brand
kit (§4) and real business data, not a visibly shared skeleton.

**Sections the premium page should support:**
- Hero (business name, logo, tagline, primary CTA)
- Services (from the real service catalog)
- Prices (once price is added to services — see below)
- Hours (structured schedule)
- Address
- Google Maps
- Contact / WhatsApp
- Photos (from the brand-kit gallery)
- Social links
- CTA (book / message)
- Reviews (*later*)

**Quality bar.** Premium, at the level of Skina-grade digital deliverables — the
same quality bar the print/PDF templates (`components/templates/*-skina`) already
hold, now applied to a web surface. Token-driven (§3), mobile-first, accessible.

**Relationship to existing data.** The website is a *view over real workspace
data*, not a new data silo:
- **Services** → the existing `serviceCatalog` (`core/services/catalog.ts`,
  `Workspace.config.serviceCatalog`).
- **Prices / durations** → **not yet modeled** — `ServiceCatalogItem` is
  `{ id, name, category, active }`; price/duration are deliberately deferred
  (`beauty.ts`, `catalog.ts`). The website needs them, so they are a future
  service-model step (§12), not invented in the page.
- **Hours / address / phone / WhatsApp / socials / photos** → **not yet modeled**
  on the business profile (see §11) — these are the brand-kit / business-profile
  fields a website depends on (§12).

**What exists today (audit).**
- **No website builder, no public business page, no block/section system, no hero
  builder** — grep confirms absence. The only public-facing surface is the
  **embeddable chat widget** (`public/widget.js` + `app/widget/chat/page.tsx`),
  which is unrelated to a marketing site.
- **No Google Maps / mapping** anywhere (`google.maps`, `@react-google-maps`,
  `leaflet`, `mapbox` = 0 matches).
- **Print/PDF templates** exist (`components/templates/*-skina`) as the quality
  reference, but they are documents, not web pages.

**Do not build the full builder yet.** This phase documents the direction and the
data dependencies. A real, small, safe first step (a read-only *preview* over real
data, no builder) is sequenced in §12/§13 — not implemented here.

---

## 8. Finesse responsibilities

**Finesse is the Beauty vertical specialist / lead voice — not an eighth core
agent.** She is defined in data (`core/vertical-packs/specialists.ts`,
`BEAUTY_SPECIALIST_AGENT`) and layered additively per workspace vertical; she is
never added to `AGENT_ROSTER` (`modules/agents/roster.ts`).

**What Finesse does (for the Beauty user):**
- Leads Beauty onboarding and interprets the business context.
- Helps configure services and prepare the agenda/day.
- Guides visual brand direction (style, logo direction — §6) in the operator's
  language.
- Recommends what the website needs and frames the web/brand decisions (§5–§7).
- **Coordinates** the core team on Beauty surfaces:
  - **Freya** → visuals (palettes from logo, logo proposals, web/section imagery).
  - **Fanny** → messages (confirmations, reminders, follow-ups).
  - **Felix** → charges/invoices (Cobros).
  - **Fiona** → growth *when it is activated later* (not now).
  - **Mr. Forte** → when a module/capability is missing.
  - **Fathom** → trends/research context.

**What Finesse does NOT do.**
- She does **not** replace or duplicate any core agent. Every action owned by a
  core agent still shows *that* agent ("Fanny detected 3 unconfirmed", "Felix can
  prepare the charge") — Finesse presents and coordinates, she does not execute
  their work.
- She is **not** wired execution today. Per `7f-professional-direction-audit §6`,
  Finesse is currently **declared** (data + voice strings + resolver), *branding
  on top of Fanny's real work* — not yet rendered as the live voice on Hoy/Home.
  Do not present her future coordination as done.

---

## 9. Agent separation

The frozen doctrine (`modules/agents/roster.ts`, `docs/agents-surface.md`,
`7f-professional-direction-audit §8-#10`). Finesse is the vertical specialist; the
other seven are core.

| Agent | Scope | In this phase (Beauty finish) |
|---|---|---|
| **Finesse** | Beauty specialist / vertical lead voice; onboarding, services, agenda, brand guidance, coordination. | **Active domain.** Voice + coordination (declared today). |
| **Freya** | Creative Studio: visuals, interfaces, imagery, video, blocks/assets, logo proposals, palette-from-logo. | **Involved (future flows).** Brand kit, palette, logo, web imagery — documented, not built. |
| **Mr. Forte** | Architecture, modules, Lab, backend/product logic. | **Involved.** Any new capability (brand-kit schema, web preview) is Forte-shaped core work. |
| **Fiona** | 7F Growth: campaigns, CRM, audiences, SEO, AEO/GEO, email marketing, digital presence. | **Deferred.** Not activated until Beauty is stable (§1, §12 Phase 6). |
| **Fanny** | Conversations / Smart Inbox: triage, drafts, follow-ups, confirmations. | **Active (only truly-wired agent).** Vertical Smart Inbox is in Beauty finish scope. |
| **Felix** | Finance / Cobros: charges, invoices, payment risk. | **Adjacent.** Referenced by web (prices) and reminders; no new work here. |
| **Francis** | CEO: operation, team, coordination, decisions. | **Background.** Global lead; unchanged. |
| **Fathom** | Research / vertical trends / market signals. | **Background.** Feeds trends; no new work here. |

---

## 10. i18n doctrine

> The canonical i18n architecture is `docs/i18n-localization-architecture.md`
> (locale resolution chain, `User.locale`, typed namespaces, Spanish Beauty pilot,
> the "no locale-prefixed routes" rule, and the small-PR sequence). **This section
> does not restate it — it extends it with the Beauty client/public-web language
> axis and states the migration doctrine.**

**Core principles (aligned with the canonical doc):**
- **Code, routes, identifiers, schema, keys, logs, tests → English, permanently.**
  New routes are English (`7f-professional-direction-audit §4`). No locale-prefixed
  routes; no ES/EN route duplication; no mass rename as a side effect.
- **Base copy → English keys.** Move visible copy toward stable English keys under
  typed namespaces (per the canonical doc §10). Do not translate everything at
  once — pilot by coherent surfaces.
- **UI language follows the *user*.** `User.locale` (a future tiny schema field)
  drives the operator's interface.
- **Two separate layers.** *i18n = language* (the sentence) vs *vocabulary =
  business terminology* (`Client → Clienta`, already in `core/personalization` +
  the Beauty pack). Vocabulary is interpolation data, never translation keys.

**The Beauty extension — three distinct language axes (new emphasis here):**

| Axis | Whose language | Drives | Where it lives |
|---|---|---|---|
| **User / operator UI** | The signed-in employee | App interface language | `User.locale` (future) |
| **Client (clienta) language** | The end customer of the salon | Reminders, confirmations, messages *to that customer* | Per-contact / per-conversation (future); today only `Workspace.config.locale` exists |
| **Public web languages** | The website's audience | Which language(s) the premium website (§7) publishes in | Brand-kit / website config (future) |

A salon in Switzerland may run its **UI in German**, serve **clientas in Spanish,
French, Italian, and Swiss German**, and publish a **public website in several
languages** — three independent choices. Today only workspace-level
`Workspace.config.locale` exists (customer-facing output default); per-client and
public-web language selection are **new** and belong to later phases.

**Migrating Beauty off hardcoded Spanish without breaking anything:**
- Beauty's Spanish today is *vertical-pack data and vocabulary*
  (`core/vertical-packs/beauty.ts`, `nav-profile.ts`), plus incidental hardcoded
  Spanish in some components (e.g. `app/services/page.tsx`). Keep the vertical
  vocabulary; do **not** confuse it with global app i18n.
- Follow the canonical small-PR sequence (`i18n-localization-architecture §14`):
  namespace scaffolding (English) → locale-resolution tests → `User.locale` field
  → resolver helper → client provider → settings → pilot surfaces (global chrome,
  Clientes, Today/Agenda labels), with **Inbox internals deferred** until Inbox
  stabilization (`§11/§15` there).
- **Do not** make Spanish the single hardcoded truth for Beauty going forward: new
  Beauty copy lands as English keys + Spanish translation + vocabulary, so a
  Swiss/German or French Beauty workspace is possible without a rewrite.

---

## 11. Current repo audit

Legend — **State:** real / partial / absent. **Risk** relative to the Beauty-finish
goals in this document.

| Area | File / route | Current state | Risk | Recommendation |
|---|---|---|---|---|
| **Beauty pack** | `core/vertical-packs/beauty.ts` | **Real** (declarative): module visibility, ES labels, service seed, appointment-state labels, theme keys, `today` gate. Spanish strings live here by design. | Low | Keep. Source of Beauty vocabulary. When i18n lands, keep vocabulary here, move *global* copy to keys (§10). |
| **Specialist / Finesse** | `core/vertical-packs/specialists.ts` | **Real** (data + resolver + voice). Declared, not wired execution. | Low | Keep. Wire as the Hoy/Home *voice* later (§8); don't present coordination as done. |
| **Agent roster** | `modules/agents/roster.ts` | **Real, frozen.** 7 core agents; only Fanny `active`. Fiona=Growth, Freya=Creative Studio. | Low | Keep. No change this phase. |
| **Services** | `app/services/page.tsx`, `core/services/catalog.ts`, `core/vertical-packs/beauty.ts` | **Real.** `ServiceCatalogItem {id,name,category,active}` in `Workspace.config.serviceCatalog`. **No price, no duration** (deferred). Page has some hardcoded Spanish copy. | Medium | Keep. **Price/duration are a website blocker (§7)** → propose as a future service-model step (§12). Move page copy to i18n keys later. |
| **Business profile** | `app/business-profile/page.tsx`, `app/api/workspace/business-profile/route.ts`, `core/verticals.ts` | **Partial.** JSON in `Workspace.config.businessProfile`: `businessName, businessDescription, services[], tone, languages[], region, workingHours` (free text), `attentionRules[]`. | **High** | **Absent for web/brand:** address, phone, WhatsApp, email, **structured hours**, social links, photos, **logo**, geo/Maps, website URL. These are the brand-kit/website data gap (§4, §7, §12). |
| **Today (Beauty preview)** | `components/today/today-page-client.tsx`, `beauty-studio-overview.tsx`, `today-appointment-layout.tsx`, `core/vertical-packs/beauty.ts` | **Real shape, demo data.** Auto-switch gated by `activateRealForRealWorkspaces:false`; preview shows "Vista previa · datos de ejemplo" chip, no fake writes. | Medium | Keep honest gate. Real Beauty Hoy is the `7f-professional-direction-audit` Move 1 (out of scope here). |
| **Inbox** | `app/inbox/page.tsx`, `app/inbox/overview/`, `components/inbox/*` | **Real** (Fanny pipeline, the strongest surface). Inbox Briefing is preview. | Medium | Vertical Smart Inbox is in Beauty finish scope (§2), but **i18n of Inbox internals is deferred** (canonical doc §11/§15). |
| **Theme tokens / palettes** | `app/globals.css`, `core/theme.ts`, `components/theme-mode-toggle.tsx`, `docs/theme-token-map.md` | **Strong.** ~316 CSS vars; 5 palettes (`midnight, lavender-mist, rose-nude, sage-luxe, noir-or`). Per-workspace theme is **derived** (not stored); user override in `localStorage` only. ~900+ hardcoded colors remain. | Medium | **7F Clear** is a new `[data-theme]` block (§3). **No stored per-workspace palette yet** → needed for palette-from-logo (§5, §12). |
| **i18n** | `core/i18n/*`, `docs/i18n-localization-architecture.md`, `app/api/workspaces/[id]/locale/route.ts` | **Minimal.** Custom `en/es/de`, `DEFAULT_LOCALE="en"`, consumed **only** by email/notifications/outbound. UI is hardcoded Spanish. No `User.locale`, no locale routing, no client provider. `Workspace.config.locale` exists. | **High** | Follow the canonical doc. Add **client language** + **public-web languages** axes (§10). Migrate by coherent surface, not all at once. |
| **Brand / logo** | (none) + `core/storage.ts`, `app/api/attachments/route.ts`, `@vercel/blob` | **Absent.** No brand kit, no logo field, no brand palette per business, no photo gallery. Generic blob upload exists but is not brand-specific. Only hardcoded "7F" mark (`components/sidebar-nav.tsx`). | **High** | Brand kit is new (§4). Reuse blob plumbing for logo/photos. **Schema/config addition is a future phase (§12).** |
| **Website / public pages** | `public/widget.js`, `app/widget/chat/page.tsx` | **Absent** (no builder, no public business page, no blocks/sections/hero). Only an embeddable **chat widget**. | **High** | Premium instant website is new (§7). Start as a read-only preview over real data, no builder (§12/§13). |
| **Google Maps** | (none) | **Absent** (no maps library or component anywhere). | Medium | Needed by the website (§7). Add only when the website preview reaches the address/map section (later phase). |

---

## 12. Recommended phased roadmap

Ordered so each phase is safe and unblocks the next. **Only Phase 1 is "now"; the
rest are sequenced direction.**

**Phase 1 — Direction & audit (this task).**
- Document the architecture (this file). ✅
- Record the real repo state (§11). ✅
- Define 7F Clear as a future `[data-theme]` block (§3) — *documented, not built*.
- Do **not** build the website builder, brand kit, or i18n migration yet.
- (Optional, safe) a separate audit of hardcoded Beauty/Spanish strings can follow
  as its own docs pass — no code change.

**Phase 2 — Brand kit foundation in business profile.**
- Add brand-kit *data* (logo, photos, structured hours, address, phone, WhatsApp,
  socials) to the business profile — **config-first**, matching the existing
  `Workspace.config` pattern; reuse blob upload for logo/photos.
- Add **price/duration** to the service model (website + Cobros need them).
- This is where the **schema/config proposal** is made (§13) — not before.

**Phase 3 — 7F Clear + palette-from-logo (proposal, no auto-apply).**
- Add the 7F Clear `[data-theme]` block (token values only), opt-in via the toggle
  allow-list.
- Add **per-workspace stored palette** (new — the current system stores none).
- Palette-from-logo as a *proposal* surface (Freya suggests, Finesse frames, user
  approves) — no auto-application.

**Phase 4 — Website preview from real data.**
- A read-only premium *preview* rendered from real workspace data (brand kit +
  services + prices + hours + address). Reusable blocks internally; personalized
  externally.
- Add Google Maps for the address section.
- Still not a full builder/publisher.

**Phase 5 — Beauty i18n (visible).**
- Execute the canonical i18n sequence for Beauty's visible surfaces (global chrome,
  Clientes, Today/Agenda labels), plus the **client language** and **public-web
  languages** axes (§10). Inbox internals stay deferred.

**Phase 6 — Activate advanced Fiona Growth.**
- Only after Beauty is stable: SEO/AEO, email marketing, campaigns — on top of a
  finished product, real website, and real brand identity.

---

## 13. Next 5 implementation moves

> Small, concrete, safe PRs. **None implement growth, a full website builder, real
> logo generation, visual AI, or a mass i18n migration.** Schema is only *proposed*,
> not changed, except where noted as a tiny additive field in its own PR.

**Move 1 — 7F Clear palette (token block only).**
- *Objective:* add a `[data-theme="clear"]` premium light base, opt-in.
- *Likely files:* `app/globals.css` (new block after the Beauty palettes),
  `core/theme.ts` (`VALID_THEME_KEYS`), `app/layout.tsx` + `components/theme-mode-toggle.tsx`
  (allow-list), `docs/theme-token-map.md` (values + WCAG table).
- *Risk:* low (additive token values; no component change; opt-in).
- *Success:* `?theme=clear` renders a clean premium light look on tokenized
  surfaces, WCAG-AA verified; no other palette changes; no auto-apply.
- *Not included:* per-workspace auto-theming, hardcoded-color migration, any
  business-profile/brand change.

**Move 2 — Business-profile structured contact & hours (config-first, additive).**
- *Objective:* extend `Workspace.config.businessProfile` with the website/brand
  fields it lacks: `address`, `phone`, `whatsapp`, `socials[]`, and a **structured**
  `openingHours` (alongside the existing free-text `workingHours`).
- *Likely files:* `core/verticals.ts` (`WorkspaceBusinessProfile` type),
  `app/api/workspace/business-profile/route.ts`, `app/business-profile/page.tsx`.
- *Risk:* low–medium (config JSON only, no Prisma schema change; validate & keep
  backward-compatible).
- *Success:* a workspace can save structured contact + hours; existing profiles
  keep working (all new fields optional).
- *Not included:* logo/photos, maps, website rendering, price/duration.

**Move 3 — Service price & duration (additive service-model fields).**
- *Objective:* add optional `price` and `durationMinutes` to `ServiceCatalogItem`
  so the website (§7) and Cobros can reference them.
- *Likely files:* `core/services/catalog.ts` (type + validation + tests),
  `app/services/page.tsx` (edit UI), `core/vertical-packs/beauty.ts` (seed may add
  example values).
- *Risk:* low (optional fields; `core/services/catalog.test.ts` covers the model).
- *Success:* services can carry price/duration; empty stays valid; tests green.
- *Not included:* billing wiring, website rendering, currency redesign.

**Move 4 — Brand-kit logo & photos (reuse blob upload).**
- *Objective:* store a per-workspace `logo` and `keyPhotos[]` in the brand kit
  (config-first), using the existing `@vercel/blob` / attachments plumbing.
- *Likely files:* `core/verticals.ts` (brand-kit shape under
  `Workspace.config.brandKit`), a small upload wiring on
  `app/business-profile/page.tsx`, reuse `core/storage.ts` /
  `app/api/attachments/route.ts`.
- *Risk:* medium (upload UX + storage; still config-first, no new Prisma model).
- *Success:* a workspace can upload a logo and a few photos; they persist and are
  readable for later web/brand use.
- *Not included:* palette extraction, logo generation, applying the logo across
  chrome, website rendering.

**Move 5 — Beauty hardcoded-string audit (docs only).**
- *Objective:* a scoped inventory of hardcoded Beauty/Spanish copy in *visible*
  Beauty surfaces (e.g. `app/services/page.tsx`, Today Beauty components) mapped to
  the future i18n namespaces — the concrete input for Phase 5.
- *Likely files:* a new `docs/` note (e.g. `docs/product/beauty-i18n-string-audit.md`);
  **no code change**.
- *Risk:* low (documentation).
- *Success:* every visible hardcoded Beauty string is listed with its target
  namespace/key and its vocabulary-vs-i18n classification.
- *Not included:* any string move, key creation, or provider work (that is the
  canonical i18n sequence, Phase 5).

---

## 14. Guardrails honored by this task

- **No advanced Fiona Growth** implemented (SEO/AEO/email marketing/campaigns
  deferred to Phase 6).
- **No full website builder** implemented (only documented; first step is a later
  read-only preview).
- **No real logo generation, no visual AI** implemented (flow documented only).
- **No functional product change:** no schema change, no API change, no route
  change, no large redesign, no mass i18n migration. This task is
  documentation/audit.
- **7F Clear, brand kit, palette-from-logo, and the website** are defined as
  architecture with tokens (not hardcoded colors) and config-first data, coexisting
  with the existing palettes and the frozen agent doctrine.

_End of document._
