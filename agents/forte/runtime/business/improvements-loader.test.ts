process.env.DATABASE_URL ??= "file:./dev.db"

import { describe, it } from "node:test"
import assert from "node:assert/strict"

describe("resolveMaturity", () => {
  it("returns 'empty' when all domains are 'none'", async () => {
    const { resolveMaturity } = await import("./improvements-loader")
    const domains = [
      { domain: "communication" as const, level: "none" as const, strength: 0, supportingSignals: [], supportingModules: [], missingCapabilities: [] },
      { domain: "relationship" as const, level: "none" as const, strength: 0, supportingSignals: [], supportingModules: [], missingCapabilities: [] },
    ]
    assert.equal(resolveMaturity(domains), "empty")
  })

  it("returns 'emerging' when some domains are basic", async () => {
    const { resolveMaturity } = await import("./improvements-loader")
    const domains = [
      { domain: "communication" as const, level: "basic" as const, strength: 0.2, supportingSignals: ["smartInbox"], supportingModules: [], missingCapabilities: [] },
      { domain: "relationship" as const, level: "none" as const, strength: 0, supportingSignals: [], supportingModules: [], missingCapabilities: [] },
    ]
    assert.equal(resolveMaturity(domains), "emerging")
  })

  it("returns 'established' when at least one domain is intermediate+", async () => {
    const { resolveMaturity } = await import("./improvements-loader")
    const domains = [
      { domain: "delivery" as const, level: "intermediate" as const, strength: 0.5, supportingSignals: ["projectDelivery"], supportingModules: ["proyectos"], missingCapabilities: [] },
      { domain: "relationship" as const, level: "none" as const, strength: 0, supportingSignals: [], supportingModules: [], missingCapabilities: [] },
    ]
    assert.equal(resolveMaturity(domains), "established")
  })
})

describe("buildImprovementsViewModel", () => {
  it("returns safe defaults for empty workspace (no modules, no capabilities)", async () => {
    const { buildImprovementsViewModel } = await import("./improvements-loader")
    const caps = {
      modules: [],
      engines: [],
      registryTools: [],
      tools: [],
      capabilities: [],
      actions: { read: [], write: [], generate: [] },
    }
    const vm = buildImprovementsViewModel(caps as any)

    assert.equal(vm.maturity, "empty")
    assert.equal(vm.domains.length, 7)
    assert.ok(vm.domains.every((d) => d.level === "none"))
    // Even empty workspaces get a nextMove from domain fallback routing
    if (vm.nextMove) {
      assert.equal(vm.nextMove.source, "domain-fallback")
    }
  })

  it("produces finance domain signals from invoicing capability", async () => {
    const { buildImprovementsViewModel } = await import("./improvements-loader")
    const caps = {
      modules: [
        { id: "facturacion", name: "facturacion", description: "", version: "1.0.0", dependencies: [], provides: ["invoicing", "billing"], models: [], capabilities: { read: [], write: [] } },
      ],
      engines: [],
      registryTools: [],
      tools: [],
      capabilities: ["invoicing", "billing"],
      actions: { read: [], write: [], generate: [] },
    }
    const vm = buildImprovementsViewModel(caps as any)

    const finance = vm.domains.find((d) => d.domain === "finance")!
    assert.ok(finance)
    assert.notEqual(finance.level, "none")
    assert.ok(finance.supportingSignals.includes("invoicing"))
    assert.notEqual(vm.maturity, "empty")
  })

  it("produces expected domains from inbox + client + project signals", async () => {
    const { buildImprovementsViewModel } = await import("./improvements-loader")
    const caps = {
      modules: [
        { id: "inbox", name: "inbox", description: "", version: "1.0.0", dependencies: [], provides: ["inbox", "conversations"], models: [], capabilities: { read: [], write: [] } },
        { id: "clientes", name: "clientes", description: "", version: "1.0.0", dependencies: [], provides: ["crm", "relationships", "accounts"], models: [], capabilities: { read: [], write: [] } },
        { id: "proyectos", name: "proyectos", description: "", version: "1.0.0", dependencies: [], provides: ["projects", "delivery"], models: [], capabilities: { read: [], write: [] } },
        { id: "tareas", name: "tareas", description: "", version: "1.0.0", dependencies: [], provides: ["tasks", "priorities"], models: [], capabilities: { read: [], write: [] } },
      ],
      engines: [],
      registryTools: [],
      tools: [],
      capabilities: ["inbox", "conversations", "crm", "relationships", "accounts", "projects", "delivery", "tasks", "priorities"],
      actions: { read: [], write: [], generate: [] },
    }
    const vm = buildImprovementsViewModel(caps as any)

    const comm = vm.domains.find((d) => d.domain === "communication")!
    const rel = vm.domains.find((d) => d.domain === "relationship")!
    const del_ = vm.domains.find((d) => d.domain === "delivery")!

    assert.notEqual(comm.level, "none")
    assert.notEqual(rel.level, "none")
    assert.notEqual(del_.level, "none")
    assert.equal(vm.maturity, "established")
  })

  it("top priorities come from guided recommendation routing", async () => {
    const { buildImprovementsViewModel } = await import("./improvements-loader")
    const caps = {
      modules: [],
      engines: [],
      registryTools: [],
      tools: [],
      capabilities: [],
      actions: { read: [], write: [], generate: [] },
    }
    const vm = buildImprovementsViewModel(caps as any)

    assert.ok(Array.isArray(vm.recommendations))
    assert.ok(vm.recommendations.length <= 3)
    for (const r of vm.recommendations) {
      assert.ok(r.domain)
      assert.ok(r.label)
      assert.ok(r.href)
    }
  })

  it("nextMove is null when all capabilities are covered", async () => {
    const { buildImprovementsViewModel } = await import("./improvements-loader")
    const caps = {
      modules: [
        { id: "inbox", provides: ["inbox", "conversations", "lead-intelligence"], models: [], capabilities: { read: [], write: [] } },
        { id: "clientes", provides: ["crm", "relationships", "accounts"], models: [], capabilities: { read: [], write: [] } },
        { id: "proyectos", provides: ["projects", "delivery", "tasks", "priorities"], models: [], capabilities: { read: [], write: [] } },
        { id: "facturacion", provides: ["invoicing", "billing", "finance", "cashflow"], models: [], capabilities: { read: [], write: [] } },
        { id: "contenido", provides: ["content", "editorial", "ideas"], models: [], capabilities: { read: [], write: [] } },
        { id: "campanas", provides: ["campaigns", "marketing-plans", "growth"], models: [], capabilities: { read: [], write: [] } },
        { id: "automatizaciones", provides: ["ai.ask", "ai.chat", "document-analysis", "automations"], models: [], capabilities: { read: [], write: [] } },
      ],
      engines: [],
      registryTools: [],
      tools: [],
      capabilities: [
        "inbox", "conversations", "lead-intelligence",
        "crm", "relationships", "accounts",
        "projects", "delivery", "tasks", "priorities",
        "invoicing", "billing", "finance", "cashflow",
        "content", "editorial", "ideas",
        "campaigns", "marketing-plans", "growth",
        "ai.ask", "ai.chat", "document-analysis", "automations",
      ],
      actions: { read: [], write: [], generate: [] },
    }
    const vm = buildImprovementsViewModel(caps as any)

    assert.equal(vm.recommendations.length, 0)
    assert.equal(vm.nextMove, null)
  })
})
