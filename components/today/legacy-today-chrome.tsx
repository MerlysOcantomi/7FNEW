"use client"

import { usePathname } from "next/navigation"
import { TodayDrawerProvider } from "@/components/today/today-drawer-provider"
import { GlobalTodayChrome } from "@/components/today/global-today-chrome"

/**
 * Drop-in Today chrome for direct legacy workspace pages that don't use
 * `AppShell` or `ContextShell` (e.g. `/`, `/clientes`, `/proyectos`,
 * `/finanzas`, `/facturacion`, `/agente`, `/assistant`, `/motor`).
 *
 * The two real shells already provide their own `<TodayDrawerProvider>` +
 * `<GlobalTodayChrome>` pair; this component is the one-liner those
 * un-shelled pages can render to reach functional parity without being
 * restyled or migrated to a shell.
 *
 * What this component does:
 *   - Wraps a fresh `<TodayDrawerProvider>` so the launcher and the drawer
 *     share the same `open` boolean. The provider is intentionally local
 *     to whichever page renders this chrome — public / `/cliente/*` /
 *     `/system/*` routes never render it, so it never touches them.
 *   - Renders `<GlobalTodayChrome>` with `sidebarCollapsed={false}`. The
 *     legacy pages don't expose their sidebar collapse state externally
 *     (each one owns it locally), so we assume the expanded sidebar width
 *     for centering math. This matches the most common runtime state and
 *     keeps the launcher comfortably inside the main content area.
 *   - Honours the `/today` and `/today/*` hide rule defensively, even
 *     though none of the current legacy mount sites live under `/today` —
 *     this way if a legacy page is ever moved or wraps a child route, the
 *     hide behaviour stays consistent without per-page wiring.
 *
 * What this component does NOT do:
 *   - Any restyle of the host page (it renders portals + a fixed-position
 *     button; the page body is untouched).
 *   - Any change to data fetching: the drawer still lazy-fetches
 *     `/api/today` only when `open` flips true.
 *   - Any wrapper around the page tree. Mount as a sibling of the page's
 *     own shell elements (next to `<CopilotPanel>` works well) so a single
 *     instance per page is enough.
 *
 * To remove: when a legacy page gets migrated to `AppShell` /
 * `ContextShell`, delete the `<LegacyTodayChrome />` line — the new shell
 * already mounts the chrome.
 */
export function LegacyTodayChrome() {
  const pathname = usePathname()
  const hidden = pathname === "/today" || pathname.startsWith("/today/")

  return (
    <TodayDrawerProvider>
      <GlobalTodayChrome sidebarCollapsed={false} hidden={hidden} />
    </TodayDrawerProvider>
  )
}
