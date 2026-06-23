# Theme — Safe Bulk Neutral Migration Plan

> **Status:** planning artifact. This document changes no code. It is the
> forward-looking, batched, risk-classified plan for finishing the hardcoded-color
> cleanup **without** a blind "migrate everything" pass.
>
> **Companion doc:** [`theme-token-map.md`](./theme-token-map.md) holds the original
> foundation audit (token inventory, the 10 additive tokens, the strategic
> classification) and the **per-PR migration log**. Read it first for the token
> vocabulary; read this for *what to migrate next and in what order*.
>
> Base for the inventory below: `master` @ `7268d29` (clean working tree).

---

## 1. Executive summary

The theme **infrastructure is done and live**: `app/globals.css` defines Midnight
(dark) and a dormant Lavender Mist (light) from the **same** semantic tokens, and a
no-FOUC `data-theme` bridge already switches palettes from `localStorage` (`7f-theme`)
and `?theme=`. Seven cleanup PRs have landed (token map, context chrome, global
search, sidebar audit, page header + Global New, toolbar-panel audit, Today/Agents
triggers, Today quick panel).

What blocks a user-facing palette switch is the **remaining hardcoded color**. A fresh
re-inspection shows the debt has **two distinct shapes**, not one:

1. **Arbitrary hex / `[#…]` literals** — down from ~412/527 at foundation to ~266/367
   now. Concentrated in a handful of hotspots.
2. **Tailwind named-palette utilities** (`*-gray-NNN`, `*-amber-NNN`, …) — ~640
   occurrences, under-counted by the original audit. Gray/slate here are neutral
   candidates; amber/red/emerald/blue are **semantic** and must be classified first.

**Conclusion / strategy.** Proceed **batch by batch**, smallest-and-safest first, with
**neutrals migrated first** and **status / brand / legacy / special-case deferred**.
Concretely: a tiny shared-residue batch, then **Admin neutrals first** (the single
biggest hex hotspot, almost pure neutral swaps), then **productive CRM module residue**
(System is **not** a neutral batch — its amber control plane is special-case, see §5 F),
then a tone-aware status pass, then a brand/accent decision pass.
Legacy/demo surfaces are **replaced, not deep-migrated**; client portal, print
templates, email HTML, and the embeddable widget are **left on their own contracts**.

This keeps `master` shippable at every step and every PR small and reviewable.

---

## 2. Current cleanup state (what has landed)

Eight theme commits are on `master` (oldest → newest), ending at the inventory base:

| Area | Commit | What it did |
| --- | --- | --- |
| Token map | `fdf4a0a` | Added 10 additive tokens; wrote `theme-token-map.md` foundation audit. |
| App-shell chrome | — | Context chrome (copilot-panel / context-bar / context-shell) → tokens. |
| Global search | — | Light-tone search surface → tokens. |
| Sidebar | — | Audit: nav is token-ready (no fresh neutral debt). |
| Page header + Global New | — | Header + app-header audit; Global New (3 files) → tokens. |
| Toolbar panels | — | Toolbar/panel audit. |
| Today / Agents triggers | — | Trigger surfaces → tokens. |
| Today quick panel | `7268d29` | `today-quick-content` neutrals → tokens (blue/status deferred). |

The authoritative running record (per-file, what swapped, what was deferred) lives in
**`theme-token-map.md` §11 (migration log)**. This plan does not duplicate it.

---

## 3. Already migrated / audited (and what remains in them)

These surfaces have been through a migration or an audit pass:

- **Context chrome** — copilot-panel, context-bar, context-shell.
- **Global search** — light tone migrated.
- **Sidebar / nav** — audited token-ready.
- **Page header / app-header** — audited clean.
- **Global New** — 3 files migrated.
- **Toolbar panels** — audited.
- **Today** — quick panel + trigger surfaces migrated.
- **Agents** — trigger surfaces migrated (`app/agente` retheme landed earlier).

**Important:** their *remaining* literals are almost entirely **deferred blue accents
and status tints** (buckets **B** and **C** below) — not fresh neutral work. Do **not**
re-open these files for a neutral pass; touch them again only in the status pass
(Batch 5) or the brand pass (Batch 6).

---

## 4. Current remaining hardcoded-color inventory

Repo: `master` @ `7268d29`, clean. ~253 TS/TSX files under `app/` + `components/`.

### Two debt shapes

| Shape | Approx. count | Notes |
| --- | --- | --- |
| Arbitrary `*-[#hex]` utilities | ~266 | down from ~412 at foundation |
| Raw 6-digit hex (any context) | ~367 | down from ~527 at foundation |
| `rgb()/rgba()/hsl()` literals | ~52 | overlays, glows, scrims |
| Inline `style={{…}}` | ~238 | many are data-driven, **not** all color |
| Named-palette utilities (`*-gray-/amber-/emerald-/red-/blue-…-NNN`) | ~640 | the under-counted layer; gray = neutral, others = semantic |

### Hex hotspots (arbitrary `[#` + raw hex)

`administracion-content` 93 · `assistant/page` 54 · `widget/chat` 27 ·
`templates/factura-skina` 20 · `qr-code-modal` 16 · `templates/propuesta-skina` 14 ·
`today-quick-content` 12 *(already-deferred blue/status)* · `templates/reporte-skina`
12 · `client-documents-tab` 12 · `context-bar` 10 *(deferred blue)* · `copilot-panel`
9 *(deferred)* · `global-search` 8 *(deferred)*.

### Named-palette hotspots

`system/workspaces/[id]` 52 · `cliente/facturas` 41 · `cliente/dashboard` 39 ·
`cliente/proyecto/[id]` 39 · `cliente/solicitudes` 36 · `cliente/archivos` 30 ·
`system/workspaces` 29 · `system/workspace-plan-editor` 25 ·
`system/allowed-emails-manager` 22.

### Most-frequent individual hex

`#1a3a5c` ×55 *(client-portal brand navy — special-case)* · `#3B82F6` ×34 *(blue)* ·
`#E2E8F0` ×25 · `#94A3B8` ×17 · `#0F172A` ×17 · `#EFF6FF` ×16 · `#2563EB` ×16.

### Anatomy of the top hotspot — `administracion-content.tsx` (93)

- **~50 slate neutrals** — `#E2E8F0`, `#94A3B8`, `#334155`, `#F8FAFC`, `#64748B`,
  `#0F172A`, `#F1F5F9`, `#CBD5E1` → **safe neutral batch**.
- **~28 blue** — `#EFF6FF`, `#3B82F6`, `#1D4ED8`, `#BFDBFE`, `#DBEAFE`, `#2563EB` →
  **defer** to the brand/accent pass.
- **~4 status** — amber/yellow → **defer** to the status pass.

So Admin is a ~50-swap **neutral** batch with the blue + status explicitly held back.

### Token vocabulary available (for the mapping tables)

(Full definitions in `theme-token-map.md`.)

- **Neutrals:** `bg-card`, `bg-background`, `bg-muted`, `border-border`,
  `text-foreground`, `text-muted-foreground` (+ dark plane `var(--app-surface-*)`,
  `var(--border-dark)`, `var(--text-*-light)`).
- **Status:** `var(--status-{danger,warning,success,info,accent,neutral,notice}-{bg,text})`
  (modern aliases `--success/--warning/--danger/--info`).
- **Tabs (section accents):** `var(--tab-{info,phases,review,billing,tasks,ai,docs})`.
- **Brand:** `var(--accent-primary)`, `var(--accent-on-dark)`, `var(--accent-muted)`,
  `var(--app-accent)`.
- **Charts:** `--chart-1 … --chart-5` (blue data-viz ramp).

---

## 5. Classification by bucket

> **Named-palette clarification (applies to every bucket):** Tailwind named-palette
> usage is **not automatically wrong**. `gray/slate` neutrals **are** candidates for
> neutral migration. `amber/red/emerald/blue/purple` must be **classified by semantic
> intent first** (status vs brand vs decorative) before any swap — never bulk-convert a
> named color without deciding what it *means*.

### A — Safe neutral migration (bulk-able)

Pure neutral swaps; 1:1; theme-stable today and after the dark flip.

- `administracion-content.tsx` slate neutrals (~50).
- Shared dialog/QR residue: `qr-code-modal` (16), `saved-qr-codes` (5),
  `workspace-panel-surface` / `workspace-panel-backdrop` (3).
- `notifications-panel` + `upload-area` — the **neutral/gray** parts only.
- *(`app/system/*` + `components/system/*` previously listed here — **reclassified to
  bucket F**: the System control plane is an intentional amber surface, not neutral debt.)*
- Scattered neutral residue inside productive CRM components.

### B — Tone-aware status migration

Semantic; needs a light/dark-tuned value, not a flat neutral.

- `global-search` `estadoChromeColors` (emerald/sky/amber/rose/orange named, dark-tuned).
- `today-quick-content` light status dots (`#DC2626` / `#D97706` / `#94A3B8`) + warning
  (`#B45309`).
- `today-task-row` `priorityDotClass` (already `var()`-driven — verify on light).
- The **amber / emerald / red** named-palette in admin/system (warning/success/danger).
- *(Already correct: `client-tabs`, `project-tabs`, `content-calendar`, `content-list`
  use `--tab-*`.)*

### C — Brand / accent decision needed

Do **not** migrate until the §9 decision is made.

- Deferred **blue accents** app-wide: `#2563EB`, `#3B82F6`, `#DBEAFE`, `#EFF6FF`,
  `#1D4ED8`, `#BFDBFE` (context chrome, global-search, today-quick, global-new, admin,
  forte, assistant).
- Sidebar active glow `rgba(99,102,241,0.18)` → candidate `color-mix(in srgb,
  var(--app-accent) …)`.
- `--chart-1 … --chart-5` (blue data-viz ramp) — keep blue or rebrand.
- Inbox outbound message-bubble gradient (`#7360D4` …) — needs a light variant.
- 7F logo white — **keep** (brand mark).

### D — Productive surfaces (keep; migrate carefully)

Current product. Migrate via the batches, not in one sweep.

Inbox · Today · Agents · Calendar · Clients · Projects · Finance · Billing · Tasks ·
**Admin**. Most are low-residue; **Admin** was the heavy neutral one and led the batch
order. *(System is a product surface too, but its amber chrome is special-case — see F.)*

### E — Legacy / provisional / demo (replace, don't deep-migrate)

Spending neutral-migration effort here is wasted; these get rebuilt.

- `/assistant` (54 hex — static mock chat).
- `/agente` (demo data), `/comunicacion` (mock), `/entrada` (mock), `/motor` (mock config).
- `app/page.tsx` **Home/Overview → replace path** (real `DashboardData`, legacy chrome;
  rebuild as "Overview v2 behind preview" — **locked decision**).
- Gated Today demo verticals (`today-appointment/job/session-layout` + `*-mock`, behind
  `?todayLayout=`) — intentional demos, leave quiet.

### F — Leave quiet / special-case (separate contracts)

Not internal-token surfaces; migrating them into app tokens would break their contract.

- **Client portal** `app/cliente/*` + `client-portal-shell` — own `#1a3a5c` brand,
  separate light tenant.
- **Print/PDF templates** `components/templates/*-skina` — `SKINA_*` brand colors baked
  into print payloads.
- **Email** `modules/inbox/email-*` — email-client HTML (no app CSS vars).
- **Widget** `app/widget/chat` — embeddable; fixed external contract.
- **System Admin control plane** `app/system/*` + `components/system/*` — an
  **intentional amber** surface (`app/system/layout.tsx:11-18` + footer *"Control plane ·
  NOT a customer workspace"*); already ships **light + dark** (`dark:bg-amber-950/…`).
  Named-palette here is **amber identity + status badges**; genuine safe-neutral debt ≈ 0
  (the few slate/zinc hits are status-badge *default* tones → status pass, not neutral;
  `bg-white/[α]` are translucent cards on amber). **Do not neutral-migrate** — it would
  erase a documented control-plane safety signal.
- **Auth** `login` pages — separate, low priority.
- Brand logos / wordmarks; theme-agnostic shadows / scrims.

---

## 6. Proposed batch migration plan

Each batch is its **own** PR: PLAN → implement → verify → push. Ordered safest-first,
**Admin neutrals prioritized** per the locked sequencing decision.

### Batch 1 — Shared dialog / QR residue *(first; smallest safe surface)*
- **Files:** `qr-code-modal`, `saved-qr-codes`, `workspace-panel-surface`,
  `workspace-panel-backdrop`, plus the neutral parts of `notifications-panel` &
  `upload-area`.
- **Migrate:** ~30–40 neutral hex → `bg-card/bg-background/bg-muted/border-border/
  text-foreground/text-muted-foreground`.
- **Defer:** any status tint or blue accent in those files.
- **Why safe:** shared but tiny; neutral-only; high reuse → quick consistency win.
- **Checks/routes:** any dialog that mounts the QR modal / workspace panels; notifications
  tray; an upload surface.
- **Commit:** `refactor(theme): migrate shared dialog and qr surfaces to theme tokens`.

### Batch 2 — Admin neutral surfaces *(PRIORITIZED)*
- **Files:** `administracion-content.tsx`.
- **Migrate:** the ~50 slate neutrals.
- **Defer:** the ~28 blue (→ Batch 6) and ~4 status (→ Batch 5).
- **Why safe:** single isolated file; biggest single neutral win; productive surface.
- **Routes:** wherever Admin / `administracion` renders.
- **Commit:** `refactor(theme): migrate admin neutral surfaces to theme tokens`.

### Batch 3 — RESOLVED: System reclassified to special-case *(not a neutral batch)*
- **Outcome:** on inspection, `/system` is an **intentional amber control plane**
  (`app/system/layout.tsx:11-18` + footer *"Control plane · NOT a customer workspace"*),
  already light + dark, with **~0 safe-neutral debt**. Its named-palette is amber
  identity + status badges, not gray neutrals. Neutral-migrating it would erase a
  documented safety/UX signal and make the control plane look like a customer workspace.
- **Decision:** moved to **bucket F (leave quiet / special-case)** — see §5 F. There is
  **no** System neutral PR. Any status-badge tokenization is deferred to **Batch 5**
  (status pass), and only if desired; the amber chrome stays as identity.
- **Next real neutral target:** **Batch 4 — Productive CRM module residue** (below).

### Batch 4 — Client-requests neutral surfaces *(narrowed from "CRM residue")*
- **Inspection outcome:** the internal CRM modules (`clientes` / `proyectos` / `finanzas` /
  `facturacion` / `tareas` / `calendario` + their forms/tabs) are **already neutral-clean**
  — they use dark tokens + `bg-white/[α]` translucent overlays. The audit's old hotspots
  resolve to special-case (client *portal* `app/cliente/*`), status (`priorityDot` maps),
  or decorative mock (`client-documents-tab` thumbnail swatches). **No CRM-wide batch.**
- **Real target — `app/requests/page.tsx`:** the one genuine productive neutral debt — a
  nav-linked, API-backed ("Client requests") **light island**. Migrated its ~32 opaque
  neutral tokens (`bg-white`→`bg-card`, `border-[#E2E8F0]`→`border-border`,
  `text-gray-*`→`text-foreground`/`text-muted-foreground`, `bg-gray-100`→`bg-muted`,
  `#111827` chip→`bg-foreground text-background`).
- **Deferred (→ Batch 5):** `STATUS_CONFIG`, `PRIORITY_COLORS` (incl. its `text-gray-500`
  priority tone + fallback), stat-number hues, and the amber/green status hovers.
- **Commit:** `refactor(theme): migrate client-requests neutral surfaces to theme tokens`.

### Batch 5 — Tone-aware status pass
- **Scope:** `estadoChromeColors`; Today light status dots + warning; the semantic
  amber/red/emerald named-palette across admin/system.
- **Migrate:** → `var(--status-*-{bg,text})` with **per-tone light/dark tuning**.
- **Why later:** not a flat swap; needs contrast tuning on both planes.
- **Commit:** `refactor(theme): add tone-aware status colors`.

### Batch 6 — Brand / accent decision pass
- **Scope:** deferred blue accents, sidebar glow, charts, outbound-bubble gradient.
- **Gated on §9** (brand decision). Not a neutral swap.
- **Commit:** `refactor(theme): apply brand accent decision`.

### Batch 7 — Legacy replacement review *(DOC ONLY)*
- **Scope:** `/assistant`, `/agente`, `/comunicacion`, `/entrada`, `/motor`.
- **Output:** replace / archive / hide-from-nav decisions. **Do not deep-migrate.**

### Batch 8 — Home/Overview v2 replacement track
- **Scope:** `app/page.tsx` Home/Overview — rebuild from tokens behind a preview flag;
  re-bind the real `DashboardData`. Separate design track, not a migration.

### No batch — special-case
Client portal, print templates, email, widget, auth: leave quiet, or give a **separate
palette contract** if they ever need theming.

---

## 7. Files that should NOT be migrated yet

- All of **bucket F** (client portal, print templates, email, widget, auth, logos,
  theme-agnostic shadows/scrims).
- All of **bucket E** legacy/demo, including the gated Today verticals.
- The **deferred blue accents and status tints** inside already-migrated files — they
  belong to Batch 5 / Batch 6, not a neutral pass. Re-opening them early risks churn and
  contrast regressions.

---

## 8. Files to replace / redesign instead of migrate

- `app/page.tsx` **Home/Overview** → Overview v2 behind preview *(locked)*.
- `/assistant`, `/agente`, `/comunicacion`, `/entrada`, `/motor` → mock-data demos;
  replace rather than invest neutral-migration effort.

---

## 9. Known deferred decisions

| # | Decision | Why it's deferred |
| --- | --- | --- |
| a | **Blue accents** — keep blue, or introduce a token? | No legible brand-purple-on-light token exists today. |
| b | **Status colors** — light/dark tuning | Tone-aware; handled in Batch 5. |
| c | **Brand purple on light** | `--accent-primary` `#8B5CFF` ≈ 2.7:1 on light vs blue `#2563EB` ~5–6:1. Needs a dedicated on-light token or wait for the dark flip. |
| d | **Tone-aware chips** | `estadoChromeColors` is dark-tuned; needs a light variant. |
| e | **Charts** | Keep the blue `--chart-*` ramp, or rebrand to the accent family? |

Batch 6 is **blocked** until (a)/(c)/(e) are answered.

---

## 10. Recommended next 3 PRs

Batches 1 & 2 have **landed** (PRs #3, #4). Batch 3 was **resolved as a reclassification**
(System → special-case, no code PR). The next PRs are:

1. `refactor(theme): migrate crm module neutral residue to theme tokens` — **Batch 4**,
   the **next real neutral target** (scattered low-per-file residue in clientes / proyectos
   / finanzas / facturacion / tareas / calendario, e.g. `client-documents-tab`). A scan
   confirms the larger remaining hex concentrations are special-case `widget/chat` and
   legacy `assistant` (both excluded), so CRM residue is the genuine next neutral work.
2. `refactor(theme): add tone-aware status colors` — **Batch 5** (status pass; may also
   tokenize System status badges if desired).
3. `refactor(theme): apply brand accent decision` — **Batch 6**, gated on the §9
   brand/accent decisions.

---

## 11. Safety rules for future migration prompts

1. **One batch per PR.** Never "migrate everything."
2. **Neutrals-only** in a neutral batch. Defer blue / status / brand every time.
3. **Per-file discipline:** grep the file before and after; confirm swaps are **1:1**
   (insertions == deletions for the swapped lines); run `tsc --noEmit` and `eslint`.
4. **Never reinterpret `--accent`** — it is the shadcn hover/muted background, **not**
   brand purple. Brand purple is `--accent-primary` / `--accent-on-dark` / `--accent-muted`.
5. **Leave already-`var()`-driven dark tones alone.** If it already reads from a token,
   don't "re-migrate" it.
6. **Never fold special-case surfaces** (client portal, print templates, email, widget)
   into internal app tokens.
7. **Don't deep-migrate legacy/demo** — flag it for replacement instead.
8. **Use targeted edits** when a bare token is a substring of an overlay — e.g. don't let
   a `bg-white` → `bg-card` swap clobber `bg-white/[0.06]` translucent overlays.

---

## 12. Visual QA checklist (run per batch)

For the routes touched by the batch:

- View in **Midnight** (current default) and, where the light theme is dormant, in
  **Lavender Mist** via `?theme=lavender-mist`.
- Confirm: **no layout shift**, **no unreadable text**, **no unexpected light island**,
  **behavior / focus / keyboard unchanged**, and **blue / status / brand colors
  unchanged** (a neutral batch must not move a semantic hue).

Per-batch routes:

- **Batch 1:** dialogs mounting the QR modal / workspace panels; notifications tray; an
  upload surface.
- **Batch 2:** wherever Admin / `administracion` renders.
- **Batch 3:** *(reclassified — no migration; System is special-case, see §5 F).*
- **Batch 4:** the touched CRM module screens (clientes / proyectos / finanzas / etc.).
- **Batch 5:** every surface whose status chips changed (search results, Today, admin/system).

---

## 13. Stop conditions (STOP and ask before editing)

Halt and ask — do **not** swap — when:

- The color is **semantic** (status / priority) or **brand** (accent / logo / agent
  identity), or a **tone-aware chip**. These are buckets B/C, not a neutral pass.
- The file is **legacy / demo** (bucket E). Propose a replacement; don't deep-migrate.
- **Contrast may regress** — e.g. dark-purple-on-light, or a dark-tuned value placed on a
  light surface. Defer and document instead.
- A "neutral" swap is **not 1:1** — it would change tone, layout, spacing, or behavior.
- The change would **exceed the batch's named files** — split into another PR rather than
  letting scope creep.
