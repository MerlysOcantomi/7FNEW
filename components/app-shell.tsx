"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { useGlobalSearch } from "@/components/global-search-provider"
import { NotificationsBell } from "@/components/notifications-bell"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import { GlobalNewDesktopChrome } from "@/components/global-new/global-new-desktop-panel"
import { GlobalNewTriggerDesktop } from "@/components/global-new/global-new-trigger"
import { useGlobalNew } from "@/components/global-new/use-global-new"
import { TodayDrawerProvider } from "@/components/today/today-drawer-provider"
import { GlobalTodayChrome } from "@/components/today/global-today-chrome"
import { GlobalTodayTriggerDesktop } from "@/components/today/global-today-trigger"
import { TodayDesktopBottomChrome } from "@/components/today/today-desktop-bottom-chrome"

interface AppShellProps {
  children: React.ReactNode
  currentSection?: string
  breadcrumbs?: { label: string; href?: string }[]
  contentClassName?: string
}

export function AppShell({ children, contentClassName }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useUser()
  const { openSearch } = useGlobalSearch()
  const { desktopOpen } = useGlobalNew()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  /**
   * Hide the floating launcher on `/today` itself: the operator is already
   * looking at the canonical surface, so layering a "Today" button on top of
   * the Today page is pure noise. The drawer can still be opened from any
   * other route. Path comparison is exact + prefix so future `/today/*`
   * sub-routes (e.g. detail panes) inherit the same hide rule.
   *
   * The drawer's open/close state now lives in `<TodayDrawerProvider>`
   * (see `components/today/today-drawer-provider.tsx`) — AppShell only
   * controls visibility of the launcher, not the drawer boolean.
   */
  const hideLauncherOnToday = pathname === "/today" || pathname.startsWith("/today/")

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--app-shell-bg)]">
        <p className="text-sm text-[var(--app-sidebar-text-muted)]">Checking session...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      {/*
        Today drawer state is scoped to this shell instance via a dedicated
        provider so AppShell and ContextShell can share the same chrome
        component without sharing a boolean (only one shell renders at a
        time, so each provider naturally owns its own state — no risk of
        duplicate launchers in the same tree).
      */}
      <TodayDrawerProvider>
      {/* fixed inset-0 = viewport-sized containing block so flex children get a definite height (h-dvh alone can still allow the main column to grow with content). */}
      <div className="fixed inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[var(--app-shell-bg)] font-sans md:flex-row">
        <SidebarNav />
        <MobileSidebarNav />

        {/* max-h-full caps main to the shell height so overflow-y-auto always forms a scrollport when content is taller */}
        <main className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {/* Scroll lives on main; nested flex-1 + overflow often fails in WebKit. Sticky chrome keeps toolbar + New panel anchored. */}
          <div className="sticky top-0 z-30 shrink-0 bg-[var(--app-shell-bg)]">
            <GlobalNewDesktopChrome variant="app">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-end gap-2 bg-[var(--app-shell-bg)] px-6 py-2.5 transition-colors",
                  desktopOpen ? "border-b border-[var(--border-dark)]" : "border-b border-transparent",
                )}
              >
                {/*
                  Today is the first global action — daily-work surface, mounted
                  BEFORE New (capture surface) so the operator's eye lands on
                  "what do I have to do today" before "what should I create".
                  Hidden on /today itself (operator is already on the canonical
                  Today surface; a toolbar trigger pointing back at the same
                  thing is pure noise — same rule as the floating launcher).
                */}
                {!hideLauncherOnToday && <GlobalTodayTriggerDesktop variant="app" />}
                <GlobalNewTriggerDesktop variant="app" />
                <button
                  type="button"
                  onClick={openSearch}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-dark)] bg-white/6 px-3 py-1.5 transition-colors hover:bg-white/10"
                >
                  <Search className="h-3.5 w-3.5 text-[var(--text-secondary-light)]" />
                  <span className="w-32 text-left text-sm text-[var(--text-secondary-light)] lg:w-48">
                    Search...
                  </span>
                  <kbd className="ml-auto rounded border border-[var(--border-dark)] px-1 py-0.5 font-mono text-[10px] text-[var(--text-secondary-light)]/60">
                    Ctrl+K
                  </kbd>
                </button>
                <NotificationsBell />
              </div>
            </GlobalNewDesktopChrome>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-2 md:px-8 md:pb-8">
            <div className={cn("mx-auto flex min-h-0 w-full max-w-6xl flex-col", contentClassName)}>
              {children}
            </div>
          </div>

          {/*
            Today desktop bottom chrome — architectural mirror of
            `<GlobalNewDesktopChrome>` at the top of <main>. Mounted as
            the LAST sticky child of <main> so when the panel grows it
            sticks to the bottom of the workspace scrollport instead of
            scrolling out of view. Closed state collapses to 0px tall
            (grid-rows animation) so the chrome never steals workspace
            area when idle.

            `variant="app"` selects the dark canvas tokens — the panel
            visually bleeds into the AppShell surface tokens, just like
            New does at the top.

            Hidden on mobile via `hidden md:block` so the mobile vaul
            drawer (mounted by `<GlobalTodayChrome>`) remains the only
            mobile surface.
          */}
          <div className="sticky bottom-0 z-30 hidden shrink-0 md:block">
            <TodayDesktopBottomChrome variant="app" />
          </div>
        </main>

        {/*
          Global Today surface — single mount via `<GlobalTodayChrome>`. The
          launcher is `position: fixed` so it floats above the main scroll
          without participating in the flex layout; the mobile drawer is
          portalled by vaul. Both consume the surrounding
          `<TodayDrawerProvider>`. The DESKTOP surface lives inline inside
          <main> above; this component intentionally does NOT mount it.
        */}
        <GlobalTodayChrome
          sidebarCollapsed={sidebarCollapsed}
          hidden={hideLauncherOnToday}
        />
      </div>
      </TodayDrawerProvider>
    </SidebarCollapseContext.Provider>
  )
}
