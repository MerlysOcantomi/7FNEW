"use client"

import { usePathname } from "next/navigation"
import { TodayDrawerProvider } from "@/components/today/today-drawer-provider"
import { GlobalTodayChrome } from "@/components/today/global-today-chrome"
import { TodayDesktopBottomChrome } from "@/components/today/today-desktop-bottom-chrome"

/**
 * Drop-in Today chrome for direct legacy workspace pages that don't
 * use `AppShell` or `ContextShell` (e.g. `/`, `/clientes`,
 * `/proyectos`, `/finanzas`, `/facturacion`, `/agente`, `/assistant`,
 * `/motor`).
 *
 * The two real shells already provide their own `<TodayDrawerProvider>`
 * + `<GlobalTodayChrome>` + inline `<TodayDesktopBottomChrome>` triad;
 * this component is the one-liner those un-shelled pages can render to
 * reach functional parity without being restyled or migrated to a
 * shell.
 *
 * Desktop bottom panel on legacy pages:
 *   Legacy pages don't give us a single `<main>` flex container with
 *   a managed scrollport, so we can't mount the desktop chrome as a
 *   `sticky bottom-0` child the way the real shells do. Instead we
 *   render `<TodayDesktopBottomChrome placement="viewport-fixed">`,
 *   which paints the SAME visual surface but uses
 *   `position: fixed; bottom: 0; right: 0; md:left-[224px]` to
 *   anchor itself at the bottom of the viewport while clearing an
 *   assumed expanded sidebar.
 *
 *   That assumption mirrors how the legacy floating launcher is
 *   positioned (`sidebarCollapsed={false}`); a collapsed sidebar on
 *   a legacy page will leave an extra ~168px gutter on the left of
 *   the panel rather than overlapping the sidebar — a small visual
 *   cost in exchange for not needing per-page wiring of sidebar
 *   width.
 *
 *   Variant: `"app"` because the legacy pages render dark
 *   AppCanvas-style surfaces (they all use `SidebarNav` directly
 *   without the ContextShell light layout).
 *
 * What this component does:
 *   - Wraps a fresh `<TodayDrawerProvider>` so the launcher, the
 *     mobile drawer, and the desktop bottom chrome share the same
 *     `open` boolean. The provider is intentionally local to
 *     whichever page renders this chrome — public / `/cliente/*` /
 *     `/system/*` routes never render it, so it never touches them.
 *   - Renders `<GlobalTodayChrome>` (launcher + mobile drawer) AND
 *     `<TodayDesktopBottomChrome placement="viewport-fixed">` so
 *     legacy pages get the same desktop bottom-chrome behaviour as
 *     the shells.
 *   - Honours the `/today` and `/today/*` hide rule defensively,
 *     even though none of the current legacy mount sites live under
 *     `/today` — this way if a legacy page is ever moved or wraps a
 *     child route, the hide behaviour stays consistent without
 *     per-page wiring.
 *
 * What this component does NOT do:
 *   - Any restyle of the host page (it renders portals + a
 *     fixed-position button + a fixed-bottom panel; the page body
 *     is untouched).
 *   - Any change to data fetching: the bottom chrome still
 *     lazy-fetches `/api/today` only when `open` flips true.
 *   - Any wrapper around the page tree. Mount as a sibling of the
 *     page's own shell elements (next to `<CopilotPanel>` works
 *     well) so a single instance per page is enough.
 *
 * To remove: when a legacy page gets migrated to `AppShell` /
 * `ContextShell`, delete the `<LegacyTodayChrome />` line — the new
 * shell already mounts the chrome.
 */
export function LegacyTodayChrome() {
  const pathname = usePathname()
  const hidden = pathname === "/today" || pathname.startsWith("/today/")

  return (
    <TodayDrawerProvider>
      <GlobalTodayChrome sidebarCollapsed={false} hidden={hidden} />
      {hidden ? null : <TodayDesktopBottomChrome variant="app" placement="viewport-fixed" />}
    </TodayDrawerProvider>
  )
}
