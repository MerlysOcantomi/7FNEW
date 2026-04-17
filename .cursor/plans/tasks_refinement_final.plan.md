# Tasks refinement — final plan (Phase A only)

**Status:** Definition only — no implementation in this document.  
**Scope:** [`app/tareas/page.tsx`](app/tareas/page.tsx) and supporting UI that serves this page; [`app/tareas/[id]/page.tsx`](app/tareas/[id]/page.tsx) as the canonical full-detail surface.  
**Direction:** Lightweight execution hub — faster and more tactical than Projects — **not** a simple list, **not** an AI-heavy hub yet.

**Ordering principle:** hygiene → visual/control consistency → **right panel architecture (early)** → lightweight execution → optional intelligence last.

---

## Priority 1 — Functional hygiene first

**Goal:** The list page reflects real behavior; no dead code or hidden behavior.

| Item | Action |
|------|--------|
| Dead imports/state | Remove or wire: `TareaForm`, `ConfirmModal`, `CanEdit`, `CanDelete`, `MoreHorizontal`, `Pencil`, `Trash2`, `Plus`, `formOpen`, `editingItem`, `deleteItem`, `handleDelete` — either connect “New / Edit / Delete from list” to product requirements **or** delete until Phase A scope explicitly includes them. |
| Sort order | **`sortBy` exists but has no UI** — add visible control (e.g. due date vs priority) **or** remove state and keep a single documented default. |
| API vs filters | Confirm search/filter query params match backend; document any limits (pagination if added later). |
| Grid breakpoints | Align `lg:col-span-*` vs `xl:grid-cols-5` naming — one breakpoint story for “when does split appear?” |

**Exit criteria:** No unused handlers; sorting behavior is user-visible or intentionally fixed; layout breakpoints are consistent on paper.

---

## Priority 2 — Visual hierarchy and control consistency

**Goal:** Tasks reads as the reference core page: clear tiers of information, controls that match the design system.

| Item | Action |
|------|--------|
| Status / priority styling | Replace ad hoc mixes (`text-chart-*`, `--tab-review` / `--tab-tasks` / `--tab-info` for priorities) with a **single vocabulary** aligned to shared tokens (`--status-*`, badge patterns used elsewhere) unless a Tasks-specific scale is deliberately defined and documented. |
| Filters | Replace or skin native `<select>` for priority/client with **the same control family** as the rest of the shell (e.g. `Select` / dropdown primitives from `@/components/ui`) so Tasks doesn’t look like a different product. |
| Stats row | Keep four KPIs but clarify **visual tier** (e.g. one primary signal vs three secondary) so the eye lands on “what matters today” — without adding new metrics yet. |
| Section shell | [`SectionPage`](components/section-page.tsx) title/description: tune copy to **execution hub** positioning if needed; keep single H1 + description pattern. |

**Exit criteria:** Token/control consistency documented; no unexplained parallel color systems on one page.

---

## Priority 3 — Decision and definition of the right-side contextual panel (early architecture)

**Goal:** Treat the contextual panel as a **first-class architectural decision** before polishing execution features.

### 3.1 What it is

- A **task-scoped contextual surface** for the **selected task** — not [`CopilotPanel`](components/copilot-panel.tsx) (global chat + generic chips), not a floating generic assistant.
- **Primary stack:** details + actions first; room for lightweight “contextual intelligence” only after Priorities 1–4 are stable.

### 3.2 Information split: list row vs side panel

| **List row (scannable, dense)** | **Side panel (selected task only)** |
|----------------------------------|-------------------------------------|
| Title | Full title repeat OK if it anchors context |
| Status icon + **one** status signal | Full status + priority badges, secondary metadata |
| Priority pill (compact) | Expanded priority / due emphasis if needed |
| One line of **meta chips**: project name, client, assignee, due (abbreviated) | **Structured fields:** project, client, owner, due (full formatting) |
| Chevron / selection affordance | **Description** (truncated in row if ever added; full in panel) |
| — | **Primary actions:** open full page, quick state transition / assign **if** API supports |
| — | **Secondary:** links to project/client; optional “signals” strip later |

**Rule:** Rows optimize for **scan + pick**; panel optimizes for **orient + act** without duplicating the entire [`/tareas/[id]`](app/tareas/[id]/page.tsx) page.

### 3.3 Desktop / wide layout

- Keep **master-detail** inside content width (current `xl` split is acceptable) **or** evolve to a **dedicated right column** with explicit min-width and collapse — decision in implementation spec: **sticky contextual column** vs **inline panel** only; both are valid if documented.
- Panel should respect **details + actions first** vertical order; intelligence block (when added) sits **below** actions.

### 3.4 Mobile and below-xl behavior (must be explicit)

| Viewport | Behavior |
|----------|----------|
| **`>= xl` (split threshold)** | Two columns: list + contextual panel when a task is selected; empty state when none selected (list full width or gentle empty hint). |
| **`< xl` (tablet / small laptop)** | **No persistent side column.** On row tap: either **(A)** navigate to [`/tareas/[id]`](app/tareas/[id]/page.tsx), or **(B)** open a **modal / drawer (recommended: bottom sheet or right drawer)** with the **same panel content** as desktop (single source of component). Pick one pattern and use it consistently. |
| **Mobile** | Prefer **drawer or full-height sheet** for selected-task context + primary actions; list remains primary; avoid shrinking list to a sliver beside a panel. |

**Exit criteria:** Written spec for breakpoint + mobile pattern; panel content as a **single composable** reused on desktop column and mobile overlay.

---

## Priority 4 — Lightweight execution improvements

**Goal:** Tactical speed — still not an AI product.

| Item | Action |
|------|--------|
| Deep link | Prominent **Open full task** → `/tareas/[id]` from panel (and row affordance where appropriate). |
| Quick actions | Minimal set aligned with API: e.g. complete / change status / assign — **only where endpoints exist**; no fake workflows. |
| Ordering | User-visible sort (due vs priority) per Priority 1. |
| Create task | If product requires “New task” from hub, add entry point + form flow; otherwise defer explicitly. |

**Exit criteria:** User can complete the core loop: find → inspect in panel → act or open full detail — without relying on AI.

---

## Priority 5 — Optional contextual intelligence (later)

**Goal:** Second-class module — **after** Priorities 1–4.

Examples (non-binding): overdue explanation, conflict hints, “blocked by” if data exists — **not** open-ended chat by default.

**Placement:** Bottom of contextual panel or collapsible “Insights” — never above primary actions.

**Exit criteria:** Only shipped when execution hub is stable and panel contract is clear.

---

## Definition of done (Tasks as reference page)

1. Hygiene complete; no mystery state.
2. Visual and control vocabulary matches the intended 7F core standard.
3. Contextual panel architecture **decided and implemented** with documented row vs panel split and **mobile/below-xl** behavior.
4. Lightweight execution loop works without intelligence features.
5. Intelligence optional and clearly subordinate.

---

## Explicit non-goals (Phase A)

- Migrating Overview, Clients, Projects, Invoices, Finance.
- Porting old **CopilotPanel** into Tasks as-is.
- Building a **global chat** in the task panel.

---

## Suggested implementation order (when execution starts)

1. Priority 1  
2. Priority 2  
3. Priority 3 (panel component contract + responsive shell)  
4. Priority 4  
5. Priority 5 (optional)
