import { describe, test } from "node:test"
import assert from "node:assert/strict"
import type { DomainState } from "./domain-types"
import {
  resolveRecommendationTarget,
  buildGuidedRecommendations,
  resolveNextMoveTarget,
} from "./recommendation-routing"

function makeDomain(overrides: Partial<DomainState> & Pick<DomainState, "domain">): DomainState {
  return {
    level: "none",
    strength: 0,
    supportingSignals: [],
    supportingModules: [],
    missingCapabilities: [],
    ...overrides,
  }
}

describe("recommendation-routing", () => {
  test("CRM gap resolves to /clientes with source capability", () => {
    const domain = makeDomain({
      domain: "relationship",
      level: "basic",
      strength: 0.3,
      missingCapabilities: ["crm"],
    })
    const target = resolveRecommendationTarget(domain, "crm")
    assert.equal(target.href, "/clientes")
    assert.equal(target.kind, "module")
    assert.equal(target.source, "capability")
    assert.equal(target.availability, "available")
  })

  test("finance gap resolves to /finanzas", () => {
    const domain = makeDomain({
      domain: "finance",
      level: "basic",
      strength: 0.25,
      missingCapabilities: ["financeControl"],
    })
    const target = resolveRecommendationTarget(domain, "financeControl")
    assert.equal(target.href, "/finanzas")
    assert.equal(target.kind, "module")
    assert.equal(target.source, "capability")
  })

  test("content gap resolves to /contenido", () => {
    const domain = makeDomain({
      domain: "content",
      missingCapabilities: ["contentMarketing"],
    })
    const target = resolveRecommendationTarget(domain, "contentMarketing")
    assert.equal(target.href, "/contenido")
    assert.equal(target.source, "capability")
  })

  test("unknown capability falls back to domain route", () => {
    const domain = makeDomain({
      domain: "marketing",
      missingCapabilities: ["nonexistent_cap"],
    })
    const target = resolveRecommendationTarget(domain, "nonexistent_cap")
    assert.equal(target.href, "/contenido")
    assert.equal(target.source, "domain-fallback")
    assert.equal(target.availability, "available")
  })

  test("no duplicate targets when capabilities share the same route", () => {
    const domains: DomainState[] = [
      makeDomain({
        domain: "marketing",
        missingCapabilities: ["contentMarketing", "campaigns"],
      }),
    ]
    const targets = buildGuidedRecommendations(domains)
    const hrefs = targets.map((t) => t.href)
    assert.equal(new Set(hrefs).size, hrefs.length)
    assert.equal(targets.length, 1)
  })

  test("next move target picks from the weakest domain", () => {
    const domains: DomainState[] = [
      makeDomain({
        domain: "delivery",
        level: "intermediate",
        strength: 0.65,
        missingCapabilities: [],
      }),
      makeDomain({
        domain: "marketing",
        level: "none",
        strength: 0,
        missingCapabilities: ["contentMarketing"],
      }),
      makeDomain({
        domain: "finance",
        level: "basic",
        strength: 0.25,
        missingCapabilities: ["financeControl"],
      }),
    ]
    const next = resolveNextMoveTarget(domains)
    assert.ok(next)
    assert.equal(next.domain, "marketing")
    assert.equal(next.href, "/contenido")
  })

  test("empty gaps returns empty recommendations", () => {
    const domains: DomainState[] = [
      makeDomain({
        domain: "delivery",
        level: "advanced",
        strength: 0.9,
        missingCapabilities: [],
      }),
      makeDomain({
        domain: "communication",
        level: "intermediate",
        strength: 0.6,
        missingCapabilities: [],
      }),
    ]
    const targets = buildGuidedRecommendations(domains)
    assert.equal(targets.length, 0)
    const next = resolveNextMoveTarget(domains)
    assert.equal(next, null)
  })
})
