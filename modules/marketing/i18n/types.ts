/**
 * Finesse Marketing — localized message contract (P4.MARKETING-5L).
 *
 * The Core owns the locale runtime (`SupportedLocale`, `parseLocale`,
 * `useI18n`, formatters); this vertical namespace owns every visible string of
 * the Marketing surface: section copy, dialogs, status labels, a11y phrases,
 * template-generated proposals and the localized demo content. All five
 * official locales ship a COMPLETE catalog against this contract — no
 * `Partial`, no English copies, no empty strings (enforced by tests).
 *
 * Design rules:
 * - Counted phrases are typed functions (`readyPhotos(2)` → "2 fotos listas"),
 *   never `${n} ${n === 1 ? … : …}` concatenations in components.
 * - Persisted enum values (`WorkStatus`, `PostStatus`, …) never change — only
 *   their visible labels live here.
 * - Real user content (client names, services, captions the user edited…) is
 *   NEVER translated; only the product-owned demo content is localized.
 */

import type {
  CalendarItemKind,
  CampaignStatus,
  PostChannel,
  PostKind,
  PostStatus,
  WorkStatus,
} from "../types"
import type { SupportedLocale } from "@core/i18n/types"

/**
 * Localized templates behind `buildDraftPostFromWork` — the deterministic
 * proposal composer (no AI call). The UI labels the result as an initial
 * proposal; when the real Freya backend lands, these become its fallback.
 */
export interface MarketingDraftTemplates {
  /** Neutral subject when a work has no service/style metadata. */
  fallbackSubject: string
  /** Full caption sentence composed from the work's metadata. */
  caption: (input: { subject: string; clientName: string | null; beforeAfter: boolean }) => string
  /** Default plain-language goal for a fresh proposal. */
  goal: string
  /** Default call to action for a fresh proposal. */
  cta: string
}

/** One demo work's localized fields (structure/status stay in `demo-data.ts`). */
export interface DemoWorkContent {
  title: string
  clientName: string
  service: string
  style: string
}

/** One demo post's localized fields. */
export interface DemoPostContent {
  title: string
  caption: string
  hashtags: string[]
  goal: string | null
  bestTime: string | null
  cta: string | null
}

/** One demo campaign's localized fields. */
export interface DemoCampaignContent {
  title: string
  reason: string
  audienceLabel: string
}

/** One demo social-pulse metric's localized fields (values pre-formatted per region). */
export interface DemoMetricContent {
  label: string
  value: string
  delta: string
}

/**
 * Product-owned demo content, localized per catalog. This is sample data owned
 * by the product (never user data), so translating it is safe and expected —
 * the preview should feel native in every official language.
 */
export interface MarketingDemoContent {
  works: {
    w1: DemoWorkContent
    w2: DemoWorkContent
    w3: DemoWorkContent
    w4: DemoWorkContent
    w5: DemoWorkContent
  }
  posts: {
    p1: DemoPostContent
    p2: DemoPostContent
    p3: DemoPostContent
  }
  campaigns: {
    c1: DemoCampaignContent
    c2: DemoCampaignContent
  }
  pulse: {
    periodLabel: string
    metrics: {
      followers: DemoMetricContent
      reach: DemoMetricContent
      saves: DemoMetricContent
      inquiries: DemoMetricContent
      newClients: DemoMetricContent
    }
    insight: string
  }
  freyaMessage: string
}

/**
 * Every visible message of the Finesse Marketing surface, for one locale.
 * Each of the five official catalogs satisfies this contract completely.
 */
export interface BeautyMarketingMessages {
  /** Locale this catalog is written in (also drives regional formatting). */
  locale: SupportedLocale
  /** "Finesse · by Sevenef" brand chip — a proper noun, constant by design. */
  brandChip: string
  preview: {
    /** Always visible while demo data drives the page. */
    chip: string
    /** Short honesty note: sample data, nothing persists, nothing is published. */
    tooltip: string
  }
  header: {
    title: string
    description: string
    uploadCta: string
    weekLabel: string
    mobileTagline: string
    readyPhotos: (count: number) => string
    scheduledPosts: (count: number) => string
    activeCampaigns: (count: number) => string
  }
  featured: {
    sectionTitle: string
    sectionHint: string
    freyaPrepared: string
    goalLabel: string
    bestTimeLabel: string
    publishNow: string
    schedule: string
    edit: string
    channelPendingNote: string
    approvedState: string
    scheduledState: string
    empty: { title: string; description: string; action: string }
  }
  gallery: {
    sectionTitle: string
    sectionHint: string
    uploadTile: string
    viewAll: string
    preparePost: string
    preparePostAria: (title: string) => string
    empty: { title: string; description: string; action: string }
  }
  calendar: {
    sectionTitle: string
    sectionHint: string
    mobileToggle: string
    empty: string
    /** Visible labels for calendar item kinds (`campaña` etc. stay internal). */
    itemKindLabels: Record<CalendarItemKind, string>
  }
  freya: {
    name: string
    role: string
    readyForReview: (count: number) => string
    empty: string
  }
  campaigns: {
    sectionTitle: string
    activeCountHint: (count: number) => string
    approve: string
    view: string
    pause: string
    resume: string
    detail: string
    empty: { title: string; description: string }
    /** Fallback audience noun when a campaign has no `audienceLabel`. */
    audienceFallback: string
    /** Full toast sentence after a campaign transition. */
    transitionToast: (status: CampaignStatus) => string
  }
  pulse: {
    sectionTitle: string
    sectionHint: string
    channelsPendingNote: string
  }
  upload: {
    title: string
    takePhoto: string
    fromGallery: string
    selectHint: string
    clientLabel: string
    clientPlaceholder: string
    serviceLabel: string
    servicePlaceholder: string
    styleLabel: string
    stylePlaceholder: string
    beforeAfterLabel: string
    notesLabel: string
    notesPlaceholder: string
    confirm: string
    cancel: string
    errorType: string
    errorEmpty: string
    successToast: string
    /** Title for an uploaded work without style/service metadata. */
    defaultWorkTitle: string
    removeImageAria: (name: string) => string
  }
  editPost: {
    title: string
    titleLabel: string
    captionLabel: string
    hashtagsLabel: string
    hashtagsHint: string
    channelLabel: string
    kindLabel: string
    goalLabel: string
    ctaLabel: string
    save: string
    cancel: string
    errorCaption: string
    successToast: string
  }
  schedule: {
    title: string
    dateLabel: string
    timeLabel: string
    channelLabel: string
    confirm: string
    cancel: string
    errorPast: string
    successToast: string
  }
  publish: {
    approvedToast: string
    proposalNote: string
  }
  errorState: { title: string; description: string; retry: string }
  a11y: {
    loadingMarketing: string
    workPhotoAlt: (title: string) => string
    workPhotoFallback: string
  }
  workStatusLabels: Record<WorkStatus, string>
  postStatusLabels: Record<PostStatus, string>
  campaignStatusLabels: Record<CampaignStatus, string>
  channelLabels: Record<PostChannel, string>
  kindLabels: Record<PostKind, string>
  agentLabels: Record<"fiona" | "freya", string>
  draftTemplates: MarketingDraftTemplates
  demo: MarketingDemoContent
}
