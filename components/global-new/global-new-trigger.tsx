"use client"

import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGlobalNew } from "./global-new-provider"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"
import { useGlobalSearch } from "@/components/global-search-provider"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"
import { useI18n } from "@/components/i18n-provider"

export function GlobalNewTriggerDesktop({ variant }: { variant: "app" | "context" }) {
  const { desktopOpen, setDesktopOpen } = useGlobalNew()
  const { t } = useI18n()
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
  const { closeAsk } = useAskFanny()

  const handleClick = () => {
    const next = !desktopOpen
    if (next) {
      closeToday()
      closeAgents()
      closeSearch()
      closeAsk()
    }
    setDesktopOpen(next)
  }

  const base =
    variant === "app"
      ? "rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-active)]"
      : "rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"

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
            ? "bg-[var(--app-surface-active)] ring-2 ring-[var(--accent-primary)]/40"
            : "bg-muted ring-2 ring-[#3B82F6]/30"),
      )}
    >
      <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      <span>{t.globalNew.trigger}</span>
    </button>
  )
}

export function GlobalNewTriggerMobile() {
  const { mobileOpen, setMobileOpen } = useGlobalNew()
  const { t } = useI18n()
  /**
   * Mobile mutual exclusion: close the Agents + Today vaul drawers
   * before opening the New sheet so two bottom surfaces never stack.
   * Both hooks are noop-safe outside their providers (legacy mounts).
   */
  const { closeAgents } = useAgentsPanel()
  const { closeToday } = useTodayDrawer()
  const { closeAsk } = useAskFanny()

  const handleClick = () => {
    closeAgents()
    closeToday()
    closeAsk()
    setMobileOpen(true)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "rounded-md p-1.5 text-[var(--app-sidebar-text-muted)] transition-colors hover:bg-[var(--app-surface-active)] hover:text-[var(--text-primary-light)]",
        mobileOpen && "text-[var(--text-primary-light)]",
      )}
      aria-label={t.globalNew.trigger}
      aria-expanded={mobileOpen}
    >
      <Plus size={22} strokeWidth={2} />
    </button>
  )
}
