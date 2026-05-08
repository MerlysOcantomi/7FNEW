"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import type { TodayPayload } from "@modules/today/types"
import { TodaySection } from "./today-section"
import { TodayEmptyState } from "./today-empty-state"

/**
 * Today page body — owns the fetch lifecycle so the parent server component
 * stays a thin wrapper. Reads the browser timezone client-side and forwards
 * it to `/api/today` as `?tz=`; falls back to `"UTC"` when `Intl` returns
 * something unusable. The aggregator validates the timezone and substitutes
 * UTC if it's not a real IANA zone, so even a malformed query string is safe.
 *
 * No write paths in PR 1 — this is purely a render of the read-only payload.
 */
export function TodayPageClient() {
  const [timezone, setTimezone] = useState<string | null>(null)

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
  const { data, loading, error } = useFetch<TodayPayload>(url)

  /**
   * `loading` is true while either (a) we haven't resolved the TZ yet, or
   * (b) the fetch is in flight. Both produce the same spinner so the user
   * sees a single calm state instead of "no fetch yet → fetching → done".
   */
  const showSpinner = loading || timezone === null

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

  const buckets = data?.buckets ?? { overdue: [], today: [], undated: [] }
  const totalItems = buckets.overdue.length + buckets.today.length + buckets.undated.length

  if (totalItems === 0) {
    return <TodayEmptyState />
  }

  return (
    <div className="flex flex-col gap-8">
      <TodaySection id="today-overdue" title="Overdue" tone="warning" items={buckets.overdue} />
      <TodaySection id="today-due-today" title="Due today" items={buckets.today} />
      <TodaySection id="today-no-date" title="No date" items={buckets.undated} />
    </div>
  )
}
