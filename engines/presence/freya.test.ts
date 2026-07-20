import { test } from "node:test"
import assert from "node:assert/strict"
import {
  HeuristicFreyaStyleProvider,
  HeuristicFreyaMediaProvider,
  resolveFreyaStyleProvider,
} from "./freya"
import { isPresenceThemeKey } from "./themes"
import { buildPresenceContentSource } from "./content-source"
import type { PresenceMedia } from "./types"

const NOW = "2026-01-01T00:00:00.000Z"

function content(workspaceId = "ws_1") {
  return buildPresenceContentSource({
    workspaceId,
    businessName: "Studio Rosa",
    profile: { businessName: "Studio Rosa", services: ["Manicura"] },
  })
}

// ---- Style proposals -------------------------------------------------------

test("proposes exactly three styles", async () => {
  const provider = new HeuristicFreyaStyleProvider()
  const proposals = await provider.proposeStyles({
    workspaceId: "ws_1",
    verticalKey: "beauty",
    content: content(),
    nowIso: NOW,
  })
  assert.equal(proposals.length, 3)
})

test("beauty vertical uses the Finesse family and valid theme keys", async () => {
  const proposals = await new HeuristicFreyaStyleProvider().proposeStyles({
    workspaceId: "ws_1",
    verticalKey: "beauty",
    content: content(),
    nowIso: NOW,
  })
  assert.equal(proposals[0].templateFamily, "finesse-vertical-landing")
  assert.equal(proposals[0].themeKey, "rose-nude")
  for (const p of proposals) {
    assert.ok(isPresenceThemeKey(p.themeKey))
    assert.equal(p.generatedBy, "heuristic")
  }
})

test("non-beauty vertical uses the generic business-site family", async () => {
  const proposals = await new HeuristicFreyaStyleProvider().proposeStyles({
    workspaceId: "ws_2",
    verticalKey: "creative-agency",
    content: content("ws_2"),
    nowIso: NOW,
  })
  assert.equal(proposals[0].templateFamily, "business-site")
  assert.equal(proposals[0].templateId, "business-site-standard")
})

test("proposals are deterministic (same input → same ids/themes)", async () => {
  const provider = new HeuristicFreyaStyleProvider()
  const input = {
    workspaceId: "ws_1",
    verticalKey: "beauty" as const,
    content: content(),
    nowIso: NOW,
  }
  const a = await provider.proposeStyles(input)
  const b = await provider.proposeStyles(input)
  assert.deepEqual(
    a.map((p) => [p.id, p.themeKey]),
    b.map((p) => [p.id, p.themeKey]),
  )
})

test("resolveFreyaStyleProvider falls back to the heuristic default", () => {
  assert.equal(resolveFreyaStyleProvider().id, "heuristic")
  assert.equal(resolveFreyaStyleProvider(null).id, "heuristic")
})

// ---- Media assessment ------------------------------------------------------

function media(overrides: Partial<PresenceMedia> = {}): PresenceMedia {
  return {
    id: "media_1",
    workspaceId: "ws_1",
    kind: "photo",
    role: "work_sample",
    storageKey: "presence/ws_1/photo.jpg",
    url: "https://blob.example/photo.jpg",
    sourceMediaId: null,
    mimeType: "image/jpeg",
    width: 2000,
    height: 1500,
    isRealWorkSample: true,
    assessmentId: null,
    createdAt: NOW,
    ...overrides,
  }
}

test("real work sample always preserves integrity", async () => {
  const a = await new HeuristicFreyaMediaProvider().assessMedia({
    media: media(),
    nowIso: NOW,
  })
  assert.equal(a.isRealWorkSample, true)
  assert.equal(a.preserveIntegrity, true)
  assert.equal(a.verdict, "use")
})

test("variants never upscale beyond source width and preserve aspect ratio", async () => {
  const a = await new HeuristicFreyaMediaProvider().assessMedia({
    media: media({ width: 900, height: 600 }),
    nowIso: NOW,
  })
  // Source width 900 → thumb(400) + card(800), no hero(1600).
  assert.deepEqual(a.variants.map((v) => v.label), ["thumb", "card"])
  for (const v of a.variants) {
    assert.equal(v.height, Math.round(v.width * (600 / 900)))
    assert.equal(v.format, "webp")
  }
})

test("missing dimensions send media to manual review with no variants", async () => {
  const a = await new HeuristicFreyaMediaProvider().assessMedia({
    media: media({ width: null, height: null }),
    nowIso: NOW,
  })
  assert.equal(a.verdict, "review")
  assert.equal(a.variants.length, 0)
})
