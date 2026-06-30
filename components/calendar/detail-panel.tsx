"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { priorityLabel, statusLabel } from "./labels"
import { typeColors, typeIcons, typeLabel } from "./tokens"
import type { CalendarItem } from "./types"

function formatFull(date: string): string {
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return "—"
  return new Date(t).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
}
function formatTime(date: string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/**
 * Date-aware primary CTA — Calendar stays time/date-real and routes to the
 * surface that actually owns the item instead of always bridging to Today:
 *   • due today        → Open in Today   (today's execution)
 *   • overdue task     → Open in Tasks   (pending/overdue work)
 *   • overdue invoice  → Open in Finance (payment-risk context)
 *   • otherwise (future, or past & not active) → Go to date (jump the calendar)
 * Returns no href for "Go to date" → the panel wires it to onOpenDate.
 */
function primaryCta(item: CalendarItem, today: Date): { label: string; href?: string } {
  const itemDay = startOfDay(new Date(item.date))
  const todayDay = startOfDay(today)
  if (Number.isNaN(itemDay)) return { label: "Go to date" }
  if (itemDay === todayDay) return { label: "Open in Today", href: "/today" }
  if (itemDay < todayDay) {
    if (item.type === "tarea" && item.status !== "completada" && item.status !== "cancelada")
      return { label: "Open in Tasks", href: "/tareas" }
    if (item.type === "factura" && item.status !== "pagada" && item.status !== "cancelada")
      return { label: "Open in Finance", href: "/finanzas" }
  }
  return { label: "Go to date" }
}

/**
 * Basic Docked detail panel (PR1). Time-first framing: When → context →
 * "Open in Today" bridge (Calendar hands execution to Today) → "Timing insight"
 * (secondary, real /api/ai). The full 5-mode panel + EventDNA land in PR2.
 * Mount with key={item.id} so AI state resets per item.
 */
export function CalendarDetailPanel({
  item,
  onClose,
  today,
  onOpenDate,
  emptyHint,
}: {
  item: CalendarItem | null
  onClose?: () => void
  today: Date
  onOpenDate?: (iso: string) => void
  /** Real, focused-day signal for the empty state — never fabricated. */
  emptyHint?: { dayCount: number; dayLabel: string }
}) {
  const [aiLoading, setAiLoading] = useState(false)
  const [insight, setInsight] = useState("")

  async function getTimingInsight() {
    if (!item) return
    setAiLoading(true)
    setInsight("")
    try {
      const when = new Date(item.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
      const prompt = `Timing analysis for the calendar item "${item.title}" (${item.type}, status: ${item.status}${item.priority ? `, priority: ${item.priority}` : ""}, date: ${when}). Focus ONLY on timing: the best time/slot, any buffer it needs, scheduling conflicts, and how close it is to its deadline. Give a concise timing recommendation — not a to-do list.`
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "operativo" }),
      })
      const json = await res.json()
      setInsight(json.success ? json.data.result : "Couldn't load a timing insight.")
    } catch {
      setInsight("Couldn't load a timing insight.")
    } finally {
      setAiLoading(false)
    }
  }

  if (!item) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center border-b border-border px-5 py-4">
          <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
            <Sparkles className="h-3 w-3" /> Time Intelligence
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-muted-border)]">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Select an event</p>
            <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-muted-foreground">
              See its timing, context and the next action — without leaving the calendar.
            </p>
          </div>
          {emptyHint && (
            <div className="mt-1 w-full max-w-[260px] rounded-lg border border-border bg-[var(--app-surface-dark-elevated)] px-3 py-2.5 text-left">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{emptyHint.dayLabel}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">
                {emptyHint.dayCount === 0
                  ? "Open time — a clean block to plan deliberately."
                  : `${emptyHint.dayCount} scheduled — pick one to inspect its timing.`}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const Icon = typeIcons[item.type]
  const start = item.allDay ? null : formatTime(item.date)
  const end = item.allDay ? null : formatTime(item.endDate)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Details</p>
        {onClose && (
          <button type="button" onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: typeColors[item.type] }} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{item.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 18%, transparent)`, color: typeColors[item.type] }}
              >
                {typeLabel[item.type]}
              </span>
              <span className="text-[10px] text-muted-foreground">{statusLabel(item)}</span>
              {priorityLabel(item.priority) && (
                <span className="text-[10px] text-muted-foreground">· {priorityLabel(item.priority)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-[var(--app-surface-dark-elevated)] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">When</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{formatFull(item.date)}</p>
          {start ? (
            <p className="text-xs text-muted-foreground">{end ? `${start} – ${end}` : start}</p>
          ) : (
            <p className="text-xs text-muted-foreground">All day</p>
          )}
        </div>

        {item.extra && <p className="mt-3 text-xs text-muted-foreground">{item.extra}</p>}

        {(() => {
          const cta = primaryCta(item, today)
          const cls =
            "mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          return cta.href ? (
            <Link href={cta.href} className={cls}>
              {cta.label}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <button type="button" onClick={() => onOpenDate?.(item.date)} className={cls}>
              {cta.label}
              <ChevronRight className="h-3 w-3" />
            </button>
          )
        })()}

        <button
          type="button"
          onClick={getTimingInsight}
          disabled={aiLoading}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
            aiLoading ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80",
          )}
        >
          {aiLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</> : <><Sparkles className="h-3 w-3" /> Timing insight</>}
        </button>

        {insight && (
          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Timing insight</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{insight}</p>
          </div>
        )}
      </div>
    </div>
  )
}
