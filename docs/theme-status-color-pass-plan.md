# Theme — Tone-Aware Status Color Pass (Batch 5 plan)

> **Status:** planning artifact. This document changes no code. It is the inspection +
> classification for the **status color** cleanup, and the batched, risk-classified plan for
> finishing it **tone-aware** (correct on both Midnight/dark and the dormant Lavender Mist/light).
>
> **Companion:** [`theme-safe-bulk-migration-plan.md`](./theme-safe-bulk-migration-plan.md) (the
> neutral-migration plan; Batches 1–4 landed). This doc is its **Batch 5**.
>
> Base for the inventory: `master` @ `39c61f5` (after Batch 4).
>
> **Completion status (updated):** Batch 5 is **functionally complete**. **5a** (requests/calendar/
> billing — #8), **5b** (`tareas/[id]` badges — #9), and **5c** (request + overdue hovers — #10) are
> **merged**. **5b-2 — `components/global-search.tsx` `estadoChromeColors` is intentionally DEFERRED**
> (see below) and does **not** block Batch 5 completion. Next phase: light-theme + visual QA — see
> [`theme-light-visual-qa-plan.md`](./theme-light-visual-qa-plan.md).
>
> ### Deferred — `global-search` `estadoChromeColors` (bespoke dark chrome)
> The command palette / global search is a **sensitive overlay surface**; the proposed token swap
> **visibly restyles** it (bright pastel text → mid-tone `--status-*-text`; `completado` sky→purple).
> Its current chrome (`bg-{c}-400/12 text-{c}-200/95 ring-white/[0.06]`) **remains as-is, on purpose**.
> Revisit during **command-palette polish / dark-flip QA / broader component QA** with a before/after
> visual diff. Not blocking.

---

## 1. Executive summary

The neutral debt is done (Batches 1–4). The remaining productive debt is **status color**. A
re-inspection found two things that make this **small and low-risk**, *if done right*:

1. **A mature status-token system already exists** and is **already adopted by most surfaces**.
   It is **dark + light aware** today.
2. The remaining **hardcoded** status debt is **5 surfaces** — not a sweep.

So Batch 5 is **token *adoption*, not a flat color swap, and not new tokens**. The one genuine
design decision is semantic (blue → the app's purple "info"), documented in §7.

---

## 2. The status token system (already exists — REUSE, don't invent)

Defined in `app/globals.css`. **Dark / Midnight** (`:root`, L137-150) + aliases (L362-365):

| Tone | `--status-*-bg` (dark) | `--status-*-text` (dark) | Alias |
| --- | --- | --- | --- |
| danger  | `rgba(232,111,116,0.14)` | `#E86F74` | `--danger` |
| warning | `rgba(242,198,109,0.18)` | `#D6A84A` | `--warning` |
| success | `rgba(143,198,162,0.16)` | `#6FAE87` | `--success` |
| info    | `var(--accent-soft)` (lavender) | `var(--accent-primary)` (**purple #8B5CFF**) | `--info` |
| accent  | `var(--accent-soft)` | `var(--accent-rich)` (deep purple) | — |
| neutral | `var(--surface-3)` | `var(--text-secondary-dark)` | — |
| notice  | `rgba(232,111,116,0.08)` | `#D4888C` | — |

**Light / Lavender Mist** (`[data-theme="lavender-mist"]`, L435-438) — comment: *"keep the soft
tint backgrounds, deepen text for contrast"*:

| Tone | Light `*-text` | Light `*-bg` |
| --- | --- | --- |
| danger  | **`#C2454A`** (override) | shared soft tint (by design) |
| warning | **`#B07D24`** (override) | shared soft tint (by design) |
| success | **`#3E8E5E`** (override) | shared soft tint (by design) |
| info / accent | cascades via `--accent-soft`→`#EFEAFF`, `--accent-primary`→`#9470FF` | cascades |
| neutral | cascades via `--text-secondary-light`→`#5A5470`, `--surface-3` | cascades |
| notice  | inherits dark (minor) | inherits dark (minor) |

**Conclusion:** the vocabulary is **complete and tone-aware**. Batch 5 maps the hardcoded surfaces
onto it. No new tokens are required for the first step. (Light `*-bg` tuning is a *possible*, QA-gated
follow-up — see §6 Batch 5c — **not** needed for 5a.)

### Reuse patterns to copy (already in the codebase)
- **Solid dots →** fill with the *text* tone: `bg-[var(--status-danger-text)]` etc.
  (`components/today/today-task-row.tsx` `priorityDotClass`, L348).
- **bg+text badges →** `bg-[var(--status-{tone}-bg)] text-[var(--status-{tone}-text)]`
  (`app/proyectos/[id]/page.tsx` `TAREA_ESTADO_STYLE`/`FACTURA_ESTADO_STYLE`, L41/L49).
- **Per-plane branch (only if a value can't be a token) →** `priorityDotClass(priority, tone)`
  (`components/today/today-quick-content.tsx`, L505) — the tone-aware model.

---

## 3. Inventory — status color by file

### A. Already TOKEN-driven — **leave quiet** (not debt)
`app/proyectos/[id]` (`STATUS_STYLE`, `TAREA_ESTADO_STYLE`, `FACTURA_ESTADO_STYLE`) ·
`app/clientes/[id]` (`STATUS_STYLE`, `PROJECT_STATUS_STYLE`, `FACTURA_ESTADO_STYLE`) ·
`app/facturacion/[id]` (`STATUS_CONFIG`, `ACTIVITY_TYPE_CONFIG`) · `app/tareas/page` (`statusConfig`,
`PRIORITY_ROW_BADGE`) · `components/today/today-task-row` (`priorityDot/ChipClass`) ·
`components/today/today-quick-content` (tone-aware) · `components/tasks/task-contextual-panel`
(`PRIORITY_BADGE`) · `app/contenido` (`ESTADO_COLOR`, `CAMPAIGN_ESTADO_COLOR`, `MARCA_COLOR`) ·
`components/content-list` · `components/content-calendar` · `components/project-tabs` ·
`components/client-tabs` · all `components/forte/*`. *(Some use `--tab-*` instead of `--status-*`;
that is a deliberate section-accent choice — leave.)*

### B. HARDCODED status debt — **Batch 5 targets** (5 surfaces)

| Symbol @ file:line | Entries (tone) | Shape | Notes |
| --- | --- | --- | --- |
| `STATUS_CONFIG` @ `app/requests/page.tsx:29` | OPEN `bg-blue-100/text-blue-700` (info) · IN_PROGRESS `amber-100/700` (warning) · DONE `green-100/700` (success) | badge | no dark variant |
| `PRIORITY_COLORS` @ `app/requests/page.tsx:35` | LOW `text-gray-500` (muted) · MEDIUM `text-amber-600` (warning) · HIGH `text-red-600` (danger) | text/dot | no dark variant |
| stat numbers @ `app/requests/page.tsx:86,92,98` | `text-blue/amber/green-600` (info/warning/success) | text | no dark variant |
| `priorityDot` @ `app/calendario/page.tsx:72` | urgente `bg-red-500` · alta `bg-orange-500` · media `bg-yellow-500` · baja `bg-green-500` · fallback `bg-gray-400` | **solid dot** | 4-level ramp (see §7) |
| overdue warning @ `app/calendario/page.tsx:~565` | `border-orange-500/20 bg-orange-500/5 text-orange-500/600` (overdue) | inline panel | overdue → danger/notice |
| `statusConfig` @ `components/client-billing-tab.tsx:172` | pagada `emerald-100/700` (success) · pendiente `amber-100/700` (warning) · vencida `red-100/700` (danger/overdue) | badge `{bg,text}` | no dark variant |
| `estadoBadge`/`prioridadBadge` @ `app/tareas/[id]/page.tsx:49,58` | en_progreso blue (info) · revision purple (accent) · completada emerald (success) · cancelada red (danger) · pendiente `bg-muted` (neutral); priorities red/orange/amber/muted | badge | **already dual-tone via `dark:` variants**, not tokens |
| `estadoChromeColors` @ `components/global-search.tsx:123` | activo emerald (success) · completada sky (info) · en_progreso amber (warning) · pendiente/baja `white/[0.07]` (muted) · pagada emerald (success) · vencida/cancelada/alta rose (danger) · media amber (warning) | badge + `ring` | bespoke dark chrome (`*-400/12`, ring) |

---

## 4. Classification by tone → existing token

| Tone | Maps to | Hardcoded occurrences (Batch 5) |
| --- | --- | --- |
| **info** | `--status-info-*` (purple accent) | requests OPEN + stat-blue; global-search `completada`; tareas/[id] `en_progreso` |
| **warning** | `--status-warning-*` | requests IN_PROGRESS/MEDIUM/stat-amber; calendario `media`(+`alta`); client-billing `pendiente`; global-search `en_progreso`/`media` |
| **success** | `--status-success-*` | requests DONE/stat-green; calendario `baja`; client-billing `pagada`; global-search `activo`/`pagada` |
| **danger** | `--status-danger-*` | requests HIGH; calendario `urgente`; client-billing `vencida`; global-search `vencida`/`cancelada`/`alta` |
| **muted / low** | `--status-neutral-*` or `text-muted-foreground` | requests LOW; calendario `bg-gray-400` fallback; global-search `pendiente`/`baja` |
| **priority** (urgent/high/medium/low) | danger / warning / (info\|warning) / (success\|neutral) — see §7 | calendario `priorityDot`; requests `PRIORITY_COLORS` |
| **overdue** | `--status-danger-*` (or `--status-notice-*`) | calendario overdue panel; client-billing/facturacion `vencida` |
| **active / current** | `--accent-*` / already neutralized | filter "active" chips (already migrated in Batch 4) |
| **neutral** | `--status-neutral-*` / shadcn `bg-muted` | tareas/[id] `pendiente`/`cancelada`; global-search `pendiente` |

---

## 5. Migration risks

1. **blue → purple "info" (semantic, visible).** `--status-info-*` is the app's **purple** accent.
   Adopting it turns requests' blue "Open" badge, blue stat number, and global-search `completada`
   (sky) **purple**. This is *consistent with the rest of the app* (every token-driven surface
   already treats info = purple), but it is a real hue change. **Decision in §7.**
2. **Dots need a solid tone, not the translucent `*-bg`.** Use `bg-[var(--status-{tone}-text)]`
   (the `today-task-row` pattern) for `priorityDot`, not `*-bg` (which is a faint tint).
3. **4-level priority ramp doesn't map 1:1.** calendario's urgente/alta/media/baja (red→green) has
   more steps than danger/warning/(…)/success. Collapsing them onto tokens loses the yellow step —
   a documented mapping choice (§7), not an automatic swap.
4. **`estadoChromeColors` is bespoke dark chrome** (`*-400/12` + `ring-white/[0.06]`), tuned for the
   global-search overlay. Converting it to tokens must preserve the chrome look → defer to **5b**,
   handle per-entry.
5. **`tareas/[id]` already dual-tones via `dark:` variants.** It is *not* broken on either plane; the
   only win is token consistency. Lower priority → **5b**, and a "tokens vs keep `dark:`" call.
6. **Light `*-bg` contrast.** The light plane shares the dark soft-tint bgs by design. Whether they
   read on Lavender Mist is a **QA item for the dark flip**, addressed in **5c only if proven** —
   never blindly. No globals.css change in 5a.

---

## 6. Recommended Batch 5 split (small & safe)

### Batch 5a — adopt existing tokens in the 3 cleanest maps *(do first)*
- **Files:** `app/requests/page.tsx` (`STATUS_CONFIG`, `PRIORITY_COLORS`, stat numbers) ·
  `app/calendario/page.tsx` (`priorityDot` + `bg-gray-400` fallback; **not** the overdue panel
  unless trivial) · `components/client-billing-tab.tsx` (`statusConfig`).
- **How:** badges → `bg/text` token pairs; dots → solid `--status-*-text` fill; muted → neutral.
- **No `globals.css` change** (tokens already exist & are dark-proven). ~3 files.
- **Gate:** confirm the §7 blue→info decision first.
- **Commit:** `refactor(theme): adopt status tokens in requests, calendar, billing badges`.

### Batch 5b — bespoke / dual-tone surfaces *(later)*
- `components/global-search.tsx` `estadoChromeColors` (preserve chrome) · `app/tareas/[id]/page.tsx`
  `estadoBadge`/`prioridadBadge` (`dark:` → tokens, or keep). Per-entry judgment.
- **Commit:** `refactor(theme): tokenize global-search + task-detail status chrome`.

### Batch 5c — light-plane `*-bg` tuning *(separate; globals.css; dark-flip-gated)*
- **Only if** Lavender-Mist QA shows the shared soft-tint `danger/warning/success/neutral/notice`
  bgs are too pale on light → add light `*-bg` overrides. Touches `app/globals.css` → its own PR.
- **Commit:** `refactor(theme): tune status backgrounds for light theme` *(conditional)*.

---

## 7. Open decision (confirm before 5a)

**Unify blue → the app's purple `--status-info`?** — **Recommended: YES.** Every token-driven
surface already uses `--status-info` (purple) for info/in-progress states; requests' blue and
global-search's sky are the only hold-outs. Unifying removes the one-off and is theme-correct on
both planes. Kept **visible here as a decision** because it is a real hue change — if instead a
distinct blue "info" is wanted product-wide, that needs a *new* `--status-blue-*` token (a brand
choice), which is out of scope for Batch 5a.

**Priority ramp mapping (calendario `priorityDot`):** recommended `urgente→danger`, `alta→warning`,
`media→warning` (or `info`), `baja→neutral` (or `success`), `fallback→neutral`. Confirm in 5a.

---

## 8. What NOT to touch
All §3-A already-tokenized status surfaces · `app/globals.css` (no change in 5a/5b; only the
conditional 5c) · `@theme inline` · Lavender Mist values (read-only until the flip) · `--tab-*`
section accents · `app/cliente/**` (client portal special-case) · legacy
(`assistant`/`agente`/`comunicacion`/`entrada`/`motor`) · Home/Overview · Beauty Overview · System ·
Admin · widget/chat · backend/API/Prisma/auth · routes/nav · no dark flip.
