"use client"

import { Sun } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Floating bottom launcher for the global Today drawer.
 *
 * MOBILE-ONLY since the "Today first-class" PR — desktop has a dedicated
 * top-toolbar trigger (`GlobalTodayTriggerDesktop`, hermano visual de
 * New) that owns the primary affordance. The launcher is hidden on
 * `md+` via the **CSS class `md:hidden` baked into the wrapper**, not
 * via JS / hydration logic, so it stays invisible from the very first
 * paint regardless of how `useIsMobile()` resolves. This avoids the
 * "two Today buttons on desktop" bug observed in production.
 *
 * The launcher remains useful on mobile as a thumb-reachable secondary
 * affordance below the mobile header trigger; retiring it on mobile is
 * a future follow-up once the header trigger is the only path users
 * reach for.
 *
 * Positioning (mobile only — desktop classes are kept dead-but-harmless
 * in case the launcher is ever re-enabled on `md+`):
 *   - Anchored to the BOTTOM-CENTER of the viewport via
 *     `left-1/2 -translate-x-1/2`. Mobile has the sidebar as a sheet
 *     drawer, so viewport-center is correct.
 *   - `mb-[env(safe-area-inset-bottom)]` keeps clear of iOS home-indicator
 *     chrome on mobile.
 *   - `z-40` sits BELOW any modal/dialog overlay (vaul drawers, alert
 *     dialogs use `z-50`), so the launcher hides naturally when the
 *     mobile drawer takes over.
 *
 * Not shown on the full `/today` page even on mobile (the parent
 * decides via the `hidden` prop). Operators already see the entire
 * Today there; floating their own launcher on top of the canonical
 * surface would be confusing.
 */
export function TodayBottomLauncher({
  onOpen,
  hidden = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sidebarCollapsed: _sidebarCollapsed = false,
}: {
  onOpen: () => void
  hidden?: boolean
  /**
   * Kept in the prop type for backwards compatibility with the previous
   * desktop launcher (which used the value to pick a `md:left-*` offset
   * clearing the sidebar). Now unused — the launcher is `md:hidden` so
   * the desktop offset math is dead. Removing the prop entirely would be
   * a wider API churn, so we accept and ignore it.
   */
  sidebarCollapsed?: boolean
}) {
  if (hidden) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open Today overview"
      title="Open Today overview"
      className={cn(
        /**
         * Mobile baseline: viewport-centered bottom pill. `left-1/2`
         * positions the button's LEFT edge at the viewport center, and
         * `-translate-x-1/2` shifts it back by half the button's own
         * width so the BUTTON's center lands on the viewport center.
         */
        "group fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full",
        "border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2",
        "text-xs font-semibold text-[var(--text-primary-light)] shadow-lg",
        "transition-all duration-200",
        "hover:border-[var(--accent-primary)]/40 hover:bg-[var(--app-surface-dark)] hover:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.4)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
        /**
         * Desktop hide — CSS-only.
         *
         * Today on desktop is owned by the top toolbar trigger
         * (`GlobalTodayTriggerDesktop`). The floating launcher must
         * NOT appear on `md+` so we never show two competing entry
         * points. We use `md:hidden` on the button itself so the
         * hide is independent of `useIsMobile()` hydration timing —
         * if the JS gate in `GlobalTodayChrome` ever drifts or a
         * legacy mounter forgets to wire it, this CSS layer still
         * keeps the launcher off desktop.
         */
        "md:hidden",
        "mb-[env(safe-area-inset-bottom)]",
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] transition-colors group-hover:bg-[var(--accent-primary)]/25"
      >
        <Sun size={12} strokeWidth={2} />
      </span>
      <span className="leading-none">Today</span>
    </button>
  )
}
