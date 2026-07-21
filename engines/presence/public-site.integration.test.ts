/**
 * Integration tests for the public-site composition (PRESENCE-03) against a REAL
 * local SQLite DB. Covers slug/hostname resolution, effective visibility across
 * states (draft/published/unpublished), entitlement (plan vs standalone),
 * verified-only domains, incomplete Business Profile degradation, media
 * approval + integrity, invalid template, SEO/robots and canonical.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "presence-public-"))
const dbUrl = `file:${join(dir, "test.db")}`
process.env.DATABASE_URL = dbUrl

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any
let repo: any
let pub: any

const PROFILE = {
  businessProfile: {
    businessName: "Studio Rosa",
    businessDescription: "Beauty studio in Madrid",
    workingHours: "Mon–Fri 9–18",
    region: "Madrid",
  },
  serviceCatalog: [
    { id: "s1", name: "Manicure", category: "Nails", active: true },
    { id: "s2", name: "Pedicure", category: "Nails", active: true },
  ],
}

async function setupWorkspace(opts: { slug: string; plan: string; withConfig?: boolean; withWhatsapp?: boolean }) {
  const ws = await db.workspace.create({
    data: {
      nombre: "Studio Rosa",
      slug: opts.slug + "-ws",
      plan: opts.plan,
      config: opts.withConfig === false ? null : JSON.stringify(PROFILE),
    },
  })
  if (opts.withWhatsapp) {
    await db.channelConnection.create({
      data: { workspaceId: ws.id, channelType: "whatsapp", provider: "meta", name: "WA", externalAccountId: "+34600111222", status: "connected" },
    })
  }
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: opts.slug })
  return { ws, site }
}

test.before(async () => {
  execSync(`npx prisma db push --accept-data-loss --url "${dbUrl}"`, { stdio: "ignore", cwd: process.cwd() })
  ;({ db } = await import("@core/db"))
  repo = await import("./repository")
  pub = await import("./public-site")
})

// ---- slug resolution & states ---------------------------------------------

test("nonexistent slug → not_found", async () => {
  const r = await pub.loadPublicSiteBySlug("does-not-exist")
  assert.equal(r.ok, false)
  assert.equal(r.reason, "not_found")
})

test("draft site → offline (not publicly visible)", async () => {
  const { site } = await setupWorkspace({ slug: "draft-co", plan: "enterprise" })
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, false)
  assert.equal(r.reason, "offline")
})

test("published + enterprise plan → ok, indexable", async () => {
  const { ws, site } = await setupWorkspace({ slug: "pub-co", plan: "enterprise", withWhatsapp: true })
  await repo.publishSite(ws.id, site.id)
  const r = await pub.loadPublicSiteBySlug(site.slug, { appBaseUrl: "https://app.sevenef.com" })
  assert.equal(r.ok, true)
  assert.equal(r.seo.robots, "index,follow")
  assert.equal(r.seo.title, "Studio Rosa")
  assert.equal(r.plan.templateId, "business-site-standard")
  assert.equal(r.seo.canonical, "https://app.sevenef.com/sites/pub-co")
})

test("unpublished site → offline", async () => {
  const { ws, site } = await setupWorkspace({ slug: "off-co", plan: "enterprise" })
  await repo.publishSite(ws.id, site.id)
  await repo.unpublishSite(ws.id, site.id)
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, false)
  assert.equal(r.reason, "offline")
})

// ---- entitlement -----------------------------------------------------------

test("free plan without standalone → offline even when published", async () => {
  const { ws, site } = await setupWorkspace({ slug: "free-co", plan: "free" })
  await repo.publishSite(ws.id, site.id)
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, false)
})

test("free plan + active standalone subscription → ok", async () => {
  const { ws, site } = await setupWorkspace({ slug: "standalone-co", plan: "free" })
  await repo.publishSite(ws.id, site.id)
  await db.presenceSubscription.create({ data: { workspaceId: ws.id, status: "active" } })
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, true)
})

// ---- hostname resolution ---------------------------------------------------

test("pending custom domain does not resolve; verified domain does", async () => {
  const { ws, site } = await setupWorkspace({ slug: "host-co", plan: "enterprise" })
  await repo.publishSite(ws.id, site.id)
  const dom = await repo.upsertDomain(ws.id, site.id, { hostname: "studio-rosa.com", isPrimary: true })

  let r = await pub.loadPublicSiteByHostname("studio-rosa.com")
  assert.equal(r.ok, false, "pending domain must not resolve")

  await repo.markDomainVerified(ws.id, dom.id)
  r = await pub.loadPublicSiteByHostname("STUDIO-ROSA.com")
  assert.equal(r.ok, true)
  // Canonical prefers the verified primary domain over the slug URL.
  assert.equal(r.seo.canonical, "https://studio-rosa.com/")
})

// ---- incomplete profile & degradation -------------------------------------

test("incomplete profile omits empty sections but still renders hero", async () => {
  const ws = await db.workspace.create({ data: { nombre: "Bare Biz", slug: "bare-ws", plan: "enterprise", config: null } })
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: "bare-co" })
  await repo.publishSite(ws.id, site.id)
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, true)
  const kinds = r.plan.sections.map((s: any) => s.kind)
  assert.ok(kinds.includes("hero"))
  assert.ok(!kinds.includes("services"), "no services → omitted")
  assert.ok(!kinds.includes("whatsapp"), "no whatsapp → omitted")
  assert.equal(r.plan.siteName, "Bare Biz")
})

// ---- media approval + integrity -------------------------------------------

test("only approved media renders; real work samples keep integrity", async () => {
  const { ws, site } = await setupWorkspace({ slug: "media-co", plan: "enterprise" })
  await repo.publishSite(ws.id, site.id)
  await repo.recordMedia(ws.id, { siteId: site.id, purpose: "gallery", storageKey: "k1", url: "https://blob/x1.jpg", width: 800, height: 600, reviewStatus: "use" })
  await repo.recordMedia(ws.id, { siteId: site.id, purpose: "gallery", storageKey: "k2", url: "https://blob/x2.jpg", width: 800, height: 600, reviewStatus: "pending" })
  await repo.recordMedia(ws.id, { siteId: site.id, purpose: "work_sample", storageKey: "k3", url: "https://blob/real.jpg", width: 800, height: 600, reviewStatus: "use", isRealWorkSample: true })

  const r = await pub.loadPublicSiteBySlug(site.slug)
  const gallery = r.plan.sections.find((s: any) => s.kind === "gallery")
  assert.ok(gallery)
  assert.equal(gallery.data.images.length, 2, "pending media excluded")
  const real = gallery.data.images.find((i: any) => i.isRealWorkSample)
  assert.ok(real)
  assert.equal(real.url, "https://blob/real.jpg", "work-sample URL passed through unmodified")
})

// ---- invalid template ------------------------------------------------------

test("a site pinned to an unknown template → invalid_template", async () => {
  const { ws, site } = await setupWorkspace({ slug: "badtpl-co", plan: "enterprise" })
  await repo.publishSite(ws.id, site.id)
  await db.presenceSite.update({ where: { id: site.id }, data: { templateId: "ghost-template" } })
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, false)
  assert.equal(r.reason, "invalid_template")
})

// ---- visualConfig safety (end to end) -------------------------------------

test("invalid visualConfig is ignored; the site still renders", async () => {
  const { ws, site } = await setupWorkspace({ slug: "vc-co", plan: "enterprise" })
  await db.presenceSite.update({ where: { id: site.id }, data: { visualConfig: "{broken json" } })
  await repo.publishSite(ws.id, site.id)
  const r = await pub.loadPublicSiteBySlug(site.slug)
  assert.equal(r.ok, true)
  assert.ok(r.plan.sections.some((s: any) => s.kind === "services"))
})
