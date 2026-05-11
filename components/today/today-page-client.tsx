"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2, Sparkles, UserRound } from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { useToast } from "@/components/toast-provider"
import { sendToAI as sendToAIRequest, takeOver as takeOverRequest } from "@/lib/today/lane-client"
import type { TodayBuckets, TodayPayload } from "@modules/today/types"
import { countLane, splitBucketsByLane } from "@modules/today/lanes"
import { TodaySection } from "./today-section"
import { TodayEmptyState } from "./today-empty-state"

/**
 * Today page body — owns the fetch lifecycle so the parent server component
 * stays a thin wrapper. Reads the browser timezone client-side and forwards
 * it to `/api/today` as `?tz=`; falls back to `"UTC"` when `Intl` returns
 * something unusable. The aggregator validates the timezone and substitutes
 * UTC if it's not a real IANA zone, so even a malformed query string is safe.
 *
 * Layout: a responsive two-column split
 *
 *   - "My work" — `assigneeType === "user"`. The operator-owned column.
 *   - "AI work" — `assigneeType === "ai"`. Fanny / AI-owned column;
 *                  includes `proposed` rows surfaced read-only with a pill.
 *
 * Each column reuses `<TodaySection>` for the Overdue / Due today / No date
 * buckets so the visual taxonomy stays identical across lanes. Events and
 * legacy `Tarea` fallback rows are intentionally NOT mixed into either lane
 * — they fall into the "other" classifier slot, which this layout hides for
 * now (a future surface can opt in once the product story for unowned work
 * is decided).
 *
 * Writes (Send to AI / Take over):
 *   - The row component fires `onLaneMove(taskId, "user" | "ai")` which we
 *     map to the `lib/today/lane-client` helpers (`PATCH /api/tasks/:id/
 *     assignee`).
 *   - On success → `refetch()` so the row reappears in the other column.
 *   - On error → toast with the server's error message; no UI changes
 *     because we deliberately avoid complex optimistic state in this PR.
 */
export function TodayPageClient() {
  const [timezone, setTimezone] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    /**
     * Defer TZ detection to client mount so SSR doesn't accidentally bake the
     * server's timezone into the URL. `Intl.DateTimeFormat` is universally
     * available in the browser; the try/catch is just paranoia for very old
     * runtimes that might throw on `resolvedOptions()`.
     */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  const url = timezone ? `/api/today?tz=${encodeURIComponent(timezone)}` : null
  const { data, loading, error, refetch } = useFetch<TodayPayload>(url)

  /**
   * Lane move handler. Wraps the lib helper so the row component can stay
   * unaware of fetch / toast / refetch concerns. We refetch on success
   * (correctness over optimistic state per the PR brief) and surface the
   * server error message verbatim on failure.
   */
  const handleLaneMove = useCallback(
    async (taskId: string, to: "user" | "ai") => {
      try {
        if (to === "ai") await sendToAIRequest(taskId)
        else await takeOverRequest(taskId)
        refetch()
      } catch (err) {
        addToast({
          type: "error",
          title: to === "ai" ? "Could not send to AI" : "Could not take over",
          description:
            err instanceof Error && err.message
              ? err.message
              : "Please try again in a moment.",
        })
      }
    },
    [addToast, refetch],
  )

  /**
   * `loading` is true while either (a) we haven't resolved the TZ yet, or
   * (b) the fetch is in flight. Both produce the same spinner so the user
   * sees a single calm state instead of "no fetch yet → fetching → done".
   */
  const showSpinner = loading || timezone === null

  const buckets: TodayBuckets = useMemo(
    () => data?.buckets ?? { overdue: [], today: [], undated: [] },
    [data?.buckets],
  )
  const lanes = useMemo(() => splitBucketsByLane(buckets), [buckets])
  const totalItems = useMemo(
    () => buckets.overdue.length + buckets.today.length + buckets.undated.length,
    [buckets.overdue.length, buckets.today.length, buckets.undated.length],
  )

  if (showSpinner) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-label="Loading Today">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
      >
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.5} />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <p className="mt-1 text-xs text-destructive/80">Today could not be loaded.</p>
      </div>
    )
  }

  if (totalItems === 0) {
    return <TodayEmptyState />
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <TodayLaneColumn
        idPrefix="today-mine"
        title="My work"
        icon={<UserRound size={13} strokeWidth={2} aria-hidden="true" />}
        buckets={lanes.mine}
        emptyTitle="No work assigned to you"
        emptyDescription="Tasks you take over or create will land here."
        onLaneMove={handleLaneMove}
      />
      <TodayLaneColumn
        idPrefix="today-ai"
        title="AI work"
        icon={<Sparkles size={13} strokeWidth={2} aria-hidden="true" />}
        buckets={lanes.ai}
        emptyTitle="No AI work yet"
        emptyDescription="AI work will appear here when Fanny proposes or starts work."
        onLaneMove={handleLaneMove}
      />
    </div>
  )
}

/**
 * One lane column. Renders the three buckets via `TodaySection` (which
 * gracefully no-ops when a bucket is empty) and falls back to a friendly
 * empty state when the entire lane is empty.
 *
 * Kept private to this file because it's tightly coupled to the page-level
 * layout decisions (heading copy, icon vocabulary, empty-state messaging).
 * Other surfaces that need a lane view should compose `TodaySection` +
 * `splitBucketsByLane` directly.
 */
function TodayLaneColumn({
  idPrefix,
  title,
  icon,
  buckets,
  emptyTitle,
  emptyDescription,
  onLaneMove,
}: {
  idPrefix: string
  title: string
  icon: React.ReactNode
  buckets: TodayBuckets
  emptyTitle: string
  emptyDescription: string
  onLaneMove: (taskId: string, to: "user" | "ai") => void | Promise<void>
}) {
  const count = countLane(buckets)

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-[var(--text-primary-light)]"
          >
            {icon}
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
            {title}
          </h2>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {count}
        </span>
      </header>

      {count === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-6"
        >
          <p className="text-xs font-medium text-[var(--text-primary-light)]">{emptyTitle}</p>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <TodaySection
            id={`${idPrefix}-overdue`}
            title="Overdue"
            tone="warning"
            items={buckets.overdue}
            onLaneMove={onLaneMove}
          />
          <TodaySection
            id={`${idPrefix}-due-today`}
            title="Due today"
            items={buckets.today}
            onLaneMove={onLaneMove}
          />
          <TodaySection
            id={`${idPrefix}-no-date`}
            title="No date"
            items={buckets.undated}
            onLaneMove={onLaneMove}
          />
        </div>
      )}
    </section>
  )
}
