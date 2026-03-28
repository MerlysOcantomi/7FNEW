import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildSettingsHandoffUrl,
  parseSettingsHandoff,
  resolveSettingsItemId,
} from "./settings-handoff"

describe("buildSettingsHandoffUrl", () => {
  it("builds URL with all params", () => {
    const url = buildSettingsHandoffUrl({
      domain: "finance",
      capabilityId: "financeControl",
      reason: "gap",
    })
    assert.ok(url.startsWith("/administracion?"))
    assert.ok(url.includes("from=forte"))
    assert.ok(url.includes("domain=finance"))
    assert.ok(url.includes("capability=financeControl"))
    assert.ok(url.includes("section=finanzas"))
    assert.ok(url.includes("reason=gap"))
  })

  it("builds URL with only reason", () => {
    const url = buildSettingsHandoffUrl({ reason: "empty-workspace" })
    assert.ok(url.includes("from=forte"))
    assert.ok(url.includes("reason=empty-workspace"))
    assert.ok(!url.includes("domain="))
    assert.ok(!url.includes("capability="))
    assert.ok(!url.includes("section="))
  })
})

describe("parseSettingsHandoff", () => {
  it("returns null for non-Forte URLs", () => {
    const result = parseSettingsHandoff({})
    assert.equal(result, null)
  })

  it("returns null when from is not forte", () => {
    const result = parseSettingsHandoff({ from: "other" })
    assert.equal(result, null)
  })

  it("correctly parses valid Forte params", () => {
    const result = parseSettingsHandoff({
      from: "forte",
      domain: "relationship",
      capability: "crm",
      section: "clientes",
      reason: "gap",
    })
    assert.ok(result)
    assert.equal(result.source, "forte")
    assert.equal(result.domain, "relationship")
    assert.equal(result.capabilityId, "crm")
    assert.equal(result.settingsItemId, "clientes")
    assert.equal(result.reason, "gap")
  })

  it("handles minimal Forte params", () => {
    const result = parseSettingsHandoff({ from: "forte" })
    assert.ok(result)
    assert.equal(result.source, "forte")
    assert.equal(result.domain, undefined)
    assert.equal(result.capabilityId, undefined)
    assert.equal(result.settingsItemId, undefined)
  })
})

describe("resolveSettingsItemId", () => {
  it("maps known capabilities to settings items", () => {
    assert.equal(resolveSettingsItemId("crm"), "clientes")
    assert.equal(resolveSettingsItemId("financeControl"), "finanzas")
    assert.equal(resolveSettingsItemId("invoicing"), "facturacion")
    assert.equal(resolveSettingsItemId("contentMarketing"), "campanas")
    assert.equal(resolveSettingsItemId("campaigns"), "campanas")
    assert.equal(resolveSettingsItemId("smartInbox"), "inbox")
    assert.equal(resolveSettingsItemId("documentAnalysis"), "motor")
  })

  it("returns undefined for unknown capabilities", () => {
    assert.equal(resolveSettingsItemId("unknown_cap"), undefined)
    assert.equal(resolveSettingsItemId(""), undefined)
  })
})
