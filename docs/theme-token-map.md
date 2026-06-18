# 7F Theme Token Map & Hardcoded-Color Audit

> **Status:** foundation. This document (a) records the canonical 7F semantic token
> map added in `chore(theme): define global 7F theme token map`, and (b) audits the
> repo's hardcoded colors and classifies surfaces so the migration to a fully
> palette-switchable system can proceed in small, safe PRs.
>
> **Base:** `master` (foundation PR). **Active theme file:** `app/globals.css`
> (Tailwind v4 — `@theme inline`, no `tailwind.config.js`; `postcss.config.mjs`).
>
> This PR is **foundation only**: it adds 10 additive tokens (zero visual change)
> and this doc. It does **not** redesign, migrate, delete, flip dark mode, or add a
> palette switcher.

---

## 1. Executive summary

- The theme **infrastructure already exists and is solid.** `app/globals.css`
  defines a **Midnight** (dark) palette on `:root, .dark, [data-theme="midnight"]`
  and a **dormant Lavender Mist** (light) palette on `[data-theme="lavender-mist"]`,
  both built from the **same semantic tokens** (only values change). A no-FOUC theme
  bridge in `app/layout.tsx` plus `components/theme-mode-toggle.tsx` already switch
  `data-theme` from `localStorage` (`7f-theme`) / `?theme=`. So a palette-switch
  foundation is **present, not missing.**
- The **blocker** to palette switching is not the token system — it's the **~900+
  hardcoded color references** still scattered through feature/page components
  (412 Tailwind `*-[#hex]` utilities, 527 raw 6-digit hex, 53 `rgb/rgba/hsl`, 238
  inline `style={{…}}` blocks in TS/TSX). Each hardcoded value is frozen to one
  theme and will **not** invert under Lavender Mist.
- **Risk level: MEDIUM.** Tokenized surfaces (shared `components/ui`, Smart Inbox
  shell, Today board, Agents post-tokenization) flip correctly. Un-tokenized zones
  (Admin, Assistant demo, client portal, auth, Today's quick-content light path,
  embed widget) would mis-render under the alternate palette.
- **Readiness verdict:** the app is **ready to define the vocabulary** (this PR) and
  to **migrate zone-by-zone**. It is **not yet ready** to ship a user-facing palette
  switch, because un-tokenized zones would break visually in the alternate palette.

---

## 2. Existing theme / token inventory

- **Active globals:** `app/globals.css` — **316** CSS custom properties. Imported by
  `app/layout.tsx` (`import './globals.css'`).
- **Dead/legacy globals:** `styles/globals.css` — a v0/shadcn default file using
  `oklch()` values. **Not imported anywhere** (`rg "styles/globals"` → 0 refs).
  Recommend deletion in a later cleanup PR (left untouched here).
- **Tailwind v4:** no `tailwind.config.js`; `postcss.config.mjs` + `@theme inline`
  inside `app/globals.css` map `--color-*` utilities to the base tokens.
- **Token families in `app/globals.css`:**
  - **shadcn base** (remapped to premium): `--background`, `--foreground`, `--card`,
    `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`,
    `--border`, `--input`, `--ring`, charts, sidebar.
  - **Premium system:** `--app-canvas/-sidebar`, `--app-surface-dark/-elevated/-hover`,
    `--surface-1..4`, `--accent-primary/-hover/-on-dark/-muted/-muted-border/-soft/-rich`,
    `--text-primary/secondary-dark`, `--text-primary/secondary/tertiary-light`,
    `--border-light/-dark/-dark-strong`, shell overlays
    (`--app-surface-subtle/-hover/-active`), `--app-shadow-subtle`.
  - **Status:** `--status-{danger,warning,info,success,accent,neutral,notice}-{bg,text}`.
  - **Inbox** (heaviest namespace, ~80 tokens): chat bubbles, composer, intelligence
    rail, urgency/lead/focus, voice states, geometry, shadows.
  - **Agent identity:** `--agent-{teal,rose}{,-soft}`.
  - **Tab aliases:** `--tab-{info,phases,review,billing,tasks,ai,docs}`.
- **Duplicates / confusing names (audit notes):**
  - **Two globals files** (active `app/` vs dead `styles/`).
  - `:root` defines the shadcn base **twice** — an early "Copilot blue" block
    (`#F8FAFC`, `#0F172A`, …) then a premium remap further down; the **later wins**.
    Confusing to read.
  - Near-duplicate semantics: `--inbox-urgency` (`#F08A8E`) vs `--status-danger-text`
    (`#E86F74`); `--status-info-text` → `--accent-primary` (purple) while
    `--inbox-info` is blue (`#9DC3FF`). **"info" is overloaded.**

---

## 3. Hardcoded-color findings (real data)

Totals (TS/TSX): **412** Tailwind `*-[#hex]` utilities · **527** raw 6-digit hex ·
**53** `rgb/rgba/hsl` · **238** inline `style={{…}}`. (`app/globals.css` itself shows
130 hex — those are the token **definitions**, expected, not a problem.)

Highest-concentration files / zones:

| File | count | zone |
|---|---|---|
| `components/administracion-content.tsx` | 69 | System/Admin |
| `app/assistant/page.tsx` | 45 | Assistant (static demo) |
| `components/global-search.tsx` | 36 | Shared/core |
| `app/widget/chat/page.tsx` | 23 | Embed widget |
| `components/copilot-panel.tsx` | 22 | App shell |
| `components/today/today-quick-content.tsx` | 21 | Today (light-tone path) |
| `components/templates/factura-skina.tsx` (+ propuesta 14, reporte 12) | 20 | Print/PDF templates |
| `components/context-shell.tsx` | 15 | App shell |
| `components/context-bar.tsx`, `components/qr-code-modal.tsx` | 11 | App shell / shared |
| `app/cliente/*` (per file) | 3–5 | Client portal (separate tenant) |

Clean / already tokenized: **`components/ui/*` = 0** arbitrary-color utilities;
Agents ≈ 0 (tokenized); Smart Inbox very low (`message-bubble` 1;
`modules/inbox/email-outbound.ts` 5 = intentional email-client HTML).

Patterns that should become tokens: repeated slate neutrals (`#0F172A`, `#64748B`,
`#94A3B8`, `#E2E8F0`, `#F1F5F9`, `#F8FAFC`), the blue brand ramp
(`#2563EB`/`#3B82F6`/`#1D4ED8`), status coral/gold/green, and inline
`style={{ background/color }}` on dynamic elements.

---

## 4. Risk assessment

- **Palette-change breakage:** every hardcoded value is fixed → un-tokenized zones
  mis-render under Lavender Mist (e.g. light slate text on a light canvas).
- **Low-contrast hazards:** `style={{ color }}` / arbitrary text colors tuned for one
  background can fail WCAG on the other theme; the 238 inline `style` blocks are the
  hardest to audit automatically.
- **Translucent backgrounds:** `bg-white/[0.06]`-style overlays are **correct** on
  dark (tokenized as `--app-surface-*`) but become invisible on light unless they go
  through the ink-flip tokens; raw `white/…` literals in components are a risk.
- **Theme-coupled colors:** anything hardcoded dark-slate or pure-white assumes one
  theme.
- **Not light-ready zones:** Admin, Assistant demo, client portal, auth, templates,
  embed widget, Today quick-content.

---

## 5. Token map added in THIS PR

**Additive only** — the 10 existing shadcn/base tokens are **left untouched**:
`--background`, `--foreground`, `--border`, `--primary`, `--primary-foreground`,
`--accent`, `--accent-foreground`, `--muted`, `--muted-foreground`, `--ring`.

Added (10), aliasing theme-aware sources so Lavender Mist inverts for free:

| token | → source | Midnight | Lavender Mist |
|---|---|---|---|
| `--surface` | `--app-surface-dark` | `#211A3A` | `#FAF8FE` |
| `--surface-elevated` | `--app-surface-dark-elevated` | `#2C2448` | `#FFFFFF` |
| `--surface-muted` | `--app-canvas` | `#16112A` | `#F4F1FB` |
| `--border-strong` | `--border-dark-strong` | white/0.14 | ink/0.16 |
| `--success` | `--status-success-text` | `#6FAE87` | `#3E8E5E` |
| `--warning` | `--status-warning-text` | `#D6A84A` | `#B07D24` |
| `--danger` | `--status-danger-text` | `#E86F74` | `#C2454A` |
| `--info` | `--accent-primary` | `#8B5CFF` | `#9470FF` |
| `--shadow-soft` | `--app-shadow-subtle` | `0 4px 10px …` | `0 4px 14px …` |
| `--shadow-strong` | literal | `0 18px 40px -20px rgba(0,0,0,.55)` | (same) |

**Why `--accent` is NOT redefined:** today `--accent` = `--accent-soft` (`#EDE7FF`),
a near-white lavender that shadcn components use as a hover/muted **background**. The
brand purple is a different role. Re-pointing `--accent` to purple would turn every
`bg-accent` / `hover:bg-accent` solid purple app-wide. So `--accent` keeps its
shadcn meaning.

**Use these for brand / on-brand purple instead:**
- `--accent-primary` (`#8B5CFF` / `#9470FF`) — solid brand purple (icons, accents,
  primary buttons).
- `--accent-on-dark` (`#C4B2FF` on dark / `#6D3FD4` on light) — readable accent
  **text**.
- `--accent-muted` / `--accent-muted-border` — translucent purple fills/borders.
- `--info` (= `--accent-primary`) — chosen **on-brand (purple), not blue**; if a
  literal blue "info" is ever needed, `--inbox-info` exists.

**Consume via** `var(--token)` (e.g. `bg-[var(--surface)]`, `text-[var(--danger)]`,
`shadow-[var(--shadow-strong)]`). Registering `--color-*` utilities in
`@theme inline` (so `bg-surface` works) is an **optional later step**, deferred to
keep this PR a visual no-op (verified: 0 existing consumers of the new names).

---

## 6. Palette direction (approved)

- **Dark (primary): Midnight** — `:root, .dark, [data-theme="midnight"]`.
- **Light (primary): Lavender Mist** — `[data-theme="lavender-mist"]` (dormant).
- **Visual family: premium PURPLE** (accent `#8B5CFF`, on-dark `#C4B2FF`) — **not
  blue**.
- The goal is not merely dark/light: the same semantic token map must support future
  **brand modes / per-vertical palettes** by adding new `[data-theme="…"]` blocks
  that override token **values only** — components never change.

---

## 7. Strategic classification of surfaces

Per product direction. **No deletions or redesigns in this PR** — this is a map for
future, separate PRs.

### CAT 1 — Shared / core infrastructure (migrate carefully; app-wide blast radius)
App shell, sidebar, navigation, shared UI, global tokens. These gate every other
zone, so migrate them deliberately and first.
- `app/globals.css` (token source), `components/ui/*` (**already 0 hardcodes ✓**),
  `components/sidebar-nav`, `components/copilot-panel` (22), `components/context-shell`
  (15), `components/context-bar` (11), `components/page-header`,
  `components/global-search` (36), `components/global-new/*`, theme provider/toggle.
- **Action:** careful token migration; highest leverage.

### CAT 2 — Productive / current product (KEEP; gradual migration)
Live product. Hardcoded colors here are migration candidates, **not** deletion
candidates.
- **Smart Inbox** — `app/inbox`, `app/inbox/overview`, `app/entrada`,
  `components/inbox/*`. **NOT legacy.** (Low hardcode count; mostly tokenized.)
- **Today** — `app/today` board + the new preview hero. (Keep; do **not** promote
  `work_first_v2`.)
- **Agents** — `app/agents`, `app/agente`, `components/agents/*` (tokenized).
- **CRM modules** — proyectos, clientes, contenido, calendario, facturacion,
  finanzas, tareas, archivos, biblioteca, departamentos, identidad,
  forte/improvements, comunicacion, automatizaciones, historial, notificaciones,
  business-profile.
- **Admin / System** — `components/administracion-content` (**69 — heavy but keep**),
  `app/admin/usuarios`, `app/system/*`, `app/usuarios`.
- **Action:** migrate hardcodes to tokens gradually, zone by zone.

### CAT 3 — Legacy / provisional / demo (don't deep-migrate; redesign from tokens later)
- **`app/page.tsx` — Home / Overview.** **CONFIRMED provisional:** imports
  `LegacyTodayChrome`; real `DashboardData` but a legacy chrome; partly superseded by
  the Today hero direction. → **First safe redesign candidate** (see §9).
- **`app/assistant/page.tsx` — Assistant.** Static **mock** (hardcoded
  `INITIAL_MESSAGES`, fake risk text; `LegacyTodayChrome`); 45 hardcodes. The real
  assistant is Fanny in Inbox/Agents. → **replace**, don't migrate.
- **Today demo verticals** — `today-appointment/job/session-layout` +
  `appointments/jobs/sessions/*-mock.ts`, gated behind `?todayLayout=`. Intentional,
  off in production. → **leave quiet** (mock by design).
- **`app/widget/chat`** (23) — standalone embed surface. → **review** (real
  embeddable vs demo unconfirmed).

### CAT 4 — Replace / delete-review candidates (DOCUMENT ONLY — act in a separate PR)
**Do not delete anything now.**
- `styles/globals.css` — **dead** (0 refs, `oklch` shadcn default) → delete later.
- Possible **route duplication** to confirm: `app/projects` vs `app/proyectos`;
  `app/usuarios` vs `app/admin/usuarios` vs `app/system/users`; `app/administracion`
  vs `app/admin`.
- `app/assistant` (static mock) → replace candidate.

### Leave quiet / out of scope (separate tenant or intentional)
- **Client portal** `app/cliente/*` + `components/client-portal-shell` — separate
  light tenant UI; **excluded** from this dark/palette migration.
- **Print/PDF templates** `components/templates/*-skina` — intentional brand colors
  for documents; evaluate separately.
- **`modules/inbox/email-outbound`** — email-client HTML inline styles (intentional).

---

## 8. Migration plan (small, safe PRs)

1. `chore(theme): define global 7F theme token map` — **THIS PR** (foundation).
2. `refactor(theme): migrate app shell to theme tokens` — CAT 1: copilot-panel,
   context-shell, context-bar, sidebar/nav (`components/ui` already clean).
3. `refactor(theme): migrate shared UI colors to theme tokens` — global-search,
   qr-code-modal, global-new panels.
4. `refactor(theme): migrate smart inbox colors to theme tokens` — small residue
   (`message-bubble`); leave `email-outbound` HTML intentional.
5. `refactor(theme): migrate today colors to theme tokens` — `today-quick-content`
   light-tone path + `global-today-trigger`. **Do NOT touch board logic /
   `work_first_v2`.**
6. Heavier CAT 2 zones: Admin (`administracion-content`), then evaluate the rest.
7. `feat(theme): add midnight and lavender mist palettes` — finalize/extend both
   palettes once consumers are tokenized.
8. `feat(theme): add palette switcher foundation` — surface the existing
   `data-theme` bridge as a user control, **after** tokenization is broad enough.
9. Cleanup PR: delete dead `styles/globals.css`; de-dup the early shadcn block in
   `:root`; reconcile `--inbox-urgency` vs `--status-danger` and the "info" overload.

---

## 9. What to migrate / replace / leave — and the first redesign candidate

- **Migrate (token-ize gradually):** CAT 1 (shell/shared) → then CAT 2 (live product,
  incl. Smart Inbox, Today, Admin).
- **Replace (rebuild from tokens, don't migrate):** CAT 3 legacy/demo — `app/page.tsx`
  Home/Overview, `app/assistant` mock.
- **Leave quiet (for now):** client portal, print templates, email HTML, gated Today
  demo verticals.
- **Recommended first safe redesign candidate: `app/page.tsx` (Home / Overview).**
  It is provisional (`LegacyTodayChrome`), but its data (`DashboardData` via
  `useFetch`) is real and re-bindable, so a from-scratch token-based rebuild is
  low-risk and high-value. **The decision to redesign / replace / delete is a
  separate future PR** — this document only recommends.

---

## 10. What NOT to touch (this and the immediate foundation phase)

- No Today redesign; do not promote `work_first_v2`; no Today↔Tasks mixing.
- No product-logic, route, or navigation changes.
- No backend / API / Prisma / schema / behavior changes.
- No mass color migration in one PR — migrate zone by zone.
- No user-facing palette switcher before tokenization is broad enough.
- Do not redefine the 10 existing shadcn tokens (especially `--accent`).
- Do not edit `@theme inline` utilities or the dormant Lavender Mist block.
- Do not delete `styles/globals.css` yet (documented for a later cleanup PR).
- Templates/`*-skina` + `email-outbound` colors may be intentional (print / email
  client) — confirm before tokenizing.

---

## 11. Migration log

### `refactor(theme): migrate context chrome to theme tokens`
First CAT-1 consumer migration. Files: `components/copilot-panel.tsx`,
`components/context-bar.tsx`, `components/context-shell.tsx` (the light copilot /
context-bar / detail-route shell chrome).

**Migrated (neutrals + dark CTAs + status → tokens; ~40 literals, 1:1 swaps, no
layout/behavior/copy change):**
- Neutral surfaces → shadcn light content tokens (theme-aware; they stay light in
  Midnight today and will follow the eventual 2B dark flip — so these stop being
  permanent light islands without a dark flip now): `bg-white→bg-card`,
  `bg-[#F8FAFC]/[#FAFCFF]→bg-background`, `bg-[#F1F5F9]→bg-muted`,
  `border-[#E2E8F0]/[#CBD5E1]→border-border`, text `#0F172A/#334155→text-foreground`,
  `#64748B/#94A3B8/#CBD5E1→text-muted-foreground`.
- Dark CTAs (`bg-[#0F172A] text-white hover:bg-[#1E293B]`) → `bg-foreground
  text-background hover:bg-foreground/90` (same inversion idiom as the Today/Agents
  CTAs).
- Amber "working" dot `#F59E0B` → `var(--status-warning-text)`.

**Deferred (left as hardcoded blue, intentionally):** the blue brand accents —
active context chip, active tab indicator + underline, links / "View", the AI
message bubble, focus rings/glows, and the idle status dot
(`#3B82F6/#2563EB/#1D4ED8/#DBEAFE/#EFF6FF/#BFDBFE/#1E3A5F`, `rgba(59,130,246,…)`).
**Why:** these surfaces are LIGHT in Midnight, and Midnight has **no legible
dark-purple-on-light token** — `--accent-primary` (#8B5CFF) on the light surfaces is
≈2.7:1 (worse than the current `#1D4ED8/#2563EB` at ~5–6.5:1), and `--accent-on-dark`
is a *light* purple meant for dark surfaces. Revisit when these surfaces flip dark
(2B) — where `--accent-on-dark` works — or when a dedicated dark-purple-on-light
token is added. Black modal scrims (`bg-black/30|50`) and Tailwind `shadow-*`
utilities were left as-is (theme-agnostic; not hardcoded hex).

**The new `--surface*/--border-strong/--shadow-*` tokens were NOT used here:** they
alias the DARK content plane, so they don't fit these currently-light chrome
surfaces; the existing shadcn light content tokens were the correct choice (as
anticipated in §5).

### `refactor(theme): migrate global search to theme tokens`
Second CAT-1 consumer migration. File: `components/global-search.tsx` (the ⌘K
workspace search). This component has **two tones**, switched at runtime by
`toneLight` (true only when the desktop portal mount carries
`data-search-chrome-variant="context"`, i.e. docked inside the light context shell
migrated above):
- **Default dark command-palette tone** — already palette-driven via the project's
  dark-plane tokens (`var(--text-primary-light)`, `var(--accent-primary)`,
  `var(--border-dark)`, `var(--app-surface-dark[-elevated])`, `var(--app-shell-bg)`)
  plus theme-agnostic `white/[0.0x]` overlays and black/white/purple shadow `rgba()`.
  Nothing hardcoded-neutral to migrate; **left untouched**.
- **Light `context` tone** — was the only place carrying hardcoded slate/blue
  literals (sibling of the context shell it docks into).

**Migrated (light-tone neutrals → same shadcn light tokens as the context-chrome PR,
so the docked search matches its shell; 32 literals, 1:1 swaps, no layout/behavior/
copy change):** `bg-white→bg-card`, `bg-[#F8FAFC]→bg-background`, `bg-[#F1F5F9]→
bg-muted`, `bg-[#E2E8F0]/80→bg-border/80`, `border-[#E2E8F0]/[#CBD5E1]→border-border`,
`ring-[#E2E8F0]/[#CBD5E1]→ring-border`, `ring-offset-[#F8FAFC]→ring-offset-background`,
text `#0F172A→text-foreground`, `#64748B/#94A3B8→text-muted-foreground`. (`bg-white`
was migrated via targeted edits, not `replace_all`, because it is a substring of the
dark tone's `bg-white/[0.0x]` overlays.)

**Deferred:**
- *Light-tone blue accents* — active result row (`bg-[#3B82F6]/14` + ring/inset),
  accent icon + intro bar (`#2563EB`), chip hover (`#EFF6FF`/`#3B82F6`), chip focus
  ring (`#3B82F6`), EmptyState icon. Same family and rationale as the context-chrome
  PR (no legible dark-purple-on-light token).
- *Status badges* `estadoChromeColors` (the result-row estado/priority chips) — a
  Tailwind **named** semantic palette (`emerald/sky/amber/rose/orange-400` at low
  opacity with `*-200/95` text), tuned for the **dark** plane and applied on both
  tones. Not hardcoded hex (absent from the grep). A `--status-*` swap is **not** a
  safe 1:1 here: those tokens are light-surface-tuned (`#6FAE87/#D6A84A/#E86F74`), so
  applying them would visibly change the dark command-palette chips — a redesign, not
  a tokenization. Deferred to a dedicated **tone-aware status pass** (needs to read
  `toneLight` and pick light- vs dark-tuned status values per tone).
- *Two neutral inset-shadow tints* (`rgba(226,232,240,1)`, `rgba(148,163,184,0.12)`)
  left inside arbitrary `shadow-[…]` values — shadows were out of scope (same policy
  as the Tailwind `shadow-*` deferral above).

### `audit: sidebar navigation already token-compliant` (no code change)
Audited the main sidebar for the next CAT-1 migration: `components/sidebar-nav.tsx`
(desktop `SidebarNav` + `MobileSidebarNav`, imported by `app-shell.tsx`) and its
child `components/sidebar-account-menu.tsx` (the bottom account trigger + left
Account Center sheet). **Result: nothing to migrate — the sidebar was built
token-first and is already palette-ready.** No edits made; recorded here so the
audit isn't repeated. (`components/ui/sidebar.tsx` is an unrelated shadcn primitive
not used by the main nav — out of scope.)

**Already tokenized** — the sidebar is driven entirely by a dedicated dark-plane
token set (these cascade with the rest of the system; do **not** churn them onto the
generic `bg-card`/`text-foreground` tokens — that would invert the dark rail to light
and change the colors): `--app-sidebar-bg`, `--app-sidebar-surface`,
`--app-sidebar-border`, `--app-sidebar-text` (26×), `--app-sidebar-text-muted` (24×),
`--app-accent` (19×), plus `--app-shell-bg`, `--app-surface-active`, `--border-dark`,
and `--inbox-*` for the inbox status dots. Active/hover/collapsed/mobile-drawer/
workspace-switcher/account states are all expressed through these — verified: **0**
hardcoded hex, **0** arbitrary `bg-[#]/text-[#]/border-[#]`, **0** Tailwind named
palette colors, **0** `bg-white/bg-black` neutral surfaces. **No hardcoded neutral
surfaces, text, or borders need migration — the sidebar is considered palette-ready
for neutral surfaces / text / borders.**

**Deferred (the only non-var literals; all intentional brand/shadow, left as-is):**
- `text-white` on `bg-[var(--app-accent)]` **count badges** (sidebar-nav 368/382/479/
  495) — brand-accent badge foreground. No safe token swap: shadcn `--accent-foreground`
  pairs with the `--accent` hover/muted background, **not** the indigo `--app-accent`.
- `text-white` on the **"7F" logo** wordmark (sidebar-nav 782/793/918/961) — brand mark.
- `rgba(99,102,241,0.18)` **active-item accent glow** inside `shadow-[0_0_0_1px_var(
  --app-accent),…]` (sidebar-nav 283/350/465) — brand accent, and inside a shadow.
- `rgba(255,255,255,0.04)` white inset highlight inside `shadow-[…]` (account-menu 281)
  — theme-agnostic shadow detail (same policy as other deferred `shadow-*`).

### `refactor(theme): migrate page header and global new to theme tokens`
Third CAT-1 consumer migration. Like global search, the Global New surfaces carry a
`variant: "app" | "context"` (a.k.a. `tone: "canvas" | "light"`) split: the **app/
canvas tone is the dark toolbar surface** (already palette-driven via the project's
`var(--…)` set — `--border-dark`, `--app-shell-bg`, `--app-surface-hover/active`,
`--text-primary/secondary-light`, `--accent-primary`, `white/[0.06]` overlays) and was
left untouched; only the **light "context" tone** carried hardcoded slate/blue.

**Page header — audited, already token-compliant (NOT touched):**
- `components/page-header.tsx` — `default` tone already uses shadcn light tokens
  (`border-border bg-background`, `text-foreground`, `text-muted-foreground`); `canvas`
  tone uses the dark `var(--…)` set. Model implementation; nothing to migrate.
- `components/app-header.tsx` — pure shadcn semantic utilities throughout
  (`border-border`, `bg-card`, `bg-background`, `text-foreground`, `text-muted-foreground`,
  `bg-accent`). 0 hardcoded colors; nothing to migrate.

**Migrated (light/"context" tone neutrals → shadcn light tokens, same set as the
context-chrome / global-search PRs; 3 files, 12 literals, 1:1 swaps, no layout/behavior/
copy change):** `components/global-new/global-new-desktop-panel.tsx`,
`…/global-new-item.tsx`, `…/global-new-trigger.tsx`.
- `bg-white→bg-card`, `bg-[#F8FAFC]→bg-background`, `bg-[#F1F5F9]→bg-muted`,
  `border-[#E2E8F0]→border-border`, `text-[#0F172A]/[#334155]→text-foreground`,
  `text-[#64748B]/[#94A3B8]→text-muted-foreground`. (`bg-white` in `global-new-item`
  migrated via a targeted edit, not `replace_all`, since it is a substring of the dark
  tone's `bg-white/[0.06]` overlays; `global-new-trigger`'s lone `bg-white` had no such
  collision.)
- Already-tokenized siblings left as-is: `global-new-mobile-sheet.tsx` (var-driven),
  `global-new-provider.tsx` / `use-global-new.ts` (logic only).

**Deferred (light-tone blue accents — same no-legible-dark-purple-on-light rationale as
prior PRs):** the New-panel header icon halo (`bg-[#DBEAFE] text-[#2563EB]`), the menu
item icon (`text-[#2563EB]`), and the focus/open-state rings (`ring-[#3B82F6]/35`,
`ring-[#3B82F6]/30`). The shared `rgba(255,255,255,0.04)` inset-highlight shadow and
`shadow-sm` utilities were left (theme-agnostic). The dark app/canvas tone was not
touched (already tokenized).
