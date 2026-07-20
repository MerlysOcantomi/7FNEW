"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useI18n } from "@/components/i18n-provider"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, ArrowUpRight, AlertTriangle, Loader2, Sun, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"
import { useTodayQuickData } from "./today-quick-data"
import type { TodayItem, TodayPriority } from "@modules/today/types"
import type { TodayMessages } from "@core/i18n/ui"

type TodayCatalog = TodayMessages

/**
 * Desktop Today "peek" — a compact anchored dropdown.
 *
 * Replaces the previous full-viewport takeover (`h-[calc(100dvh-3rem)]`) that
 * felt emptier than Full Today. Now a ~520px card hangs under the toolbar's
 * Today button (first action), with a caret pointing at it and a light scrim
 * over the page behind. It is a BRIEFING peek — it summarises and links out; it
 * does not duplicate Full Today (no sub-buckets, no Waiting/Schedule/No-date
 * lists, no inline actions) and carries no Fanny voice.
 *
 * Unchanged on purpose: the trigger (`global-today-trigger.tsx`), provider,
 * data hook (`today-quick-data.ts`), `/api/today`, lane classification, and the
 * mobile vaul drawer. `TodayQuickContent` is still the mobile body — it is no
 * longer used here. Click-outside (mousedown) / Escape / route-change auto-close
 * and `data-today-trigger` skipping are preserved.
 *
 * Theming: surfaces come from the active theme's tokens (Midnight / Lavender),
 * so the old slate `tone="light"` ContextShell path is gone — no hardcoded hex.
 */

const PANEL_MAX_WIDTH = 520

interface Anchor {
  top: number
  left: number
  width: number
  caretLeft: number
  scrimTop: number
}

/** Measure the visible Today trigger and derive the dropdown placement. */
function measureAnchor(): Anchor {
  const vw = window.innerWidth
  const width = Math.min(PANEL_MAX_WIDTH, vw - 24)
  const triggers = Array.from(document.querySelectorAll<HTMLElement>("[data-today-trigger]"))
  // Skip the hidden mobile trigger (0-width); take the visible desktop one.
  const trigger = triggers.find((el) => el.getBoundingClientRect().width > 0) ?? triggers[0]
  if (!trigger) {
    return { top: 56, left: 12, width, caretLeft: 24, scrimTop: 48 }
  }
  const r = trigger.getBoundingClientRect()
  const left = Math.max(12, Math.min(r.left, vw - width - 12))
  const caretLeft = Math.max(16, Math.min(r.left + r.width / 2 - left - 5, width - 28))
  return { top: r.bottom + 8, left, width, caretLeft, scrimTop: r.bottom }
}

/** Locale-aware compact due phrase — copy comes from the `today` catalog. */
function formatDue(iso: string | null, today: TodayCatalog): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const due = today.workboard.row.due
  const diffDays = Math.round((date.getTime() - Date.now()) / 86_400_000)
  if (diffDays === 0) {
    return due.todayAt(date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))
  }
  if (diffDays === -1) return due.yesterday
  if (diffDays === 1) return due.tomorrow
  if (diffDays > -7 && diffDays < 0) return due.daysAgo(Math.abs(diffDays))
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function sourceLabel(item: TodayItem, today: TodayCatalog): string {
  const s = item.source
  if (s.kind === "inbox") return today.quick.sources.inbox
  if (s.kind === "project") return s.projectName ?? today.workboard.row.projectFallback
  if (s.kind === "calendar") return today.quick.sources.calendar
  return today.quick.sources.task
}

/** Priority → dot colour token (urgency / neutral / muted). */
function priorityColor(p: TodayPriority | null): string {
  if (p === "critical" || p === "high") return "var(--inbox-urgency)"
  if (p === "low") return "var(--text-tertiary-light)"
  return "var(--text-secondary-light)"
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"

function NeedsRow({ item, onNavigate }: { item: TodayItem; onNavigate: () => void }) {
  const { t } = useI18n()
  const meta = [formatDue(item.dueAt, t.today), sourceLabel(item, t.today)].filter(Boolean).join(" · ")
  return (
    <Link
      href={item.source.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--app-surface-dark-hover)]",
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: priorityColor(item.priority) }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-[var(--text-primary-light)]">{item.title}</p>
        {meta ? (
          <p suppressHydrationWarning className="truncate text-[11px] text-[var(--text-tertiary-light)]">
            {meta}
          </p>
        ) : null}
      </div>
      <ArrowUpRight
        size={12}
        aria-hidden="true"
        className="shrink-0 text-[var(--text-tertiary-light)] transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

export function GlobalTodayDesktopChrome({ variant }: { variant: "app" | "context" }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const { open, setOpen } = useTodayDrawer()
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const isOpenOnDesktop = open && !isMobile
  const { loading, error, lanes, counts } = useTodayQuickData(isOpenOnDesktop)

  const [anchor, setAnchor] = useState<Anchor | null>(null)

  // ─── Anchor measurement (on open + resize) ────────────────────────
  useEffect(() => {
    if (!isOpenOnDesktop) {
      setAnchor(null)
      return
    }
    setAnchor(measureAnchor())
    const onResize = () => setAnchor(measureAnchor())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [isOpenOnDesktop])

  // ─── Click-outside (mousedown), skips the trigger ─────────────────
  useEffect(() => {
    if (!isOpenOnDesktop) return
    function handle(e: MouseEvent) {
      const target = e.target as Element | null
      if (target?.closest?.("[data-today-trigger]")) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  // "Needs you" = actionable items only: overdue first, then due-today,
  // across both task lanes (mine + ai). No waiting / no-date / schedule.
  const needs = useMemo(
    () => [
      ...lanes.mine.overdue,
      ...lanes.ai.overdue,
      ...lanes.mine.today,
      ...lanes.ai.today,
    ],
    [lanes],
  )

  if (!isOpenOnDesktop || anchor === null || typeof document === "undefined") return null

  const overdueCount = lanes.mine.overdue.length + lanes.ai.overdue.length
  const todayCount = lanes.mine.today.length + lanes.ai.today.length
  const needN = needs.length
  const visible = needs.slice(0, 5)
  const moreCount = needN - visible.length
  const waitingText = t.today.workboard.summary.waiting(counts.waiting)
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const chips: { label: string; value: number }[] = [
    { label: t.today.workboard.pills.myWork, value: counts.mine },
    { label: t.today.quick.aiChip, value: counts.ai },
    { label: t.today.workboard.pills.schedule, value: counts.schedule },
    { label: t.today.workboard.pills.waiting, value: counts.waiting },
  ]

  return createPortal(
    <>
      {/* Light scrim below the topbar — page stays visible, not a fullscreen takeover. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40"
        style={{ top: anchor.scrimTop, background: "rgba(8,5,18,0.45)" }}
      />

      <div
        ref={ref}
        id="today-desktop-chrome"
        role="dialog"
        aria-label={t.nav.today}
        data-variant={variant}
        className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
        style={{
          top: anchor.top,
          left: anchor.left,
          width: anchor.width,
          maxHeight: "min(440px, calc(100dvh - 5rem))",
        }}
      >
        {/* Caret pointing up at the trigger */}
        <span
          aria-hidden="true"
          className="absolute -top-[6px] h-3 w-3 rotate-45 border-l border-t border-[var(--border-dark)] bg-[var(--app-surface-dark)]"
          style={{ left: anchor.caretLeft }}
        />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
            >
              <Sun size={14} strokeWidth={1.9} />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary-light)]">{t.nav.today}</span>
              <span suppressHydrationWarning className="text-[11px] text-[var(--text-secondary-light)]">
                {dateLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/today"
              onClick={() => setOpen(false)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-on-dark)] transition-colors hover:bg-[var(--app-surface-dark-hover)]",
                FOCUS_RING,
              )}
            >
              {t.today.chrome.openFull}
              <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.today.chrome.close}
              className={cn(
                "rounded-md p-1 text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-dark-hover)] hover:text-[var(--text-primary-light)]",
                FOCUS_RING,
              )}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          {loading ? (
            <div role="status" aria-live="polite" className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary-light)]" aria-label={t.today.workboard.loadingAria} />
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center"
            >
              <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.today.workboard.errorNote}</p>
            </div>
          ) : (
            <>
              {/* Status line / empty */}
              {needN === 0 ? (
                <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-7 text-center">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
                  >
                    <Sun size={18} strokeWidth={1.9} />
                  </span>
                  <p className="text-[13px] font-medium text-[var(--text-primary-light)]">{t.today.workboard.emptyState.title}</p>
                  <p className="text-[12px] text-[var(--text-secondary-light)]">
                    {t.today.workboard.emptyState.body}
                  </p>
                </div>
              ) : (
                <div className="mb-3.5">
                  <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">
                    {t.today.quick.needsCount(needN)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary-light)]">
                    <span style={overdueCount > 0 ? { color: "var(--inbox-urgency)" } : undefined}>
                      {t.today.workboard.summary.overdue(overdueCount)}
                    </span>{" "}
                    · {t.today.workboard.summary.dueToday(todayCount)} · {waitingText}
                  </p>
                </div>
              )}

              {/* Count chips */}
              <div className="grid grid-cols-4 gap-2">
                {chips.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2.5 py-2"
                  >
                    <p className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
                      {c.label}
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--text-primary-light)]">
                      {c.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Needs-you list */}
              {needN > 0 ? (
                <div className="mt-3 flex flex-col gap-0.5">
                  {visible.map((item) => (
                    <NeedsRow key={item.id} item={item} onNavigate={() => setOpen(false)} />
                  ))}
                  {moreCount > 0 ? (
                    <Link
                      href="/today"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "mt-1 inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-[var(--accent-on-dark)] transition-colors hover:bg-[var(--app-surface-dark-hover)]",
                        FOCUS_RING,
                      )}
                    >
                      {t.today.quick.moreInToday(moreCount)}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--border-dark)] p-3">
          <Link
            href="/today"
            onClick={() => setOpen(false)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)]",
              FOCUS_RING,
            )}
            style={{ background: "var(--accent-primary)" }}
          >
            {t.today.chrome.openFull}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </>,
    document.body,
  )
}
