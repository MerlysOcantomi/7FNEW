import type { TodayItem } from "@modules/today/types"
import { TodayTaskRow } from "./today-task-row"
import { TodayEventCard } from "./today-event-card"

/**
 * One bucket section in Today: a labelled `<section>` of task rows + event
 * cards. When `items` is empty the parent should not render this at all; we
 * still bail defensively so a stray empty render never shows a "0" header.
 *
 * `tone` colours the sub-bucket dot + label so the operator can scan priority
 * without reading: Overdue → urgency, Due today → neutral, Waiting → warning
 * (amber/lead), No date → muted. All colours are theme tokens so the section
 * reads correctly in Midnight and Lavender Mist.
 */
type TodaySectionTone = "urgency" | "neutral" | "warning" | "muted"

const TONE_COLOR: Record<TodaySectionTone, string> = {
  urgency: "var(--inbox-urgency)",
  warning: "var(--inbox-lead)",
  neutral: "var(--text-secondary-light)",
  muted: "var(--text-tertiary-light)",
}

export function TodaySection({
  id,
  title,
  tone = "neutral",
  items,
  onLaneMove,
  onLegacyHandoff,
}: {
  id: string
  title: string
  tone?: TodaySectionTone
  items: TodayItem[]
  /**
   * Forwarded to each `<TodayTaskRow>` so the parent surface owns the mutation
   * lifecycle. When omitted, rows render without the Send-to-AI / Take-over
   * affordances — correct for any read-only reuse of this primitive.
   */
  onLaneMove?: (taskId: string, to: "user" | "ai") => void | Promise<void>
  /** Forwarded to each row for legacy `Tarea` → AI conversion. */
  onLegacyHandoff?: (tareaId: string) => void | Promise<void>
}) {
  if (items.length === 0) return null

  const headingId = `${id}-heading`
  const color = TONE_COLOR[tone]

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2
          id={headingId}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color }}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          {title}
        </h2>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">{items.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) =>
          item.kind === "event" ? (
            <TodayEventCard key={item.id} item={item} />
          ) : (
            <TodayTaskRow
              key={item.id}
              item={item}
              onLaneMove={onLaneMove}
              onLegacyHandoff={onLegacyHandoff}
            />
          ),
        )}
      </div>
    </section>
  )
}
