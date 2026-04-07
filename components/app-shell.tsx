"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { useGlobalSearch } from "@/components/global-search-provider"
import { NotificationsBell } from "@/components/notifications-bell"
import { useUser } from "@/hooks/use-user"

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm text-[#94A3B8]">Checking session...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#F8FAFC] font-sans md:flex-row">
        <SidebarNav />
        <MobileSidebarNav />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="hidden md:flex items-center justify-end gap-2 px-6 py-3 shrink-0">
            <button
              onClick={openSearch}
              className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 cursor-pointer hover:border-[#3B82F6]/30 transition-colors"
            >
              <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
              <span className="w-32 lg:w-48 text-left text-sm text-[#94A3B8]">Search...</span>
              <kbd className="ml-auto text-[10px] font-mono text-[#94A3B8]/60 border border-[#E2E8F0] rounded px-1 py-0.5">
                Ctrl+K
              </kbd>
            </button>
            <NotificationsBell />
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-4 pb-6 md:px-8 md:pb-8">
            <div className={`mx-auto h-full min-h-0 max-w-6xl ${contentClassName ?? ""}`}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarCollapseContext.Provider>
  )
}
