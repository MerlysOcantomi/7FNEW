import assert from "node:assert/strict"
import test from "node:test"
import {
  buildChannelFilterDefinitions,
  channelFilterId,
  compiledFilterToSearchParams,
  compileInboxFilterRule,
  CORE_INBOX_FILTERS,
  getCoreInboxFilter,
  LEGACY_INBOX_FILTER_ALIASES,
  parseChannelFilterId,
  resolveInboxFilterFromUrl,
} from "./filter-registry"
import { resolveInboxChannelsConfig, resolveInboxChannelViews } from "./channel-config"

// ─── Registry integrity ──────────────────────────────────────────────────────

test("core filter ids are unique", () => {
  const ids = CORE_INBOX_FILTERS.map((def) => def.id)
  assert.equal(new Set(ids).size, ids.length)
})

test("channel filter ids never collide with core ids", () => {
  const channelViews = resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
  const channelDefs = buildChannelFilterDefinitions(channelViews)
  const all = [...CORE_INBOX_FILTERS, ...channelDefs].map((def) => def.id)
  assert.equal(new Set(all).size, all.length)
})

test("every ACTIVE core filter compiles; planned ones need not", () => {
  for (const def of CORE_INBOX_FILTERS) {
    if (def.availability === "active") {
      assert.notEqual(compileInboxFilterRule(def.queryRule), null, def.id)
    }
  }
})

// ─── Core defaults preserve the legacy mapSidebarFilter contract ────────────

test("core filters compile to the exact legacy mapSidebarFilter queries", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["needs_action", { status: "new,assigned,triaged,lead_detected" }],
    ["waiting", { status: "awaiting_response" }],
    ["done", { status: "resolved,closed,converted" }],
    ["opportunities", { status: "lead_detected" }],
    ["closed", { status: "closed" }],
    ["archived", { status: "archived" }],
    ["trash", { status: "trashed" }],
    ["urgent", { urgency: "alta,critica" }],
    ["all", {}],
  ]
  for (const [id, expected] of cases) {
    const def = getCoreInboxFilter(id)
    assert.ok(def, id)
    const compiled = compileInboxFilterRule(def.queryRule)
    assert.ok(compiled, id)
    assert.deepEqual(compiledFilterToSearchParams(compiled), expected, id)
  }
})

test("legacy aliases keep their historical queries", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["new", { status: "new" }],
    ["in_progress", { status: "assigned,awaiting_response,triaged" }],
    ["needs_reply", { status: "awaiting_response" }],
    ["leads", { status: "lead_detected" }],
    ["todo", {}],
    ["scheduled", {}],
  ]
  for (const [alias, expected] of cases) {
    const legacy = LEGACY_INBOX_FILTER_ALIASES[alias]
    assert.ok(legacy, alias)
    const compiled = compileInboxFilterRule(legacy.rule)
    assert.ok(compiled, alias)
    assert.deepEqual(compiledFilterToSearchParams(compiled), expected, alias)
  }
})

// ─── Rule compilation ───────────────────────────────────────────────────────

test("assignment and unanswered rules compile to real params", () => {
  assert.deepEqual(
    compiledFilterToSearchParams(compileInboxFilterRule({ type: "assignment", value: "unassigned" })!),
    { assignedTo: "unassigned" },
  )
  assert.deepEqual(
    compiledFilterToSearchParams(compileInboxFilterRule({ type: "unanswered" })!),
    { unanswered: "1" },
  )
  assert.deepEqual(
    compiledFilterToSearchParams(compileInboxFilterRule({ type: "unanswered", minAgeMinutes: 30 })!),
    { unanswered: "1", unansweredMinAgeMinutes: "30" },
  )
})

test("channel rules compile only for a single known channel", () => {
  assert.deepEqual(compileInboxFilterRule({ type: "channel", values: ["whatsapp"] }), {
    channel: ["whatsapp"],
  })
  // Multi-channel is not supported by the list endpoint yet.
  assert.equal(compileInboxFilterRule({ type: "channel", values: ["whatsapp", "email"] }), null)
  assert.equal(compileInboxFilterRule({ type: "channel", values: [] }), null)
})

test("intent rules do not compile (no server vocabulary support yet)", () => {
  assert.equal(compileInboxFilterRule({ type: "intent", values: ["booking_request"] }), null)
})

test("empty value lists are invalid, never match-everything", () => {
  assert.equal(compileInboxFilterRule({ type: "status", values: [] }), null)
  assert.equal(compileInboxFilterRule({ type: "urgency", values: [] }), null)
})

test("compound AND merges dimensions and rejects contradictions", () => {
  const compiled = compileInboxFilterRule({
    type: "compound",
    operator: "and",
    rules: [
      { type: "status", values: ["new", "triaged"] },
      { type: "channel", values: ["whatsapp"] },
    ],
  })
  assert.deepEqual(compiled, { status: ["new", "triaged"], channel: ["whatsapp"] })
  // Same-dimension AND intersects; empty intersection is contradictory.
  const contradiction = compileInboxFilterRule({
    type: "compound",
    operator: "and",
    rules: [
      { type: "status", values: ["new"] },
      { type: "status", values: ["closed"] },
    ],
  })
  assert.equal(contradiction, null)
  // A compound containing an uncompilable sub-rule is itself invalid.
  assert.equal(
    compileInboxFilterRule({
      type: "compound",
      operator: "and",
      rules: [{ type: "status", values: ["new"] }, { type: "intent", values: ["x"] }],
    }),
    null,
  )
})

// ─── Channel-derived filters ────────────────────────────────────────────────

test("channel filters derive from effective channel views with honest availability", () => {
  const beautyChannels = {
    enabled: ["whatsapp", "instagram", "email"],
    order: ["whatsapp", "instagram", "email"],
  }
  const views = resolveInboxChannelViews({
    config: resolveInboxChannelsConfig(beautyChannels),
  })
  const defs = buildChannelFilterDefinitions(views)
  assert.deepEqual(
    defs.map((d) => d.id),
    ["channel:whatsapp", "channel:instagram", "channel:email"],
  )
  const instagram = defs.find((d) => d.id === "channel:instagram")
  assert.equal(instagram?.availability, "planned")
  const whatsapp = defs.find((d) => d.id === "channel:whatsapp")
  assert.equal(whatsapp?.availability, "active")
})

test("channelFilterId round-trips through parseChannelFilterId", () => {
  assert.equal(parseChannelFilterId(channelFilterId("email")), "email")
  assert.equal(parseChannelFilterId("channel:web"), "web_chat")
  assert.equal(parseChannelFilterId("channel:nope"), null)
  assert.equal(parseChannelFilterId("email"), null)
})

// ─── URL resolution (registry-level) ────────────────────────────────────────

test("unknown or planned URL filters fall back to the default view", () => {
  assert.deepEqual(resolveInboxFilterFromUrl("no-such-filter"), {
    id: "all",
    rule: { type: "all" },
    isFallback: true,
  })
  // `scheduled` is a planned core filter — resolved as fallback, never a query.
  const scheduled = resolveInboxFilterFromUrl("scheduled")
  assert.equal(scheduled.id, "all")
  assert.deepEqual(scheduled.rule, { type: "all" })
})

test("null/inbox/all resolve to the default unfiltered view", () => {
  for (const raw of [null, undefined, "inbox", "all"]) {
    const resolved = resolveInboxFilterFromUrl(raw)
    assert.equal(resolved.id, "all")
    assert.equal(resolved.isFallback, false)
  }
})
