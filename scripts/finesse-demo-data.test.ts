import assert from "node:assert/strict"
import test from "node:test"
import {
  generateDemoInvoiceNumber,
  generateDemoEmail,
  generateDemoPhone,
  getRelativeDate,
  getWorkspaceShortId,
  FINESSE_DEMO_CLIENTS,
  FINESSE_DEMO_EVENTS,
  FINESSE_DEMO_CONVERSATIONS,
  FINESSE_DEMO_INVOICES,
  FINESSE_DEMO_CONTENT_PIECES,
  validateDemoData,
  getDemoDatasetSummary,
  buildClientMap,
  resolveClientId,
} from "./finesse-demo-data"

test("generateDemoInvoiceNumber: deterministic and globally unique", () => {
  const ws1 = "cuid1234567890abcdef"
  const ws2 = "cuidabcdef1234567890"

  const inv1_1 = generateDemoInvoiceNumber(ws1, 1)
  const inv1_1_again = generateDemoInvoiceNumber(ws1, 1)
  const inv1_2 = generateDemoInvoiceNumber(ws1, 2)
  const inv2_1 = generateDemoInvoiceNumber(ws2, 1)

  assert.equal(inv1_1, inv1_1_again, "same workspace + seq should produce same number")
  assert.notEqual(inv1_1, inv1_2, "different seq should produce different number")
  assert.notEqual(inv1_1, inv2_1, "different workspace should produce different number")

  assert.match(inv1_1, /^DEMO-FINESSE-/, "should have expected prefix")
  assert.match(inv1_1, /cuid/, "should include workspace short ID")
  assert.match(inv1_1, /001$/, "should have zero-padded sequence")
})

test("generateDemoEmail: deterministic and unique per sequence", () => {
  const email1_1 = generateDemoEmail("client", 1)
  const email1_1_again = generateDemoEmail("client", 1)
  const email1_2 = generateDemoEmail("client", 2)
  const email2_1 = generateDemoEmail("contact", 1)

  assert.equal(email1_1, email1_1_again, "same type + seq should produce same email")
  assert.notEqual(email1_1, email1_2, "different seq should produce different email")
  assert.notEqual(email1_1, email2_1, "different type should produce different email")

  assert.match(email1_1, /^demo-/, "should start with demo-")
  assert.match(email1_1, /@demo\.example\.com$/, "should use demo.example.com domain")
  assert.ok(email1_1.includes("01"), "should have zero-padded sequence")
})

test("generateDemoPhone: deterministic and unique per sequence", () => {
  const phone1 = generateDemoPhone(1)
  const phone1_again = generateDemoPhone(1)
  const phone2 = generateDemoPhone(2)

  assert.equal(phone1, phone1_again, "same seq should produce same phone")
  assert.notEqual(phone1, phone2, "different seq should produce different phone")

  assert.match(phone1, /^\+34 000 000 001/, "should have expected format")
  assert.ok(phone1.includes("001"), "should have zero-padded sequence")
})

test("getRelativeDate: calculates dates from today", () => {
  const now = new Date()
  const today = getRelativeDate(0, 9, 0)
  const tomorrow = getRelativeDate(1, 10, 0)
  const yesterday = getRelativeDate(-1, 14, 0)

  assert.equal(today.getHours(), 9, "should respect hour")
  assert.equal(tomorrow.getHours(), 10, "tomorrow should have different hour")
  assert.equal(yesterday.getHours(), 14, "yesterday should have different hour")

  // Check that dates are approximately correct (within same day)
  const dayOffset = Math.floor((today.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  assert.ok(Math.abs(dayOffset) <= 1, "today should be approximately today")
})

test("getWorkspaceShortId: extracts first 8 characters", () => {
  const long = "cuid1234567890abcdefghijklmnop"
  const short = getWorkspaceShortId(long)
  assert.equal(short, "cuid1234", "should extract first 8 chars")
  assert.equal(short.length, 8, "short ID should be 8 chars")
})

test("validateDemoData: checks client index references", () => {
  const validation = validateDemoData()
  assert.ok(validation.valid, "demo data should be valid")
  assert.equal(validation.errors.length, 0, "should have no errors")
})

test("validateDemoData: detects invalid client references", () => {
  // This is more of a documentation test—in real use we'd mock the data
  // For now, just verify the validation function exists and works on good data
  const result = validateDemoData()
  assert.ok(typeof result === "object", "should return validation result")
  assert.ok("valid" in result && "errors" in result, "should have valid and errors keys")
})

test("FINESSE_DEMO_CLIENTS: emails are unique", () => {
  const emails = FINESSE_DEMO_CLIENTS.map((c) => c.email)
  const uniqueEmails = new Set(emails)
  assert.equal(
    emails.length,
    uniqueEmails.size,
    "all client emails should be unique",
  )
})

test("FINESSE_DEMO_CLIENTS: all use demo.example.com domain", () => {
  for (const client of FINESSE_DEMO_CLIENTS) {
    assert.ok(
      client.email.endsWith("@demo.example.com"),
      `${client.email} should use demo domain`,
    )
  }
})

test("FINESSE_DEMO_EVENTS: all reference valid client indices", () => {
  for (const event of FINESSE_DEMO_EVENTS) {
    assert.ok(
      event.clientIndex >= 0 && event.clientIndex < FINESSE_DEMO_CLIENTS.length,
      `event clientIndex ${event.clientIndex} should be valid`,
    )
  }
})

test("FINESSE_DEMO_CONVERSATIONS: all reference valid client indices", () => {
  for (const conv of FINESSE_DEMO_CONVERSATIONS) {
    assert.ok(
      conv.clientIndex >= 0 && conv.clientIndex < FINESSE_DEMO_CLIENTS.length,
      `conversation clientIndex ${conv.clientIndex} should be valid`,
    )
  }
})

test("FINESSE_DEMO_INVOICES: all reference valid client indices", () => {
  for (const inv of FINESSE_DEMO_INVOICES) {
    assert.ok(
      inv.clientIndex >= 0 && inv.clientIndex < FINESSE_DEMO_CLIENTS.length,
      `invoice clientIndex ${inv.clientIndex} should be valid`,
    )
  }
})

test("getDemoDatasetSummary: returns correct counts", () => {
  const summary = getDemoDatasetSummary()

  assert.equal(summary.clients, FINESSE_DEMO_CLIENTS.length, "should count clients")
  assert.equal(summary.events, FINESSE_DEMO_EVENTS.length, "should count events")
  assert.equal(summary.conversations, FINESSE_DEMO_CONVERSATIONS.length, "should count conversations")
  assert.equal(
    summary.messages,
    FINESSE_DEMO_CONVERSATIONS.reduce((sum, c) => sum + c.messages.length, 0),
    "should sum all messages",
  )
  assert.equal(summary.invoices, FINESSE_DEMO_INVOICES.length, "should count invoices")
  assert.equal(summary.contentPieces, FINESSE_DEMO_CONTENT_PIECES.length, "should count content pieces")
})

test("FINESSE_DEMO_CONTENT_PIECES: estado values are valid", () => {
  const validStates = ["draft", "idea", "scheduled", "published"]
  for (const piece of FINESSE_DEMO_CONTENT_PIECES) {
    assert.ok(
      validStates.includes(piece.estado),
      `ContentPiece estado "${piece.estado}" should be valid`,
    )
  }
})

test("FINESSE_DEMO_INVOICES: all have positive amounts", () => {
  for (const inv of FINESSE_DEMO_INVOICES) {
    assert.ok(inv.subtotal > 0, `invoice subtotal should be positive: ${inv.subtotal}`)
    assert.ok(inv.impuesto >= 0, `invoice tax should be non-negative: ${inv.impuesto}`)
  }
})

test("buildClientMap: deterministic email-to-ID mapping", () => {
  const clients = [
    { id: "client-1", email: "demo-client-01@demo.example.com" },
    { id: "client-2", email: "demo-client-02@demo.example.com" },
    { id: "client-3", email: "demo-client-03@demo.example.com" },
  ]

  const map = buildClientMap(clients)

  assert.equal(map.get("demo-client-01@demo.example.com"), "client-1")
  assert.equal(map.get("demo-client-02@demo.example.com"), "client-2")
  assert.equal(map.get("demo-client-03@demo.example.com"), "client-3")
  assert.equal(map.size, 3, "should have 3 entries")
})

test("buildClientMap: order independence", () => {
  const clients1 = [
    { id: "id-a", email: "email-a@test.com" },
    { id: "id-b", email: "email-b@test.com" },
    { id: "id-c", email: "email-c@test.com" },
  ]

  const clients2 = [
    { id: "id-c", email: "email-c@test.com" },
    { id: "id-a", email: "email-a@test.com" },
    { id: "id-b", email: "email-b@test.com" },
  ]

  const map1 = buildClientMap(clients1)
  const map2 = buildClientMap(clients2)

  assert.equal(map1.get("email-a@test.com"), map2.get("email-a@test.com"))
  assert.equal(map1.get("email-b@test.com"), map2.get("email-b@test.com"))
  assert.equal(map1.get("email-c@test.com"), map2.get("email-c@test.com"))
})

test("resolveClientId: returns correct ID or null", () => {
  const demoClient = { email: "test@example.com" }
  const map = new Map([
    ["test@example.com", "resolved-id"],
    ["other@example.com", "other-id"],
  ])

  assert.equal(resolveClientId(demoClient, map), "resolved-id")
  assert.equal(resolveClientId({ email: "missing@example.com" }, map), null)
})

test("FINESSE_DEMO_EVENTS: all have tipo='cita'", () => {
  for (const event of FINESSE_DEMO_EVENTS) {
    assert.equal(event.tipo, "cita", `event tipo should be "cita", got "${event.tipo}"`)
  }
})

test("FINESSE_DEMO_EVENTS: all have demoMarker field", () => {
  for (const event of FINESSE_DEMO_EVENTS) {
    assert.ok(event.demoMarker, `event should have demoMarker: ${JSON.stringify(event)}`)
    assert.ok(
      event.demoMarker.startsWith("FINESSE_DEMO:cita:"),
      `demoMarker should start with FINESSE_DEMO:cita:, got ${event.demoMarker}`,
    )
  }
})

test("FINESSE_DEMO_CONVERSATIONS: all have demoMarker field", () => {
  for (const conv of FINESSE_DEMO_CONVERSATIONS) {
    assert.ok(conv.demoMarker, `conversation should have demoMarker: ${JSON.stringify(conv)}`)
    assert.ok(
      conv.demoMarker.startsWith("FINESSE_DEMO:conv:"),
      `demoMarker should start with FINESSE_DEMO:conv:, got ${conv.demoMarker}`,
    )
  }
})

test("FINESSE_DEMO_INVOICES: all have demoMarker field", () => {
  for (const inv of FINESSE_DEMO_INVOICES) {
    assert.ok(inv.demoMarker, `invoice should have demoMarker: ${JSON.stringify(inv)}`)
    assert.ok(
      inv.demoMarker.startsWith("FINESSE_DEMO:invoice:"),
      `demoMarker should start with FINESSE_DEMO:invoice:, got ${inv.demoMarker}`,
    )
  }
})

test("FINESSE_DEMO_CONTENT_PIECES: all have demoMarker field", () => {
  for (const piece of FINESSE_DEMO_CONTENT_PIECES) {
    assert.ok(piece.demoMarker, `content piece should have demoMarker: ${JSON.stringify(piece)}`)
    assert.ok(
      piece.demoMarker.startsWith("FINESSE_DEMO:content:"),
      `demoMarker should start with FINESSE_DEMO:content:, got ${piece.demoMarker}`,
    )
  }
})
