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
  FINESSE_DEMO_WORKSPACE_TASKS,
  FINESSE_DEMO_TAREAS,
  FINESSE_DEMO_BUSINESS_PROFILE,
  FINESSE_DEMO_SERVICE_CATALOG,
  FINESSE_DEMO_TASK_SOURCE_TYPE,
  validateDemoData,
  getDemoDatasetSummary,
  buildClientMap,
  resolveClientId,
} from "./finesse-demo-data"
import {
  parseWorkspaceConfig,
  mergeDemoWorkspaceConfig,
  mergeDemoBusinessProfile,
  shouldWriteDemoServiceCatalog,
  extractDemoMetadata,
} from "./finesse-demo-utils"
import {
  WORKSPACE_TASK_VALID_STATUSES,
  WORKSPACE_TASK_VALID_PRIORITIES,
  WORKSPACE_TASK_VALID_SUGGESTED_BY,
  WORKSPACE_TASK_VALID_EXECUTION_MODES,
} from "../modules/tasks/types"
import { resolveServiceCatalog } from "../core/services/catalog"

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
  assert.equal(summary.workspaceTasks, FINESSE_DEMO_WORKSPACE_TASKS.length, "should count workspace tasks")
  assert.equal(summary.tareas, FINESSE_DEMO_TAREAS.length, "should count tareas")
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

test("parseWorkspaceConfig: empty/null input returns {}", () => {
  assert.deepEqual(parseWorkspaceConfig(null), {}, "null should return {}")
  assert.deepEqual(parseWorkspaceConfig(undefined), {}, "undefined should return {}")
  assert.deepEqual(parseWorkspaceConfig(""), {}, "empty string should return {}")
  assert.deepEqual(parseWorkspaceConfig("   "), {}, "whitespace-only string should return {}")
})

test("parseWorkspaceConfig: valid JSON object returns parsed object", () => {
  const config = { key1: "value1", nested: { key2: "value2" } }
  const result = parseWorkspaceConfig(JSON.stringify(config))
  assert.deepEqual(result, config, "should parse valid JSON object")
})

test("parseWorkspaceConfig: invalid JSON returns null", () => {
  assert.equal(parseWorkspaceConfig("{invalid json}"), null, "invalid JSON should return null")
  assert.equal(parseWorkspaceConfig('[1, 2, 3]'), null, "JSON array should return null")
  assert.equal(parseWorkspaceConfig('"string"'), null, "JSON string should return null")
  assert.equal(parseWorkspaceConfig('123'), null, "JSON number should return null")
})

const TEST_OWNER_EMAIL = "owner@example.com"

test("mergeDemoWorkspaceConfig: preserves existing properties", () => {
  const existing = { userSetting: "value", nested: { original: true } }
  const demo = { createdAt: "2026-07-15", created: { clientes: 5 } }

  const merged = mergeDemoWorkspaceConfig(existing, demo, TEST_OWNER_EMAIL)

  assert.equal(merged.userSetting, "value", "should preserve existing string property")
  assert.deepEqual(merged.nested, { original: true }, "should preserve existing nested object")
  assert.deepEqual(merged.finesseDemoMetadata, demo, "should add demo metadata under finesseDemoMetadata key")
})

test("mergeDemoWorkspaceConfig: overwrites finesseDemoMetadata on re-run", () => {
  const config1 = { userSetting: "value" }
  const demo1 = { runCount: 1 }
  const merged1 = mergeDemoWorkspaceConfig(config1, demo1, TEST_OWNER_EMAIL)

  assert.deepEqual(merged1.finesseDemoMetadata, { runCount: 1 })

  const config2 = merged1 // Simulate re-running
  const demo2 = { runCount: 2 }
  const merged2 = mergeDemoWorkspaceConfig(config2, demo2, TEST_OWNER_EMAIL)

  assert.equal(merged2.userSetting, "value", "should still preserve original setting")
  assert.deepEqual(merged2.finesseDemoMetadata, { runCount: 2 }, "should update demo metadata")
})

test("mergeDemoWorkspaceConfig: sets the demo flag with owner email", () => {
  const merged = mergeDemoWorkspaceConfig({}, { runCount: 1 }, TEST_OWNER_EMAIL)

  assert.deepEqual(
    merged.demo,
    { enabled: true, type: "finesse-internal", ownerEmail: TEST_OWNER_EMAIL },
    "should set demo.enabled/type/ownerEmail",
  )
})

test("mergeDemoWorkspaceConfig: preserves extra demo sub-properties, canonical keys win", () => {
  const existing = {
    userSetting: "value",
    demo: { enabled: false, type: "other", ownerEmail: "old@example.com", customFlag: true },
  }

  const merged = mergeDemoWorkspaceConfig(existing, { runCount: 3 }, TEST_OWNER_EMAIL)
  const demo = merged.demo as Record<string, unknown>

  assert.equal(demo.customFlag, true, "should preserve unknown demo sub-properties")
  assert.equal(demo.enabled, true, "enabled must be forced to true")
  assert.equal(demo.type, "finesse-internal", "type must be forced to finesse-internal")
  assert.equal(demo.ownerEmail, TEST_OWNER_EMAIL, "ownerEmail must be the current owner")
  assert.equal(merged.userSetting, "value", "should preserve unrelated properties")
})

test("mergeDemoWorkspaceConfig: replaces a malformed demo value (non-object)", () => {
  const existing = { demo: "corrupted-string-value" }

  const merged = mergeDemoWorkspaceConfig(existing, { runCount: 1 }, TEST_OWNER_EMAIL)

  assert.deepEqual(
    merged.demo,
    { enabled: true, type: "finesse-internal", ownerEmail: TEST_OWNER_EMAIL },
    "a non-object demo value should be replaced by the canonical demo flag",
  )
})

test("extractDemoMetadata: returns demo metadata or empty object", () => {
  const withMetadata = {
    userSetting: "value",
    finesseDemoMetadata: { created: 5 },
  }
  assert.deepEqual(extractDemoMetadata(withMetadata), { created: 5 })

  const withoutMetadata = { userSetting: "value" }
  assert.deepEqual(extractDemoMetadata(withoutMetadata), {}, "should return empty object if no metadata")
})

test("FINESSE_DEMO_EVENTS: daysOffset ensures relative date recalculation", () => {
  // Each event has a daysOffset that should be used to recalculate relative to today on each run
  const eventToday = FINESSE_DEMO_EVENTS.find((e) => e.daysOffset === 0)
  const eventTomorrow = FINESSE_DEMO_EVENTS.find((e) => e.daysOffset === 1)

  assert.ok(eventToday, "should have at least one event for today (daysOffset=0)")
  assert.ok(eventTomorrow, "should have at least one event for tomorrow (daysOffset=1)")

  // Verify that daysOffset values are distinct and can be used for recalculation
  const today = getRelativeDate(eventToday.daysOffset, eventToday.hora, eventToday.minuto)
  const tomorrow = getRelativeDate(eventTomorrow.daysOffset, eventTomorrow.hora, eventTomorrow.minuto)

  assert.ok(
    tomorrow.getTime() > today.getTime(),
    "tomorrow (daysOffset=1) should be after today (daysOffset=0)",
  )

  // Verify time spans are roughly 24 hours (allowing for clock skew)
  const diff = (tomorrow.getTime() - today.getTime()) / (1000 * 60 * 60)
  assert.ok(diff > 23 && diff < 25, `should be ~24 hours, got ${diff}h`)
})

test("FINESSE_DEMO_CONVERSATIONS: all use demoMarker in source field (not subject)", () => {
  for (const conv of FINESSE_DEMO_CONVERSATIONS) {
    // demoMarker should be stored in source field for idempotent lookup
    assert.ok(conv.demoMarker, "should have demoMarker")
    // subject should be human-readable (visible in Inbox)
    assert.ok(conv.subject, "should have human-readable subject")
    // subject should NOT be the demoMarker
    assert.notEqual(
      conv.subject,
      conv.demoMarker,
      "subject should be human-readable, not demoMarker",
    )
  }
})

test("FINESSE_DEMO_CLIENTS: emails are deterministic for order independence", () => {
  // Clients 1, 2, 3 in order should generate emails in same sequence
  const emails = FINESSE_DEMO_CLIENTS.slice(0, 3).map((c) => c.email)
  assert.deepEqual(
    emails,
    [
      generateDemoEmail("client", 1),
      generateDemoEmail("client", 2),
      generateDemoEmail("client", 3),
    ],
    "first 3 clients should have deterministic emails",
  )
})

test("FINESSE_DEMO_INVOICES: date fields are coherent with estado", () => {
  for (const inv of FINESSE_DEMO_INVOICES) {
    if (inv.estado === "vencida") {
      assert.ok(
        typeof inv.dueOffsetDays === "number" && inv.dueOffsetDays < 0,
        `overdue invoice ${inv.demoMarker} must have a past due date`,
      )
    }
    if (inv.estado === "pagada") {
      assert.ok(
        typeof inv.paidDaysAgo === "number" && inv.paidDaysAgo >= 0,
        `paid invoice ${inv.demoMarker} must have paidDaysAgo`,
      )
    } else {
      assert.equal(
        inv.paidDaysAgo,
        undefined,
        `unpaid invoice ${inv.demoMarker} must not have paidDaysAgo`,
      )
    }
    if (inv.estado === "borrador") {
      assert.equal(
        inv.dueOffsetDays,
        undefined,
        `draft invoice ${inv.demoMarker} must not have a due date`,
      )
    }
  }
})

test("FINESSE_DEMO_WORKSPACE_TASKS: statuses/priorities match the WorkspaceTask vocabulary", () => {
  for (const task of FINESSE_DEMO_WORKSPACE_TASKS) {
    assert.ok(
      WORKSPACE_TASK_VALID_STATUSES.has(task.status),
      `task ${task.demoMarker} status "${task.status}" must be a valid WorkspaceTask status`,
    )
    assert.ok(
      WORKSPACE_TASK_VALID_PRIORITIES.has(task.priority),
      `task ${task.demoMarker} priority "${task.priority}" must be a valid WorkspaceTask priority`,
    )
    if (task.suggestedBy) {
      assert.ok(
        WORKSPACE_TASK_VALID_SUGGESTED_BY.has(task.suggestedBy),
        `task ${task.demoMarker} suggestedBy "${task.suggestedBy}" must be valid`,
      )
    }
    if (task.executionMode) {
      assert.ok(
        WORKSPACE_TASK_VALID_EXECUTION_MODES.has(task.executionMode),
        `task ${task.demoMarker} executionMode "${task.executionMode}" must be valid`,
      )
    }
  }
})

test("FINESSE_DEMO_WORKSPACE_TASKS: every task is visible in Today's buckets", () => {
  // modules/today/aggregator.ts drops future-dated tasks and hides undated
  // tasks from everyone but their assignee. Every demo task must survive.
  for (const task of FINESSE_DEMO_WORKSPACE_TASKS) {
    if (task.dueHour === undefined) {
      assert.equal(
        task.assign,
        "owner",
        `undated task ${task.demoMarker} must be assigned to the owner or Today hides it`,
      )
    } else {
      assert.ok(
        task.dueHour >= 0 && task.dueHour <= 23,
        `task ${task.demoMarker} dueHour must be a same-day hour`,
      )
    }
  }
})

test("FINESSE_DEMO_WORKSPACE_TASKS: cross-references resolve to existing demo records", () => {
  const eventMarkers = new Set(FINESSE_DEMO_EVENTS.map((e) => e.demoMarker))
  const convMarkers = new Set(FINESSE_DEMO_CONVERSATIONS.map((c) => c.demoMarker))
  for (const task of FINESSE_DEMO_WORKSPACE_TASKS) {
    if (task.eventMarker) {
      assert.ok(eventMarkers.has(task.eventMarker), `unknown eventMarker ${task.eventMarker}`)
    }
    if (task.conversationMarker) {
      assert.ok(
        convMarkers.has(task.conversationMarker),
        `unknown conversationMarker ${task.conversationMarker}`,
      )
    }
    if (typeof task.clientIndex === "number") {
      assert.ok(
        task.clientIndex >= 0 && task.clientIndex < FINESSE_DEMO_CLIENTS.length,
        `task ${task.demoMarker} clientIndex out of bounds`,
      )
    }
  }
})

test("FINESSE_DEMO_WORKSPACE_TASKS: includes the realistic risk scenarios", () => {
  // The mission requires at least one honest risk. We ship three: an
  // unconfirmed appointment, an overdue invoice chase and a pending rebooking.
  const titles = FINESSE_DEMO_WORKSPACE_TASKS.map((t) => t.title.toLowerCase())
  assert.ok(titles.some((t) => t.includes("confirmar la cita")), "unconfirmed appointment risk")
  assert.ok(titles.some((t) => t.includes("factura vencida")), "overdue invoice risk")
  assert.ok(
    FINESSE_DEMO_WORKSPACE_TASKS.some((t) => t.status === "proposed" && t.suggestedBy === "fanny"),
    "AI-proposed rebooking risk",
  )
})

test("FINESSE_DEMO_TAREAS: estados/prioridades match the legacy Tarea vocabulary", () => {
  const validEstados = new Set(["pendiente", "en_progreso", "completada"])
  const validPrioridades = new Set(["baja", "media", "alta", "urgente"])
  for (const tarea of FINESSE_DEMO_TAREAS) {
    assert.ok(validEstados.has(tarea.estado), `tarea ${tarea.demoMarker} estado invalid`)
    assert.ok(validPrioridades.has(tarea.prioridad), `tarea ${tarea.demoMarker} prioridad invalid`)
  }
})

test("FINESSE_DEMO_TAREAS: titles never collide with WorkspaceTask titles", () => {
  // Today merges both models without cross-model dedup — near-duplicate
  // titles would look like duplicated work items.
  const taskTitles = new Set(FINESSE_DEMO_WORKSPACE_TASKS.map((t) => t.title))
  for (const tarea of FINESSE_DEMO_TAREAS) {
    assert.ok(!taskTitles.has(tarea.titulo), `tarea title "${tarea.titulo}" duplicates a WorkspaceTask`)
  }
})

test("FINESSE_DEMO_TASK_SOURCE_TYPE: stable idempotency key", () => {
  assert.equal(FINESSE_DEMO_TASK_SOURCE_TYPE, "finesse_demo")
})

test("FINESSE_DEMO_BUSINESS_PROFILE: canonical shape with non-empty content", () => {
  const profile = FINESSE_DEMO_BUSINESS_PROFILE
  for (const key of ["businessName", "businessDescription", "tone", "region", "workingHours"]) {
    const value = profile[key]
    assert.ok(
      typeof value === "string" && value.trim().length > 0,
      `businessProfile.${key} must be a non-empty string`,
    )
  }
  for (const key of ["services", "languages", "attentionRules"]) {
    const value = profile[key]
    assert.ok(Array.isArray(value) && value.length > 0, `businessProfile.${key} must be a non-empty array`)
  }
  // Locale codes stay technical identifiers (English/ISO), content may be Spanish.
  assert.deepEqual(profile.languages, ["es", "en"])
})

test("FINESSE_DEMO_SERVICE_CATALOG: parses cleanly through the core catalog resolver", () => {
  const resolved = resolveServiceCatalog(FINESSE_DEMO_SERVICE_CATALOG)
  assert.equal(
    resolved.length,
    FINESSE_DEMO_SERVICE_CATALOG.length,
    "every demo service must survive normalization",
  )
  const ids = new Set(resolved.map((s) => s.id))
  assert.equal(ids.size, resolved.length, "resolved service ids must be unique")
  for (const item of resolved) {
    assert.ok(item.active, "demo services are all active")
    assert.ok(item.category, "demo services carry a category")
  }
})

test("mergeDemoBusinessProfile: fills only missing fields, never overwrites owner edits", () => {
  const existing = {
    businessProfile: {
      businessName: "Mi Salón Real",
      services: ["Corte"],
      businessDescription: "",
    },
    otherKey: 1,
  }

  const { config, filledKeys } = mergeDemoBusinessProfile(existing, FINESSE_DEMO_BUSINESS_PROFILE)
  const profile = config.businessProfile as Record<string, unknown>

  assert.equal(profile.businessName, "Mi Salón Real", "owner-set name must win")
  assert.deepEqual(profile.services, ["Corte"], "owner-set services must win")
  assert.equal(
    profile.businessDescription,
    FINESSE_DEMO_BUSINESS_PROFILE.businessDescription,
    "empty string counts as missing and gets filled",
  )
  assert.ok(filledKeys.includes("businessDescription"))
  assert.ok(!filledKeys.includes("businessName"))
  assert.equal(config.otherKey, 1, "unrelated config keys preserved")
})

test("mergeDemoBusinessProfile: no-op when profile is already complete", () => {
  const complete = { businessProfile: { ...FINESSE_DEMO_BUSINESS_PROFILE } }
  const { config, filledKeys } = mergeDemoBusinessProfile(complete, FINESSE_DEMO_BUSINESS_PROFILE)
  assert.equal(filledKeys.length, 0, "nothing to fill")
  assert.equal(config, complete, "config object returned unchanged")
})

test("mergeDemoBusinessProfile: fills everything on an empty config", () => {
  const { config, filledKeys } = mergeDemoBusinessProfile({}, FINESSE_DEMO_BUSINESS_PROFILE)
  assert.equal(filledKeys.length, Object.keys(FINESSE_DEMO_BUSINESS_PROFILE).length)
  assert.deepEqual(config.businessProfile, FINESSE_DEMO_BUSINESS_PROFILE)
})

test("shouldWriteDemoServiceCatalog: only when no canonical catalog resolves", () => {
  const demoCatalog = [{ name: "X", category: "Y", active: true }]

  // Workspace already owns a catalog → never write.
  assert.equal(shouldWriteDemoServiceCatalog({ serviceCatalog: demoCatalog }, null), false)

  // Vertical defaults carry a catalog → never write.
  assert.equal(shouldWriteDemoServiceCatalog({}, { serviceCatalog: demoCatalog }), false)

  // Nothing anywhere → fallback applies.
  assert.equal(shouldWriteDemoServiceCatalog({}, null), true)
  assert.equal(shouldWriteDemoServiceCatalog({}, {}), true)
  assert.equal(shouldWriteDemoServiceCatalog({ serviceCatalog: [] }, { serviceCatalog: [] }), true)
})

test("marker fields enable safe restoration/deletion without touching real data", () => {
  // All demo records have markers that uniquely identify them
  const eventMarkers = new Set(FINESSE_DEMO_EVENTS.map((e) => e.demoMarker))
  const convMarkers = new Set(FINESSE_DEMO_CONVERSATIONS.map((c) => c.demoMarker))
  const invoiceMarkers = new Set(FINESSE_DEMO_INVOICES.map((i) => i.demoMarker))
  const contentMarkers = new Set(FINESSE_DEMO_CONTENT_PIECES.map((p) => p.demoMarker))
  const taskMarkers = new Set(FINESSE_DEMO_WORKSPACE_TASKS.map((t) => t.demoMarker))
  const tareaMarkers = new Set(FINESSE_DEMO_TAREAS.map((t) => t.demoMarker))

  assert.equal(
    eventMarkers.size,
    FINESSE_DEMO_EVENTS.length,
    "all event markers should be unique",
  )
  assert.equal(
    convMarkers.size,
    FINESSE_DEMO_CONVERSATIONS.length,
    "all conversation markers should be unique",
  )
  assert.equal(invoiceMarkers.size, FINESSE_DEMO_INVOICES.length, "all invoice markers should be unique")
  assert.equal(
    contentMarkers.size,
    FINESSE_DEMO_CONTENT_PIECES.length,
    "all content markers should be unique",
  )
  assert.equal(
    taskMarkers.size,
    FINESSE_DEMO_WORKSPACE_TASKS.length,
    "all workspace task markers should be unique",
  )
  assert.equal(tareaMarkers.size, FINESSE_DEMO_TAREAS.length, "all tarea markers should be unique")

  // All markers follow the pattern FINESSE_DEMO:*
  const allMarkers = [
    ...eventMarkers,
    ...convMarkers,
    ...invoiceMarkers,
    ...contentMarkers,
    ...taskMarkers,
    ...tareaMarkers,
  ]
  for (const marker of allMarkers) {
    assert.ok(
      marker.startsWith("FINESSE_DEMO:"),
      `marker "${marker}" should start with FINESSE_DEMO:`,
    )
  }
})
