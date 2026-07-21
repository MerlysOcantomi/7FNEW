/**
 * Integration tests for the Presence data-access layer (PRESENCE-02) against a
 * REAL local SQLite database (schema pushed via `prisma db push` into a temp
 * file). Covers behaviours pure tests cannot: per-workspace creation, DB-level
 * slug/hostname uniqueness, verified-only hostname resolution, cross-workspace
 * isolation, publish/unpublish, standalone entitlement continuity, persisted
 * Freya proposal selection, and media metadata + variant lineage.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "presence-repo-"))
const dbUrl = `file:${join(dir, "test.db")}`
process.env.DATABASE_URL = dbUrl

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any
let repo: any
let freya: any
let wsA: any
let wsB: any

test.before(async () => {
  execSync(`npx prisma db push --accept-data-loss --url "${dbUrl}"`, {
    stdio: "ignore",
    cwd: process.cwd(),
  })
  ;({ db } = await import("@core/db"))
  repo = await import("./repository")
  freya = await import("./freya")

  wsA = await db.workspace.create({ data: { nombre: "A", slug: "ws-a", plan: "free" } })
  wsB = await db.workspace.create({ data: { nombre: "B", slug: "ws-b", plan: "enterprise" } })
})

// ---- Creation per workspace ------------------------------------------------

test("getOrCreateSiteForWorkspace creates once and is idempotent", async () => {
  const first = await repo.getOrCreateSiteForWorkspace(wsA.id, { slug: "Studio A" })
  assert.equal(first.workspaceId, wsA.id)
  assert.equal(first.slug, "studio-a")
  assert.equal(first.status, "draft")

  const second = await repo.getOrCreateSiteForWorkspace(wsA.id)
  assert.equal(second.id, first.id, "must return the same canonical site")

  const count = await db.presenceSite.count({ where: { workspaceId: wsA.id } })
  assert.equal(count, 1)
})

// ---- Slug uniqueness (DB-level) -------------------------------------------

test("slug is globally unique — a second workspace cannot reuse it", async () => {
  await repo.getOrCreateSiteForWorkspace(wsB.id, { slug: "studio-a" })
  const siteB = await db.presenceSite.findUnique({ where: { workspaceId: wsB.id } })
  assert.notEqual(siteB.slug, "studio-a", "collision must be disambiguated")

  await assert.rejects(
    db.presenceSite.update({ where: { workspaceId: wsB.id }, data: { slug: "studio-a" } }),
    /unique|constraint/i,
    "DB must reject a duplicate slug",
  )
})

// ---- Hostname normalization + verified-only resolution ---------------------

test("upsertDomain normalizes the hostname and starts pending", async () => {
  const site = await repo.getOrCreateSiteForWorkspace(wsA.id)
  const domain = await repo.upsertDomain(wsA.id, site.id, { hostname: "HTTPS://Studio-A.com/gallery" })
  assert.equal(domain.hostname, "studio-a.com")
  assert.equal(domain.verification, "pending")
})

test("an unverified hostname does NOT resolve publicly", async () => {
  const resolved = await repo.findSiteByHostname("studio-a.com")
  assert.equal(resolved, null)
})

test("a verified hostname resolves to its site", async () => {
  const domain = await db.presenceDomain.findUnique({ where: { hostname: "studio-a.com" } })
  await repo.markDomainVerified(wsA.id, domain.id)
  const resolved = await repo.findSiteByHostname("Studio-A.com")
  assert.ok(resolved)
  assert.equal(resolved.site.workspaceId, wsA.id)
})

// ---- Cross-workspace isolation --------------------------------------------

test("a workspace cannot mutate another workspace's site", async () => {
  const siteA = await repo.getOrCreateSiteForWorkspace(wsA.id)
  await assert.rejects(
    repo.updateVisualConfig(wsB.id, siteA.id, { presentation: {} }),
    /not found for workspace/i,
  )
  await assert.rejects(repo.publishSite(wsB.id, siteA.id), /not found for workspace/i)
})

test("a workspace cannot claim a hostname owned by another workspace", async () => {
  const siteB = await repo.getOrCreateSiteForWorkspace(wsB.id)
  await assert.rejects(
    repo.upsertDomain(wsB.id, siteB.id, { hostname: "studio-a.com" }),
    /already claimed/i,
  )
})

// ---- Visual config never stores business data -----------------------------

test("updateVisualConfig strips business-data keys before persisting", async () => {
  const site = await repo.getOrCreateSiteForWorkspace(wsA.id)
  const updated = await repo.updateVisualConfig(wsA.id, site.id, {
    presentation: { density: "cozy" },
    services: ["LEAKED"],
    phone: "+34600000000",
  })
  const parsed = JSON.parse(updated.visualConfig)
  assert.deepEqual(parsed.presentation, { density: "cozy" })
  assert.ok(!("services" in parsed))
  assert.ok(!("phone" in parsed))
})

// ---- Freya proposal selection (persisted) ---------------------------------

test("selectFreyaProposal persists the chosen style and pins theme/template", async () => {
  const site = await repo.getOrCreateSiteForWorkspace(wsA.id)
  const proposals = await new freya.HeuristicFreyaStyleProvider().proposeStyles({
    workspaceId: wsA.id,
    verticalKey: "beauty",
    content: { workspaceId: wsA.id, identity: { name: "A", description: null }, services: [], hours: null, region: null, channels: { whatsapp: null, phone: null, social: {} }, availableSources: [] },
    nowIso: "2026-07-21T10:00:00.000Z",
  })
  const chosen = proposals[1] // "serene" / sage-luxe
  const updated = await repo.selectFreyaProposal(wsA.id, site.id, chosen)
  assert.equal(updated.selectedProposalId, chosen.id)
  assert.equal(updated.themeKey, chosen.themeKey)
  assert.equal(updated.templateId, chosen.templateId)
  assert.equal(updated.status, "ready")

  const reloaded = await db.presenceSite.findUnique({ where: { id: site.id } })
  assert.equal(reloaded.selectedProposalId, chosen.id, "selection must survive a reload")
})

// ---- Publish / unpublish ---------------------------------------------------

test("publish then unpublish records status + immutable publications", async () => {
  const site = await repo.getOrCreateSiteForWorkspace(wsB.id)
  const published = await repo.publishSite(wsB.id, site.id)
  assert.equal(published.status, "published")

  let pubs = await db.presencePublication.findMany({ where: { siteId: site.id } })
  assert.equal(pubs.length, 1)
  assert.equal(pubs[0].state, "public")

  const offline = await repo.unpublishSite(wsB.id, site.id, "saas_cancelled")
  assert.equal(offline.status, "unpublished")
  pubs = await db.presencePublication.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "asc" } })
  assert.equal(pubs.length, 2, "publications are append-only")
  assert.equal(pubs[1].state, "offline")
  assert.equal(pubs[1].reason, "saas_cancelled")
})

// ---- Entitlement continuity (standalone) ----------------------------------

test("enterprise plan is entitled via plan (published site is visible)", async () => {
  const site = await repo.getOrCreateSiteForWorkspace(wsB.id)
  await repo.publishSite(wsB.id, site.id)
  const resolved = await repo.resolvePublicSite(site.slug)
  assert.ok(resolved)
  assert.equal(resolved.entitlement.source, "plan_included")
  assert.equal(resolved.isPubliclyVisible, true)
})

test("free plan with no standalone → published but NOT publicly visible", async () => {
  const ws = await db.workspace.create({ data: { nombre: "C", slug: "ws-c", plan: "free" } })
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: "studio-c" })
  await repo.publishSite(ws.id, site.id)
  const resolved = await repo.resolvePublicSite("studio-c")
  assert.equal(resolved.entitlement.entitled, false)
  assert.equal(resolved.isPubliclyVisible, false)
})

test("standalone subscription keeps a published site visible after SaaS is cancelled", async () => {
  const ws = await db.workspace.create({ data: { nombre: "D", slug: "ws-d", plan: "free" } })
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: "studio-d" })
  await repo.publishSite(ws.id, site.id)
  await db.presenceSubscription.create({ data: { workspaceId: ws.id, status: "active", source: "standalone" } })

  const resolved = await repo.resolvePublicSite("studio-d")
  assert.equal(resolved.entitlement.source, "standalone")
  assert.equal(resolved.isPubliclyVisible, true)
})

// ---- Media metadata + variants --------------------------------------------

test("recordMedia stores metadata and derived variants with lineage", async () => {
  const ws = await db.workspace.create({ data: { nombre: "E", slug: "ws-e", plan: "free" } })
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: "studio-e" })

  const original = await repo.recordMedia(ws.id, {
    siteId: site.id,
    kind: "photo",
    purpose: "work_sample",
    storageKey: "presence/ws-e/orig.jpg",
    url: "https://blob.example/orig.jpg",
    mimeType: "image/jpeg",
    width: 2000,
    height: 1500,
    isRealWorkSample: true,
    checksum: "abc123",
  })
  assert.equal(original.isRealWorkSample, true)
  assert.equal(original.preserveIntegrity, true, "real work samples default to integrity-preserving")

  const variant = await repo.recordMedia(ws.id, {
    siteId: site.id,
    kind: "variant",
    purpose: "work_sample",
    storageKey: "presence/ws-e/orig-card.webp",
    url: "https://blob.example/orig-card.webp",
    mimeType: "image/webp",
    width: 800,
    height: 600,
    sourceMediaId: original.id,
  })
  assert.equal(variant.sourceMediaId, original.id)

  const all = await repo.listMedia(ws.id, site.id)
  assert.equal(all.length, 2)

  // Deleting the original cascades to its variants (FK ON DELETE CASCADE).
  await db.presenceMedia.delete({ where: { id: original.id } })
  const remaining = await repo.listMedia(ws.id, site.id)
  assert.equal(remaining.length, 0, "variant must be removed with its source")
})
