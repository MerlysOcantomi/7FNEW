"use client"

import { useState, useCallback } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { AppChat } from "@/components/app-chat"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: React.ReactNode
  currentSection: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function AppShell({ children, currentSection, breadcrumbs = [] }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const toggleChat = useCallback(() => setChatOpen((prev) => !prev), [])
  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen((prev) => !prev), [])
  const toggleMobileChat = useCallback(() => setMobileChatOpen((prev) => !prev), [])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out flex-shrink-0",
          sidebarOpen ? "w-64" : "w-0 border-r-0 overflow-hidden"
        )}
      >
        <AppSidebar currentSection={currentSection} onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-in-out md:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AppSidebar currentSection={currentSection} onClose={() => setMobileSidebarOpen(false)} />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <AppHeader
          breadcrumbs={breadcrumbs}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onToggleMobileSidebar={toggleMobileSidebar}
          chatOpen={chatOpen}
          onToggleChat={toggleChat}
          onToggleMobileChat={toggleMobileChat}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Content area */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>

          {/* Chat panel - desktop */}
          <aside
            className={cn(
              "hidden md:flex flex-col border-l border-border bg-card transition-all duration-300 ease-in-out flex-shrink-0",
              chatOpen ? "w-80 lg:w-96" : "w-0 border-l-0 overflow-hidden"
            )}
          >
            <AppChat onClose={() => setChatOpen(false)} />
          </aside>
        </div>
      </div>

      {/* Chat - mobile overlay */}
      {mobileChatOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileChatOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 flex flex-col border-l border-border bg-card transition-transform duration-300 ease-in-out md:hidden",
          mobileChatOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <AppChat onClose={() => setMobileChatOpen(false)} />
      </aside>
    </div>
  )
}
