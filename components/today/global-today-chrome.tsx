"use client"

import { TodayBottomLauncher } from "@/components/today/today-bottom-launcher"
import { TodayMobileDrawer } from "@/components/today/today-mobile-drawer"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Mount point for the global Today surface pieces that DO NOT live
 * inline in the shell's `<main>` flow.
 *
 * After the bottom-chrome migration, Today is split across two
 * mounting sites:
 *
 *   1. `<TodayDesktopBottomChrome>` — mounted INSIDE `<main>` by the
 *      shells (`AppShell`, `ContextShell`) as a sticky-bottom child.
 *      This is the canonical desktop surface; it's tone-aware
 *      (`app` / `context`) and feels like part of the workspace
 *      shell, mirroring `<GlobalNewDesktopChrome>` at the top.
 *
 *   2. This component — mounted as a sibling NEXT TO `<main>` by the
 *      shells. It owns:
 *        - The floating launcher (`<TodayBottomLauncher>`), which
 *          stays `position: fixed` and never participates in shell
 *          geometry. The launcher hides itself when Today is open on
 *          desktop so the bottom chrome owns the visual focus.
 *        - The mobile vaul drawer (`<TodayMobileDrawer>`), which is
 *          unchanged from the previous PR and remains the only
 *          mobile Today surface.
 *
 * Why split? Two reasons:
 *   - The desktop chrome MUST live inside `<main>`'s scroll
 *     container to use `sticky bottom-0` — putting it as a sibling
 *     of `<main>` would lose the sticky anchor.
 *   - The launcher is `position: fixed` (viewport-anchored, not
 *     shell-anchored) and intentionally floats above `<main>`'s
 *     scroll; mounting it inside `<main>` would let the operator
 *     scroll the launcher with content, which is wrong.
 *
 * Both pieces consume the same `<TodayDrawerProvider>` so the open
 * state stays in one place per shell instance.
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
   * Launcher visibility rule:
   *
   *   - Always hidden when the parent shell asks (e.g. on the full
   *     `/today` route — that page is the canonical Today surface,
   *     a floating launcher on top of it would be visual noise).
   *   - Hidden when Today is open on DESKTOP. The bottom chrome owns
   *     the visual focus; keeping the launcher visible would also
   *     create a click-outside race (mousedown on the launcher would
   *     close the panel via the chrome's outside listener, then
   *     re-open via the launcher's onClick → no-op flicker).
   *   - NOT hidden when Today is open on MOBILE. vaul already paints
   *     the bottom sheet over the launcher area, so the launcher is
   *     naturally occluded; explicitly hiding it would re-trigger
   *     the launcher's `aria-hidden` flow on every drawer toggle.
   */
  const launcherHidden = hidden || (open && !isMobile)

  return (
    <>
      <TodayBottomLauncher
        onOpen={openToday}
        hidden={launcherHidden}
        sidebarCollapsed={sidebarCollapsed}
      />
      <TodayMobileDrawer open={open && isMobile} onOpenChange={setOpen} />
    </>
  )
}
