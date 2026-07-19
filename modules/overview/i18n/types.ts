/**
 * Finesse "Mi salón" overview — localized message contract (P4.FINESSE-ENES).
 *
 * Mirrors the Marketing precedent (`modules/marketing/i18n`): the Core owns
 * the locale runtime; this vertical namespace owns every visible string of the
 * business overview. English is the canonical catalog; Spanish is a complete
 * real translation — structural parity is enforced by `satisfies` + tests.
 *
 * Sentences composed from data (driver labels, recommendations, the Finesse
 * brief) are typed template FUNCTIONS, never string concatenations in
 * components or module logic. Real user/business data (service names once a
 * backend exists, client names) is never translated; the demo catalog below is
 * product-owned sample content and localizes with the UI.
 */

import type { SupportedLocale } from "@core/i18n/types"
import type {
  BookingSourceKind,
  BusinessRecommendation,
  DriverConfidence,
  LookingAheadNote,
  OverviewPeriodPreset,
  PerformanceDriver,
  RecommendationAgent,
} from "../types"

export interface BeautyOverviewMessages {
  /** Locale this catalog is written in (also drives regional formatting). */
  locale: SupportedLocale
  /** "Finesse · by Sevenef" brand chip. */
  brandChip: string
  preview: {
    /** Always visible while demo data drives the page. */
    chip: string
    /** Short honesty note on the chip (tooltip). */
    tooltip: string
  }
  header: {
    title: string
    description: string
    exportLabel: string
    periodLabels: Record<OverviewPeriodPreset, string>
  }
  /** CSV export — localized column headers + filename prefix. */
  exportCsv: {
    filenamePrefix: string
    columns: {
      service: string
      visits: string
      revenue: string
      visitShare: string
    }
  }
  periodCard: {
    eyebrow: string
    noComparisonNote: string
  }
  brief: {
    agentName: string
    tagline: string
    /** Sentence templates — assembled by `buildBeautyOverviewBrief`. */
    earningsUp: (pct: string, topService: string | null) => string
    earningsDown: (pct: string) => string
    earningsFlat: string
    topServiceOnly: (service: string) => string
    peakNearlyFull: string
    returningRate: (pct: string) => string
  }
  kpis: {
    earnings: string
    visits: string
    newClients: string
    returningRate: string
    comparisonSuffix: Record<OverviewPeriodPreset, string>
    noComparison: string
    noData: string
    sparkAria: string
    /** Screen-reader tone words for deltas. */
    srTones: { more: string; less: string; same: string }
  }
  revenue: {
    title: string
    subtitle: Record<"day" | "week" | "month", string>
    moreSuffix: string
    lessSuffix: string
    sameNote: string
    empty: { title: string; description: string }
    weekPrefix: string
  }
  drivers: {
    titleUp: string
    titleDown: string
    subtitle: string
    sourceLabels: Record<PerformanceDriver["source"], string>
    confidenceLabels: Record<DriverConfidence, string>
    /** `{detail}` fallback when a driver has no attribution channel. */
    detailFallback: string
    empty: string
  }
  lookingAhead: {
    lead: string
    texts: Record<LookingAheadNote["kind"], string>
    actions: Record<LookingAheadNote["kind"], string>
  }
  services: {
    title: string
    hintPrefix: string
    hintSuffix: string
    empty: { title: string; description: string }
    archivedLabel: string
  }
  demand: {
    title: string
    hint: string
    /** Mon → Sun short labels (ISO order, matches `DemandDay.weekday`). */
    weekdays: [string, string, string, string, string, string, string]
    weekdaysLong: [string, string, string, string, string, string, string]
    peakLead: string
    /** Joiner between peak-day names ("Fridays and Saturdays"). */
    peakJoiner: string
    empty: string
    actionLabel: string
  }
  clientMix: {
    title: string
    returning: string
    newLabel: string
    centerLabel: string
    empty: string
  }
  topClients: {
    title: string
    hint: string
    visitsSuffix: string
    vipLabel: string
    empty: string
    restrictedSpend: string
  }
  sources: {
    title: string
    labels: Record<BookingSourceKind, string>
    empty: string
  }
  recommendations: {
    title: string
    agentLabels: Record<RecommendationAgent, string>
    actionLabels: Record<BusinessRecommendation["kind"], string>
    /** Full sentence per recommendation kind (amounts arrive pre-formatted). */
    texts: {
      reactivation: (count: number) => string
      pendingPayments: (amount: string) => string
      availability: (percent: number) => string
      quietPeriod: string
    }
    emptyPositive: string
  }
  /** Salon identity card — real data from `Workspace.config.businessProfile`. */
  salonProfile: {
    title: string
    regionLabel: string
    hoursLabel: string
    servicesLabel: string
    /** "Perfil completo al 75%" — pct arrives pre-formatted. */
    completeness: (pct: string) => string
    editCta: string
    /** Shown when the profile has no filled fields yet. */
    empty: string
  }
  /** "Hoy en el salón" operational card — real cross-module counts. */
  todayOps: {
    title: string
    appointmentsTitle: string
    appointmentsEmpty: string
    /** Row templates — counts/amounts arrive pre-formatted. */
    pendingConversations: (count: number) => string
    priorityTasks: (count: number) => string
    activeClients: (count: number) => string
    pendingInvoices: (count: number, amount: string) => string
    overdueInvoices: (count: number, amount: string) => string
    /** Row action labels (existing routes only). */
    openInbox: string
    openToday: string
    openBilling: string
    openAgenda: string
  }
  states: {
    loading: string
    error: { title: string; description: string; retry: string }
    emptyPage: {
      title: string
      description: string
      cta: string
    }
    sectionNoData: string
    noFinance: string
  }
  /** Product-owned demo content (never real business data). */
  demo: {
    serviceNames: {
      cutStyle: string
      fullColor: string
      balayage: string
      treatment: string
      eventStyle: string
    }
  }
}
