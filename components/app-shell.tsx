"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { useGlobalSearch } from "@/components/global-search-provider"
import { NotificationsBell } from "@/components/notifications-bell"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import { GlobalNewDesktopChrome } from "@/components/global-new/global-new-desktop-panel"
import { GlobalNewTriggerDesktop } from "@/components/global-new/global-new-trigger"
import { useGlobalNew } from "@/components/global-new/use-global-new"

interface AppShellProps {
  children: React.ReactNode
  currentSection?: string
  breadcrumbs?: { label: string; href?: string }[]
  contentClassName?: string
}

export function AppShell({ children, contentClassName }: AppShellProps) {
  const router = useRouter()
  const { user, loading } = useUser()
  const { openSearch } = useGlobalSearch()
  const { desktopOpen } = useGlobalNew()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        </main>
      </div>
    </SidebarCollapseContext.Provider>
  )
}
