"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { ExportCSVButton } from "@/components/export-button"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { useFetch } from "@/hooks/use-fetch"
import { useI18n } from "@/components/i18n-provider"
import { useRegisterFinesseAssistantContext } from "@/components/assistant/finesse-assistant-provider"
import type { CSVColumn } from "@/lib/export/csv"
import { buildBeautyOverviewBrief } from "@modules/overview/beauty-overview"
import {
  getBeautyOverviewMessages,
  type BeautyOverviewMessages,
} from "@modules/overview/i18n"
import {
  compareKpi,
  deriveBriefFacts,
  deriveRecommendations,
} from "@modules/overview/derive"
import {
  getBeautyOverviewDemoSnapshot,
  getEmptyOverviewSnapshot,
  getFirstPeriodOverviewSnapshot,
  getNegativeOverviewSnapshot,
  getPartialOverviewSnapshot,
} from "@modules/overview/demo-data"
import { resolveOverviewPeriod } from "@modules/overview/period"
import type {
  BusinessOverviewSnapshot,
  OverviewPeriodPreset,
  SalonOverviewPayload,
  SalonProfile,
  SalonToday,
} from "@modules/overview/types"
import { OverviewHeader } from "./overview-header"
import { SalonProfileCard, SalonTodayCard } from "./salon-cards"
import { FinesseBriefRow } from "./finesse-brief"
import { OverviewKpiGrid } from "./overview-kpis"
import { RevenueTrendCard } from "./revenue-trend-card"
import { PerformanceDriversCard } from "./drivers-card"
import { TopServicesCard } from "./services-card"
import { BusiestTimesCard } from "./demand-card"
import { ClientMixCard, TopClientsCard } from "./client-cards"
import { BookingSourcesCard, BusinessRecommendationsCard } from "./insight-cards"
import { BTN_PRIMARY, CARD_CLASS } from "./overview-ui"

/**
 * "Mi salón" — the Beauty vertical's business overview at `/` (see
 * `app/page.tsx` for the vertical dispatch, mirroring `/contenido`).
 *
 * Product principle: data → interpretation → recommended action. One
 * workspace-scoped snapshot drives every section; the Finesse brief, KPI
 * deltas, drivers and recommendations are all derived from it (see
 * `modules/overview/derive.ts`), so the page can never disagree with itself.
 *
 * Layout: AppShell owns navigation (sidebar + real mobile nav — no parallel
 * shells). Desktop is a two-column grid (trend/drivers/services/demand left,
 * client insight rail right); mobile re-orders the SAME nodes into a
 * narrative column (brief → KPIs → ideas → services → why → mix → clients)
 * via `display: contents` wrappers + `order-*`, with the deeper charts behind
 * a collapsed disclosure — no duplicated markup, no compressed dashboard.
 *
 * Data policy (honesty first):
 *   - DEFAULT: the REAL backend (`GET /api/overview` → `loadSalonOverview`)
 *     aggregates the workspace's own `Evento`/`Factura`/`Cliente`/
 *     `Conversation`/`WorkspaceTask` rows plus `Workspace.config` — demo and
 *     real workspaces alike. Sections whose backend does not exist yet
 *     (drivers, per-service visits, booking attribution) arrive empty and
 *     render their honest empty states; real and invented figures are never
 *     mixed in one payload.
 *   - The demo adapter remains ONLY behind the explicit QA modes, which show
 *     the preview chip:
 *     `?overviewDemo=demo|empty|partial|error|negative|first` (+ `?vertical=beauty`)
 */

// ─── Entry ───────────────────────────────────────────────────────────────────

export function BeautyBusinessOverviewPage() {
  const searchParams = useSearchParams()
  const { workspace } = useActiveWorkspace()
  const { locale } = useI18n()
  const config = useMemo(() => getBeautyOverviewMessages(locale), [locale])

  const demoMode = searchParams.get("overviewDemo")
  const [preset, setPreset] = useState<OverviewPeriodPreset>("month")

  // Gate on client mount before reading the clock: periods derive from "now",
  // and computing them during SSR would risk a hydration mismatch around day
  // boundaries (same pattern as BeautyMarketingPage).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
  }, [])

  const timezone = useMemo(() => {
    if (now === null) return null
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
    } catch {
      return "UTC"
    }
  }, [now])

  const workspaceId = workspace?.id ?? "preview"

  // Real payload — fetched unless an explicit QA demo mode is active.
  const realUrl =
    demoMode === null && workspace?.id && timezone
      ? `/api/overview?preset=${preset}&tz=${encodeURIComponent(timezone)}`
      : null
  const real = useFetch<SalonOverviewPayload>(realUrl)

  let body: React.ReactNode
  if (demoMode === "error") {
    body = <OverviewErrorState config={config} />
  } else if (now === null) {
    body = <OverviewLoading config={config} />
  } else if (demoMode !== null) {
    // QA preview modes — clearly identified sample data, never the default.
    body = (
      <OverviewContent
        // Locale in the key: the demo snapshot is product-owned sample data
        // and regenerates in the new language (real data never would).
        key={`${workspaceId}:${demoMode}:${config.locale}`}
        config={config}
        snapshot={resolveDemoSnapshot(workspaceId, preset, now, demoMode, config)}
        salon={null}
        todayOps={null}
        showPreviewChip
        isDemo
        preset={preset}
        onPresetChange={setPreset}
        now={now}
      />
    )
  } else if (real.error) {
    body = <OverviewErrorState config={config} />
  } else if (real.loading || !real.data) {
    body = <OverviewLoading config={config} />
  } else {
    body = (
      <OverviewContent
        key={`${workspaceId}:real`}
        config={config}
        snapshot={real.data.snapshot}
        salon={real.data.salon}
        todayOps={real.data.today}
        showPreviewChip={false}
        isDemo={false}
        preset={preset}
        onPresetChange={setPreset}
        now={now}
      />
    )
  }

  return (
    <AppShell
      currentSection="overview"
      breadcrumbs={[{ label: "7F" }, { label: config.header.title }]}
      contentClassName="max-w-7xl"
    >
      {body}
    </AppShell>
  )
}

// ─── States: loading / error ─────────────────────────────────────────────────

function OverviewLoading({ config }: { config: BeautyOverviewMessages }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={config.states.loading}>
      <div className={`${CARD_CLASS} h-24 animate-pulse`} />
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${CARD_CLASS} h-28 animate-pulse`} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className={`${CARD_CLASS} h-64 animate-pulse`} />
          <div className={`${CARD_CLASS} h-48 animate-pulse`} />
        </div>
        <div className="flex flex-col gap-6">
          <div className={`${CARD_CLASS} h-40 animate-pulse`} />
          <div className={`${CARD_CLASS} h-56 animate-pulse`} />
        </div>
      </div>
    </div>
  )
}

function OverviewErrorState({ config }: { config: BeautyOverviewMessages }) {
  const t = config.states.error
  return (
    <div className={`${CARD_CLASS} mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center`}>
      <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">{t.title}</p>
      <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.description}</p>
      <Link href="/" className={`${BTN_PRIMARY} mt-2`}>
        {t.retry}
      </Link>
    </div>
  )
}

// ─── Content ─────────────────────────────────────────────────────────────────

/** QA-only demo snapshots — reachable exclusively via `?overviewDemo=`. */
function resolveDemoSnapshot(
  workspaceId: string,
  preset: OverviewPeriodPreset,
  now: Date,
  demoMode: string,
  config: BeautyOverviewMessages,
): BusinessOverviewSnapshot {
  const period = resolveOverviewPeriod(preset, now)
  const serviceNames = config.demo.serviceNames
  switch (demoMode) {
    case "empty":
      return getEmptyOverviewSnapshot(workspaceId, period)
    case "partial":
      return getPartialOverviewSnapshot(workspaceId, period, { serviceNames })
    case "negative":
      return getNegativeOverviewSnapshot(workspaceId, period, { serviceNames })
    case "first":
      return getFirstPeriodOverviewSnapshot(workspaceId, period, { serviceNames })
    default:
      return getBeautyOverviewDemoSnapshot(workspaceId, period, { serviceNames })
  }
}

/** CSV column headers come from the catalog — the export localizes too. */
function buildExportColumns(config: BeautyOverviewMessages): CSVColumn[] {
  const c = config.exportCsv.columns
  return [
    { key: "service", label: c.service },
    { key: "visits", label: c.visits },
    { key: "revenue", label: c.revenue },
    { key: "share", label: c.visitShare },
  ]
}

function OverviewContent({
  config,
  snapshot,
  salon,
  todayOps,
  showPreviewChip,
  isDemo,
  preset,
  onPresetChange,
  now,
}: {
  config: BeautyOverviewMessages
  /** ONE snapshot per (workspace, period, source) — every section derives from it. */
  snapshot: BusinessOverviewSnapshot
  /** Real salon identity — `null` in QA demo modes (cards are hidden). */
  salon: SalonProfile | null
  /** Real operational summary — `null` in QA demo modes. */
  todayOps: SalonToday | null
  showPreviewChip: boolean
  isDemo: boolean
  preset: OverviewPeriodPreset
  onPresetChange: (preset: OverviewPeriodPreset) => void
  now: Date
}) {
  const { locale } = useI18n()

  const brief = useMemo(
    () => buildBeautyOverviewBrief(deriveBriefFacts(snapshot), { messages: config, locale }),
    [snapshot, config, locale],
  )
  const recommendations = useMemo(() => deriveRecommendations(snapshot.signals), [snapshot])

  const currency = snapshot.currency
  const kpis = snapshot.kpis

  // Publish the page context so Ask Finesse can ground its answers — and the
  // dynamic suggestion engine can rank prompts — from what the user is
  // actually seeing (period + on-screen KPI numbers and their deltas only:
  // minimal, serializable, permission-aware by construction).
  useRegisterFinesseAssistantContext(
    useMemo(() => {
      const earningsCmp = compareKpi(snapshot.kpis?.earnings ?? null)
      return {
        page: "my-salon" as const,
        period: {
          preset: snapshot.period.preset,
          start: snapshot.period.start,
          end: snapshot.period.end,
        },
        visibleMetrics: {
          ingresos: snapshot.kpis?.earnings?.current ?? null,
          ingresosDelta: earningsCmp.deltaRatio,
          visitas: snapshot.kpis?.visits?.current ?? null,
          clientasNuevas: snapshot.kpis?.newClients?.current ?? null,
          tasaRetorno: snapshot.kpis?.returningRate?.current ?? null,
          cobrosPendientes: snapshot.signals.pendingPayments?.amount ?? null,
          ocupacionDiaPunta: snapshot.signals.peakDayOccupancy,
          clientasSinVolver: snapshot.signals.inactiveClients,
          sinComparativa: snapshot.dataQuality.comparison ? 0 : 1,
          moneda: snapshot.currency,
        },
      }
    }, [snapshot]),
  )
  const totalVisits = kpis?.visits?.current ?? null
  const hasComparison = snapshot.dataQuality.comparison

  // Whole-page empty state ONLY when literally nothing has data; a single
  // missing module keeps the page useful with per-section empty states.
  const pageEmpty =
    kpis === null &&
    snapshot.topServices.length === 0 &&
    snapshot.clientMix === null &&
    snapshot.revenueTrend.length === 0

  const exportRows = useMemo(
    () =>
      snapshot.topServices.map((s) => ({
        service: s.name,
        visits: s.visits,
        revenue: s.revenue ?? "",
        share: Math.round(s.visitShare * 100),
      })),
    [snapshot.topServices],
  )

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <OverviewHeader
        config={config}
        preset={preset}
        onPresetChange={onPresetChange}
        locale={locale}
        now={now}
        showPreviewChip={showPreviewChip}
        exportSlot={
          exportRows.length > 0 ? (
            <ExportCSVButton
              data={exportRows}
              columns={buildExportColumns(config)}
              filename={`${config.exportCsv.filenamePrefix}-${snapshot.period.start}`}
              label={config.header.exportLabel}
            />
          ) : null
        }
      />

      {pageEmpty ? (
        <>
          {/* A workspace can have its identity filled while business data is
              still empty — keep the real profile/today cards visible above
              the honest empty state. */}
          {salon || todayOps ? (
            <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
              {todayOps ? (
                <SalonTodayCard config={config} today={todayOps} locale={locale} currency={currency} />
              ) : null}
              {salon ? <SalonProfileCard config={config} salon={salon} locale={locale} /> : null}
            </div>
          ) : null}
          <OverviewEmptyState config={config} />
        </>
      ) : (
        <>
          <FinesseBriefRow
            config={config}
            brief={brief}
            period={snapshot.period}
            locale={locale}
            hasComparison={hasComparison}
          />

          <OverviewKpiGrid
            config={config}
            kpis={kpis}
            preset={preset}
            locale={locale}
            currency={currency}
          />

          {/*
            Mobile: one ordered narrative column (ideas → services → why →
            revenue → mix → clients → deeper analysis collapsed). Desktop
            (lg+): 2-column grid via `display: contents` wrappers, so the same
            nodes serve both layouts. `BusiestTimesCard` + `BookingSourcesCard`
            are the only intentional duplicates: collapsed behind a disclosure
            on mobile (progressive depth), regular cards on desktop — the
            Marketing calendar precedent.
          */}
          <div className="flex flex-col gap-5 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
            {/* Left column (protagonist) */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <div className="order-4 lg:order-none">
                <RevenueTrendCard
                  config={config}
                  trend={snapshot.revenueTrend}
                  earnings={kpis?.earnings ?? null}
                  locale={locale}
                  currency={currency}
                />
              </div>
              <div className="order-3 lg:order-none">
                <PerformanceDriversCard
                  config={config}
                  drivers={snapshot.drivers}
                  lookingAhead={snapshot.lookingAhead}
                  locale={locale}
                  currency={currency}
                />
              </div>
              <div className="order-2 lg:order-none">
                <TopServicesCard
                  config={config}
                  services={snapshot.topServices}
                  totalVisits={totalVisits}
                  locale={locale}
                  currency={currency}
                />
              </div>
              <div className="order-7 hidden lg:order-none lg:block">
                <BusiestTimesCard config={config} demand={snapshot.demand} locale={locale} />
              </div>
            </div>

            {/* Right rail */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              {todayOps ? (
                <div className="order-first lg:order-none">
                  <SalonTodayCard
                    config={config}
                    today={todayOps}
                    locale={locale}
                    currency={currency}
                  />
                </div>
              ) : null}
              <div className="order-1 lg:order-none">
                <BusinessRecommendationsCard
                  config={config}
                  recommendations={recommendations}
                  locale={locale}
                  currency={currency}
                />
              </div>
              <div className="order-5 lg:order-none">
                <ClientMixCard config={config} mix={snapshot.clientMix} locale={locale} />
              </div>
              <div className="order-6 lg:order-none">
                <TopClientsCard
                  config={config}
                  clients={snapshot.topClients}
                  locale={locale}
                  currency={currency}
                  // Real client ids navigate to the profile; QA demo ids don't.
                  clientHref={(clientId) => (isDemo ? null : `/clientes/${clientId}`)}
                />
              </div>
              <div className="order-8 hidden lg:order-none lg:block">
                <BookingSourcesCard config={config} sources={snapshot.bookingSources} locale={locale} />
              </div>

              {salon ? (
                <div className="order-10 lg:order-none">
                  <SalonProfileCard config={config} salon={salon} locale={locale} />
                </div>
              ) : null}

              {/* Mobile-only: deeper analysis behind a collapsed disclosure. */}
              <div className="order-9 lg:hidden">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--text-primary-light)] [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="transition-transform group-open:rotate-180"
                    />
                    {config.demand.title} · {config.sources.title}
                  </summary>
                  <div className="mt-3 flex flex-col gap-5">
                    <BusiestTimesCard config={config} demand={snapshot.demand} locale={locale} />
                    <BookingSourcesCard config={config} sources={snapshot.bookingSources} locale={locale} />
                  </div>
                </details>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Whole-page empty state ──────────────────────────────────────────────────

function OverviewEmptyState({ config }: { config: BeautyOverviewMessages }) {
  const t = config.states.emptyPage
  return (
    <div className={`${CARD_CLASS} mx-auto mt-6 flex w-full max-w-lg flex-col items-center gap-3 p-8 text-center`}>
      <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">{t.title}</p>
      <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">{t.description}</p>
      <Link href="/calendario" className={`${BTN_PRIMARY} mt-2`}>
        {t.cta}
      </Link>
    </div>
  )
}
