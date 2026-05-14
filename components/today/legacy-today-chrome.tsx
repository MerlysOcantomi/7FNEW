"use client"

import { usePathname } from "next/navigation"
import { TodayDrawerProvider } from "@/components/today/today-drawer-provider"
import { GlobalTodayChrome } from "@/components/today/global-today-chrome"

/**
 * Drop-in Today chrome for direct legacy workspace pages that don't
 * use `AppShell` or `ContextShell` (e.g. `/`, `/clientes`,
 * `/proyectos`, `/finanzas`, `/facturacion`, `/agente`, `/assistant`,
 * `/motor`).
 *
 * The two real shells already provide their own `<TodayDrawerProvider>`
 * + `<GlobalTodayChrome>` triad and mount the desktop Today panel
 * inline at the top toolbar (sibling of `<GlobalNewDesktopChrome>`).
 * Legacy pages don't have that toolbar, so they only get the mobile
 * vaul drawer here — there is no longer a sticky-bottom or
 * viewport-fixed Today panel on desktop. Operators on legacy pages
 * who want the full Today board navigate to `/today` (the canonical
 * page); the mobile header trigger does this automatically when it
 * detects no provider is visible.
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
    </TodayDrawerProvider>
  )
}
