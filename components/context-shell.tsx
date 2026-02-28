"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, ChevronRight } from "lucide-react"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsBell } from "@/components/notifications-bell"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface TabItem {
  key: string
  label: string
}

export interface ContextShellProps {
  breadcrumbs: BreadcrumbItem[]
  heading: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  tabs: TabItem[]
  defaultTab?: string
  children: (activeTab: string) => React.ReactNode
  copilotContext?: string
}

export function ContextShell({
  breadcrumbs,
  heading,
  meta,
  actions,
  tabs,
  defaultTab,
  children,
  copilotContext,
}: ContextShellProps) {
  const router = useRouter()
  const { user, loading } = useUser()
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? "")
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

  if (!user) return null

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
            {/* Sticky Shell Header */}
            <div className="sticky top-0 z-20 bg-[#F8FAFC]/95 backdrop-blur-sm border-b border-[#E2E8F0]">
              {/* Toolbar */}
              <div className="hidden md:flex items-center justify-end gap-2 px-6 py-2 shrink-0">
                <button
                  onClick={openSearch}
                  className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 cursor-pointer hover:border-[#3B82F6]/30 transition-colors"
                >
                  <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
                  <span className="w-32 lg:w-48 text-left text-sm text-[#94A3B8]">Buscar...</span>
                  <kbd className="ml-auto text-[10px] font-mono text-[#94A3B8]/60 border border-[#E2E8F0] rounded px-1 py-0.5">Ctrl+K</kbd>
                </button>
                <NotificationsBell />
              </div>

              {/* Breadcrumbs + heading */}
              <div className="px-5 md:px-8 pt-3 pb-4">
                <nav className="flex items-center gap-1.5 mb-4 flex-wrap" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight size={11} className="text-[#CBD5E1] shrink-0" />}
                      {crumb.href ? (
                        <Link href={crumb.href} className="text-xs text-[#64748B] hover:text-[#0F172A] transition-colors font-medium">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-xs text-[#0F172A] font-semibold truncate max-w-[200px]">
                          {crumb.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>

                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {heading}
                    {meta && <div className="mt-1.5">{meta}</div>}
                  </div>
                  {actions && (
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {actions}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="px-5 md:px-8 overflow-x-auto scrollbar-none">
                <div className="flex items-end gap-0 min-w-max">
                  {tabs.map((tab) => {
                    const isActive = tab.key === activeTab
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          "relative px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
                          isActive
                            ? "text-[#2563EB] border-[#3B82F6]"
                            : "text-[#94A3B8] border-transparent hover:text-[#334155] hover:border-[#CBD5E1]"
                        )}
                        style={isActive ? { boxShadow: "0 1px 0 0 #3B82F6" } : {}}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {tab.label}
                        {isActive && (
                          <span
                            className="absolute bottom-0 left-0 right-0 h-px bg-[#3B82F6] rounded-t"
                            style={{ boxShadow: "0 0 6px 0 rgba(59,130,246,0.35)" }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 px-5 md:px-8 py-7">
              <div className="mx-auto max-w-6xl">
                {children(activeTab)}
              </div>
            </div>
          </main>

          <CopilotPanel defaultContext={copilotContext} />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  )
}
