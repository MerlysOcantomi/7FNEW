import { cn } from "@/lib/utils"
import type { TodayItem } from "@modules/today/types"
import { TodayTaskRow } from "./today-task-row"
import { TodayEventCard } from "./today-event-card"

/**
 * One bucket section in Today: a labelled `<section>` containing a stacked
 * list of task rows + event cards. Per the PR 1 design rule, when `items` is
 * empty the parent should NOT render this component at all — we still bail
 * defensively here so an accidental empty render doesn't show a header with
 * "0 items" underneath.
 *
 * `tone`:
 *   - `"default"` — Today + Undated.
 *   - `"warning"` — Overdue. Slight tint on the header so the operator can
 *                   visually pick out "this is the bucket I should clear".
 */
export function TodaySection({
  id,
  title,
  tone = "default",
  items,
  onLaneMove,
}: {
  id: string
  title: string
  tone?: "default" | "warning"
  items: TodayItem[]
  /**
   * Forwarded to each `<TodayTaskRow>` so the parent surface (page or
   * drawer) owns the mutation lifecycle. When omitted, rows render
   * without the Send-to-AI / Take-over affordances — which is the
   * right behaviour for any read-only surface that may reuse this
   * primitive in the future.
   */
  onLaneMove?: (taskId: string, to: "user" | "ai") => void | Promise<void>
}) {
  if (items.length === 0) return null

  const headingId = `${id}-heading`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2
          id={headingId}
          className={cn(
            "text-[10px] font-semibold uppercase tracking-widest",
            tone === "warning"
              ? "text-[var(--status-warning-text)]"
              : "text-[var(--text-secondary-light)]",
          )}
        >
          {title}
        </h2>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) =>
          item.kind === "event" ? (
            <TodayEventCard key={item.id} item={item} />
          ) : (
            <TodayTaskRow key={item.id} item={item} onLaneMove={onLaneMove} />
          ),
        )}
      </div>
    </section>
  )
}
