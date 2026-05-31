"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRight, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAgentsPanel } from "@/components/agents/agents-panel-provider"
import { GlobalAgentsPanel, type AgentsQuickTone } from "./global-agents-panel"
import { useAgentsActivityData } from "./use-agents-activity-data"

/**
 * Desktop top chrome for the global Agents quick view.
 *
 * Visual sibling of `GlobalTodayDesktopChrome` / `GlobalNewDesktopPanel`
 * — all three hang from the workspace toolbar and grow DOWN inside the
 * same `sticky top-0` container:
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Today | New | Agents | Search   (toolbar)            │
 *   ├──────────────────────────────────────────────────────┤
 *   │ New panel        (grid-rows 0fr/1fr)                 │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Today panel      (grid-rows 0fr/1fr)                 │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Agents panel     (grid-rows 0fr/1fr) <-- THIS        │
 *   ├──────────────────────────────────────────────────────┤
 *   │ <main> page content                                  │
 *
 * Mounting: the shells (`AppShell`, `ContextShell`) place this as a
 * SIBLING of the New + Today chromes inside the same sticky-top
 * container. Each chrome owns its own ref + click-outside listener;
 * mutual exclusion is enforced at the trigger level (each trigger closes
 * the other three surfaces when it opens), so stacking them stays
 * cosmetic — only one is ever open.
 *
 * Hidden on mobile via `hidden md:block`; `useIsMobile` also gates the
 * data fetch so a CSS-hidden node never double-fetches against
 * `/api/agents/activity`. Mobile uses `<AgentsMobileDrawer>` exclusively.
 *
 * Click-outside / Escape / pathname-change closing is hand-rolled,
 * identical to `GlobalTodayDesktopChrome`. The click-outside listener
 * (`mousedown`) skips `[data-agents-trigger]` so the trigger owns its
 * own toggle without racing the outside-dismiss.
 */
export function GlobalAgentsDesktopChrome({ variant }: { variant: "app" | "context" }) {
  const ref = useRef<HTMLDivElement>(null)
  const { open, setOpen } = useAgentsPanel()
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const isOpenOnDesktop = open && !isMobile

  const { loading, error, agents, lanes, totalItems } =
    useAgentsActivityData(isOpenOnDesktop)

  // ─── Click-outside (mousedown) ────────────────────────────────────
  useEffect(() => {
    if (!isOpenOnDesktop) return
    function handle(e: MouseEvent) {
      const target = e.target as Element | null
      if (target?.closest?.("[data-agents-trigger]")) return
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpenOnDesktop, setOpen])

  // ─── Escape to close ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpenOnDesktop) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpenOnDesktop, setOpen])

  // ─── Auto-close on route change ───────────────────────────────────
  useEffect(() => {
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const tone: AgentsQuickTone = variant === "app" ? "canvas" : "light"

  const panelSurface =
    variant === "app"
      ? "border-[var(--border-dark)] bg-[var(--app-shell-bg)]"
      : "border-[#E2E8F0] bg-[#F8FAFC]"
  const headerBorder =
    variant === "app" ? "border-[var(--border-dark)]" : "border-[#E2E8F0]"
  const headerTitle =
    variant === "app" ? "text-[var(--text-primary-light)]" : "text-[#0F172A]"
  const headerSubtitle =
    variant === "app" ? "text-[var(--text-secondary-light)]" : "text-[#64748B]"
  const headerCountBg = variant === "app" ? "bg-white/[0.06]" : "bg-[#F1F5F9]"
  const headerCountText =
    variant === "app" ? "text-[var(--text-secondary-light)]" : "text-[#64748B]"
  const headerLinkText =
    variant === "app" ? "text-[var(--accent-primary)]" : "text-[#2563EB]"
  const headerLinkHover =
    variant === "app" ? "hover:bg-white/[0.06]" : "hover:bg-[#F1F5F9]"
  const headerIconHalo =
    variant === "app"
      ? "bg-[linear-gradient(135deg,rgba(47,128,237,0.20),rgba(139,92,246,0.20),rgba(236,72,153,0.20))] text-[var(--text-primary-light)]"
      : "bg-[#EEF2FF] text-[#4F46E5]"
  const headerCloseColour =
    variant === "app"
      ? "text-[var(--text-secondary-light)] hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
      : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
  const focusRing =
    variant === "app"
      ? "focus-visible:ring-[var(--accent-primary)]/40"
      : "focus-visible:ring-[#3B82F6]/35"

  return (
    <div
      ref={ref}
      id="agents-desktop-chrome"
      className="relative z-30 hidden shrink-0 md:block"
      data-agents-panel
    >
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpenOnDesktop ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!isOpenOnDesktop}
      >
        <div className="min-h-0 overflow-hidden">
          {/*
            Height fills the viewport below the sticky toolbar (≈3rem tall)
            so the open panel fully covers the underlying page — no page
            content peeks below it. Body scrolls internally via
            `overflow-y-auto` (same recipe as New / Today).
          */}
          <div
            className={cn(
              "flex h-[calc(100dvh-3rem)] flex-col overflow-hidden border-b shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
              panelSurface,
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3",
                headerBorder,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    headerIconHalo,
                  )}
                >
                  <Sparkles size={14} strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold tracking-tight", headerTitle)}>
                    Agents
                  </p>
                  <p className={cn("text-[11px] leading-tight", headerSubtitle)}>
                    What your AI agents are doing · workspace-wide
                  </p>
                </div>
                {!loading && !error && totalItems > 0 ? (
                  <span
                    className={cn(
                      "ml-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      headerCountBg,
                      headerCountText,
                    )}
                  >
                    {totalItems}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href="/agents"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    headerLinkText,
                    headerLinkHover,
                    "focus-visible:outline-none focus-visible:ring-2",
                    focusRing,
                  )}
                >
                  Open full Agents
                  <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Agents panel"
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    headerCloseColour,
                    "focus-visible:outline-none focus-visible:ring-2",
                    focusRing,
                  )}
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
                tone={tone}
                onRowNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
