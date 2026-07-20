import { test } from "node:test"
import assert from "node:assert/strict"
import {
  resolvePresenceEntitlement,
  isPresencePubliclyVisible,
  resolveSiteBySlug,
  resolveSiteByHostname,
} from "./resolve"
import type { PresenceSite, PresenceDomain, PresencePublication } from "./types"

function site(overrides: Partial<PresenceSite> = {}): PresenceSite {
  return {
    id: "site_1",
    workspaceId: "ws_1",
    slug: "studio-rosa",
    status: "published",
    ownershipModel: "included_in_saas",
    templateId: "business-site-standard",
    templateVersion: "0.1.0",
    themeKey: "rose-nude",
    selectedProposalId: "ws_1:signature",
    sections: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function publication(state: PresencePublication["state"]): PresencePublication {
  return {
    id: "pub_1",
    siteId: "site_1",
    workspaceId: "ws_1",
    state,
    templateId: "business-site-standard",
    templateVersion: "0.1.0",
    themeKey: "rose-nude",
    reason: "client_published",
    publishedAt: "2026-01-01T00:00:00.000Z",
    offlineAt: null,
  }
}

// ---- Entitlement -----------------------------------------------------------

test("enterprise plan (all modules) is entitled via plan", () => {
  const e = resolvePresenceEntitlement({ plan: "enterprise" })
  assert.equal(e.entitled, true)
  assert.equal(e.source, "plan_included")
})

test("a plan without presence is not entitled without standalone", () => {
  const e = resolvePresenceEntitlement({ plan: "free" })
  assert.equal(e.entitled, false)
  assert.equal(e.source, "none")
})

test("standalone subscription keeps Presence entitled after SaaS is cancelled", () => {
  const e = resolvePresenceEntitlement({
    plan: "free",
    standalone: { active: true },
  })
  assert.equal(e.entitled, true)
  assert.equal(e.source, "standalone")
})

test("an inactive standalone subscription is not entitled", () => {
  const e = resolvePresenceEntitlement({
    plan: "free",
    standalone: { active: false },
  })
  assert.equal(e.entitled, false)
})

// ---- Public visibility -----------------------------------------------------

test("published + public + entitled → visible", () => {
  const visible = isPresencePubliclyVisible(
    site(),
    publication("public"),
    { entitled: true, source: "plan_included" },
  )
  assert.equal(visible, true)
})

test("not entitled → offline even if published", () => {
  const visible = isPresencePubliclyVisible(
    site(),
    publication("public"),
    { entitled: false, source: "none" },
  )
  assert.equal(visible, false)
})

test("unpublished status → offline", () => {
  const visible = isPresencePubliclyVisible(
    site({ status: "unpublished" }),
    publication("offline"),
    { entitled: true, source: "standalone" },
  )
  assert.equal(visible, false)
})

test("missing publication → offline", () => {
  const visible = isPresencePubliclyVisible(site(), null, {
    entitled: true,
    source: "plan_included",
  })
  assert.equal(visible, false)
})

// ---- Slug & hostname resolution -------------------------------------------

test("resolves a site by slug, case-insensitively", () => {
  const found = resolveSiteBySlug("STUDIO-ROSA", [site()])
  assert.ok(found)
  assert.equal(found!.id, "site_1")
})

test("hostname resolution requires a verified domain", () => {
  const domains: PresenceDomain[] = [
    {
      id: "dom_1",
      workspaceId: "ws_1",
      siteId: "site_1",
      hostname: "studiorosa.com",
      kind: "custom",
      verification: "pending",
      ownership: "client_owned",
      isPrimary: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]
  assert.equal(resolveSiteByHostname("studiorosa.com", domains, [site()]), null)

  domains[0].verification = "verified"
  const resolved = resolveSiteByHostname("studiorosa.com", domains, [site()])
  assert.ok(resolved)
  assert.equal(resolved!.site.id, "site_1")
  assert.equal(resolved!.domain.id, "dom_1")
})
