import { test } from "node:test"
import assert from "node:assert/strict"
import {
  planProposalSelection,
  planPublish,
  planUnpublish,
  sanitizeVisualConfig,
  FORBIDDEN_VISUAL_CONFIG_KEYS,
} from "./planning"
import type { FreyaSiteProposal } from "./freya"

const NOW = "2026-07-21T10:00:00.000Z"

const proposal: FreyaSiteProposal = {
  id: "ws_1:signature",
  workspaceId: "ws_1",
  styleKey: "signature",
  name: "Signature",
  themeKey: "rose-nude",
  templateFamily: "finesse-vertical-landing",
  templateId: "finesse-vertical-landing",
  rationale: "…",
  generatedBy: "heuristic",
  createdAt: NOW,
}

test("planProposalSelection pins the theme, template + resolved version, moves to ready", () => {
  const plan = planProposalSelection(proposal)
  assert.equal(plan.selectedProposalId, "ws_1:signature")
  assert.equal(plan.themeKey, "rose-nude")
  assert.equal(plan.templateId, "finesse-vertical-landing")
  assert.equal(plan.templateVersion, "0.1.0") // resolved from the registry
  assert.equal(plan.status, "ready")
})

const site = { templateId: "business-site-standard", templateVersion: "0.1.0", themeKey: "midnight" }

test("planPublish freezes template/theme and sets published/public", () => {
  const plan = planPublish(site, NOW)
  assert.equal(plan.siteStatus, "published")
  assert.equal(plan.publication.state, "public")
  assert.equal(plan.publication.templateId, "business-site-standard")
  assert.equal(plan.publication.themeKey, "midnight")
  assert.equal(plan.publication.publishedAt, NOW)
  assert.equal(plan.publication.offlineAt, null)
  assert.equal(plan.publication.reason, "client_published")
})

test("planUnpublish sets unpublished/offline with a reason", () => {
  const plan = planUnpublish(site, NOW, "saas_cancelled")
  assert.equal(plan.siteStatus, "unpublished")
  assert.equal(plan.publication.state, "offline")
  assert.equal(plan.publication.offlineAt, NOW)
  assert.equal(plan.publication.publishedAt, null)
  assert.equal(plan.publication.reason, "saas_cancelled")
})

test("sanitizeVisualConfig strips every forbidden business-data key", () => {
  const dirty: Record<string, unknown> = {
    sections: [{ kind: "hero", enabled: true, order: 0 }],
    presentation: { density: "cozy" },
  }
  for (const k of FORBIDDEN_VISUAL_CONFIG_KEYS) dirty[k] = "LEAKED"

  const clean = sanitizeVisualConfig(dirty) as Record<string, unknown>
  assert.deepEqual(clean.sections, [{ kind: "hero", enabled: true, order: 0 }])
  assert.deepEqual(clean.presentation, { density: "cozy" })
  for (const k of FORBIDDEN_VISUAL_CONFIG_KEYS) {
    assert.ok(!(k in clean), `forbidden key leaked: ${k}`)
  }
})
