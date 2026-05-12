/**
 * Shared types for the Global Workspace Panel layer.
 *
 * Status as of the Today bottom-chrome PR:
 *   Today no longer renders through `WorkspacePanelSurface` /
 *   `WorkspacePanelBackdrop`. The desktop Today quick view is now
 *   an INLINE shell chrome (see
 *   `components/today/today-desktop-bottom-chrome.tsx`) that mirrors
 *   `GlobalNewDesktopChrome` architecturally — no portal, no scrim,
 *   no scroll lock, no focus trap. That change made Today feel like
 *   part of the workspace shell rather than a modal layered on top.
 *
 *   These types and their consumers
 *   (`WorkspacePanelSurface` / `WorkspacePanelBackdrop`) are kept in
 *   the repo because they remain the right shape for FUTURE
 *   workspace-panel needs that DO want a true floating panel:
 *
 *     - Side rails (`anchor: "left" | "right"`) for a future
 *       side-by-side mode (Today rail + New rail), where the surface
 *       genuinely overlays the workspace from an edge.
 *     - Notification / activity peek surfaces that need focus-trap
 *       and Escape-to-close semantics.
 *     - Any future modal-feeling micro-panel that isn't a Dialog
 *       (e.g. a quick command palette anchored at a specific
 *       position).
 *
 *   `anchor: "bottom-center"` was the original Today consumer; that
 *   value remains valid for non-Today use cases (e.g. a transient
 *   bottom-center toast peek). Today itself moved off it in favour
 *   of the bottom chrome.
 *
 * Keep this file framework-agnostic: NO React imports, NO Radix
 * imports, NO Next imports. The types must be usable from server-only
 * helpers too.
 */

/**
 * Where a panel surface anchors itself inside the workspace area.
 *
 * - `bottom-center` — current Today Inlay; future Stack mode's lower half.
 * - `top-center`    — future Stack mode's upper half (New).
 * - `left`          — future Side-by-side: Today rail.
 * - `right`         — future Side-by-side: New rail.
 * - `center`        — escape hatch for true-modal contexts. Not used yet.
 *
 * NB: the anchor is INSIDE the workspace content area, not the raw
 * viewport. The surface component adjusts its horizontal centering
 * using the active sidebar width so the panel always reads as
 * "centered in what the operator sees as the workspace."
 */
export type PanelAnchor =
  | "bottom-center"
  | "top-center"
  | "left"
  | "right"
  | "center"

/**
 * Clamped sizing for a panel surface. Both dimensions accept either a
 * concrete CSS length (`"760px"`, `"60vh"`, `"min(900px,92vw)"`) or
 * a numeric value (interpreted as pixels). The surface component
 * resolves these into the final `min-width` / `max-width` /
 * `min-height` / `max-height` style.
 */
export interface PanelSize {
  minWidth?: number | string
  maxWidth?: number | string
  minHeight?: number | string
  maxHeight?: number | string
}

/**
 * Visual tone for a panel. Mirrors the existing Global New tone split
 * so any future shared coordinator can re-use the same vocabulary.
 *
 *   - `canvas` — dark app-shell tokens (matches AppShell).
 *   - `light`  — F8FAFC surface (matches ContextShell).
 *
 * For Today Inlay we use `canvas` only because the inlay's surface is
 * dark across both shells (matches the current drawer styling).
 */
export type PanelTone = "canvas" | "light"

/**
 * Snapshot of the active sidebar's width, supplied by the surrounding
 * shell. Used by the surface component to compute horizontal centering
 * inside the workspace area (rather than the full viewport).
 *
 * Values are the actual rendered widths in pixels, NOT abstract
 * "collapsed/expanded" booleans, so the surface stays decoupled from
 * the SidebarNav variant taxonomy and can support future widths
 * without a code change.
 *
 *   - `desktopPx` — sidebar width at `md+` breakpoints. The surface
 *                   uses `calc(50% + desktopPx/2)` as the centering
 *                   anchor.
 *   - `mobilePx`  — sidebar width at mobile widths. Usually `0`
 *                   because the sidebar is a sheet on mobile. The
 *                   Today inlay does not render on mobile so this
 *                   field is effectively unused today, but it's part
 *                   of the contract so PR 2's side rails can use it.
 */
export interface PanelLeftOffset {
  desktopPx: number
  mobilePx: number
}
