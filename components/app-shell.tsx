"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { useGlobalSearch } from "@/components/global-search-provider"
import { CloseTodayWhenGlobalSearchOpen } from "@/components/close-today-when-global-search-open"
import { useIsMobile } from "@/hooks/use-mobile"
import { NotificationsBell } from "@/components/notifications-bell"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import { GlobalNewDesktopChrome } from "@/components/global-new/global-new-desktop-panel"
import { GlobalNewTriggerDesktop } from "@/components/global-new/global-new-trigger"
import { useGlobalNew } from "@/components/global-new/use-global-new"
import { TodayDrawerProvider, useTodayDrawer } from "@/components/today/today-drawer-provider"
import { GlobalTodayChrome } from "@/components/today/global-today-chrome"
import { GlobalTodayTriggerDesktop } from "@/components/today/global-today-trigger"
import { GlobalTodayDesktopChrome } from "@/components/today/global-today-desktop-chrome"

interface AppShellProps {
  children: React.ReactNode
  currentSection?: string
  breadcrumbs?: { label: string; href?: string }[]
  contentClassName?: string
}

/**
 * Top desktop chrome of `AppShell` — extracted into its own component
 * because it needs to read `useTodayDrawer()` to drive the toolbar
 * bottom-border highlight. The `<TodayDrawerProvider>` is mounted by
 * `AppShell` further down the JSX tree, so this hook can only resolve
 * inside a child component (calling it at the top level of `AppShell`
 * itself would fall back to the noop store and miss state changes).
 *
 * Renders the toolbar AND mounts the New + Today desktop panels as
 * siblings inside the same `sticky top-0` container. Both panels grow
 * down from the toolbar; cross-linked triggers ensure only one is
 * open at a time.
 */
function AppShellDesktopToolbar({
  hideTodayTrigger,
}: {
  hideTodayTrigger: boolean
}) {
  const { openSearch, searchOpen } = useGlobalSearch()
  const { desktopOpen } = useGlobalNew()
  const { open: todayOpen } = useTodayDrawer()
  const isMobileViewport = useIsMobile()
  const eitherOpen = desktopOpen || todayOpen || (searchOpen && !isMobileViewport)

  return (
    <div className="sticky top-0 z-30 shrink-0 bg-[var(--app-shell-bg)]">
      <GlobalNewDesktopChrome variant="app">
        <div
          className={cn(
            "flex shrink-0 items-center justify-end gap-2 bg-[var(--app-shell-bg)] px-6 py-2.5 transition-colors",
            eitherOpen ? "border-b border-[var(--border-dark)]" : "border-b border-transparent",
          )}
        >
          {/*
            Today is the first global action — daily-work surface, mounted
            BEFORE New (capture surface) so the operator's eye lands on
            "what do I have to do today" before "what should I create".
            Hidden on /today itself (operator is already on the canonical
            Today surface; a toolbar trigger pointing back at the same
            thing is pure noise).
          */}
          {!hideTodayTrigger && <GlobalTodayTriggerDesktop variant="app" />}
          <GlobalNewTriggerDesktop variant="app" />
          <button
            type="button"
            data-global-search-trigger
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
      {/*
        Today desktop chrome — sibling of `GlobalNewDesktopChrome` inside
        the same sticky-top container. Panel hangs from the toolbar and
        grows DOWN, identical recipe to the New panel. The previous
        sticky-bottom mount inside `<main>` has been retired so Today
        and New behave as a single global action family at the top.
      */}
      <GlobalTodayDesktopChrome variant="app" />
      <div
        id="global-search-desktop-root"
        data-search-chrome-variant="app"
        className="relative z-30 hidden shrink-0 md:block"
      />
    </div>
  )
}

export function AppShell({ children, contentClassName }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useUser()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  /**
   * Hide the Today trigger on `/today` itself: the operator is already
   * looking at the canonical surface, so layering a "Today" button on
   * top of the Today page is pure noise. Path comparison is exact +
   * prefix so future `/today/*` sub-routes inherit the same hide rule.
   */
  const hideTodayTrigger = pathname === "/today" || pathname.startsWith("/today/")

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
        time, so each provider naturally owns its own state).
      */}
      <TodayDrawerProvider>
      <CloseTodayWhenGlobalSearchOpen />
      {/* fixed inset-0 = viewport-sized containing block so flex children get a definite height (h-dvh alone can still allow the main column to grow with content). */}
      <div className="fixed inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[var(--app-shell-bg)] font-sans md:flex-row">
        <SidebarNav />
        <MobileSidebarNav />

        {/* max-h-full caps main to the shell height so overflow-y-auto always forms a scrollport when content is taller */}
        <main className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <AppShellDesktopToolbar hideTodayTrigger={hideTodayTrigger} />

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-2 md:px-8 md:pb-8">
            <div className={cn("mx-auto flex min-h-0 w-full max-w-6xl flex-col", contentClassName)}>
              {children}
            </div>
          </div>
        </main>

        {/*
          Global Today surface — only mounts the mobile vaul drawer.
          Desktop Today surface lives in the top sticky container inside
          `<main>` (see `AppShellDesktopToolbar` above).
        */}
        <GlobalTodayChrome
          sidebarCollapsed={sidebarCollapsed}
          hidden={hideTodayTrigger}
        />
      </div>
      </TodayDrawerProvider>
    </SidebarCollapseContext.Provider>
  )
}
