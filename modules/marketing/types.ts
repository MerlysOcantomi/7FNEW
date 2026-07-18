/**
 * Marketing (Finesse) — data contracts.
 *
 * Pure types for the Beauty/Finesse Marketing surface: works (photos of real
 * jobs), posts prepared by Freya, simple campaigns, the editorial calendar and
 * the social pulse. DB-free and framework-free so they are safe on the client,
 * the server and in tests.
 *
 * These interfaces are the seam for the future backend: a Prisma model / API
 * route can map 1:1 onto them (every entity carries `workspaceId` so the
 * multi-tenant scope is part of the contract from day one). Until that backend
 * exists, `demo-data.ts` produces values of these same types, clearly isolated
 * from the UI components.
 */

// ─── Works (photos of real jobs) ─────────────────────────────────────────────

/**
 * Lifecycle of an uploaded work photo:
 *   nuevo      → just uploaded, Freya has not proposed anything yet
 *   sin_usar   → available, no post uses it
 *   preparado  → a post draft/proposal exists for it
 *   programado → its post is scheduled
 *   publicado  → its post was published (or approved & waiting for the channel)
 */
export type WorkStatus = "nuevo" | "sin_usar" | "preparado" | "programado" | "publicado"

export interface MarketingWork {
  id: string
  /** Owning workspace — every read/write must be scoped by this. */
  workspaceId: string
  /** Short human title, e.g. "Rose Nude Chrome · María". */
  title: string
  clientName?: string | null
  service?: string | null
  style?: string | null
  beforeAfter?: boolean
  /** Free notes the professional leaves for Freya. */
  notesForFreya?: string | null
  status: WorkStatus
  /** ISO datetime. */
  createdAt: string
  /**
   * Image source. For real uploads this is an object URL now and a storage URL
   * once the upload backend lands. Demo works leave it null and render a
   * gradient placeholder via `placeholderTone` — no hardcoded photo URLs.
   */
  imageUrl?: string | null
  /** Demo-only gradient key used when `imageUrl` is null. */
  placeholderTone?: PlaceholderTone
  /** Post created from this work, if any. */
  postId?: string | null
}

/** Curated gradient tones for demo/placeholder thumbnails (no external images). */
export type PlaceholderTone = "rose" | "gold" | "red" | "blush" | "lilac" | "sage"

// ─── Posts (publications prepared by Freya) ──────────────────────────────────

/**
 * Post lifecycle:
 *   borrador   → initial proposal, still editable before review
 *   preparada  → Freya finished the proposal; ready for the user to review
 *   aprobada   → user approved it; waiting for a connected channel to publish
 *   programada → scheduled for a date/time
 *   publicada  → actually published on the channel (needs a real integration)
 */
export type PostStatus = "borrador" | "preparada" | "aprobada" | "programada" | "publicada"

export type PostChannel = "instagram" | "facebook" | "tiktok"

export type PostKind = "post" | "reel" | "story" | "carrusel"

export interface MarketingPost {
  id: string
  workspaceId: string
  /** Work this post was created from, if any. */
  workId?: string | null
  /** Short context of the job, e.g. "El Rose Nude Chrome de María…". */
  title: string
  caption: string
  /** Without the leading `#`. */
  hashtags: string[]
  channel: PostChannel
  kind: PostKind
  /** Plain-language goal, e.g. "Attract new clients" (localized template default). */
  goal?: string | null
  /** Suggested best time, e.g. "Today 19:00" (localized demo string). */
  bestTime?: string | null
  /** Call to action, e.g. "Book your appointment" (localized template default). */
  cta?: string | null
  status: PostStatus
  /** ISO datetime when `status === "programada"`. */
  scheduledFor?: string | null
  preparedBy: "freya" | "user"
}

// ─── Campaigns (simple, no funnels/ROAS language) ────────────────────────────

export type CampaignStatus =
  | "sugerida"
  | "aprobada"
  | "programada"
  | "activa"
  | "pausada"
  | "finalizada"

export interface MarketingCampaign {
  id: string
  workspaceId: string
  title: string
  /** Responsible agent — growth campaigns belong to Fiona; visuals to Freya. */
  agent: "fiona" | "freya"
  status: CampaignStatus
  /** Plain-language reason why this campaign is recommended. */
  reason: string
  /** Approximate audience size (number of people), if known. */
  audienceSize?: number | null
  /** Human audience description, e.g. "clients without a booking for 2+ months". */
  audienceLabel?: string | null
}

// ─── Social pulse (simple metrics only) ──────────────────────────────────────

export type MetricTone = "up" | "down" | "flat"

export interface SocialPulseMetric {
  id: string
  label: string
  value: string
  delta?: string | null
  deltaTone?: MetricTone
}

export interface SocialPulse {
  workspaceId: string
  periodLabel: string
  metrics: SocialPulseMetric[]
  /** Useful interpretation connecting marketing to real business results. */
  insight: string
}

// ─── Freya recommendation ────────────────────────────────────────────────────

export interface FreyaBrief {
  workspaceId: string
  /** Short recommendation text (1–2 sentences). */
  message: string
  /** Nº of posts ready for review — drives the "N listas" pill. */
  readyCount: number
}

// ─── Editorial calendar (7-day view, editorial only) ─────────────────────────

export type CalendarItemKind = "post" | "reel" | "story" | "campaña"

export interface EditorialCalendarItem {
  id: string
  label: string
  kind: CalendarItemKind
}

export interface EditorialCalendarDay {
  /** ISO date (yyyy-mm-dd). */
  date: string
  /** Short regional weekday label from Intl (e.g. "Fri", "vie", "Fr."). */
  weekday: string
  /** Day of month. */
  dayNumber: number
  isToday: boolean
  items: EditorialCalendarItem[]
}

// ─── Channels ────────────────────────────────────────────────────────────────

export interface ChannelConnection {
  channel: PostChannel
  connected: boolean
}

/** Everything the Marketing surface needs, in one workspace-scoped snapshot. */
export interface MarketingSnapshot {
  workspaceId: string
  works: MarketingWork[]
  posts: MarketingPost[]
  campaigns: MarketingCampaign[]
  pulse: SocialPulse | null
  freya: FreyaBrief | null
  channels: ChannelConnection[]
}
