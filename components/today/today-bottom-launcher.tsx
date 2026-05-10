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
 *   - Bottom-right with `safe-area-inset-bottom` respected so it doesn't
 *     overlap iOS home-indicator chrome on mobile.
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
}: {
  onOpen: () => void
  hidden?: boolean
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
         * `fixed` + `bottom-/right-` keep the button anchored to the viewport
         * regardless of the underlying page's scroll position. The
         * `pb-[env(safe-area-inset-bottom)]` shim is applied via a wrapper
         * span so the visual padding doesn't get baked into the button's
         * tappable area (clicks on the safe-area gutter would otherwise miss).
         */
        "group fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full",
        "border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2",
        "text-xs font-semibold text-[var(--text-primary-light)] shadow-lg",
        "transition-all duration-200",
        "hover:border-[var(--accent-primary)]/40 hover:bg-[var(--app-surface-dark)] hover:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.4)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
        /**
         * Mobile sits a bit higher to clear the iOS keyboard / home indicator
         * area. We don't push it inside any existing mobile bottom nav
         * because the sidebar uses a sheet-based mobile nav with no
         * bottom-anchored chrome.
         */
        "md:bottom-5 md:right-5",
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
