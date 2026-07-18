/**
 * Marketing (Finesse) — ISOLATED demo adapter.
 *
 * Curated, deletable demo content for the Beauty Marketing surface, in the same
 * spirit as `components/today/appointments/appointment-mock.ts`: no real
 * backend for works/posts/campaigns/social metrics exists yet, so this module
 * produces a coherent `MarketingSnapshot` for a realistic salon. The UI always
 * renders the localized "Preview · sample data" chip while this adapter is the
 * data source, and it is the ONLY place demo structure lives — components
 * never hardcode data.
 *
 * Localization: every visible demo string (titles, captions, campaign copy,
 * pulse metrics, Freya's brief) comes from the caller's localized catalog via
 * the `demo: MarketingDemoContent` parameter — this file owns only structure
 * (ids, statuses, tones, scheduling offsets, channel flags). Demo content is
 * product-owned sample data, which is why localizing it is safe; real user
 * content is never translated.
 *
 * Multi-tenant: the snapshot is generated per `workspaceId` (ids are prefixed
 * with it), never shared module-level mutable state. Scheduled dates are
 * derived from `now` passed by the caller — no clock reads here — so the demo
 * week always looks alive without being nondeterministic in tests.
 *
 * Swap path: replace calls to `getBeautyMarketingDemoSnapshot` with a real
 * fetch returning the same `MarketingSnapshot` contract (see `types.ts`).
 */

import type {
  MarketingCampaign,
  MarketingPost,
  MarketingSnapshot,
  MarketingWork,
} from "./types"
import type { MarketingDemoContent } from "./i18n/types"

function atDay(base: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute)
  return d.toISOString()
}

/** Build the demo snapshot for a workspace. Pure given (workspaceId, now, demo). */
export function getBeautyMarketingDemoSnapshot(
  workspaceId: string,
  now: Date,
  demo: MarketingDemoContent,
): MarketingSnapshot {
  const id = (suffix: string) => `${workspaceId}:demo-mkt-${suffix}`

  const works: MarketingWork[] = [
    {
      id: id("w1"),
      workspaceId,
      ...demo.works.w1,
      beforeAfter: true,
      status: "preparado",
      createdAt: atDay(now, 0, 9, 30),
      imageUrl: null,
      placeholderTone: "rose",
      postId: id("p1"),
    },
    {
      id: id("w2"),
      workspaceId,
      ...demo.works.w2,
      status: "programado",
      createdAt: atDay(now, -1, 17, 0),
      imageUrl: null,
      placeholderTone: "lilac",
      postId: id("p2"),
    },
    {
      id: id("w3"),
      workspaceId,
      ...demo.works.w3,
      status: "publicado",
      createdAt: atDay(now, -2, 12, 0),
      imageUrl: null,
      placeholderTone: "gold",
      postId: id("p3"),
    },
    {
      id: id("w4"),
      workspaceId,
      ...demo.works.w4,
      status: "sin_usar",
      createdAt: atDay(now, -2, 18, 30),
      imageUrl: null,
      placeholderTone: "red",
    },
    {
      id: id("w5"),
      workspaceId,
      ...demo.works.w5,
      status: "nuevo",
      createdAt: atDay(now, 0, 8, 15),
      imageUrl: null,
      placeholderTone: "blush",
    },
  ]

  const posts: MarketingPost[] = [
    {
      id: id("p1"),
      workspaceId,
      workId: id("w1"),
      ...demo.posts.p1,
      channel: "instagram",
      kind: "carrusel",
      status: "preparada",
      scheduledFor: null,
      preparedBy: "freya",
    },
    {
      id: id("p2"),
      workspaceId,
      workId: id("w2"),
      ...demo.posts.p2,
      channel: "instagram",
      kind: "post",
      status: "programada",
      scheduledFor: atDay(now, 2, 18, 30),
      preparedBy: "freya",
    },
    {
      id: id("p3"),
      workspaceId,
      workId: id("w3"),
      ...demo.posts.p3,
      channel: "instagram",
      kind: "reel",
      status: "programada",
      scheduledFor: atDay(now, 4, 12, 0),
      preparedBy: "freya",
    },
  ]

  const campaigns: MarketingCampaign[] = [
    {
      id: id("c1"),
      workspaceId,
      ...demo.campaigns.c1,
      agent: "fiona",
      status: "activa",
      audienceSize: 480,
    },
    {
      id: id("c2"),
      workspaceId,
      ...demo.campaigns.c2,
      agent: "fiona",
      status: "sugerida",
      audienceSize: 14,
    },
  ]

  return {
    workspaceId,
    works,
    posts,
    campaigns,
    pulse: {
      workspaceId,
      periodLabel: demo.pulse.periodLabel,
      metrics: [
        { id: "followers", ...demo.pulse.metrics.followers, deltaTone: "up" },
        { id: "reach", ...demo.pulse.metrics.reach, deltaTone: "up" },
        { id: "saves", ...demo.pulse.metrics.saves, deltaTone: "up" },
        { id: "inquiries", ...demo.pulse.metrics.inquiries, deltaTone: "up" },
        { id: "newClients", ...demo.pulse.metrics.newClients, deltaTone: "flat" },
      ],
      insight: demo.pulse.insight,
    },
    // Coherent with the snapshot above: 1 post ready for review (p1), plus a
    // reel idea already scheduled (p3).
    freya: {
      workspaceId,
      message: demo.freyaMessage,
      readyCount: 1,
    },
    // No channel is connected yet — publish stays in the honest "approved ·
    // channel pending" state until real integrations exist.
    channels: [
      { channel: "instagram", connected: false },
      { channel: "facebook", connected: false },
      { channel: "tiktok", connected: false },
    ],
  }
}

/** An intentionally empty snapshot — drives the empty-state QA preview. */
export function getEmptyMarketingSnapshot(workspaceId: string): MarketingSnapshot {
  return {
    workspaceId,
    works: [],
    posts: [],
    campaigns: [],
    pulse: null,
    freya: null,
    channels: [
      { channel: "instagram", connected: false },
      { channel: "facebook", connected: false },
      { channel: "tiktok", connected: false },
    ],
  }
}
