"use client"

import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGlobalNew } from "@/components/global-new/use-global-new"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useGlobalSearch } from "@/components/global-search-provider"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"

/**
 * Desktop trigger for Agents — visual sibling of `GlobalNewTriggerDesktop` /
 * `GlobalTodayTriggerDesktop` in the top toolbar (Today | New | Agents | Search).
 *
 * Unlike New / Today / Search (which open quick OVERLAYS that grow down from the
 * toolbar), Agents is the full **AI Team Control Center** — a destination, not a
 * popover. So this button NAVIGATES to `/agents` (the live roster + decision
 * rail), instead of opening the old compact read-only panel. Before navigating
 * it closes any open sibling overlay so nothing lingers over the transition.
 *
 * Visual contract — kept 1:1 with the New / Today triggers (same shape, padding,
 * tone tokens). Only the icon (`Sparkles`) and label (`"Agents"`) diverge. The
 * button is hidden on `/agents` itself (see app-shell/context-shell).
 */
export function GlobalAgentsTriggerDesktop({ variant }: { variant: "app" | "context" }) {
  const router = useRouter()
  const { closeAll: closeNew } = useGlobalNew()
  const { closeToday } = useTodayDrawer()
  const { closeSearch } = useGlobalSearch()
  const { closeAsk } = useAskFanny()

  const handleClick = () => {
    closeNew()
    closeToday()
    closeSearch()
    closeAsk()
    router.push("/agents")
  }

  const base =
    variant === "app"
      ? "rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-active)]"
      : "rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"

  return (
    <button
      type="button"
      onClick={handleClick}
      data-agents-trigger="true"
      aria-label="Open Agents"
      className={cn("flex cursor-pointer items-center gap-1.5 transition-colors", base)}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
      <span>Agents</span>
    </button>
  )
}

/**
 * Mobile trigger for Agents — visual sibling of `GlobalTodayTriggerMobile` /
 * `GlobalNewTriggerMobile`, mounted in `MobileSidebarNav`'s header AFTER New.
 *
 * Same destination semantics as desktop: navigates to `/agents` (the full
 * control center) rather than opening a bottom-sheet quick view. Closes the
 * other mobile surfaces first so two sheets never stack during the transition.
 */
export function GlobalAgentsTriggerMobile() {
  const router = useRouter()
  const { closeAll: closeNew } = useGlobalNew()
  const { closeToday } = useTodayDrawer()
  const { closeAsk } = useAskFanny()

  const onClick = () => {
    closeNew()
    closeToday()
    closeAsk()
    router.push("/agents")
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-agents-trigger="true"
      aria-label="Agents"
      className={cn(
        "rounded-md p-1.5 text-[var(--app-sidebar-text-muted)] transition-colors hover:bg-[var(--app-surface-active)] hover:text-[var(--text-primary-light)]",
      )}
    >
      <Sparkles size={22} strokeWidth={2} />
    </button>
  )
}
