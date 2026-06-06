"use client"

import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"
import { useGlobalNew } from "@/components/global-new/use-global-new"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useGlobalSearch } from "@/components/global-search-provider"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"

/**
 * Desktop trigger for the global Agents panel — visual sibling of
 * `GlobalNewTriggerDesktop` / `GlobalTodayTriggerDesktop`.
 *
 * Lives in the top toolbar AFTER New (Today | New | Agents | Search):
 * Agents is the visibility/decision plane over AI work, so it sits next
 * to the create/execute actions but before Search.
 *
 * Visual contract — 1:1 with the New / Today triggers (same shape,
 * padding, tone tokens, open-ring highlight). Only the icon (`Sparkles`)
 * and label (`"Agents"`) diverge.
 *
 * Mutual exclusion: opening Agents proactively closes New, Today and
 * Search. All four global surfaces share the sticky-top region (New +
 * Today + Agents all grow DOWN from the toolbar) and only one should be
 * visible at a time. `useTodayDrawer()` / `useGlobalNew()` /
 * `useGlobalSearch()` are all safe to call here (the first two fall back
 * to no-op stores outside a provider).
 *
 * `data-agents-trigger="true"` opts the button out of
 * `GlobalAgentsDesktopChrome`'s click-outside listener (avoids the
 * "mousedown closes -> onClick reopens" race). `aria-controls` points at
 * the panel id.
 */
export function GlobalAgentsTriggerDesktop({ variant }: { variant: "app" | "context" }) {
  const { open, setOpen } = useAgentsPanel()
  const { closeAll: closeNew } = useGlobalNew()
  const { closeToday } = useTodayDrawer()
  const { closeSearch } = useGlobalSearch()
  const { closeAsk } = useAskFanny()

  const handleClick = () => {
    const next = !open
    if (next) {
      closeNew()
      closeToday()
      closeSearch()
      closeAsk()
    }
    setOpen(next)
  }

  const base =
    variant === "app"
      ? "rounded-lg border border-[var(--border-dark)] bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary-light)] hover:bg-white/10"
      : "rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] shadow-sm hover:bg-[#F1F5F9]"

  return (
    <button
      type="button"
      onClick={handleClick}
      data-agents-trigger="true"
      aria-expanded={open}
      aria-haspopup="true"
      aria-controls="agents-desktop-chrome"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 transition-colors",
        base,
        open &&
          (variant === "app"
            ? "bg-white/10 ring-2 ring-[var(--accent-primary)]/40"
            : "bg-[#F1F5F9] ring-2 ring-[#3B82F6]/30"),
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
      <span>Agents</span>
    </button>
  )
}

/**
 * Mobile trigger for the global Agents drawer — visual sibling of
 * `GlobalTodayTriggerMobile` / `GlobalNewTriggerMobile`.
 *
 * Icon-only (`Sparkles`), same hit area / tone tokens as the New + Today
 * mobile triggers. Mounted in `MobileSidebarNav`'s header AFTER New.
 *
 * Behaviour mirrors `GlobalTodayTriggerMobile`:
 *   - Inside the shells (provider visible) → `openAgents()` opens the
 *     vaul drawer. Before opening we close the other mobile surfaces
 *     (New sheet + Today drawer) so two bottom sheets never stack.
 *   - On un-shelled legacy pages (`MobileSidebarNav` above the provider)
 *     the hook returns `available: false` and we navigate to `/agents`
 *     instead of a silent no-op.
 *
 * `openAgents()` (one-way) is preferred over toggling on mobile: vaul's
 * own swipe/back-press is the canonical close path.
 */
export function GlobalAgentsTriggerMobile() {
  const { open, openAgents, available } = useAgentsPanel()
  const { closeAll: closeNew } = useGlobalNew()
  const { closeToday } = useTodayDrawer()
  const { closeAsk } = useAskFanny()
  const router = useRouter()

  const onClick = () => {
    if (available) {
      closeNew()
      closeToday()
      closeAsk()
      openAgents()
    } else {
      router.push("/agents")
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-agents-trigger="true"
      aria-label="Agents"
      aria-expanded={available ? open : undefined}
      className={cn(
        "rounded-md p-1.5 text-[var(--app-sidebar-text-muted)] transition-colors hover:bg-white/10 hover:text-white",
        available && open && "text-white",
      )}
    >
      <Sparkles size={22} strokeWidth={2} />
    </button>
  )
}
