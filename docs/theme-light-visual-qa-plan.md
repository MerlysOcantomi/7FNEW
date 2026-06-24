# Theme — Light (Lavender Mist) & Visual QA Plan

> **Status:** planning + QA artifact. **Changes no code.** Drives the next phase after the neutral
> (Batches 1–4) and status (Batch 5a/5b/5c) token work landed.
>
> **Companions:** [`theme-safe-bulk-migration-plan.md`](./theme-safe-bulk-migration-plan.md) (neutrals),
> [`theme-status-color-pass-plan.md`](./theme-status-color-pass-plan.md) (status),
> [`theme-token-map.md`](./theme-token-map.md) (token inventory).
>
> Base: `master` @ `04d1e19` (after Batch 5c, PR #10).

---

## 1. Theme wiring — confirmed (do NOT change in this phase)

| Signal | What it drives | Where | Default |
| --- | --- | --- | --- |
| **`data-theme`** on `<html>` | the **7F palette** — `:root` (Midnight/dark) vs `[data-theme="lavender-mist"]` (light) in `app/globals.css` | no-FOUC pre-paint script in `app/layout.tsx`; UI toggle `components/theme-mode-toggle.tsx`; persisted to `localStorage 7f-theme`; `?theme=midnight\|lavender-mist` override | **midnight** |
| next-themes `.dark`/`.light` **class** | Tailwind **`dark:` variants** only | `ThemeProvider attribute="class" defaultTheme="light"` in `app/layout.tsx` | light (so `dark:` is effectively **off** by default) |

**Authoritative palette signal = `data-theme`.** next-themes' class is a **separate** compatibility
signal that only affects `dark:` utilities — it is **not** wired to the palette toggle. ⇒ token-driven
styles (`var(--…)`) are correct on both planes; `dark:`-variant styles depend on a different, largely
dormant signal (see §4). **This phase changes neither mechanism, nor the default theme.**

How to QA light: append **`?theme=lavender-mist`** to any route (or use the toggle). Midnight is the
default with no param.

---

## 2. Global-search — intentionally deferred
`components/global-search.tsx` `estadoChromeColors` stays as **bespoke dark chrome**
(`bg-{c}-400/12 text-{c}-200/95 ring-white/[0.06]`). The command palette is a sensitive overlay; the
token swap visibly restyles it (pastel→mid-tone text; sky→purple). **Revisit** during command-palette
polish / dark-flip QA / broader component QA, with a before/after diff. **Not blocking Batch 5.**

---

## 3. What remains for the color system to be "finished"
- ✅ Internal productive **neutrals** (Batches 1–4) and **status** (5a/5b/5c) on Midnight.
- ⬜ **Lavender Mist (light) end-to-end QA** — this doc (§5–§6). May surface small token refinements (§7).
- ⬜ **`dark:`-variant audit** (§4) — review, classify, then targeted migrations later.
- ⬜ **Brand/accent pass** (deferred blue accents, sidebar glow, charts, inbox outbound gradient) —
  *separate track, gated on brand decisions; NOT this phase.*
- ☑️ **Excluded by decision (not "unfinished"):** client portal, print templates, email, widget,
  system amber, **global-search chrome**, legacy routes.

---

## 4. `dark:`-variant audit checklist *(documentation only — NO code migration in this PR)*

**Principle:** `data-theme` is the authoritative 7F palette signal; the next-themes `.dark` class is a
separate compatibility signal. Remaining `dark:` usage must be **reviewed, not blindly removed** (a
naive strip could drop intended styling on whichever signal is live).

**Grounded inventory** (`grep "dark:"` → 239 hits / 33 files):

| Class | Where (representative) | Approx hits | Disposition |
| --- | --- | --- | --- |
| **c) special-case** | `app/system/**` + `components/system/**` (workspaces, audit, users, plan-editor, …) | ~208 | **Leave** — system is the amber control-plane special-case. |
| **a) safe legacy/compat** | `components/ui/*` shadcn primitives (input, button, badge, switch, tabs, calendar, chart, …) | ~28 | **Review, likely keep** — vendored shadcn defaults; low-risk; revisit only if light QA shows a mismatch. |
| **b) should migrate to tokens** | `app/contenido` (1), `app/business-profile` (1), `components/notifications-panel` (1), `components/forms/transaccion-form` (2) | ~5 | **Candidate** for a small future token PR (same pattern as Batch 5b `tareas/[id]`). |
| **d) excluded/non-UI** | `tools/qr.ts` (2) | 2 | Ignore (tooling, not UI). |

**Action this PR:** record the classification above. **Action later (separate small PR):** migrate the
~5 type-(b) productive `dark:` usages to `data-theme`-driven tokens; verify shadcn (a) under light QA.

---

## 5. Visual QA matrix — core routes (✔ = check in that theme)

Load each in **Midnight** (default) and **Lavender Mist** (`?theme=lavender-mist`). For each, verify:
**no unreadable text · no stray light/dark island · status hues unchanged · no layout shift · focus/keyboard intact.**

| Route | Midnight | Lavender Mist | Notes / what to watch |
| --- | :---: | :---: | --- |
| `/today` | ☐ | ☐ | quick panel, agents triggers, priority dots |
| `/inbox` (+`/inbox/overview`) | ☐ | ☐ | bespoke inbox light overrides; translucent overlays |
| `/clientes` · `/clientes/[id]` | ☐ | ☐ | list rows; detail tabs + estado/factura badges |
| `/proyectos` · `/proyectos/[id]` | ☐ | ☐ | `*_ESTADO_STYLE` badges (token-driven) |
| `/tareas` · `/tareas/[id]` | ☐ | ☐ | estado/prioridad badges (migrated 5b) |
| `/facturacion` · `/facturacion/[id]` | ☐ | ☐ | STATUS_CONFIG + activity badges |
| `/finanzas` | ☐ | ☐ | cards, tables |
| `/calendario` | ☐ | ☐ | priority dots + overdue panel (migrated 5a/5c) |
| `/archivos` | ☐ | ☐ | file rows, thumbnails |
| `/requests` | ☐ | ☐ | status badges, stat numbers, button hovers (5a/5c) |
| `/contenido` | ☐ | ☐ | estado/campaign/marca badges; one `dark:` usage |
| `/agents` | ☐ | ☐ | agents board/panels |
| `/notificaciones` · `/historial` · `/biblioteca` | ☐ | ☐ | lists, empty states |
| `/business-profile` · `/usuarios` · `/departamentos` · `/identidad` | ☐ | ☐ | forms, tables; one `dark:` in business-profile |

**Verify-only (own contracts — do NOT restyle):** `/cliente/*` (portal navy), `/system/*` (amber),
`/widget/chat`, `/login`. **Skip (legacy/replace track):** `/assistant`, `/agente`, `/comunicacion`,
`/entrada`, `/motor`, `/` (Overview).

## 6. Visual QA matrix — component surfaces (both themes)

| Surface | Components | Watch for |
| --- | --- | --- |
| Status badges/chips/dots/pills | requests, tareas(+/[id]), calendario, facturacion(+/[id]), proyectos/[id], clientes/[id], contenido, content-list/calendar, project/client-tabs, client-billing-tab, today | contrast of `*-bg` tints on **light**; hue correctness |
| Neutral surfaces | cards/`StatCard`/`detail-section`, tables/lists, `empty-state`, `skeleton-loader` | no light/dark island; border/divider visibility |
| Overlays | dialogs (`qr-code-modal`, `smart/confirm/assign-modal`), dropdowns/`select`, popovers, toasts (`sonner`) | backdrop + surface contrast both planes |
| Inputs | `components/forms/*`, `ui/input/textarea/checkbox/switch/radio` | placeholder, focus ring, disabled |
| Chrome | `sidebar-nav`, `app/page-header`, `global-new`, `notifications-panel`, context chrome, today drawers, agents panels | active states, hovers |
| Bespoke (verify, don't change) | `inbox/*` (own light vars), `global-search` (deferred), `templates/*`, `system/*` | render only — no edits |

---

## 7. Lavender Mist token-refinement candidates *(QA-driven; any fix = its own small `globals.css` PR, approved separately)*
From `app/globals.css` (light block deepens only `*-text` for danger/warning/success; bgs shared):
- **status `*-bg` soft tints** (`danger/warning/success`) — shared dark→light; confirm legible on light lavender; add light `*-bg` overrides **only if** QA shows them too pale.
- **`--status-neutral-bg`** (`= --surface-3`) and **`--status-notice-{bg,text}`** (inherit dark) — verify on light.
- **contrast on badges/chips/dots** using those tints.
- **cards / tables / forms / modals / dropdowns / empty states** — general light-surface contrast & borders.
> Do **not** preemptively edit tokens — log findings here first, then a single targeted PR.

---

## 8. Recommended PR split
- **PR-1 (this PR, docs-only):** this plan + the global-search deferral note. No code.
- **PR-2…n (conditional, small, QA-driven):**
  - `refactor(theme): tune Lavender Mist status backgrounds` *(globals.css — only if QA proves; approved separately)*
  - `refactor(theme): fix <area> light-theme contrast` *(targeted per finding)*
  - `refactor(theme): migrate stray dark: variants to tokens` *(the ~5 type-(b) productive usages)*
- **Separate track (NOT now):** brand/accent pass (gated on brand decisions).

## 9. What NOT to touch
`app/globals.css` (until a QA-proven fix, approved separately) · theme wiring / next-themes config /
the `data-theme` bridge · the **default theme** (Midnight stays default) · brand/accent (separate, gated) ·
`global-search` (deferred) · special-case surfaces (portal, templates, email, widget, system) — verify-only ·
legacy / Home/Overview / Beauty · backend/API/Prisma/auth · routes/nav · layout/behavior/copy.

## 10. Checks
- **Visual QA** is the core: every route in Midnight **and** `?theme=lavender-mist`, per the criteria in §5.
  *(Run in Vercel / a preview deploy or via screenshots — a local `next build` is blocked by Google-Fonts egress here.)*
- **Any code PR:** `git status` · `git diff --stat` · grep touched files · `npx tsc --noEmit` · `npx eslint <files>` · `next build` omitted (fonts).
