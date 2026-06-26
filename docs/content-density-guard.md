# 7F — Content Density Guard (preview lists & clamped text)

**Status:** authoritative rule for authenticated workspace UI.
**Grounding:** [`components/ui/preview-list.tsx`](../components/ui/preview-list.tsx), [`components/ui/expandable-text.tsx`](../components/ui/expandable-text.tsx).
**Companion:** [`docs/app-shell-contract.md`](./app-shell-contract.md) (the shell already prevents the *page* from growing; this rule prevents *sections* from growing).

---

## 1. The rule

Every list-heavy or long-text section **shows a useful preview first, then offers
a clear, contextual way to see the full content.** Cards, panels and internal
sections must never grow endlessly because a list or a description is long.

7F should feel **spacious, controlled and premium**: the most important
information is always visible first, without the UI becoming crowded or forcing
the surface to grow.

### Default preview budgets

| Surface | Show first | Then |
| --- | --- | --- |
| Generic list / section | 3–5 items | "View all" |
| Task sections | top 3–5 tasks | "View all tasks" |
| Risks | top risks | "View all risks" |
| Calendar cell | 2–4 event chips | "+N more" |
| Text / description | 2–4 lines | "Read more" |
| Activity / history log | latest 4–6 | "View full history" |
| 7F Intelligence Panel | main insight + action + a few linked items | "Open full context" |

## 2. Critical-risk exception (non-negotiable)

**Never hide a critical risk completely.** If a high-risk item exists it must
either (a) appear in the preview, or (b) be represented by a **visible alert
count** in the affordance (e.g. `View all risks (3)`).

`PreviewList` enforces (a) via `isPinned` (pinned rows always render in the
preview) and always surfaces the hidden count for (b).

## 3. Contextual labels (vary the wording)

Do **not** always write "View all". Match the affordance to the content:

`View all` · `View all tasks` · `View all risks` · `View full agenda` ·
`Show more` · `Read more` · `+N more` · `Open full context` · `View history`

## 4. Primitives

### `PreviewList<T>` — list-heavy sections

```tsx
<PreviewList
  items={tasks}
  previewCount={4}
  isPinned={(t) => isOverdue(t) || t.priority === "high"}   // critical always shows
  getKey={(t) => t.id}
  variant="link"                 // "expand" (inline) | "link" (href) | "action" (onMore)
  href="/tareas"
  moreLabel={(n) => `View all tasks (${n})`}
  listClassName="flex flex-col gap-2"
  renderItem={(t) => <TaskRow task={t} />}
/>
```

- `variant="expand"` toggles the full list inline (`Show less` to collapse).
- `variant="link"` points at the canonical full view.
- `variant="action"` runs a callback (switch a lens, open a panel).
- The footer always shows the hidden count; `isPinned` keeps critical rows visible.

### `ExpandableText` — long copy

```tsx
<ExpandableText lines={4} moreLabel="Read more">{description}</ExpandableText>
```

- Clamps to `lines` (1–6) via `line-clamp-*`; the toggle appears **only when the
  text actually overflows** (no toggle on short copy).

## 5. Where to apply

Adopt incrementally — reuse the primitives above, never re-implement per surface:

- **Tasks / Work Queue** — `All Work` swimlanes preview the top few and link to
  the focused lens; the detail panel clamps the description. *(Reference usage —
  already wired.)*
- **Today** — section lists (attention, due, no-date) preview + "View all".
- **Calendar** — cells cap chips at 2–4 + `+N more`.
- **Risks & delays** — preview top risks, pin overdue/blocked, surface the count.
- **Activity timeline / history** — latest 4–6 + "View full history".
- **7F Intelligence Panel** — main insight + action + a few links, then
  "Open full context".

## 6. Anti-patterns

- ❌ Rendering an unbounded `.map()` of every row inside a card/panel.
- ❌ A wall of full-length descriptions with no clamp.
- ❌ Hiding a high-risk row behind "View all" with no count.
- ❌ Always-identical "View all" wording regardless of content.
