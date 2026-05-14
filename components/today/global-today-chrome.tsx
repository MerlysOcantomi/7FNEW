"use client"

import { TodayMobileDrawer } from "@/components/today/today-mobile-drawer"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Mount point for global Today surface pieces that DO NOT live inline
 * in the shell's top sticky toolbar.
 *
 * Today is now split across two mounting sites:
 *
 *   1. `<GlobalTodayDesktopChrome>` — mounted by the shells
 *      (`AppShell`, `ContextShell`) as a sibling of
 *      `<GlobalNewDesktopChrome>` inside the same `sticky top-0`
 *      container. The panel hangs from the toolbar and grows DOWN,
 *      identical recipe to the New panel. This is the canonical
 *      desktop surface; it's tone-aware (`app` / `context`).
 *
 *   2. This component — mounted as a sibling NEXT TO `<main>` by the
 *      shells. It owns ONLY the mobile vaul drawer
 *      (`<TodayMobileDrawer>`), which remains the only mobile Today
 *      surface.
 *
 * Earlier iterations also mounted a floating bottom launcher and a
 * sticky-bottom desktop chrome (`TodayDesktopBottomChrome`); both have
 * been retired so Today and New now read as a single global action
 * family at the top of the shell, with no Today UI ever growing from
 * the bottom on desktop.
 *
 *   - Desktop: `GlobalTodayTriggerDesktop` in the top toolbar is the
 *     single, canonical entry point.
 *   - Mobile: `GlobalTodayTriggerMobile` in the mobile header is the
 *     single, canonical entry point.
 *
 * Both remaining pieces consume the same `<TodayDrawerProvider>` so
 * the open state stays in one place per shell instance. The
 * `sidebarCollapsed` and `hidden` props are kept for API stability
 * with the existing call sites (`AppShell`, `ContextShell`,
 * `LegacyTodayChrome`); they no longer have any visible effect now
 * that the launcher and bottom chrome are gone.
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
