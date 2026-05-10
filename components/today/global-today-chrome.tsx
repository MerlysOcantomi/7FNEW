"use client"

import { TodayBottomLauncher } from "@/components/today/today-bottom-launcher"
import { TodayBottomDrawer } from "@/components/today/today-bottom-drawer"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"

/**
 * Single mount point for the global Today surface (floating launcher +
 * bottom drawer).
 *
 * Replaces the two duplicated mount blocks that used to live inline in
 * `AppShell` and `ContextShell`. Both shells now wrap their tree in a
 * `<TodayDrawerProvider>` and render a single `<GlobalTodayChrome>`; the
 * launcher and the drawer share the provider's `open` state, so the
 * boolean stays in one place per shell instance.
 *
 * The chrome is intentionally dumb — it owns no state, just wires the
 * launcher's "open" callback and the drawer's `open` / `onOpenChange`
 * into the provider. Anything route-specific (e.g. hiding the launcher
 * on `/today`) is decided by the shell and passed in via `hidden`,
 * because the shell is the one that already does pathname checks.
 *
 * Positioning is unchanged: `TodayBottomLauncher` continues to center
 * itself in the workspace area based on `sidebarCollapsed`. The drawer
 * is rendered as a vaul portal so it never participates in the parent's
 * flex / fixed geometry.
 */
export function GlobalTodayChrome({
  sidebarCollapsed = false,
  hidden = false,
}: {
  sidebarCollapsed?: boolean
  hidden?: boolean
}) {
  const { open, setOpen, openToday } = useTodayDrawer()

  return (
    <>
      <TodayBottomLauncher
        onOpen={openToday}
        hidden={hidden}
        sidebarCollapsed={sidebarCollapsed}
      />
      <TodayBottomDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
