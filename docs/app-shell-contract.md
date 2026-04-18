# 7F — App shell contract (viewport, scroll, layout)

**Status:** authoritative rule for authenticated workspace UI.  
**Grounding:** [`components/app-shell.tsx`](../components/app-shell.tsx), [`components/context-shell.tsx`](../components/context-shell.tsx), [`components/sidebar-nav.tsx`](../components/sidebar-nav.tsx).

---

## 1. Core contract

### 1.1 Viewport

- The authenticated shell **occupies the visible viewport** as a single frame.
- Implementation pattern (canonical today): root container **`fixed inset-0`** (or equivalent: **`h-dvh min-h-0 overflow-hidden`** on a full-viewport wrapper) so height is **definite** for flex children.
- **Do not** rely on unbounded document growth as the primary layout mechanism for core product pages.

### 1.2 Sidebar

- **Fixed width**, **`shrink-0`**, aligned with the shell height (flex stretch or explicit `h-full` when the parent is bounded).
- **Independent vertical scroll only inside the sidebar** when navigation content exceeds viewport ([`SidebarNav`](../components/sidebar-nav.tsx): `aside` uses `overflow-y-auto`).
- Sidebar scroll is **not** a substitute for main content scroll.

### 1.3 Main content

- **`main`** is the **default primary vertical scroll container** for route content.
- Canonical classes (match [`AppShell`](../components/app-shell.tsx)):  
  **`flex flex-1 min-h-0 min-w-0 max-h-full flex-col overflow-y-auto overflow-x-hidden`** (optional: `overscroll-y-contain`).
- Page content lives **inside** this scrollport (padding + max-width wrappers are fine).

### 1.4 Document / body scroll

- **Rule:** For core authenticated routes, **do not** depend on **`document` / `body` scroll** as the main way to reach content below the fold.
- Exception categories are listed in §2.

---

## 2. Allowed exceptions

| Exception | When | Scroll model |
|-----------|------|----------------|
| **Split-view** (e.g. Inbox) | Multiple persistent columns | Shell `main` may be **`overflow-hidden`** + **`min-h-0`**; each column gets **`flex-1 min-h-0 overflow-y-auto`** as needed. Requires a correct **`min-h-0` chain** from shell → row → column. |
| **Chat-style** (e.g. Assistant) | Conversation + optional side panel | Outer **`main`** often **`overflow-hidden`**; **message list** and **composer** use **nested** `overflow-y-auto` / flex column with **`min-h-0`**. |
| **Tables / long panels** | Large grids or detail panels | **Internal scroll** on the table body or panel (`overflow-auto` / `overflow-y-auto`) with parents **`min-h-0`** so height is bounded. |

Sticky headers inside these regions must sit **inside** the element that scrolls for that region.

---

## 3. Standard patterns (enforceable)

### 3.1 Shell height

- Prefer **`fixed inset-0`** + **`flex`** + **`min-h-0`** + **`overflow-hidden`** on the shell root (see [`AppShell`](../components/app-shell.tsx)).
- **`min-h-screen`** alone as the shell root for core pages is **discouraged** — it does not lock the shell to the viewport the same way and can combine poorly with **`sticky`** / **`h-screen`** sidebar.

### 3.2 Primary scroll (`main`)

- **`flex-1 min-h-0 max-h-full`** so the column participates in flex layout without expanding past the shell.
- **`overflow-y-auto`** on **`main`** for the default single-column experience.

### 3.3 Sticky headers

- Must be **descendants of the scrolling element** (typically **`main`**), e.g. **`sticky top-0`** toolbar block **inside** [`AppShell`](../components/app-shell.tsx)’s **`main`**.

### 3.4 Nested scroll / flex chain

- Any nested scroll area: **`min-h-0`** on each flex ancestor between the shell and the **`overflow-*`** node.

---

## 4. Layout families in this codebase

| Family | Where | Scroll / viewport notes |
|--------|--------|-------------------------|
| **AppShell** | [`components/app-shell.tsx`](../components/app-shell.tsx) | **`fixed inset-0`**, **`main overflow-y-auto`**, **`max-h-full`**, sticky chrome inside **`main`**. **Reference implementation** of this contract. |
| **ContextShell** | [`components/context-shell.tsx`](../components/context-shell.tsx) | Root **`min-h-screen`** (not viewport-locked like AppShell); **`main overflow-y-auto`**; includes **Copilot** column. **Misaligned** with §1.1 / §3.1 until refactored. |
| **Manual legacy** | e.g. [`app/page.tsx`](../app/page.tsx), [`app/proyectos/page.tsx`](../app/proyectos/page.tsx), [`app/clientes/page.tsx`](../app/clientes/page.tsx), [`app/finanzas/page.tsx`](../app/finanzas/page.tsx), [`app/agente/page.tsx`](../app/agente/page.tsx) | Repeated pattern: **`min-h-screen`**, **`main overflow-y-auto`**, **Copilot** sibling — **no** shared **`fixed`** shell with AppShell. **Violates** single viewport contract. |
| **Inbox** | [`app/inbox/page.tsx`](../app/inbox/page.tsx) under AppShell | **Split-view**: **`h-full min-h-0 overflow-hidden`** + multiple internal **`overflow-y-auto`**. Valid **exception** if height chain from AppShell **`main`** is preserved. |
| **Assistant** | [`app/assistant/page.tsx`](../app/assistant/page.tsx) | **Chat exception**: **`main`** **`h-screen overflow-hidden`**, inner regions scroll. Should still align outer wrapper with §1.1 when unified. |

---

## 5. Violations vs this contract

| Component / area | Violation | Why |
|------------------|-----------|-----|
| **ContextShell** | `min-h-screen` root | Document can grow; shell is not strictly viewport-bounded like AppShell. |
| **Legacy manual layouts** | `min-h-screen` + manual sidebar/main/copilot | Same; inconsistent with **`fixed inset-0`** model; risk of “frame” vs content mismatch. |
| **ContextShell / legacy + Copilot** | Third column + scrollable `main` without shared bounded root | Copilot (`h-screen sticky` in [`copilot-panel.tsx`](../components/copilot-panel.tsx)) vs **`main`** align only if outer flex row has a **defined height** — legacy **`min-h-screen`** is weaker than AppShell’s **fixed** shell. |

**Does not violate by design:** AppShell routes with a single **`main`** scroll; Inbox-style splits if **`min-h-0`** chain is correct.

---

## 6. Unification strategy

1. **Single geometric base:** All authenticated “workspace” routes should share the **same viewport lock** as [`AppShell`](../components/app-shell.tsx) (**`fixed inset-0`** + **`overflow-hidden`** + **`min-h-0`** flex row).

2. **AppShell as the default base** for routes that today duplicate `SidebarNav` + `MobileSidebarNav` + `main` manually.

3. **WorkspaceShell (recommended optional wrapper):**  
   **AppShell geometry + optional `rightSlot`** (e.g. `<CopilotPanel />`) so Overview / Clients / Projects / Finance / Agent **stop reimplementing** the outer layout. Either:
   - extend **AppShell** with an optional prop `rightPanel?: ReactNode`, or  
   - a thin **`WorkspaceShell`** component that composes the same divs as AppShell + slot.

4. **ContextShell alignment:** Refactor to use the **same root viewport + flex row** as AppShell (dark/light theme can remain a separate concern). **Sticky** headers and **`main`** scroll must follow §3.

---

## 7. Migration priorities

### Phase A — Global / structural (first)

1. Document this contract (this file + pointer in [`AGENTS.md`](../AGENTS.md) or `.cursor/rules`).
2. Align **ContextShell** root + **main** to AppShell’s viewport model.
3. Introduce **WorkspaceShell** (or extend AppShell) and migrate **one** high-traffic legacy page to validate Copilot + scroll.

### Phase B — Page-by-page (later)

- Migrate remaining manual pages (Overview, Clients list, Projects list, Finance, Agent) to the unified shell.
- Re-verify **Inbox** split-view and **Assistant** chat after Phase A (height chain).

---

## 8. Cursor / agent rule (short)

Authenticated workspace pages MUST:

1. Use a **viewport-bounded** shell (**`fixed inset-0`** or equivalent **`h-dvh` + `overflow-hidden`** root), not **`min-h-screen`** as the only height constraint.
2. Use **`main`** as the **primary vertical scroll** surface unless the route is an approved **split-view** or **chat** pattern (§2).
3. Place **sticky** headers **inside** the scrolling **`main`** (or inside the approved nested scrollport).
4. Preserve **`min-h-0`** on flex ancestors above any **`overflow-y-auto` / `overflow-auto`** child.

Do **not** add new **ad-hoc** `min-h-screen` root layouts for core routes; extend **AppShell** / **WorkspaceShell** / **ContextShell** instead.

---

*Last aligned with codebase: AppShell `fixed inset-0`, main `overflow-y-auto max-h-full min-h-0`; ContextShell `min-h-screen` + main `overflow-y-auto`.*
