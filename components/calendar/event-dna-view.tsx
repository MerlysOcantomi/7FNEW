"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { priorityLabel, statusLabel } from "./labels"
import { deriveDateMeaning, deriveTimingRisk, type TimingRiskTone } from "./event-dna"
import { typeColors, typeIcons } from "./tokens"
import type { CalendarItem } from "./types"

function formatFull(dateISO: string, intlLocale: string): string {
  const t = new Date(dateISO).getTime()
  if (Number.isNaN(t)) return "—"
  return new Date(t).toLocaleDateString(intlLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
}
function formatTime(dateISO: string | null | undefined, intlLocale: string): string | null {
  if (!dateISO) return null
  const d = new Date(dateISO)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
}

const TONE_CLASS: Record<TimingRiskTone, string> = {
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  neutral: "bg-muted text-muted-foreground",
}

/**
 * EventDNA — the honest read-out of the selected item: identity, timing risk,
 * when + what the date means, and related client/project/invoice context when
 * the feed actually carries it. Pure presentation of real fields (no fabricated
 * insight); the suggested ACTION lives in the panel, not here.
 */
export function EventDNA({
  item,
  today,
  inConflict = false,
  compact = false,
}: {
  item: CalendarItem
  today: Date
  inConflict?: boolean
  compact?: boolean
}) {
  const { t, locale } = useI18n()
  const cal = t.calendar
  const intlLocale = toIntlLocale(locale)
  const Icon = typeIcons[item.type]
  const start = item.allDay ? null : formatTime(item.date, intlLocale)
  const end = item.allDay ? null : formatTime(item.endDate, intlLocale)
  const meaning = deriveDateMeaning(item.date, today, cal.dna.meaning)
  const risk = deriveTimingRisk(item, today, inConflict, cal.dna.risks)
  const priority = priorityLabel(item.priority, t.statuses)

  const context: { label: string; value: string }[] = []
  if (item.clientName) context.push({ label: cal.dna.client, value: item.clientName })
  if (item.projectName) context.push({ label: cal.dna.project, value: item.projectName })
  if (item.type === "factura" && typeof item.invoiceTotal === "number")
    context.push({ label: cal.dna.amount, value: `$${item.invoiceTotal.toLocaleString(intlLocale)}` })

  return (
    <div className="flex flex-col gap-3">
      {/* Identity — what it is */}
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: typeColors[item.type] }} />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-snug text-foreground">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 18%, transparent)`, color: typeColors[item.type] }}
            >
              {cal.types[item.type]}
            </span>
            <span className="text-[10px] text-muted-foreground">{statusLabel(item, cal, t.statuses)}</span>
            {priority && <span className="text-[10px] text-muted-foreground">· {priority}</span>}
          </div>
        </div>
      </div>

      {/* Timing risk — "is this at risk?" in one glance */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", TONE_CLASS[risk.tone])}>
          {risk.label}
        </span>
        {risk.detail && <span className="text-[10px] text-muted-foreground">{risk.detail}</span>}
      </div>

      {/* When + what the date means */}
      <div className="rounded-lg border border-border bg-[var(--app-surface-dark-elevated)] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{cal.dna.when}</p>
          <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-primary)]">
            {meaning.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-foreground">{formatFull(item.date, intlLocale)}</p>
        <p className="text-xs text-muted-foreground">{start ? (end ? `${start} – ${end}` : start) : cal.dna.allDay}</p>
      </div>

      {/* Related context — only when the feed actually carries it (compact hides it) */}
      {!compact && context.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{cal.dna.context}</p>
          <div className="flex flex-col gap-1">
            {context.map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="min-w-0 truncate font-medium text-foreground">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
