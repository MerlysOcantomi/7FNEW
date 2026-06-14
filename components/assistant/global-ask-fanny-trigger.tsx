"use client"

import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useGlobalNew } from "@/components/global-new/use-global-new"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"
import { useGlobalSearch } from "@/components/global-search-provider"

/**
 * Desktop trigger for the global Ask Fanny assistant — visual sibling of
 * `GlobalTodayTriggerDesktop` / `GlobalNewTriggerDesktop`.
 *
 * Sits BETWEEN Today and Agents in the action row (Today | Ask Fanny | Agents |
 * New | Search): Today = what needs doing, Ask Fanny = talk to the active
 * assistant, Agents = supervision/history of AI work. Same button shape,
 * tokens and open-ring as the other actions so the row reads as one family.
 *
 * Unlike Today/New/Agents (which hang a sticky-top panel), Ask Fanny opens the
 * existing `TalkToFanny` panel (rendered by `GlobalAskFannyChrome`) anchored
 * top-right — reusing the exact /ask API + conversation scope. We still enforce
 * mutual exclusion: opening Ask Fanny closes the other global panels.
 */
export function GlobalAskFannyTriggerDesktop({ variant }: { variant: "app" | "context" }) {
  const { open, setOpen } = useAskFanny()
  const { closeToday } = useTodayDrawer()
  const { closeAll: closeNew } = useGlobalNew()
  const { closeAgents } = useAgentsPanel()
  const { closeSearch } = useGlobalSearch()

  const handleClick = () => {
    const next = !open
    if (next) {
      closeToday()
      closeNew()
      closeAgents()
      closeSearch()
    }
    setOpen(next)
  }

  const base =
    variant === "app"
      ? "rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-active)]"
      : "rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] shadow-sm hover:bg-[#F1F5F9]"

  return (
    <button
      type="button"
      onClick={handleClick}
      data-ask-fanny-trigger="true"
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 transition-colors",
        base,
        open &&
          (variant === "app"
            ? "bg-[var(--app-surface-active)] ring-2 ring-[var(--accent-primary)]/40"
            : "bg-[#F1F5F9] ring-2 ring-[#3B82F6]/30"),
      )}
    >
      <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
      <span>Ask Fanny</span>
    </button>
  )
}

/**
 * Mobile trigger for the global Ask Fanny assistant — icon-only sibling of the
 * Today / New / Agents mobile triggers. Mounted in `MobileSidebarNav`'s header
 * between Today and Agents. Opens the same controlled `TalkToFanny` panel and
 * closes the other mobile surfaces first so two overlays never stack.
 */
export function GlobalAskFannyTriggerMobile() {
  const { open, openAsk } = useAskFanny()
  const { closeToday } = useTodayDrawer()
  const { closeAll: closeNew } = useGlobalNew()
  const { closeAgents } = useAgentsPanel()

  const onClick = () => {
    closeToday()
    closeNew()
    closeAgents()
    openAsk()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-ask-fanny-trigger="true"
      aria-label="Ask Fanny"
      aria-expanded={open}
      className={cn(
        "rounded-md p-1.5 text-[var(--app-sidebar-text-muted)] transition-colors hover:bg-[var(--app-surface-active)] hover:text-[var(--text-primary-light)]",
        open && "text-[var(--text-primary-light)]",
      )}
    >
      <MessageCircle size={22} strokeWidth={2} />
    </button>
  )
}
