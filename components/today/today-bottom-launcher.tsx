"use client"

import { Sun } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Floating bottom launcher for the global Today drawer.
 *
 * Visible on every authenticated route (mounted at the AppShell root). The
 * launcher is `position: fixed` and lives in its own stacking context, so it
 * never affects the layout of the underlying page — the Inbox three-column
 * grid, the Today full page, and any other layout pass renders identically
 * regardless of whether the launcher is on screen.
 *
 * Positioning:
 *   - Anchored to the BOTTOM-CENTER of the workspace (main content) area,
 *     not the raw viewport: on desktop we shift by half the sidebar width
 *     so the button visually centers between the sidebar's right edge and
 *     the viewport's right edge. Math: centerX = S + (W - S)/2 = W/2 + S/2,
 *     which in CSS becomes `left: calc(50% + S/2)` combined with
 *     `-translate-x-1/2` to anchor the BUTTON's center at that point. On
 *     mobile the sidebar is a sheet drawer, so a plain viewport-centered
 *     `left-1/2 -translate-x-1/2` is correct.
 *   - This keeps Today comfortably clear of the bottom-right floating
 *     chrome (Inbox `TalkToFanny` at `bottom-6 right-6`, mobile-only
 *     `CopilotPanel` at `bottom-5 right-5`) without needing a higher
 *     `z-index` — the buttons live in different horizontal regions.
 *   - `mb-[env(safe-area-inset-bottom)]` keeps clear of iOS home-indicator
 *     chrome on mobile.
 *   - `z-40` sits BELOW any modal/dialog overlay (vaul drawers, alert dialogs
 *     use `z-50`), so the launcher is hidden once a modal takes over the
 *     viewport — exactly what we want.
 *
 * Not shown on the full `/today` page (the parent decides via the `hidden`
 * prop). Operators already see the entire Today there; floating their own
 * launcher on top of the canonical surface would be confusing.
 */
export function TodayBottomLauncher({
  onOpen,
  hidden = false,
  sidebarCollapsed = false,
}: {
  onOpen: () => void
  hidden?: boolean
  /**
   * Whether the desktop sidebar is currently collapsed. Used only to pick
   * the correct `md:left-*` offset so the launcher clears the sidebar's
   * footprint without overlapping it. Mobile ignores this entirely (the
   * sidebar is a sheet there). Defaults to `false` to keep the launcher
   * usable even if the parent forgets to wire the prop.
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
         * Desktop: shift right by half the sidebar width so the launcher
         * visually centers in the main content area, not in the full
         * viewport (which would pull it under/near the sidebar). The
         * `-translate-x-1/2` from the base classes is still in effect, so
         * `left: calc(50% + S/2)` lands the button's CENTER on the
         * workspace center.
         *   - collapsed sidebar (`w-14` = 56px) → `calc(50% + 28px)`
         *   - expanded sidebar  (`w-56` = 224px) → `calc(50% + 112px)`
         * The focused-inbox sidebar (`w-48` = 192px) falls back to the
         * expanded offset; that puts the button ~16px to the right of the
         * exact Inbox-area center, which is visually indistinguishable
         * and never lands on the sidebar.
         */
        "md:bottom-5",
        sidebarCollapsed ? "md:left-[calc(50%+28px)]" : "md:left-[calc(50%+112px)]",
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
