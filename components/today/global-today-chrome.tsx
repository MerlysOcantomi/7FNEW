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
   *   - Always hidden on DESKTOP. Today is now a first-class global
   *     action with a dedicated toolbar trigger
   *     (`GlobalTodayTriggerDesktop`), visual sibling of New. Two
   *     entry points (toolbar AND floating launcher) compete for the
   *     same intent and break the rule "Today vive arriba como
   *     trabajo diario, no abajo" — so on desktop the launcher is
   *     retired as the primary affordance. The bottom chrome
   *     (`TodayDesktopBottomChrome`) is unchanged and remains the
   *     surface that opens.
   *   - On MOBILE the launcher stays for now: the mobile header has
   *     its own `GlobalTodayTriggerMobile` icon, but keeping the
   *     bottom pill avoids a behavior regression while the mobile
   *     header is still settling in. Retiring the mobile launcher
   *     can be a follow-up once usage analytics confirm the header
   *     trigger is sufficient. vaul already paints the drawer over
   *     the launcher area when open, so there's no visual conflict.
   *
   * `useIsMobile()` returns `false` during SSR; that means the
   * launcher renders hidden on the very first server pass and
   * reveals on hydration only on actual mobile breakpoints. This is
   * safe because (a) on desktop the launcher must stay hidden, and
   * (b) the mobile header trigger is visible from the first render
   * via plain CSS, so the operator always has a Today entry point.
   */
  const launcherHidden = hidden || !isMobile

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
