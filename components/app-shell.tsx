"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsBell } from "@/components/notifications-bell"
import { useUser } from "@/hooks/use-user"

interface AppShellProps {
  children: React.ReactNode
  currentSection?: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter()
  const { user, loading } = useUser()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [copilotCollapsed, setCopilotCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm text-[#94A3B8]">Verificando sesion...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 flex flex-col">
            {/* Toolbar */}
            <div className="hidden md:flex items-center justify-end gap-2 px-6 py-3 shrink-0">
              <button
                onClick={openSearch}
                className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 cursor-pointer hover:border-[#3B82F6]/30 transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
                <span className="w-32 lg:w-48 text-left text-sm text-[#94A3B8]">Buscar...</span>
                <kbd className="ml-auto text-[10px] font-mono text-[#94A3B8]/60 border border-[#E2E8F0] rounded px-1 py-0.5">
                  Ctrl+K
                </kbd>
              </button>
              <NotificationsBell />
            </div>

            <div className="flex-1 px-4 pb-6 md:px-8 md:pb-8">
              <div className="mx-auto max-w-6xl">
                {children}
              </div>
            </div>
          </main>

          <CopilotPanel />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  )
}
