"use client"

import Link from "next/link"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowUpRight, Sun, X } from "lucide-react"
import {
  WorkspacePanelSurface,
  WorkspacePanelTitle,
  WorkspacePanelDescription,
} from "@/components/workspace-panel/workspace-panel-surface"
import { WorkspacePanelBackdrop } from "@/components/workspace-panel/workspace-panel-backdrop"
import { TodayQuickContent } from "./today-quick-content"
import { useTodayQuickData } from "./today-quick-data"

/**
 * Desktop surface for the Today quick view.
 *
 * Renders as an integrated workspace panel — anchored bottom-center
 * inside the workspace content area, NOT as a vaul bottom sheet
 * pinned to the viewport's lower edge. This makes Today on desktop
 * feel like an app layer rather than an overlay.
 *
 * Composition:
 *   - `Dialog.Root` (Radix)            — gives focus trap, Escape,
 *                                         portal mount, return-focus.
 *   - `WorkspacePanelBackdrop`         — soft scrim. Click closes
 *                                         Today (D1 = modal-close).
 *   - `WorkspacePanelSurface`          — floating panel surface,
 *                                         anchored `bottom-center`
 *                                         with sidebar-aware
 *                                         centering math (D3).
 *   - `WorkspacePanelTitle/Description`— Radix-wired aria-labelledby
 *                                         / aria-describedby for a11y.
 *   - `TodayQuickContent`              — shared body (Schedule strip
 *                                         + My-work / AI-work mini
 *                                         workboard).
 *
 * Sidebar centering:
 *   The `sidebarPx` prop is the actual rendered sidebar width (56 for
 *   collapsed, 224 for expanded), and the surface uses `left:
 *   calc(50% + S/2)` + `translateX(-50%)` to land the panel's center
 *   at workspace-center. Same math as the existing
 *   `TodayBottomLauncher` — keeping them aligned reinforces the
 *   "panel rises from the launcher" mental model.
 *
 * Sizing:
 *   `min-w: 760px` so the My-work | AI-work split has room without
 *   collapsing to single-column on the smallest desktops. `max-w:
 *   960px` keeps the panel from sprawling on ultrawide monitors —
 *   /today is the canonical deep-dive, the inlay is a glance.
 *   `max-h: 68vh` matches the mobile drawer's 70vh budget so the two
 *   surfaces feel like siblings, with a hard cap of 720px on very
 *   tall monitors to avoid an oddly-stretched panel on 4K.
 *
 * Scroll lock:
 *   Radix Dialog locks body scroll by default. We KEEP this for the
 *   Today-only PR — with a single panel and the scrim already
 *   committing to a modal feel, locking the page below avoids the
 *   awkward case of scrolling content underneath while the focus
 *   trap is active. The future Coordinator PR (Stack / Side-by-side)
 *   will revisit this when multiple panels can coexist.
 */
export function TodayDesktopInlay({
  open,
  onOpenChange,
  sidebarPx,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  /**
   * Active sidebar width in pixels. The inlay uses this to center
   * itself inside the workspace area instead of the raw viewport.
   * Defaults to 0 so callers that haven't wired it yet still render
   * a viewport-centered panel (acceptable fallback rather than a
   * crash).
   */
  sidebarPx?: number
}) {
  const { loading, error, lanes, scheduleItems, totalItems } =
    useTodayQuickData(open)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <WorkspacePanelBackdrop />
        <WorkspacePanelSurface
          anchor="bottom-center"
          tone="canvas"
          leftOffset={{ desktopPx: sidebarPx ?? 0, mobilePx: 0 }}
          size={{
            minWidth: 760,
            maxWidth: "min(960px, calc(100vw - 96px))",
            maxHeight: "min(68vh, 720px)",
          }}
          labelledBy="today-desktop-inlay-title"
          describedBy="today-desktop-inlay-description"
          className="w-[clamp(760px,80vw,960px)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
              >
                <Sun size={14} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <WorkspacePanelTitle
                  id="today-desktop-inlay-title"
                  className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]"
                >
                  Today
                </WorkspacePanelTitle>
                <WorkspacePanelDescription
                  id="today-desktop-inlay-description"
                  className="text-[11px] leading-tight text-[var(--text-secondary-light)]"
                >
                  Daily overview · workspace-wide
                </WorkspacePanelDescription>
              </div>
              {!loading && !error && totalItems > 0 ? (
                <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary-light)]">
                  {totalItems}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/today"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-white/[0.06]"
              >
                Open full Today
                <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
              </Link>
              <DialogPrimitive.Close
                aria-label="Close Today panel"
                className="rounded-md p-1 text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
              >
                <X size={14} strokeWidth={2} />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <TodayQuickContent
              loading={loading}
              error={error}
              lanes={lanes}
              scheduleItems={scheduleItems}
              totalItems={totalItems}
              onRowNavigate={() => onOpenChange(false)}
            />
          </div>
        </WorkspacePanelSurface>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
