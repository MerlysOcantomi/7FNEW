# Smart Inbox — Experience levels (Simple / Standard / Advanced)

> Status: **pure layer + non-persisted URL preview** (INBOX-UX-SAFE-01, 2026-09-11).
> The preview (`?experience=`) is available to any authenticated operator on any
> workspace and is NOT environment-gated; it changes only what renders, never
> what the server allows, and nothing is stored. No level is resolved per
> workspace/vertical and no workspace is activated by default. Companion plan:
> mission 7F-INBOX-UX-01 (owner's plan file).

## What exists

| Piece | File | Notes |
|---|---|---|
| Level vocabulary | `core/inbox/experience-config.ts` | `InboxExperienceLevel = "simple" \| "standard" \| "advanced"`; `parseInboxExperienceLevel` (closed union, never throws) |
| Declarative UI policies | same | `INBOX_EXPERIENCE_DEFINITIONS[level].ui` — visibility/order decisions only (`maxPrimaryFilters`, `primaryFilterIds`, `primaryFilterGroups`, `channelPresentation`, `showAssignment`, `showAdvancedFilters`, `showTaxonomies`, `showLayoutSwitcher`, `showContextOperationalSections`, `showActiveFilterTokens`) |
| Chip-row shaping | same | `shapeInboxPrimaryFilterViews(effectiveViews, policy)` — subset/order of the EFFECTIVE registry views; never introduces an id the workspace did not enable; `all` always first |
| Layout-mode guard | same | `resolveEffectiveInboxLayoutMode` — levels without the switcher pin `reading` |
| Active-filter tokens | `components/inbox/inbox-active-filters.tsx` | Every active dimension visible and removable + "clear all". Renders nothing when empty |
| Toolbar hook | `components/inbox/inbox-toolbar.tsx` | `showAdvancedFilters` prop (default `true` = today) |
| Preview wiring | `app/inbox/page.tsx` | `?experience=simple\|standard\|advanced` — **non-persisted, visibility-only**, any signed-in operator, not environment-gated |
| Tests | `core/inbox/experience-config.test.ts` | compatibility (no level = identity), invalid input, Beauty/core shaping, caps, layout guard |

## Invariants

- **No effective experience → the current UI, byte for byte.** `null` policy is the
  default and every consumer treats it as "render exactly what you rendered before".
- A level can only **hide or reorder** what the registries already allow; it never
  adds capabilities and never grants access (server gates unchanged).
- `advanced` is an explicit selection, not an alias of the current UI.
- Hidden chips remain resolvable through the URL (`resolveActiveUrlFilter`), and the
  tokens row keeps them visible/removable.
- No "unread" filter: the registry has none; the layer does not invent semantics.
- `showAssignment` and `showContextOperationalSections` are declared but not yet
  consumed (composer / context-panel wiring is a later, separate step).

## What each level shows (initial, conservative)

| | Simple | Standard | Advanced |
|---|---|---|---|
| Primary chips | All · Needs attention · No reply (≤4) | effective primary row minus channel chips (≤6) | effective primary row as-is |
| Channels | picker only | picker only | picker + `channel:*` chips when promoted |
| More filters (priority / assignment / status) | hidden | shown | shown |
| Category chips | hidden | shown | shown |
| Layout switcher | hidden (reading pinned) | hidden (reading pinned) | shown |
| Active-filter tokens | shown | shown | shown |

## Deliberately NOT done here (POST-NEON)

- Persisting the level (`Workspace.config.inbox.experience`) and its admin write endpoint.
- Resolving the level per workspace / vertical (pack gate for Finesse, `resolveWorkspaceExperience`).
- Delivering the level through `GET /api/inbox/channels` or the workspace summary.
- Host / standalone product resolution and the Inbox Overview decision.
- Composer and context-panel shaping; sidebar focused-mode shaping.
- OLÓJÚ as a second consumer.
