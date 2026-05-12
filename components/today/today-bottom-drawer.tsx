"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { TodayMobileDrawer } from "./today-mobile-drawer"
import { TodayDesktopInlay } from "./today-desktop-inlay"

/**
 * Breakpoint switch for the global Today quick view.
 *
 * Picks the right surface for the operator's current viewport while
 * keeping the same external `{ open, onOpenChange }` API the rest of
 * the app already wires (see `global-today-chrome.tsx`). External
 * callers don't need to know about the desktop-vs-mobile split.
 *
 *   - Mobile (< 768px): `TodayMobileDrawer` (vaul bottom sheet) —
 *     unchanged from the pre-refactor UX.
 *   - Desktop (≥ 768px): `TodayDesktopInlay` (Radix Dialog rendered
 *     as a workspace-area-anchored panel) — the new inlay UX.
 *
 * Why mount BOTH and gate via `open && isMatchingBreakpoint` instead
 * of conditionally rendering only the active one?
 *
 *   - The data hook (`useTodayQuickData`) inside each surface is
 *     gated on the surface's own `open` prop. With both surfaces
 *     mounted, ONLY the breakpoint-matching surface ever receives
 *     `open === true`, so we fire exactly one `/api/today` request
 *     at a time — no double fetch, no duplicated render.
 *   - Resizing the window across the 768px boundary mid-session is
 *     handled gracefully: the surface that loses the breakpoint
 *     closes (its `open` flips to false), and the surface that gains
 *     it opens. No flash, no abrupt unmount of the visible UI.
 *   - On SSR / first client render, `useIsMobile` returns `false`
 *     (its initial state is `undefined`, coerced to `false`). The
 *     mobile drawer's gate becomes `open && true === open` only if
 *     `open` is already truthy at mount. The provider initialises
 *     `open=false`, so neither surface portals anything visible
 *     during SSR — there is no hydration mismatch risk.
 *
 * The filename / export name is kept as `TodayBottomDrawer` so the
 * upstream import in `global-today-chrome.tsx` doesn't have to
 * change in this PR. A future rename to `TodayQuickView` is
 * tracked but out of scope here.
 */
export function TodayBottomDrawer({
  open,
  onOpenChange,
  sidebarPx,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  /**
   * Active desktop sidebar width in pixels. Forwarded to the desktop
   * inlay for workspace-area centering. Mobile ignores this entirely
   * because the sidebar is a sheet there. Defaults to 0 when the
   * parent hasn't wired it yet (the inlay then centers on the raw
   * viewport — acceptable graceful fallback).
   */
  sidebarPx?: number
}) {
  const isMobile = useIsMobile()

  return (
    <>
      <TodayMobileDrawer
        open={open && isMobile}
        onOpenChange={onOpenChange}
      />
      <TodayDesktopInlay
        open={open && !isMobile}
        onOpenChange={onOpenChange}
        sidebarPx={sidebarPx}
      />
    </>
  )
}
