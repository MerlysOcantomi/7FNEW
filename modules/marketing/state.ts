/**
 * Marketing (Finesse) — pure state logic.
 *
 * Every transition, derivation and validation the Marketing surface needs,
 * kept pure and deterministic (no React, no DB, no clock reads — callers pass
 * `now`). Follows the "pure planner" pattern from docs/inbox-pipeline-testing.md:
 * the UI layer stays a thin orchestrator with no inline business conditions,
 * and all of this is testable with `node:test`.
 */

import { toIntlLocale, type FormatLocale } from "@core/i18n/format"
import type {
  CampaignStatus,
  EditorialCalendarDay,
  EditorialCalendarItem,
  MarketingCampaign,
  MarketingPost,
  MarketingWork,
  PostChannel,
  PostKind,
  PostStatus,
  WorkStatus,
} from "./types"
import type { MarketingDraftTemplates } from "./i18n/types"

// ─── Campaign transitions ────────────────────────────────────────────────────

/**
 * Allowed campaign transitions:
 *   sugerida → aprobada (user approves) — or finalizada (user dismisses)
 *   aprobada → programada | activa
 *   programada → activa | pausada
 *   activa → pausada | finalizada
 *   pausada → activa | finalizada
 *   finalizada → (terminal)
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  sugerida: ["aprobada", "finalizada"],
  aprobada: ["programada", "activa"],
  programada: ["activa", "pausada"],
  activa: ["pausada", "finalizada"],
  pausada: ["activa", "finalizada"],
  finalizada: [],
}

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Apply a campaign transition. Returns the updated campaign, or `null` when the
 * transition is not allowed (callers decide how to surface the rejection).
 */
export function transitionCampaign(
  campaign: MarketingCampaign,
  to: CampaignStatus,
): MarketingCampaign | null {
  if (!canTransitionCampaign(campaign.status, to)) return null
  return { ...campaign, status: to }
}

// ─── Post transitions ────────────────────────────────────────────────────────

/**
 * Approve a post for publishing. HONEST behavior: while no channel is
 * connected, approving marks the post `aprobada` (ready & waiting for the
 * channel connection) — it never pretends the post was published. Once a real
 * integration exists, a connected channel will move it to `publicada`.
 */
export function approvePost(
  post: MarketingPost,
  opts: { channelConnected: boolean },
): MarketingPost {
  if (opts.channelConnected) {
    // Real publish path — only reachable once a channel integration exists.
    return { ...post, status: "publicada" }
  }
  return { ...post, status: "aprobada" }
}

/**
 * Schedule a post for `scheduledForIso`. Returns `null` when the date is
 * invalid or not in the future (relative to `now`).
 */
export function schedulePost(
  post: MarketingPost,
  scheduledForIso: string,
  now: Date,
): MarketingPost | null {
  const when = new Date(scheduledForIso)
  if (Number.isNaN(when.getTime())) return null
  if (when.getTime() <= now.getTime()) return null
  return { ...post, status: "programada", scheduledFor: when.toISOString() }
}

/** Editable fields of a post. */
export interface PostEdits {
  title?: string
  caption?: string
  /** Raw hashtag input — normalized by `normalizeHashtags`. */
  hashtags?: string[]
  channel?: PostChannel
  kind?: PostKind
  goal?: string | null
  cta?: string | null
  scheduledFor?: string | null
}

/**
 * Normalize hashtag input: strip leading `#`, trim, drop empties, dedupe
 * (case-insensitive, keeping first casing).
 */
export function normalizeHashtags(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const clean = item.replace(/^#+/, "").trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clean)
  }
  return out
}

/** Apply edits to a post (hashtags are normalized; empty caption is rejected → null). */
export function applyPostEdits(post: MarketingPost, edits: PostEdits): MarketingPost | null {
  const caption = edits.caption !== undefined ? edits.caption.trim() : post.caption
  if (!caption) return null
  return {
    ...post,
    title: edits.title !== undefined ? edits.title.trim() || post.title : post.title,
    caption,
    hashtags: edits.hashtags !== undefined ? normalizeHashtags(edits.hashtags) : post.hashtags,
    channel: edits.channel ?? post.channel,
    kind: edits.kind ?? post.kind,
    goal: edits.goal !== undefined ? edits.goal : post.goal,
    cta: edits.cta !== undefined ? edits.cta : post.cta,
    scheduledFor: edits.scheduledFor !== undefined ? edits.scheduledFor : post.scheduledFor,
  }
}

// ─── Work → post proposal ────────────────────────────────────────────────────

/**
 * Build an initial post proposal from a work's metadata. Deterministic
 * template composition (no AI call, no fake "Freya generated this"): the UI
 * labels the result as an initial proposal the user edits. When the real Freya
 * backend lands, this becomes its fallback.
 *
 * The sentence templates come from the caller's localized catalog
 * (`templates`), so the proposal is written in the effective UI locale. The
 * work's OWN metadata (service, style, client name) is user content and is
 * composed verbatim — never translated.
 */
export function buildDraftPostFromWork(
  work: MarketingWork,
  opts: { id: string; templates: MarketingDraftTemplates; channel?: PostChannel },
): MarketingPost {
  const { templates } = opts
  const service = work.service?.trim() || templates.fallbackSubject
  const style = work.style?.trim()
  const subject = style ? `${style}` : service
  const clientName = work.clientName?.trim() || null
  return {
    id: opts.id,
    workspaceId: work.workspaceId,
    workId: work.id,
    title: work.title,
    caption: templates.caption({
      subject: capitalize(subject),
      clientName,
      beforeAfter: work.beforeAfter === true,
    }),
    hashtags: buildHashtagsFromWork(work),
    channel: opts.channel ?? "instagram",
    kind: work.beforeAfter ? "carrusel" : "post",
    goal: templates.goal,
    bestTime: null,
    cta: templates.cta,
    status: "borrador",
    scheduledFor: null,
    preparedBy: "user",
  }
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

/** Hashtags derived from a work's metadata (service/style words, deduped). */
export function buildHashtagsFromWork(work: MarketingWork): string[] {
  const parts: string[] = []
  if (work.style) parts.push(work.style)
  if (work.service) parts.push(work.service)
  const tags = parts
    .map((p) => p.replace(/[^\p{L}\p{N} ]/gu, "").trim())
    .filter(Boolean)
    .map((p) =>
      p
        .split(/\s+/)
        .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase())))
        .join(""),
    )
  return normalizeHashtags([...tags, "beauty"])
}

// ─── Work status sync ────────────────────────────────────────────────────────

/** The work status implied by its post's status. */
export function workStatusForPost(postStatus: PostStatus): WorkStatus {
  switch (postStatus) {
    case "borrador":
    case "preparada":
      return "preparado"
    case "programada":
      return "programado"
    case "aprobada":
    case "publicada":
      return "publicado"
  }
}

// ─── Editorial calendar (7-day derivation) ───────────────────────────────────

function isoDateOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Map a post kind to its calendar item kind. */
function calendarKindOf(kind: PostKind): EditorialCalendarItem["kind"] {
  if (kind === "reel") return "reel"
  if (kind === "story") return "story"
  return "post"
}

/**
 * Derive the 7-day editorial calendar starting at `today` from scheduled posts
 * and active/programmed campaigns. Editorial only — never replaces the general
 * appointments calendar. Weekday labels are regional: they come from Intl for
 * the caller's locale (a UI locale like "es" or a regional tag like "de-CH").
 */
export function buildEditorialWeek(
  posts: MarketingPost[],
  campaigns: MarketingCampaign[],
  today: Date,
  locale: FormatLocale,
): EditorialCalendarDay[] {
  const weekdayFormat = new Intl.DateTimeFormat(toIntlLocale(locale), { weekday: "short" })
  const days: EditorialCalendarDay[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    const iso = isoDateOf(date)
    const items: EditorialCalendarItem[] = posts
      .filter((p) => p.status === "programada" && p.scheduledFor && isoDateOf(new Date(p.scheduledFor)) === iso)
      .map((p) => ({ id: p.id, label: shortLabel(p.title), kind: calendarKindOf(p.kind) }))
    // Active campaigns appear on the first day of the window as a gentle marker.
    if (i === 0) {
      for (const c of campaigns) {
        if (c.status === "activa") items.push({ id: c.id, label: shortLabel(c.title), kind: "campaña" })
      }
    }
    days.push({
      date: iso,
      weekday: weekdayFormat.format(date),
      dayNumber: date.getDate(),
      isToday: i === 0,
      items,
    })
  }
  return days
}

function shortLabel(title: string): string {
  const clean = title.replace(/^"|"$/g, "")
  return clean.length > 18 ? `${clean.slice(0, 17)}…` : clean
}

// ─── Weekly summary (header pills) ───────────────────────────────────────────

export interface MarketingWeeklySummary {
  /** Posts ready for review/approval (preparada or borrador). */
  readyCount: number
  /** Scheduled posts. */
  scheduledCount: number
  /** Active campaigns. */
  activeCampaigns: number
}

export function deriveWeeklySummary(
  posts: MarketingPost[],
  campaigns: MarketingCampaign[],
): MarketingWeeklySummary {
  return {
    readyCount: posts.filter((p) => p.status === "preparada" || p.status === "borrador").length,
    scheduledCount: posts.filter((p) => p.status === "programada").length,
    activeCampaigns: campaigns.filter((c) => c.status === "activa").length,
  }
}

/**
 * Pick the featured "Publicación de hoy": the first post ready for review
 * (preparada first, then borrador), else the next scheduled one.
 */
export function pickFeaturedPost(posts: MarketingPost[]): MarketingPost | null {
  return (
    posts.find((p) => p.status === "preparada") ??
    posts.find((p) => p.status === "borrador") ??
    posts.find((p) => p.status === "aprobada") ??
    posts.find((p) => p.status === "programada") ??
    null
  )
}
