"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useFetch } from "@/hooks/use-fetch"
import { useToast } from "@/components/toast-provider"
import { sendToAI as sendToAIRequest, takeOver as takeOverRequest } from "@/lib/today/lane-client"
import type { TodayBuckets, TodayPayload } from "@modules/today/types"
import { countLane, splitBucketsByLane } from "@modules/today/lanes"
import { TodaySection } from "@/components/today/today-section"
import { cn } from "@/lib/utils"

/**
 * Global bottom Today drawer.
 *
 * Compact, read-only projection of `/today` so the operator can glance at the
 * day's work from anywhere in the app without leaving their current context.
 * The full Today page (`/today`) remains the canonical surface — this drawer
 * is a launcher-friendly summary, not a replacement.
 *
 * Reuses the same data flow as `TodayPageClient`:
 *   - same `GET /api/today?tz=...` endpoint
 *   - same `TodayPayload` shape
 *   - same `<TodaySection>` rendering primitive (so any future change to a row
 *     automatically reflects here too)
 *
 * Behaviour:
 *   - Fetch is lazy: we only call `/api/today` once the drawer is `open`.
 *   - Closing the drawer leaves the cache in memory; reopening reuses it
 *     until the operator hits the explicit "Refresh" affordance (none in this
 *     PR — they reload by closing and opening again).
 *   - The body uses an inner `max-h-[70vh] overflow-y-auto` scrollport so the
 *     drawer never grows past 70% of the viewport regardless of payload size.
 *
 * Multi-tenancy: the fetch goes through `requireReadAccess` in the route,
 * which ALWAYS scopes to the active workspace. No client-side workspace
 * juggling here.
 */
export function TodayBottomDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const [timezone, setTimezone] = useState<string | null>(null)

  useEffect(() => {
    /**
     * Defer TZ detection to client mount so SSR never bakes the server zone
     * into the URL. Identical to the `/today` page client; we duplicate the
     * five lines on purpose to keep the drawer self-contained — pulling a
     * shared hook just for this would invite incidental coupling between
     * surfaces that may evolve independently.
     */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  /**
   * Lazy fetch: only build the URL once the drawer is actually open. Closing
   * the drawer suspends the request lifecycle without unmounting state, so
   * `<TodayBottomLauncher>` can stay mounted globally without paying the cost
   * of an idle Today fetch on every route.
   */
  const url = open && timezone ? `/api/today?tz=${encodeURIComponent(timezone)}` : null
  const { data, loading, error, refetch } = useFetch<TodayPayload>(url)
  const { addToast } = useToast()

  const buckets: TodayBuckets = useMemo(
    () => data?.buckets ?? { overdue: [], today: [], undated: [] },
    [data?.buckets],
  )
  const lanes = useMemo(() => splitBucketsByLane(buckets), [buckets])
  const totalItems = useMemo(
    () => buckets.overdue.length + buckets.today.length + buckets.undated.length,
    [buckets.overdue.length, buckets.today.length, buckets.undated.length],
  )

  /**
   * Same lane-move flow as `TodayPageClient` — kept duplicated here so the
   * drawer remains self-contained. Refactoring this into a hook would invite
   * cross-surface coupling for ~10 lines of glue.
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        /**
         * Override the default `bg-background` so the drawer adopts the app's
         * dark surface tokens — consistent with `app-shell.tsx` and the Today
         * page chrome. `max-h-[70vh]` keeps the panel compact; the body owns
         * its own scrollport below.
         */
        className={cn(
          "bg-[var(--app-shell-bg)] text-[var(--text-primary-light)]",
          "data-[vaul-drawer-direction=bottom]:max-h-[78vh]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
            >
              <Sun size={14} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <DrawerTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
                Today
              </DrawerTitle>
              <DrawerDescription className="text-[11px] leading-tight text-[var(--text-secondary-light)]">
                Daily overview · workspace-wide
              </DrawerDescription>
            </div>
            {!loading && !error && totalItems > 0 ? (
              <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary-light)]">
                {totalItems}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/today"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-white/[0.06]"
            >
              Open full Today
              <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
            </Link>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close Today drawer"
              className="rounded-md p-1 text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <TodayDrawerBody
            loading={loading}
            error={error}
            lanes={lanes}
            totalItems={totalItems}
            onLaneMove={handleLaneMove}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Inner body of the Today drawer. Mirrors the loading / error / empty /
 * content branching from `TodayPageClient` but with compact tokens suitable
 * for the drawer height budget. The drawer renders the two lanes stacked
 * (vs. side-by-side in the full page) because the drawer's narrow width
 * doesn't comfortably fit two columns.
 */
function TodayDrawerBody({
  loading,
  error,
  lanes,
  totalItems,
  onLaneMove,
}: {
  loading: boolean
  error: string | null
  lanes: ReturnType<typeof splitBucketsByLane>
  totalItems: number
  onLaneMove: (taskId: string, to: "user" | "ai") => void | Promise<void>
}) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading Today"
        className="flex items-center justify-center py-10"
      >
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-xs font-medium text-destructive">{error}</p>
        <p className="text-[11px] text-destructive/80">Today could not be loaded.</p>
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-8 text-center"
      >
        <Sun
          className="h-6 w-6 text-[var(--accent-primary)]/80"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <p className="text-xs font-medium text-[var(--text-primary-light)]">
          Nothing pending. Nice.
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
          Anything that needs your attention will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <TodayDrawerLane
        idPrefix="today-drawer-mine"
        title="My work"
        icon={<UserRound size={12} strokeWidth={2} aria-hidden="true" />}
        buckets={lanes.mine}
        emptyTitle="No work assigned to you"
        emptyDescription="Tasks you take over or create will land here."
        onLaneMove={onLaneMove}
      />
      <TodayDrawerLane
        idPrefix="today-drawer-ai"
        title="AI work"
        icon={<Sparkles size={12} strokeWidth={2} aria-hidden="true" />}
        buckets={lanes.ai}
        emptyTitle="No AI work yet"
        emptyDescription="AI work will appear here when Fanny proposes or starts work."
        onLaneMove={onLaneMove}
      />
    </div>
  )
}

/**
 * One compact lane block inside the drawer. Stacked vertically. The drawer
 * intentionally trades the wider page's two-column air for vertical density;
 * this matches the drawer's role as a "quick glance" surface.
 */
function TodayDrawerLane({
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
    <section aria-label={title} className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06] text-[var(--text-primary-light)]"
          >
            {icon}
          </span>
          <h3 className="text-xs font-semibold tracking-tight text-[var(--text-primary-light)]">
            {title}
          </h3>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {count}
        </span>
      </header>

      {count === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-3"
        >
          <p className="text-[11px] font-medium text-[var(--text-primary-light)]">
            {emptyTitle}
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-secondary-light)]">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
