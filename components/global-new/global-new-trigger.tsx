"use client"

import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGlobalNew } from "./global-new-provider"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"
import { useGlobalSearch } from "@/components/global-search-provider"

export function GlobalNewTriggerDesktop({ variant }: { variant: "app" | "context" }) {
  const { desktopOpen, setDesktopOpen } = useGlobalNew()
  /**
   * Cross-link with Today + Agents: when the user opens New, we
   * proactively close the Today and Agents panels. New, Today and
   * Agents all share the sticky-top region (all grow DOWN from the
   * toolbar) and only one should ever be visible at a time.
   * `useTodayDrawer()` / `useAgentsPanel()` fall back to noop stores
   * outside a provider, so this stays safe on any future legacy mount.
   */
  const { closeToday } = useTodayDrawer()
  const { closeAgents } = useAgentsPanel()
  const { closeSearch } = useGlobalSearch()

  const handleClick = () => {
    const next = !desktopOpen
    if (next) {
      closeToday()
      closeAgents()
      closeSearch()
    }
    setDesktopOpen(next)
  }

  const base =
    variant === "app"
      ? "rounded-lg border border-[var(--border-dark)] bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-light)] hover:bg-white/10"
      : "rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] shadow-sm hover:bg-[#F1F5F9]"

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={desktopOpen}
      aria-haspopup="true"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 transition-colors",
        base,
        desktopOpen &&
          (variant === "app"
            ? "bg-white/10 ring-2 ring-[var(--accent-primary)]/40"
            : "bg-[#F1F5F9] ring-2 ring-[#3B82F6]/30"),
      )}
    >
      <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      <span>New</span>
    </button>
  )
}

export function GlobalNewTriggerMobile() {
  const { mobileOpen, setMobileOpen } = useGlobalNew()
  /**
   * Mobile mutual exclusion: close the Agents + Today vaul drawers
   * before opening the New sheet so two bottom surfaces never stack.
   * Both hooks are noop-safe outside their providers (legacy mounts).
   */
  const { closeAgents } = useAgentsPanel()
  const { closeToday } = useTodayDrawer()

  const handleClick = () => {
    closeAgents()
    closeToday()
    setMobileOpen(true)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "rounded-md p-1.5 text-[var(--app-sidebar-text-muted)] transition-colors hover:bg-white/10 hover:text-white",
        mobileOpen && "text-white",
      )}
      aria-label="New"
      aria-expanded={mobileOpen}
    >
      <Plus size={22} strokeWidth={2} />
    </button>
  )
}
