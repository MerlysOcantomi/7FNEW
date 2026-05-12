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
 * Desktop "bottom workspace chrome" for the Today quick view.
 *
 * Architectural mirror of `GlobalNewDesktopChrome`:
 *   - New is mounted INLINE at the TOP of `<main>` and grows DOWN.
 *   - Today is mounted INLINE at the BOTTOM of `<main>` and grows UP.
 *
 * Both share the same recipe — inline (no portal), shell tokens (no
 * standalone modal surface), `grid-rows` height animation, no
 * backdrop, no scroll lock, no focus trap, click-outside +
 * Escape + pathname-change to close. The operator should feel that
 * the panel is just another piece of the workspace shell.
 *
 * Mounting:
 *   The shells (`AppShell`, `ContextShell`) wrap this component in a
 *   `sticky bottom-0 z-30 shrink-0 hidden md:block` container as the
 *   LAST child of `<main>`. When the panel is closed the chrome is
 *   0px tall and invisible; when it opens the grid grows up to its
 *   max height and the sticky-bottom container occupies that slice of
 *   the workspace area.
 *
 *   For legacy pages that don't go through the shells, the
 *   `placement="viewport-fixed"` prop swaps the layout-derived
 *   positioning for a `position: fixed; bottom: 0` overlay anchored
 *   to the right of the assumed sidebar width. Same visual surface,
 *   different geometry — see `LegacyTodayChrome`.
 *
 * Tone awareness:
 *   - `variant="app"` → dark canvas tokens (matches AppShell).
 *   - `variant="context"` → light slate tokens (matches ContextShell).
 *
 *   The variant flows down into `TodayQuickContent` as
 *   `tone="canvas" | "light"` so rows / lanes / schedule are
 *   readable on each surface without any per-shell branching in the
 *   row primitives.
 *
 * Trigger:
 *   Today's trigger is the existing floating launcher
 *   (`TodayBottomLauncher`) — NOT a topbar button. The launcher is
 *   hidden while this panel is open on desktop (see
 *   `global-today-chrome.tsx`). On mobile the launcher continues to
 *   open the vaul drawer; this desktop chrome never renders on
 *   mobile (`hidden md:block` on the shell wrapper PLUS an internal
 *   `isMobile` gate on the data fetch so a CSS-hidden node never
 *   double-fetches).
 *
 * Click-outside / Escape / pathname-change:
 *   Hand-rolled, identical pattern to `GlobalNewDesktopChrome`. The
 *   click-outside listener uses `mousedown` so it fires BEFORE a
 *   row's click handler — the row's navigation handler still runs
 *   because we close optimistically; row links remain functional.
 *   Pathname-change auto-close mirrors Global New: as soon as the
 *   route changes, Today closes so the operator lands cleanly on the
 *   new page.
 *
 * Reusability:
 *   `TodayQuickContent` is unchanged in this PR; it is the same
 *   component that the mobile vaul drawer renders. Future stacked
 *   (`New top + Today bottom`) or side-by-side
 *   (`Today left + New right`) layouts will reuse it without any
 *   modification — only the surrounding chrome / panel shape changes.
 */
export function TodayDesktopBottomChrome({
  variant,
  placement = "main-bottom",
}: {
  variant: "app" | "context"
  /**
   * How the chrome is anchored:
   *   - `"main-bottom"` (default) — caller wraps the chrome in a
   *     `sticky bottom-0` container inside `<main>`. Used by
   *     `AppShell` and `ContextShell`.
   *   - `"viewport-fixed"` — the chrome paints its own
   *     `position: fixed; bottom: 0; right: 0` and offsets `left`
   *     by an assumed sidebar width. Used by `LegacyTodayChrome` on
   *     un-shelled legacy pages where `<main>` doesn't have a
   *     scroll container we control.
   */
  placement?: "main-bottom" | "viewport-fixed"
}) {
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
   * client render before mount. That defaults the bottom chrome to
   * "active on desktop" — which is the right thing: on the first
   * render `open` is also `false` (provider default), so the chrome
   * is invisible regardless of breakpoint and no listener fires.
   */
  const isOpenOnDesktop = open && !isMobile

  const { loading, error, lanes, scheduleItems, totalItems } =
    useTodayQuickData(isOpenOnDesktop)

  // ─── Click-outside (mousedown) ────────────────────────────────────
  //
  // Matches `GlobalNewDesktopChrome`. Listener is only registered
  // while the desktop panel is open — when closed there is nothing
  // to dismiss.
  useEffect(() => {
    if (!isOpenOnDesktop) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpenOnDesktop, setOpen])

  // ─── Escape to close ──────────────────────────────────────────────
  //
  // Local to the desktop chrome so we don't compete with vaul's own
  // Escape handling in the mobile drawer — and so a future Coordinator
  // PR can route Escape decisions per surface.
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
  // Mirrors `GlobalNewProvider`'s pathname effect: the user navigating
  // away (e.g. clicking a row that goes to /clientes/123) closes the
  // panel so they land on the new page without a stale Today on top.
  //
  // The closeAll happens unconditionally on pathname change. If
  // Today was already closed the no-op `setOpen(false)` is cheap and
  // doesn't trigger a render (React state-setter equality check).
  useEffect(() => {
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const tone: TodayQuickTone = variant === "app" ? "canvas" : "light"

  // ─── Surface tokens per variant ───────────────────────────────────
  //
  // Mirrors `GlobalNewDesktopPanel.panelSurface`:
  //   - `app`     → dark shell tokens (matches `AppShell` background).
  //   - `context` → light slate tokens (matches `ContextShell` `#F8FAFC`).
  //
  // The visible "panel surface" is the inner scrollport, NOT the
  // outer wrapper, so we can keep the outer wrapper transparent
  // (`grid-rows` animation only animates the row track, not a
  // background — backgrounds on the outer would briefly flash before
  // the row shrinks to 0fr).
  const panelSurface =
    variant === "app"
      ? "border-[var(--border-dark)] bg-[var(--app-shell-bg)]"
      : "border-[#E2E8F0] bg-[#F8FAFC]"

  // ─── Header tokens per variant ────────────────────────────────────
  //
  // Header sits inside the panel surface, so it inherits the same
  // background; the bottom border is a hairline divider between
  // header and body. We keep header text + the count pill consistent
  // with the corresponding shell's other header chrome.
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

  // ─── Outer wrapper (geometry) ─────────────────────────────────────
  //
  // For `main-bottom` the shell already provides `sticky bottom-0
  // z-30 shrink-0 hidden md:block`, so the chrome itself is `relative
  // z-30 hidden shrink-0 md:block` — same shape as
  // `GlobalNewDesktopChrome`'s outer div.
  //
  // For `viewport-fixed` the chrome carries its own positioning:
  // `fixed bottom-0 right-0 z-30 hidden md:block` plus a `left`
  // offset wide enough to clear an expanded sidebar (224px). Legacy
  // pages don't expose their sidebar width to us, so 224 is the safe
  // upper bound; on collapsed-sidebar legacy pages the panel will
  // leave an extra 168px gutter on the left rather than spilling
  // under the sidebar. Visually that reads as a small inset and is
  // preferable to overlapping.
  const wrapperClass =
    placement === "viewport-fixed"
      ? "fixed bottom-0 right-0 z-30 hidden md:block md:left-[224px]"
      : "relative z-30 hidden shrink-0 md:block"

  return (
    <div ref={ref} className={wrapperClass} data-today-bottom-chrome>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpenOnDesktop ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!isOpenOnDesktop}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "flex max-h-[min(560px,72vh)] flex-col overflow-hidden border-t shadow-[0_-1px_0_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.04)]",
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
