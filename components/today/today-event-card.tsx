"use client"

import Link from "next/link"
import { CalendarDays, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import type { TodayItem } from "@modules/today/types"

/**
 * Calendar event card for the Today view. Visually distinct from a task row so
 * the operator can tell at a glance "this is on my calendar" vs "this needs me
 * to do something". Not actionable in PR 1: clicking navigates to the global
 * `/calendario` view rather than completing/dismissing inline.
 */
export function TodayEventCard({ item }: { item: TodayItem }) {
  const { t, locale } = useI18n()
  const row = t.today.workboard.row
  if (item.kind !== "event" || item.source.kind !== "calendar") {
    /** Defensive — only render the event variant for calendar-sourced rows. */
    return null
  }

  const timeChip = formatEventTime(item.dueAt, toIntlLocale(locale))
  const ariaLabel = [
    row.eventAria,
    item.title,
    timeChip ? row.atTime(timeChip) : null,
    row.fromCalendar,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Link
      href={item.source.href}
      aria-label={ariaLabel}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3 transition-all",
        /**
         * Slight accent tint on the leading edge so events read distinct from
         * tasks even before the operator parses the icon. We avoid using the
         * status palette here — events aren't "urgent" by default, they're
         * just scheduled.
         */
        "border-l-2 border-l-[var(--accent-primary)]/60",
        "hover:bg-[var(--app-surface-dark-elevated)] hover:shadow-[var(--app-shadow-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
      )}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
      >
        <CalendarDays size={13} strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--text-primary-light)]">
            {item.title}
          </p>
          {timeChip ? (
            <span
              className="inline-flex items-center rounded-md bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--text-secondary-light)]"
              suppressHydrationWarning
            >
              {timeChip}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[var(--text-secondary-light)]">
            {item.description}
          </p>
        ) : null}
        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
            <CalendarDays size={10} className="shrink-0" aria-hidden="true" />
            {row.fromCalendar}
          </span>
        </div>
      </div>

      <ArrowUpRight
        size={13}
        className="shrink-0 text-[var(--text-secondary-light)]/70 transition-colors group-hover:text-[var(--text-primary-light)]"
        aria-hidden="true"
      />
    </Link>
  )
}

/** "10:30 AM" style time, locale-aware. Returns empty string on bad input. */
function formatEventTime(iso: string | null, intlLocale: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(intlLocale, { hour: "numeric", minute: "2-digit" })
}
