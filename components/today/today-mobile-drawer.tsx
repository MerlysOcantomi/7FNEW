"use client"

import Link from "next/link"
import { ArrowUpRight, Sun, X } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { TodayQuickContent } from "./today-quick-content"
import { useTodayQuickData } from "./today-quick-data"

/**
 * Mobile surface for the Today quick view.
 *
 * Thin wrapper around the existing vaul `Drawer` — same UX as the
 * pre-refactor `TodayBottomDrawer` on mobile. The only change is that
 * the body and the data hook are now extracted (`TodayQuickContent`
 * + `useTodayQuickData`), so the mobile drawer and the desktop inlay
 * stay in lock-step.
 *
 * Why keep vaul on mobile?
 *   - Native-feeling drag-to-close and momentum behaviour.
 *   - Safe-area-inset handling out of the box.
 *   - Doesn't fight iOS keyboard / address bar viewport changes the
 *     way a hand-rolled bottom sheet would.
 *
 * Lazy fetch: `useTodayQuickData(open)` will only build the
 * `/api/today` URL when `open === true`, so leaving this wrapper
 * mounted globally has no idle cost.
 */
export function TodayMobileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { loading, error, lanes, scheduleItems, totalItems } =
    useTodayQuickData(open)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        /**
         * Override the default `bg-background` so the drawer adopts
         * the app's dark surface tokens — consistent with
         * `app-shell.tsx` and the Today page chrome. `max-h-[70vh]`
         * keeps the panel intentionally lighter than the full
         * `/today` page; the body owns its own scrollport below.
         */
        className={cn(
          "bg-[var(--app-shell-bg)] text-[var(--text-primary-light)]",
          "data-[vaul-drawer-direction=bottom]:max-h-[70vh]",
        )}
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
              <DrawerTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
                Today
              </DrawerTitle>
              <DrawerDescription className="text-[11px] leading-tight text-[var(--text-secondary-light)]">
                Daily overview · workspace-wide
              </DrawerDescription>
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
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close Today drawer"
              className="rounded-md p-1 text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
            >
              <X size={14} strokeWidth={2} />
            </button>
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
      </DrawerContent>
    </Drawer>
  )
}
