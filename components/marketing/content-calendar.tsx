"use client"

import type { CSSProperties } from "react"
import type { BeautyMarketingMessages } from "@modules/marketing/i18n"
import type { CalendarItemKind, EditorialCalendarDay } from "@modules/marketing/types"
import { CARD_CLASS } from "./marketing-ui"

const ITEM_KIND_STYLE: Record<CalendarItemKind, CSSProperties> = {
  post: {
    background: "var(--inbox-info-soft, color-mix(in srgb, var(--inbox-info) 12%, transparent))",
    color: "var(--inbox-info)",
  },
  reel: {
    background: "var(--accent-muted)",
    color: "var(--accent-on-dark)",
  },
  story: {
    background: "var(--inbox-success-soft, color-mix(in srgb, var(--inbox-success) 12%, transparent))",
    color: "var(--inbox-success)",
  },
  "campaña": {
    background: "var(--inbox-lead-soft, color-mix(in srgb, var(--inbox-lead) 12%, transparent))",
    color: "var(--inbox-lead)",
  },
}

/**
 * "Content calendar" — a simple 7-day editorial strip (posts, reels,
 * stories, campaigns, today highlighted) with regional weekday labels.
 * Editorial only: it never replaces the general appointments calendar. On
 * mobile the parent renders it inside a collapsible block so the screen never
 * gets too long.
 */
export function ContentCalendar({
  messages,
  days,
  showHeading = true,
}: {
  messages: BeautyMarketingMessages
  days: EditorialCalendarDay[]
  showHeading?: boolean
}) {
  const t = messages.calendar
  const isEmpty = days.every((d) => d.items.length === 0)

  return (
    <section aria-labelledby={showHeading ? "content-calendar-title" : undefined}>
      {showHeading ? (
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2
            id="content-calendar-title"
            className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]"
          >
            {t.sectionTitle}
          </h2>
          <span className="font-mono text-[10.5px] text-[var(--text-tertiary-light)]">{t.sectionHint}</span>
        </div>
      ) : null}

      <div className={`${CARD_CLASS} p-3.5`}>
        {/* 7 columns; horizontal scroll inside its own container on very
            narrow screens so the page body never scrolls horizontally. */}
        <div className="overflow-x-auto">
          <ul className="grid min-w-[560px] grid-cols-7 gap-2" role="list">
            {days.map((day) => (
              <li
                key={day.date}
                className="flex min-h-[88px] flex-col items-center rounded-xl border px-1.5 py-2.5"
                style={
                  day.isToday
                    ? { background: "var(--app-surface-active)", borderColor: "var(--accent-muted-border)" }
                    : { borderColor: "var(--border-dark)" }
                }
                aria-current={day.isToday ? "date" : undefined}
              >
                <p
                  className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: day.isToday ? "var(--accent-on-dark)" : "var(--text-tertiary-light)" }}
                >
                  {day.weekday}
                </p>
                <p
                  className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums"
                  style={{ color: day.isToday ? "var(--accent-on-dark)" : "var(--text-primary-light)" }}
                >
                  {day.dayNumber}
                </p>
                <div className="mt-2 flex w-full flex-col gap-1">
                  {day.items.map((item) => (
                    <span
                      key={item.id}
                      className="w-full truncate rounded-md px-1.5 py-0.5 text-center text-[9px] font-semibold"
                      style={ITEM_KIND_STYLE[item.kind]}
                      title={`${item.label} · ${t.itemKindLabels[item.kind]}`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
        {isEmpty ? (
          <p className="mt-2.5 text-center text-[11.5px] text-[var(--text-tertiary-light)]">{t.empty}</p>
        ) : null}
      </div>
    </section>
  )
}
