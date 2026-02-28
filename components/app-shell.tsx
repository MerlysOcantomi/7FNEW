"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel"
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

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

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
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
            <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
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
