"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { EventDNA } from "./event-dna-view"
import { primaryCta } from "./event-dna"
import { PanelModeSwitcher } from "./panel-mode-switcher"
import type { PanelMode } from "./panel-modes"
import type { CalendarItem } from "./types"

export interface PanelEmptyHint {
  dayCount: number
  dayLabel: string
  /** Active lens context (real, month-scoped) — shown only when a lens is on. */
  lens?: { label: string; count: number } | null
}

/**
 * Calendar-local 7F Intelligence Panel (PR3). Wraps EventDNA + a date/module-
 * aware next action + an on-demand (never auto) AI timing insight, plus a
 * Time-Intelligence empty state with open-time + lens context. Mode-aware:
 * `compact` trims to the essentials. Structured so the generic pieces
 * (panel-modes / switcher) can be hoisted to a shared panel later — this file
 * stays the calendar-specific binding. Mount with key={item.id} so AI resets.
 */
export function CalendarIntelligencePanel({
  item,
  today,
  inConflict = false,
  onOpenDate,
  onClose,
  mode,
  onModeChange,
  showSwitcher = true,
  emptyHint,
}: {
  item: CalendarItem | null
  today: Date
  inConflict?: boolean
  onOpenDate?: (iso: string) => void
  onClose?: () => void
  mode: PanelMode
  onModeChange: (mode: PanelMode) => void
  showSwitcher?: boolean
  emptyHint?: PanelEmptyHint
}) {
  const { t, locale } = useI18n()
  const cal = t.calendar
  const [aiLoading, setAiLoading] = useState(false)
  const [insight, setInsight] = useState("")
  const compact = mode === "compact"

  async function getTimingInsight() {
    if (!item) return
    setAiLoading(true)
    setInsight("")
    try {
      const when = new Date(item.date).toLocaleDateString(toIntlLocale(locale), { weekday: "long", month: "short", day: "numeric" })
      const prompt = `Timing analysis for the calendar item "${item.title}" (${item.type}, status: ${item.status}${item.priority ? `, priority: ${item.priority}` : ""}, date: ${when}). Focus ONLY on timing: the best time/slot, any buffer it needs, scheduling conflicts, and how close it is to its deadline. Give a concise timing recommendation — not a to-do list.`
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "operativo" }),
      })
      const json = await res.json()
      setInsight(json.success ? json.data.result : cal.panel.aiError)
    } catch {
      setInsight(cal.panel.aiError)
    } finally {
      setAiLoading(false)
    }
  }

  const header = (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
      <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
        <Sparkles className="h-3 w-3" /> {cal.timeIntelligence}
      </p>
      <div className="flex items-center gap-1">
        {showSwitcher && <PanelModeSwitcher value={mode} onChange={onModeChange} />}
        {onClose && (
          <button type="button" onClick={onClose} aria-label={cal.panel.clearSelectionAria} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )

  if (!item) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-muted-border)]">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{cal.panel.emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-muted-foreground">
              {cal.panel.emptyBody}
            </p>
          </div>
          {emptyHint && (
            <div className="mt-1 w-full max-w-[260px] rounded-lg border border-border bg-[var(--app-surface-dark-elevated)] px-3 py-2.5 text-left">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{emptyHint.dayLabel}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
                {emptyHint.dayCount === 0 ? cal.panel.openTimeHint : cal.panel.dayCountHint(emptyHint.dayCount)}
              </p>
              {emptyHint.lens && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-[var(--accent-primary)]">
                  <Sparkles className="h-2.5 w-2.5 shrink-0" /> {cal.panel.lensHint(emptyHint.lens.label, emptyHint.lens.count)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const cta = primaryCta(item, today, inConflict, cal.dna.cta)
  const ctaCls =
    "flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <EventDNA item={item} today={today} inConflict={inConflict} compact={compact} />

        {/* Suggested next time-aware action */}
        <div className="mt-4">
          {cta.href ? (
            <Link href={cta.href} className={ctaCls}>
              {cta.label}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <button type="button" onClick={() => onOpenDate?.(item.date)} className={ctaCls}>
              {cta.label}
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* AI timing insight — user-triggered only (never auto); hidden in compact density */}
        {!compact && (
          <>
            <button
              type="button"
              onClick={getTimingInsight}
              disabled={aiLoading}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                aiLoading ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80",
              )}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> {cal.panel.analyzing}
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> {cal.panel.timingInsight}
                </>
              )}
            </button>
            {insight && (
              <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">{cal.panel.timingInsight}</p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{insight}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
