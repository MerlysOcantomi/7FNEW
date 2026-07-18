"use client"

import { useSearchParams } from "next/navigation"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { resolveBeautyOverviewConfig } from "@modules/overview/beauty-overview"
import { BeautyBusinessOverviewPage } from "@/components/overview/beauty-business-overview-page"
import { DashboardCorePage } from "@/components/dashboard-core-page"
import { AppShell } from "@/components/app-shell"

/**
 * `/` — vertical-aware Business Overview entry.
 *
 * Same pattern as `/contenido` and `/today`: ONE route, and the workspace's
 * vertical decides the experience. The Beauty nav profile points its
 * "Mi salón" item here, so no new route or parallel navigation exists.
 *
 *   - Beauty workspace (or the `?vertical=beauty` design-preview helper) →
 *     the Finesse "Mi salón" business overview (Spanish, demo-labeled data
 *     until the overview backend lands).
 *   - Every other vertical → the existing 7F Core "Business Overview"
 *     dashboard, byte-for-byte (extracted to
 *     `components/dashboard-core-page.tsx`).
 *
 * While the active workspace is still unknown (first load) we render a neutral
 * skeleton instead of committing to either experience — same first-load gate
 * as the sidebar — so a Beauty workspace never flashes the Core dashboard and
 * the layout never jumps.
 */
export default function OverviewPage() {
  const searchParams = useSearchParams()
  const { workspace, loading } = useActiveWorkspace()

  // Preview/dev-only helper (mirrors TodayPageClient): lets a reviewer see the
  // "Mi salón" surface without flipping a workspace's vertical first.
  const forcedBeauty = searchParams.get("vertical") === "beauty"
  const effectiveVerticalKey = forcedBeauty ? "beauty" : workspace?.verticalKey
  const overview = resolveBeautyOverviewConfig(effectiveVerticalKey)

  if (loading && !workspace && !forcedBeauty) {
    return (
      <AppShell currentSection="overview" breadcrumbs={[{ label: "7F" }]}>
        <OverviewRouteLoading />
      </AppShell>
    )
  }

  if (overview) {
    return <BeautyBusinessOverviewPage config={overview} />
  }

  return <DashboardCorePage />
}

/** Neutral first-load skeleton — no experience committed yet, no layout jumps. */
function OverviewRouteLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="h-24 animate-pulse rounded-[18px] border border-border bg-card" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="h-28 animate-pulse rounded-[18px] border border-border bg-card" />
        <div className="h-28 animate-pulse rounded-[18px] border border-border bg-card" />
        <div className="hidden h-28 animate-pulse rounded-[18px] border border-border bg-card xl:block" />
        <div className="hidden h-28 animate-pulse rounded-[18px] border border-border bg-card xl:block" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="h-72 animate-pulse rounded-[18px] border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-[18px] border border-border bg-card" />
      </div>
    </div>
  )
}
