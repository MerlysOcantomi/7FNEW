"use client"

import { useEffect, useMemo, useState } from "react"
import { useFetch } from "@/hooks/use-fetch"
import type { TodayBuckets, TodayItem, TodayPayload } from "@modules/today/types"
import {
  countLane,
  getScheduleItems,
  splitBucketsByLane,
  type TodayBucketsByLane,
} from "@modules/today/lanes"

/**
 * Single source of truth for the Today quick-view payload.
 *
 * Used by BOTH:
 *   - `TodayMobileDrawer` (vaul bottom drawer; the existing UX)
 *   - `TodayDesktopInlay` (the new desktop inlay panel)
 *
 * Centralising this means the two surfaces never disagree about
 * what "today" looks like, and we only ever fire `/api/today` once
 * regardless of how many wrappers ride on top.
 *
 * Lazy fetch:
 *   - The hook returns `loading: true` until both (a) the client TZ
 *     is resolved and (b) `open === true`. If the panel is closed
 *     the URL is `null` and `useFetch` keeps its state idle.
 *   - This matches the pre-refactor behaviour of the standalone
 *     drawer, so no extra requests are made.
 *
 * Multi-tenancy: the route at `/api/today` enforces
 * `requireReadAccess`, so the workspace scoping is server-side. The
 * hook does NOT carry a workspaceId argument — it relies on the
 * active session cookie.
 */
export interface TodayQuickDataResult {
  loading: boolean
  error: string | null
  /** Raw buckets straight from `/api/today` (overdue / today / undated). */
  buckets: TodayBuckets
  /** Same buckets split by lane (mine / ai / schedule) + waiting sub-bucket. */
  lanes: TodayBucketsByLane
  /** Flat list of events for the Schedule strip. */
  scheduleItems: TodayItem[]
  /** Sum of items across the two task lanes + schedule. */
  totalItems: number
  /** Counts useful for header / launcher badges. */
  counts: {
    mine: number
    ai: number
    schedule: number
    waiting: number
  }
  /** Trigger a refetch on demand (used after lane-move mutations elsewhere). */
  refetch: () => void
}

export function useTodayQuickData(open: boolean): TodayQuickDataResult {
  const [timezone, setTimezone] = useState<string | null>(null)

  useEffect(() => {
    /**
     * Defer TZ detection to client mount so SSR doesn't bake the
     * server zone into the URL. The aggregator validates whatever
     * the client sends and falls back to UTC if it's bad, so a brief
     * "UTC default" state during the very first render is safe.
     */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  const url = open && timezone ? `/api/today?tz=${encodeURIComponent(timezone)}` : null
  const { data, loading, error, refetch } = useFetch<TodayPayload>(url)

  const buckets: TodayBuckets = useMemo(
    () => data?.buckets ?? { overdue: [], today: [], undated: [] },
    [data?.buckets],
  )
  const lanes = useMemo(() => splitBucketsByLane(buckets), [buckets])
  const scheduleItems = useMemo(() => getScheduleItems(lanes), [lanes])

  const counts = useMemo(
    () => ({
      mine: countLane(lanes.mine),
      ai: countLane(lanes.ai),
      schedule: scheduleItems.length,
      waiting: lanes.mine.waiting.length + lanes.ai.waiting.length,
    }),
    [lanes, scheduleItems.length],
  )

  const totalItems = counts.mine + counts.ai + counts.schedule

  /**
   * `loading` is true while either (a) we haven't resolved the TZ yet,
   * or (b) the fetch is in flight. Both produce the same spinner in
   * consumers — matches the pre-refactor UX.
   */
  return {
    loading: loading || (open && timezone === null),
    error,
    buckets,
    lanes,
    scheduleItems,
    totalItems,
    counts,
    refetch,
  }
}
