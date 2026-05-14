"use client"

import { TodayMobileDrawer } from "@/components/today/today-mobile-drawer"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Mount point for the global Today surface pieces that DO NOT live
 * inline in the shell's `<main>` flow.
 *
 * Today is now split across two mounting sites:
 *
 *   1. `<TodayDesktopBottomChrome>` — mounted INSIDE `<main>` by the
 *      shells (`AppShell`, `ContextShell`) as a sticky-bottom child.
 *      This is the canonical desktop surface; it's tone-aware
 *      (`app` / `context`) and feels like part of the workspace
 *      shell, mirroring `<GlobalNewDesktopChrome>` at the top.
 *
 *   2. This component — mounted as a sibling NEXT TO `<main>` by the
 *      shells. It owns ONLY the mobile vaul drawer
 *      (`<TodayMobileDrawer>`), which remains the only mobile Today
 *      surface.
 *
 * The previously-mounted floating bottom launcher
 * (`TodayBottomLauncher`) has been retired in both breakpoints:
 *
 *   - Desktop: `GlobalTodayTriggerDesktop` in the top toolbar is the
 *     single, canonical entry point.
 *   - Mobile: `GlobalTodayTriggerMobile` in the mobile header is the
 *     single, canonical entry point.
 *
 * Removing the launcher from the tree (instead of just CSS-hiding it)
 * means it cannot reappear under any cache, hydration, or styling
 * regression.
 *
 * Both remaining pieces consume the same `<TodayDrawerProvider>` so
 * the open state stays in one place per shell instance. The
 * `sidebarCollapsed` and `hidden` props are kept for API stability
 * with the existing call sites (`AppShell`, `ContextShell`,
 * `LegacyTodayChrome`); they no longer have any visible effect now
 * that the launcher is gone.
 */
export function GlobalTodayChrome({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sidebarCollapsed: _sidebarCollapsed = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hidden: _hidden = false,
}: {
  /**
   * Kept for backwards compatibility with the previous launcher (which
   * used the value to pick a sidebar-clearing offset). Now unused.
   */
  sidebarCollapsed?: boolean
  /**
   * Kept for backwards compatibility — used to hide the launcher on
   * `/today`. Now unused because the launcher is no longer mounted.
   */
  hidden?: boolean
}) {
  const { open, setOpen } = useTodayDrawer()
  const isMobile = useIsMobile()

  return <TodayMobileDrawer open={open && isMobile} onOpenChange={setOpen} />
}
