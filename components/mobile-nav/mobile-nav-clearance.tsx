/**
 * Trailing spacer that keeps the last piece of content above the vertical
 * mobile bottom bar (FINESSE-UI-02). Rendered by the shells as the LAST child
 * of their content column — a real in-flow box, so it always extends the
 * scroll even when the column itself shrinks (`min-h-0`) below its content.
 * Height = bar height + device safe-area; hidden from `md` up (no bar there).
 */
export function MobileNavClearance() {
  return (
    <div
      aria-hidden="true"
      data-mobile-nav-spacer
      className="shrink-0 md:hidden"
      style={{ height: "calc(var(--app-mobile-nav-height) + env(safe-area-inset-bottom, 0px))" }}
    />
  )
}
