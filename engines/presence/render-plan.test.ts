import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildRenderPlan,
  isApprovedMedia,
  PresenceTemplateNotFoundError,
  type RenderMedia,
} from "./render-plan"
import type { PresenceContentSource } from "./content-source"

function content(overrides: Partial<PresenceContentSource> = {}): PresenceContentSource {
  return {
    workspaceId: "ws_1",
    identity: { name: "Studio Rosa", description: "Beauty studio in Madrid" },
    services: [
      { name: "Manicure", category: "Nails", active: true },
      { name: "Old", category: null, active: false },
    ],
    hours: "Mon–Fri 9–18",
    region: "Madrid",
    channels: { whatsapp: "+34 600 000 000", phone: null, social: {} },
    availableSources: [],
    ...overrides,
  }
}

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: "site_1",
    templateId: "business-site-standard",
    templateVersion: "0.1.0",
    themeKey: "rose-nude",
    visualConfig: null as string | null,
    ...overrides,
  }
}

function media(overrides: Partial<RenderMedia> = {}): RenderMedia {
  return {
    id: "m1",
    kind: "photo",
    purpose: "gallery",
    url: "https://blob.example/a.jpg",
    width: 1200,
    height: 900,
    reviewStatus: "use",
    isRealWorkSample: false,
    preserveIntegrity: false,
    sourceMediaId: null,
    ...overrides,
  }
}

// ---- template resolution ---------------------------------------------------

test("throws PresenceTemplateNotFoundError for an unknown template", () => {
  assert.throws(
    () => buildRenderPlan({ site: site({ templateId: "nope" }), content: content(), media: [] }),
    PresenceTemplateNotFoundError,
  )
})

test("falls back to midnight for an invalid theme key", () => {
  const plan = buildRenderPlan({ site: site({ themeKey: "not-a-theme" }), content: content(), media: [] })
  assert.equal(plan.themeKey, "midnight")
})

// ---- section presence / omission ------------------------------------------

test("renders hero + services + location + whatsapp from full content", () => {
  const plan = buildRenderPlan({ site: site(), content: content(), media: [] })
  const kinds = plan.sections.map((s) => s.kind)
  assert.ok(kinds.includes("hero"))
  assert.ok(kinds.includes("services"))
  assert.ok(kinds.includes("location"))
  assert.ok(kinds.includes("whatsapp"))
})

test("services only include active items", () => {
  const plan = buildRenderPlan({ site: site(), content: content(), media: [] })
  const services = plan.sections.find((s) => s.kind === "services")
  assert.ok(services && services.kind === "services")
  assert.deepEqual(services.data.items.map((i) => i.name), ["Manicure"])
})

test("empty sections are omitted cleanly (no services, no region/hours, no whatsapp)", () => {
  const plan = buildRenderPlan({
    site: site(),
    content: content({ services: [], hours: null, region: null, channels: { whatsapp: null, phone: null, social: {} } }),
    media: [],
  })
  const kinds = plan.sections.map((s) => s.kind)
  assert.ok(kinds.includes("hero"), "hero always renders from the name")
  assert.ok(!kinds.includes("services"))
  assert.ok(!kinds.includes("location"))
  assert.ok(!kinds.includes("whatsapp"))
})

test("hero renders even with only a business name (incomplete profile)", () => {
  const plan = buildRenderPlan({
    site: site(),
    content: content({ identity: { name: "Solo Name", description: null }, services: [], hours: null, region: null, channels: { whatsapp: null, phone: null, social: {} } }),
    media: [],
  })
  const hero = plan.sections.find((s) => s.kind === "hero")
  assert.ok(hero && hero.kind === "hero")
  assert.equal(hero.data.title, "Solo Name")
  assert.equal(hero.data.subtitle, null)
  assert.equal(hero.data.cta, null)
})

// ---- media approval + integrity -------------------------------------------

test("only approved media (reviewStatus 'use') appears in the gallery", () => {
  const plan = buildRenderPlan({
    site: site(),
    content: content(),
    media: [media({ id: "ok" }), media({ id: "pending", reviewStatus: "pending" }), media({ id: "rejected", reviewStatus: "reject" })],
  })
  const gallery = plan.sections.find((s) => s.kind === "gallery")
  assert.ok(gallery && gallery.kind === "gallery")
  assert.equal(gallery.data.images.length, 1)
})

test("isApprovedMedia gates on the 'use' verdict", () => {
  assert.equal(isApprovedMedia(media({ reviewStatus: "use" })), true)
  assert.equal(isApprovedMedia(media({ reviewStatus: "review" })), false)
})

test("real work samples keep an integrity-preserving alt and are not altered", () => {
  const plan = buildRenderPlan({
    site: site(),
    content: content(),
    media: [media({ isRealWorkSample: true, purpose: "work_sample" })],
  })
  const gallery = plan.sections.find((s) => s.kind === "gallery")
  assert.ok(gallery && gallery.kind === "gallery")
  assert.equal(gallery.data.images[0].isRealWorkSample, true)
  assert.equal(gallery.data.images[0].alt, "Work sample")
  // URL is passed through verbatim — the renderer never rewrites work-sample media.
  assert.equal(gallery.data.images[0].url, "https://blob.example/a.jpg")
})

// ---- visualConfig safety ---------------------------------------------------

test("invalid visualConfig JSON is ignored safely (template defaults apply)", () => {
  const plan = buildRenderPlan({ site: site({ visualConfig: "{not json" }), content: content(), media: [] })
  assert.ok(plan.sections.some((s) => s.kind === "services"))
})

test("visualConfig can disable a known section; unknown kinds are ignored", () => {
  const cfg = JSON.stringify({ sections: [{ kind: "services", enabled: false }, { kind: "totally-unknown", enabled: true }] })
  const plan = buildRenderPlan({ site: site({ visualConfig: cfg }), content: content(), media: [] })
  assert.ok(!plan.sections.some((s) => s.kind === "services"), "disabled section is dropped")
  assert.ok(!plan.sections.some((s) => (s.kind as string) === "totally-unknown"))
})

// ---- nav + cta -------------------------------------------------------------

test("nav is built from present non-hero sections; whatsapp drives the primary CTA", () => {
  const plan = buildRenderPlan({ site: site(), content: content(), media: [] })
  assert.ok(plan.primaryCta)
  assert.match(plan.primaryCta!.href, /^https:\/\/wa\.me\/34600000000$/)
  assert.ok(plan.nav.some((n) => n.href === "#services"))
})

// ---- structural snapshot (stable) -----------------------------------------

test("structural snapshot is stable for fixed input", () => {
  const plan = buildRenderPlan({ site: site(), content: content(), media: [media()] })
  const structure = {
    themeKey: plan.themeKey,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    siteName: plan.siteName,
    nav: plan.nav.map((n) => n.href),
    primaryCta: plan.primaryCta?.href ?? null,
    sections: plan.sections.map((s) => s.kind),
  }
  assert.deepEqual(structure, {
    themeKey: "rose-nude",
    templateId: "business-site-standard",
    templateVersion: "0.1.0",
    siteName: "Studio Rosa",
    nav: ["#services", "#gallery", "#location", "#whatsapp"],
    primaryCta: "https://wa.me/34600000000",
    sections: ["hero", "services", "gallery", "location", "whatsapp"],
  })
})
