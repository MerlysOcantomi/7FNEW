"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRight, Sun, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { TodayQuickContent, type TodayQuickTone } from "./today-quick-content"
import { useTodayQuickData } from "./today-quick-data"

/**
 * Desktop top chrome for the Today quick view.
 *
 * Visual sibling of `GlobalNewDesktopPanel` — both surfaces hang from
 * the workspace toolbar and grow DOWN inside the same `sticky top-0`
 * container. Today is no longer mounted as a sticky-bottom panel
 * inside `<main>`; the previous bottom chrome has been retired so
 * Today and New behave like a single global action family at the top
 * of the shell:
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ Today | New | Search | Notifications  (toolbar)  │
 *   ├──────────────────────────────────────────────────┤
 *   │ New panel        (grid-rows 0fr/1fr)             │
 *   ├──────────────────────────────────────────────────┤
 *   │ Today panel      (grid-rows 0fr/1fr) <-- THIS    │
 *   ├──────────────────────────────────────────────────┤
 *   │ <main> page content                              │
 *
 * Mounting:
 *   The shells (`AppShell`, `ContextShell`) place this component as a
 *   SIBLING of `<GlobalNewDesktopChrome>` inside the same
 *   `sticky top-0 z-30` container. Each chrome owns its own ref +
 *   click-outside listener; mutual exclusion is enforced by the
 *   triggers (`GlobalTodayTriggerDesktop` calls
 *   `useGlobalNew().closeAll()` when opening Today, and the New
 *   trigger calls `useTodayDrawer().closeToday()` when opening New).
 *   With cross-linking, only one panel is ever open at a time —
 *   stacking them inside the same sticky region stays cosmetic.
 *
 *   Hidden on mobile via `hidden md:block` (`useIsMobile` is also
 *   used to gate the data fetch so a CSS-hidden node never
 *   double-fetches against `/api/today`). Mobile uses
 *   `<TodayMobileDrawer>` exclusively.
 *
 * Click-outside / Escape / pathname-change:
 *   Hand-rolled, identical pattern to `GlobalNewDesktopChrome`. The
 *   click-outside listener uses `mousedown` so it fires BEFORE a
 *   row's click handler — row navigation still runs because we close
 *   optimistically. The listener skips clicks on
 *   `[data-today-trigger]` so the trigger itself owns the toggle
 *   without racing the outside-dismiss.
 *
 * Reusability:
 *   `TodayQuickContent` is unchanged; the same component is used by
 *   the mobile vaul drawer. Lane classification, fetch, and data
 *   shape are not touched here.
 */
export function GlobalTodayDesktopChrome({ variant }: { variant: "app" | "context" }) {
  const ref = useRef<HTMLDivElement>(null)
  const { open, setOpen } = useTodayDrawer()
  const isMobile = useIsMobile()
  const pathname = usePathname()

  /**
   * `isOpenOnDesktop` gates:
   *   - The data hook → mobile breakpoint never fetches via this
   *     chrome (the mobile vaul drawer owns its own hook).
   *   - The click-outside / Escape listeners → idle on mobile so
   *     they don't close the mobile vaul on outside taps.
   *
   * `useIsMobile()` returns `false` during SSR and on the first
   * client render before mount. That defaults this chrome to
   * "active on desktop" — which is the right thing because `open`
   * is also `false` on the first render (provider default), so the
   * panel is invisible regardless of breakpoint and no listener
   * fires.
   */
  const isOpenOnDesktop = open && !isMobile

  const { loading, error, lanes, scheduleItems, totalItems } =
    useTodayQuickData(isOpenOnDesktop)

  // ─── Click-outside (mousedown) ────────────────────────────────────
  //
  // Listener registered only while the panel is open. Skips clicks
  // that originate inside any element with `data-today-trigger` so
  // the toolbar trigger always owns its own toggle (avoids the
  // "mousedown closes -> onClick reopens" race).
  useEffect(() => {
    if (!isOpenOnDesktop) return
    function handle(e: MouseEvent) {
      const target = e.target as Element | null
      if (target?.closest?.("[data-today-trigger]")) return
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpenOnDesktop, setOpen])

  // ─── Escape to close ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpenOnDesktop) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpenOnDesktop, setOpen])

  // ─── Auto-close on route change ───────────────────────────────────
  //
  // Mirrors `GlobalNewProvider`'s pathname effect: navigating away
  // (e.g. clicking a row that goes to `/clientes/123`) closes the
  // panel so the operator lands cleanly on the new page.
  useEffect(() => {
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const tone: TodayQuickTone = variant === "app" ? "canvas" : "light"

  // ─── Surface tokens per variant ───────────────────────────────────
  //
  // Identical to the bottom-chrome implementation we replaced — same
  // halos, same colours per variant. Only the geometry/border side
  // changes (border-b on the body now that the panel hangs from the
  // toolbar instead of standing on the floor).
  const panelSurface =
    variant === "app"
      ? "border-[var(--border-dark)] bg-[var(--app-shell-bg)]"
      : "border-[#E2E8F0] bg-[#F8FAFC]"

  const headerBorder =
    variant === "app" ? "border-[var(--border-dark)]" : "border-[#E2E8F0]"
  const headerTitle =
    variant === "app"
      ? "text-[var(--text-primary-light)]"
      : "text-[#0F172A]"
  const headerSubtitle =
    variant === "app"
      ? "text-[var(--text-secondary-light)]"
      : "text-[#64748B]"
  const headerCountBg =
    variant === "app" ? "bg-white/[0.06]" : "bg-[#F1F5F9]"
  const headerCountText =
    variant === "app"
      ? "text-[var(--text-secondary-light)]"
      : "text-[#64748B]"
  const headerLinkText =
    variant === "app" ? "text-[var(--accent-primary)]" : "text-[#2563EB]"
  const headerLinkHover =
    variant === "app" ? "hover:bg-white/[0.06]" : "hover:bg-[#F1F5F9]"
  const headerIconHalo =
    variant === "app"
      ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
      : "bg-[#DBEAFE] text-[#2563EB]"
  const headerCloseColour =
    variant === "app"
      ? "text-[var(--text-secondary-light)] hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
      : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
  const focusRing =
    variant === "app"
      ? "focus-visible:ring-[var(--accent-primary)]/40"
      : "focus-visible:ring-[#3B82F6]/35"

  return (
    <div
      ref={ref}
      id="today-desktop-chrome"
      className="relative z-30 hidden shrink-0 md:block"
      data-today-panel
    >
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpenOnDesktop ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!isOpenOnDesktop}
      >
        <div className="min-h-0 overflow-hidden">
          {/*
            border-b (NOT border-t) and shadow-[inset_0_1px_0_...]
            on the top — same recipe as `GlobalNewDesktopPanel`. The
            panel reads as "hanging" from the toolbar.

            Height fills the viewport below the sticky toolbar (≈3rem
            tall) so the open panel fully covers the underlying page —
            no page content peeks below it. The body scrolls internally
            via `overflow-y-auto`.
          */}
          <div
            className={cn(
              "flex h-[calc(100dvh-3rem)] flex-col overflow-hidden border-b shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
              panelSurface,
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3",
                headerBorder,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    headerIconHalo,
                  )}
                >
                  <Sun size={14} strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      headerTitle,
                    )}
                  >
                    Today
                  </p>
                  <p className={cn("text-[11px] leading-tight", headerSubtitle)}>
                    Daily overview · workspace-wide
                  </p>
                </div>
                {!loading && !error && totalItems > 0 ? (
                  <span
                    className={cn(
                      "ml-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      headerCountBg,
                      headerCountText,
                    )}
                  >
                    {totalItems}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href="/today"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    headerLinkText,
                    headerLinkHover,
                    "focus-visible:outline-none focus-visible:ring-2",
                    focusRing,
                  )}
                >
                  Open full Today
                  <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Today panel"
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    headerCloseColour,
                    "focus-visible:outline-none focus-visible:ring-2",
                    focusRing,
                  )}
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
                tone={tone}
                onRowNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
