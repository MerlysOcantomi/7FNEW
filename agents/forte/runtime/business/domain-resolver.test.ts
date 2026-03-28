import assert from "node:assert/strict"
import test from "node:test"

test("inbox + clientes => communication y relationship no son none", async () => {
  const { resolveSignals } = await import("./signals")
  const { resolveDomainStates } = await import("./domain-resolver")

  const signals = resolveSignals({ smartInbox: true, crm: true })
  const states = resolveDomainStates({
    signals,
    activeModules: [
      { id: "inbox", provides: ["inbox", "conversations", "lead-intelligence"] },
      { id: "clientes", provides: ["crm", "relationships", "accounts"] },
    ],
  })

  const communication = states.find((s) => s.domain === "communication")
  const relationship = states.find((s) => s.domain === "relationship")

  assert.ok(communication)
  assert.notEqual(communication.level, "none")
  assert.ok(communication.supportingSignals.includes("smartInbox"))

  assert.ok(relationship)
  assert.notEqual(relationship.level, "none")
  assert.ok(relationship.supportingModules.includes("clientes"))
})

test("facturacion sin finanzas => gap en finance", async () => {
  const { resolveSignals } = await import("./signals")
  const { resolveDomainStates, getDomainGaps } = await import("./domain-resolver")

  const signals = resolveSignals({ invoicing: true })
  const states = resolveDomainStates({
    signals,
    activeModules: [
      { id: "facturacion", provides: ["invoicing", "billing", "collections"] },
    ],
  })

  const finance = states.find((s) => s.domain === "finance")
  assert.ok(finance)
  assert.notEqual(finance.level, "none")
  assert.ok(finance.missingCapabilities.includes("finance"))
  assert.ok(finance.missingCapabilities.includes("cashflow"))

  const gaps = getDomainGaps(states)
  assert.ok(gaps.some((g) => g.domain === "finance"))
})

test("campaigns implica contentMarketing via inferencia", async () => {
  const { resolveSignals } = await import("./signals")
  const { resolveDomainStates } = await import("./domain-resolver")

  const signals = resolveSignals({ campaigns: true })

  assert.equal(signals.contentMarketing, true, "inferencia: campaigns => contentMarketing")

  const states = resolveDomainStates({
    signals,
    activeModules: [
      { id: "campanas", provides: ["campaigns", "marketing-plans", "growth"] },
      { id: "contenido", provides: ["content", "editorial", "ideas"] },
    ],
  })

  const content = states.find((s) => s.domain === "content")
  assert.ok(content)
  assert.notEqual(content.level, "none")

  const marketing = states.find((s) => s.domain === "marketing")
  assert.ok(marketing)
  assert.notEqual(marketing.level, "none")
})

test("documentAnalysis => intelligence domain activo", async () => {
  const { resolveSignals } = await import("./signals")
  const { resolveDomainStates } = await import("./domain-resolver")

  const signals = resolveSignals({ documentAnalysis: true })

  assert.equal(signals.documents, true, "inferencia: documentAnalysis => documents")
  assert.equal(signals.aiAssistance, true, "inferencia: documentAnalysis => aiAssistance")

  const states = resolveDomainStates({
    signals,
    activeModules: [
      { id: "documentos", provides: ["documents", "files", "recordkeeping"] },
    ],
  })

  const intelligence = states.find((s) => s.domain === "intelligence")
  assert.ok(intelligence)
  assert.notEqual(intelligence.level, "none")
  assert.ok(intelligence.supportingSignals.includes("documentAnalysis"))
})

test("sin signals ni modulos => todos los dominios en none", async () => {
  const { resolveSignals } = await import("./signals")
  const { resolveDomainStates, getActiveDomains } = await import("./domain-resolver")

  const signals = resolveSignals({})
  const states = resolveDomainStates({ signals, activeModules: [] })

  const active = getActiveDomains(states)
  assert.equal(active.length, 0)
  assert.ok(states.every((s) => s.level === "none"))
})

test("senales sin modulos genera nota de gap", async () => {
  const { resolveSignals } = await import("./signals")
  const { resolveDomainStates } = await import("./domain-resolver")

  const signals = resolveSignals({ crm: true, smartInbox: true })
  const states = resolveDomainStates({ signals, activeModules: [] })

  const relationship = states.find((s) => s.domain === "relationship")
  assert.ok(relationship)
  assert.ok(relationship.notes && relationship.notes.length > 0)
  assert.ok(relationship.notes!.some((n) => n.includes("no hay modulos activos")))
})
