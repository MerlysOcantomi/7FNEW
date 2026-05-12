"use client"

import { TodayBottomLauncher } from "@/components/today/today-bottom-launcher"
import { TodayBottomDrawer } from "@/components/today/today-bottom-drawer"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Single mount point for the global Today surface.
 *
 * Mounts:
 *   - `TodayBottomLauncher` — floating button to open Today.
 *   - `TodayBottomDrawer`   — breakpoint switch that renders the
 *                             desktop inlay (Radix Dialog panel) on
 *                             `md+` and the mobile bottom sheet on
 *                             smaller widths.
 *
 * Both consume the shared `{ open, setOpen }` from
 * `<TodayDrawerProvider>`, so the boolean stays in one place per
 * shell instance.
 *
 * Launcher visibility:
 *   The launcher is hidden when:
 *     1. The shell explicitly asks (`hidden={true}` — used by the
 *        `/today` route so the canonical page doesn't carry a
 *        redundant launcher), OR
 *     2. The desktop inlay is OPEN. The inlay sits centered in the
 *        workspace area with the launcher floating right below it;
 *        keeping the launcher visible at the same time would create
 *        a "two Today entry points" feeling. Hiding it cleans up the
 *        surface during interaction (PR design decision D2).
 *
 * Note: we deliberately do NOT hide the launcher when the MOBILE
 * drawer is open — vaul already paints the drawer over the launcher
 * area, so the launcher is naturally occluded, and hiding it would
 * cause a redundant focus/return-focus shuffle when the drawer
 * closes.
 *
 * Sidebar width:
 *   `sidebarCollapsed` (legacy boolean from the shells) is converted
 *   here into the rendered pixel width (`56` collapsed, `224`
 *   expanded). The new desktop inlay needs an actual pixel value to
 *   center inside the workspace area — keeping the conversion at the
 *   chrome boundary lets the existing shells continue passing the
 *   boolean they already track without re-wiring all of them.
 */
export function GlobalTodayChrome({
  sidebarCollapsed = false,
  hidden = false,
}: {
  sidebarCollapsed?: boolean
  hidden?: boolean
}) {
  const { open, setOpen, openToday } = useTodayDrawer()
  const isMobile = useIsMobile()

  /**
   * Convert the boolean sidebar state into the pixel width Sidebar
   * actually renders. These constants mirror the Tailwind classes
   * on `<SidebarNav>`:
   *   - collapsed: w-14 → 56px
   *   - expanded:  w-56 → 224px
   * The Inbox "focused-inbox" variant renders w-48 (192px); we round
   * it up to 224 here so the inlay sits in the same visual center as
   * the launcher (which also uses the expanded offset for that
   * variant). Visually the two are indistinguishable.
   */
  const sidebarPx = sidebarCollapsed ? 56 : 224

  /**
   * Launcher hides while the DESKTOP inlay is open. We gate on
   * `!isMobile` (rather than `>= md`) because that matches the
   * breakpoint switch inside `TodayBottomDrawer` exactly — the
   * launcher's visibility and the inlay's mounting always agree.
   */
  const launcherHidden = hidden || (open && !isMobile)

  return (
    <>
      <TodayBottomLauncher
        onOpen={openToday}
        hidden={launcherHidden}
        sidebarCollapsed={sidebarCollapsed}
      />
      <TodayBottomDrawer
        open={open}
        onOpenChange={setOpen}
        sidebarPx={sidebarPx}
      />
    </>
  )
}
