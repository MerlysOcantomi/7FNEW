"use client"

import { useSearchParams } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { isBeautyMarketingVertical } from "@modules/marketing/beauty-marketing"
import { ContentCorePage } from "@/components/content-core-page"
import { BeautyMarketingPage } from "@/components/marketing/beauty-marketing-page"
import { AppShell } from "@/components/app-shell"

/**
 * `/contenido` — vertical-aware Marketing entry.
 *
 * Same pattern as `/today` (`TodayPageClient`): ONE route, and the workspace's
 * vertical decides the experience. The Beauty nav profile already points its
 * "Marketing" item here, so no new route or parallel navigation exists.
 *
 *   - Beauty workspace (or the `?vertical=beauty` design-preview helper, same
 *     as Today's) → the Finesse Marketing experience (localized to the
 *     effective locale, Freya-led, demo-labeled data until the Marketing
 *     backend lands).
 *   - Every other vertical → the existing 7F Core "Campanas & Contenido"
 *     page, byte-for-byte (extracted to `components/content-core-page.tsx`).
 *
 * While the active workspace is still unknown (first load) we render a neutral
 * skeleton instead of committing to either experience — same first-load gate
 * as the sidebar — so a Beauty workspace never flashes the Core content page
 * and the layout never jumps.
 */
export default function ContenidoPage() {
  const searchParams = useSearchParams()
  const { workspace, loading } = useActiveWorkspace()

  // Preview/dev-only helper (mirrors TodayPageClient): lets a reviewer see the
  // Finesse Marketing surface without flipping a workspace's vertical first.
  const forcedBeauty = searchParams.get("vertical") === "beauty"
  const effectiveVerticalKey = forcedBeauty ? "beauty" : workspace?.verticalKey

  if (loading && !workspace && !forcedBeauty) {
    return (
      <AppShell currentSection="contenido" breadcrumbs={[{ label: "7F" }]}>
        <ContenidoLoading />
      </AppShell>
    )
  }

  if (isBeautyMarketingVertical(effectiveVerticalKey)) {
    return <BeautyMarketingPage />
  }

  return <ContentCorePage />
}

/** Neutral first-load skeleton — no experience committed yet, no layout jumps. */
function ContenidoLoading() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.common.loading}>
      <div className="h-24 animate-pulse rounded-[18px] border border-border bg-card" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className="h-72 animate-pulse rounded-[18px] border border-border bg-card" />
          <div className="h-48 animate-pulse rounded-[18px] border border-border bg-card" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="h-28 animate-pulse rounded-[18px] border border-border bg-card" />
          <div className="h-56 animate-pulse rounded-[18px] border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}
