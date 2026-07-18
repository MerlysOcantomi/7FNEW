import test from "node:test"
import assert from "node:assert/strict"

import {
  applyPostEdits,
  approvePost,
  buildDraftPostFromWork,
  buildEditorialWeek,
  canTransitionCampaign,
  deriveWeeklySummary,
  normalizeHashtags,
  pickFeaturedPost,
  schedulePost,
  transitionCampaign,
  workStatusForPost,
} from "./state"
import { getBeautyMarketingDemoSnapshot, getEmptyMarketingSnapshot } from "./demo-data"
import { resolveBeautyMarketingConfig } from "./beauty-marketing"
import type { MarketingCampaign, MarketingPost, MarketingWork } from "./types"

const WS = "ws-test"
const NOW = new Date(2026, 6, 17, 10, 0, 0) // fixed local date for determinism

function post(overrides: Partial<MarketingPost> = {}): MarketingPost {
  return {
    id: "p1",
    workspaceId: WS,
    workId: null,
    title: "Trabajo de prueba",
    caption: "Un pie de foto",
    hashtags: ["beauty"],
    channel: "instagram",
    kind: "post",
    goal: null,
    bestTime: null,
    cta: null,
    status: "preparada",
    scheduledFor: null,
    preparedBy: "freya",
    ...overrides,
  }
}

function campaign(overrides: Partial<MarketingCampaign> = {}): MarketingCampaign {
  return {
    id: "c1",
    workspaceId: WS,
    title: "Campaña",
    agent: "fiona",
    status: "sugerida",
    reason: "motivo",
    ...overrides,
  }
}

// ─── Campaign transitions ────────────────────────────────────────────────────

test("campaign transitions: the declared lifecycle is enforced", () => {
  assert.ok(canTransitionCampaign("sugerida", "aprobada"))
  assert.ok(canTransitionCampaign("aprobada", "activa"))
  assert.ok(canTransitionCampaign("activa", "pausada"))
  assert.ok(canTransitionCampaign("pausada", "activa"))
  assert.ok(canTransitionCampaign("activa", "finalizada"))
  // Invalid jumps are rejected.
  assert.equal(canTransitionCampaign("sugerida", "activa"), false)
  assert.equal(canTransitionCampaign("finalizada", "activa"), false)
  assert.equal(canTransitionCampaign("pausada", "sugerida"), false)
})

test("transitionCampaign returns the updated campaign or null", () => {
  const c = campaign()
  const approved = transitionCampaign(c, "aprobada")
  assert.equal(approved?.status, "aprobada")
  // Original is not mutated.
  assert.equal(c.status, "sugerida")
  assert.equal(transitionCampaign(c, "pausada"), null)
})

// ─── Post approval (honest publish) ──────────────────────────────────────────

test("approvePost without a connected channel never fakes a publication", () => {
  const approved = approvePost(post(), { channelConnected: false })
  assert.equal(approved.status, "aprobada")
})

test("approvePost with a connected channel publishes", () => {
  const published = approvePost(post(), { channelConnected: true })
  assert.equal(published.status, "publicada")
})

// ─── Scheduling ──────────────────────────────────────────────────────────────

test("schedulePost accepts a future date and normalizes to ISO", () => {
  const future = new Date(2026, 6, 18, 19, 0).toISOString()
  const scheduled = schedulePost(post(), future, NOW)
  assert.equal(scheduled?.status, "programada")
  assert.equal(scheduled?.scheduledFor, future)
})

test("schedulePost rejects past dates and garbage input", () => {
  assert.equal(schedulePost(post(), new Date(2026, 6, 16, 9, 0).toISOString(), NOW), null)
  assert.equal(schedulePost(post(), "not-a-date", NOW), null)
})

// ─── Edits & hashtags ────────────────────────────────────────────────────────

test("normalizeHashtags strips #, trims, dedupes case-insensitively", () => {
  assert.deepEqual(normalizeHashtags(["#RoseNude", " rosenude ", "", "#uñas", "uñas"]), [
    "RoseNude",
    "uñas",
  ])
})

test("applyPostEdits normalizes hashtags and rejects an empty caption", () => {
  const edited = applyPostEdits(post(), { caption: "Nuevo texto", hashtags: ["#a", "a", "b"] })
  assert.equal(edited?.caption, "Nuevo texto")
  assert.deepEqual(edited?.hashtags, ["a", "b"])
  assert.equal(applyPostEdits(post(), { caption: "   " }), null)
})

// ─── Work → post proposal ────────────────────────────────────────────────────

test("buildDraftPostFromWork composes a usable proposal from metadata", () => {
  const work: MarketingWork = {
    id: "w1",
    workspaceId: WS,
    title: "Rose nude · María",
    clientName: "María",
    service: "Manicura semipermanente",
    style: "Rose nude",
    beforeAfter: true,
    status: "sin_usar",
    createdAt: NOW.toISOString(),
  }
  const draft = buildDraftPostFromWork(work, { id: "p-new" })
  assert.equal(draft.workspaceId, WS)
  assert.equal(draft.workId, "w1")
  assert.equal(draft.status, "borrador")
  assert.equal(draft.kind, "carrusel") // before/after → carrusel
  assert.ok(draft.caption.includes("María"))
  assert.ok(draft.hashtags.length > 0)
  // Hashtags carry no spaces or leading #.
  for (const t of draft.hashtags) assert.ok(!t.includes(" ") && !t.startsWith("#"))
})

// ─── Work status sync ────────────────────────────────────────────────────────

test("workStatusForPost maps every post status", () => {
  assert.equal(workStatusForPost("borrador"), "preparado")
  assert.equal(workStatusForPost("preparada"), "preparado")
  assert.equal(workStatusForPost("programada"), "programado")
  assert.equal(workStatusForPost("aprobada"), "publicado")
  assert.equal(workStatusForPost("publicada"), "publicado")
})

// ─── Editorial week ──────────────────────────────────────────────────────────

test("buildEditorialWeek derives 7 days with scheduled posts and active campaigns", () => {
  const scheduled = post({
    id: "p2",
    status: "programada",
    kind: "reel",
    scheduledFor: new Date(2026, 6, 19, 18, 0).toISOString(),
  })
  const days = buildEditorialWeek([scheduled], [campaign({ status: "activa" })], NOW)
  assert.equal(days.length, 7)
  assert.equal(days[0].isToday, true)
  // The active campaign markers live on today's cell.
  assert.ok(days[0].items.some((i) => i.kind === "campaña"))
  // The reel lands on its scheduled day (offset +2).
  assert.ok(days[2].items.some((i) => i.kind === "reel"))
  // Unscheduled days stay empty.
  assert.equal(days[6].items.length, 0)
})

// ─── Summary & featured pick ─────────────────────────────────────────────────

test("deriveWeeklySummary counts ready, scheduled and active", () => {
  const summary = deriveWeeklySummary(
    [post({ status: "preparada" }), post({ id: "p2", status: "programada" }), post({ id: "p3", status: "borrador" })],
    [campaign({ status: "activa" }), campaign({ id: "c2", status: "sugerida" })],
  )
  assert.deepEqual(summary, { readyCount: 2, scheduledCount: 1, activeCampaigns: 1 })
})

test("pickFeaturedPost prefers preparada, then borrador, then aprobada, then programada", () => {
  const prepared = post({ id: "a", status: "preparada" })
  const draft = post({ id: "b", status: "borrador" })
  const scheduled = post({ id: "c", status: "programada" })
  assert.equal(pickFeaturedPost([scheduled, draft, prepared])?.id, "a")
  assert.equal(pickFeaturedPost([scheduled, draft])?.id, "b")
  assert.equal(pickFeaturedPost([scheduled])?.id, "c")
  assert.equal(pickFeaturedPost([]), null)
})

// ─── Demo adapter ────────────────────────────────────────────────────────────

test("demo snapshot is workspace-scoped and coherent", () => {
  const snap = getBeautyMarketingDemoSnapshot(WS, NOW)
  assert.equal(snap.workspaceId, WS)
  for (const w of snap.works) assert.equal(w.workspaceId, WS)
  for (const p of snap.posts) assert.equal(p.workspaceId, WS)
  for (const c of snap.campaigns) assert.equal(c.workspaceId, WS)
  // Ids are namespaced per workspace so two tenants never collide.
  const other = getBeautyMarketingDemoSnapshot("ws-other", NOW)
  const ids = new Set(snap.works.map((w) => w.id))
  for (const w of other.works) assert.ok(!ids.has(w.id))
  // Every work that claims a post actually has it.
  for (const w of snap.works) {
    if (w.postId) assert.ok(snap.posts.some((p) => p.id === w.postId))
  }
  // No channel is connected (honest publish gate).
  assert.ok(snap.channels.every((c) => !c.connected))
  // Demo works never hardcode image URLs — they use placeholder tones.
  for (const w of snap.works) {
    assert.equal(w.imageUrl, null)
    assert.ok(w.placeholderTone)
  }
})

test("empty snapshot drives the empty states", () => {
  const snap = getEmptyMarketingSnapshot(WS)
  assert.equal(snap.works.length, 0)
  assert.equal(snap.posts.length, 0)
  assert.equal(snap.campaigns.length, 0)
  assert.equal(snap.pulse, null)
  assert.equal(snap.freya, null)
})

// ─── Beauty config resolver ──────────────────────────────────────────────────

test("resolveBeautyMarketingConfig activates for beauty verticals only", () => {
  for (const key of ["beauty", "salon", "nails", "spa"]) {
    assert.ok(resolveBeautyMarketingConfig(key), `expected config for ${key}`)
  }
  assert.equal(resolveBeautyMarketingConfig("construction"), null)
  assert.equal(resolveBeautyMarketingConfig(null), null)
  assert.equal(resolveBeautyMarketingConfig(undefined), null)
})

test("beauty marketing config speaks Spanish and stays honest about channels", () => {
  const cfg = resolveBeautyMarketingConfig("beauty")
  assert.ok(cfg)
  assert.equal(cfg.header.title, "Marketing")
  assert.ok(cfg.previewChip.includes("datos de ejemplo"))
  assert.ok(cfg.featured.channelPendingNote.length > 0)
  // No complex ad-tech jargon in the campaign section.
  const text = JSON.stringify(cfg.campaigns).toLowerCase()
  for (const banned of ["funnel", "roas", "segmentación avanzada"]) {
    assert.ok(!text.includes(banned), `campaigns copy must not include "${banned}"`)
  }
})
