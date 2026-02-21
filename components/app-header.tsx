"use client"

import { useState, useEffect, useCallback } from "react"
import { PanelLeft, MessageCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsBell } from "@/components/notifications-bell"

interface AppHeaderProps {
  breadcrumbs: { label: string; href?: string }[]
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onToggleMobileSidebar: () => void
  chatOpen: boolean
  onToggleChat: () => void
  onToggleMobileChat: () => void
}

export function AppHeader({
  breadcrumbs,
  sidebarOpen,
  onToggleSidebar,
  onToggleMobileSidebar,
  chatOpen,
  onToggleChat,
  onToggleMobileChat,
}: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])

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

  return (
    <>
    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 gap-4">
      {/* Left side: sidebar toggle + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Desktop sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className={cn(
            "hidden md:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          )}
          aria-label={sidebarOpen ? "Ocultar sidebar" : "Mostrar sidebar"}
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Mobile sidebar toggle */}
        <button
          onClick={onToggleMobileSidebar}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Menu"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 min-w-0 overflow-hidden" aria-label="Breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <span className="text-muted-foreground/50 text-sm flex-shrink-0">/</span>
              )}
              <span
                className={cn(
                  "truncate text-sm",
                  i === breadcrumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Right side: search + chat toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search bar (opens global search overlay) */}
        <button
          onClick={openSearch}
          className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 cursor-pointer hover:border-foreground/20 transition-colors"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="w-32 lg:w-48 text-left text-sm text-muted-foreground">Buscar...</span>
          <kbd className="ml-auto text-[10px] font-mono text-muted-foreground/60 border border-border rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>
        {/* Mobile search button */}
        <button
          onClick={openSearch}
          className="flex sm:hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <NotificationsBell />

        {/* Desktop chat toggle */}
        <button
          onClick={onToggleChat}
          className={cn(
            "hidden md:flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            chatOpen
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          aria-label={chatOpen ? "Ocultar asistente" : "Mostrar asistente"}
        >
          <MessageCircle className="h-4 w-4" />
        </button>

        {/* Mobile chat toggle */}
        <button
          onClick={onToggleMobileChat}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Asistente"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      </div>
    </header>
    </>
  )
}
