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
 *   - Anchored to the BOTTOM-LEFT of the viewport so it never collides with
 *     the existing bottom-right floating chrome (Inbox `TalkToFanny`,
 *     mobile-only `CopilotPanel`, toast stack). On desktop we offset by the
 *     current sidebar width so the launcher sits just inside the main
 *     content area instead of overlapping the sidebar; on mobile the
 *     sidebar is a sheet drawer, so a flush 16px gutter is safe.
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
         * `fixed` + `bottom-/left-` keep the button anchored to the viewport
         * regardless of the underlying page's scroll position. Bottom-left
         * was chosen over bottom-right because the existing global floating
         * controls (Inbox `TalkToFanny` at `bottom-6 right-6`, mobile
         * CopilotPanel at `bottom-5 right-5`) already own the bottom-right
         * corner — anchoring Today there would stack two buttons on top of
         * each other.
         */
        "group fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full",
        "border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2",
        "text-xs font-semibold text-[var(--text-primary-light)] shadow-lg",
        "transition-all duration-200",
        "hover:border-[var(--accent-primary)]/40 hover:bg-[var(--app-surface-dark)] hover:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.4)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
        /**
         * Desktop offset is the sidebar width + 16px gutter so the launcher
         * sits just inside the main content column instead of overlapping
         * the sidebar:
         *   - collapsed sidebar (`w-14` = 56px) → `left-[72px]`
         *   - expanded sidebar (`w-56` = 224px) → `left-[240px]`
         * The focused-inbox sidebar (`w-48` = 192px) falls back to the
         * expanded offset, which keeps the launcher safely inside Inbox's
         * main column with a small extra gap.
         */
        "md:bottom-5",
        sidebarCollapsed ? "md:left-[72px]" : "md:left-[240px]",
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
