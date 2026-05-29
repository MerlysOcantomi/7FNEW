"use client"

import Link from "next/link"
import { ArrowUpRight, Sparkles, X } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { GlobalAgentsPanel } from "./global-agents-panel"
import { useAgentsActivityData } from "./use-agents-activity-data"

/**
 * Mobile surface for the compact Agents quick view.
 *
 * Thin wrapper around the existing vaul `Drawer` — same recipe as
 * `TodayMobileDrawer`. The body and the data hook are shared with the
 * desktop chrome (`GlobalAgentsPanel` + `useAgentsActivityData`) so the
 * two surfaces stay in lock-step.
 *
 * Lazy fetch: `useAgentsActivityData(open)` only builds the
 * `/api/agents/activity` URL when `open === true`, so leaving this
 * wrapper mounted globally has no idle cost.
 */
export function AgentsMobileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { loading, error, agents, lanes, totalItems } =
    useAgentsActivityData(open)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "bg-[var(--app-shell-bg)] text-[var(--text-primary-light)]",
          "data-[vaul-drawer-direction=bottom]:max-h-[70vh]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,rgba(47,128,237,0.20),rgba(139,92,246,0.20),rgba(236,72,153,0.20))] text-[var(--text-primary-light)]"
            >
              <Sparkles size={14} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <DrawerTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
                Agents
              </DrawerTitle>
              <DrawerDescription className="text-[11px] leading-tight text-[var(--text-secondary-light)]">
                What your AI agents are doing · workspace-wide
              </DrawerDescription>
            </div>
            {!loading && !error && totalItems > 0 ? (
              <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary-light)]">
                {totalItems}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/agents"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-white/[0.06]"
            >
              Open full Agents
              <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
            </Link>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close Agents drawer"
              className="rounded-md p-1 text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <GlobalAgentsPanel
            loading={loading}
            error={error}
            agents={agents}
            lanes={lanes}
            totalItems={totalItems}
            tone="canvas"
            onRowNavigate={() => onOpenChange(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
