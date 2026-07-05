/**
 * Unit tests for the pure Inbox list-derivation layer (`list-derivation.ts`).
 *
 * These functions were extracted verbatim from the inline `useMemo` bodies of
 * `app/inbox/page.tsx` (PR-2 of the inbox decomposition). The page now calls
 * them through thin `useMemo` wrappers, so locking their behavior here is what
 * guarantees the "zero behavior change" contract of the refactor.
 *
 * Scope note: only the genuinely CLIENT-SIDE derivation surface is covered.
 * Search (`q`), status, urgency, channel, assignment, and category are applied
 * SERVER-SIDE via the `/api/inbox/conversations` query string — they are not
 * functions in this module and are intentionally NOT tested here.
 *
 * Test runner: Node's built-in `node:test`, executed via `tsx --test`
 * (matches `modules/inbox/auto-task-policy.test.ts`). Run narrowly with:
 *
 *   npm run test:inbox-derivation
 *
 * or directly:
 *
 *   npx tsx --test modules/inbox/list-derivation.test.ts
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  mapSidebarFilter,
  resolvePrimaryWorkFilter,
  selectSidebarConversations,
  selectListConversations,
  applyIntentStatusFilter,
  computeTerminalRescueActive,
  buildStatusFilterOptions,
  buildStatusEditOptions,
  STATUS_OPTIONS,
} from "./list-derivation"

/* ── helpers ─────────────────────────────────────────────────────────────── */

type Row = { id: string; status: string }
const row = (id: string, status: string): Row => ({ id, status })

/* ── mapSidebarFilter ────────────────────────────────────────────────────── */

test("mapSidebarFilter: storage buckets map to their status", () => {
  assert.deepEqual(mapSidebarFilter("archived"), { status: "archived" })
  assert.deepEqual(mapSidebarFilter("closed"), { status: "closed" })
  assert.deepEqual(mapSidebarFilter("trash"), { status: "trashed" })
})

test("mapSidebarFilter: work buckets map to composite status sets", () => {
  assert.deepEqual(mapSidebarFilter("needs_action"), {
    status: "new,assigned,triaged,lead_detected",
  })
  assert.deepEqual(mapSidebarFilter("waiting"), { status: "awaiting_response" })
  assert.deepEqual(mapSidebarFilter("done"), { status: "resolved,closed,converted" })
})

test("mapSidebarFilter: smart views", () => {
  assert.deepEqual(mapSidebarFilter("opportunities"), { status: "lead_detected" })
})

test("mapSidebarFilter: placeholders and unknown/null fall through to {}", () => {
  assert.deepEqual(mapSidebarFilter("todo"), {})
  assert.deepEqual(mapSidebarFilter("scheduled"), {})
  assert.deepEqual(mapSidebarFilter("inbox"), {})
  assert.deepEqual(mapSidebarFilter("something-unknown"), {})
  assert.deepEqual(mapSidebarFilter(null), {})
})

test("mapSidebarFilter: legacy aliases preserved for old bookmarks", () => {
  assert.deepEqual(mapSidebarFilter("new"), { status: "new" })
  assert.deepEqual(mapSidebarFilter("in_progress"), {
    status: "assigned,awaiting_response,triaged",
  })
  assert.deepEqual(mapSidebarFilter("urgent"), { urgency: "alta,critica" })
  assert.deepEqual(mapSidebarFilter("needs_reply"), { status: "awaiting_response" })
  assert.deepEqual(mapSidebarFilter("leads"), { status: "lead_detected" })
})

/* ── resolvePrimaryWorkFilter ────────────────────────────────────────────── */

test("resolvePrimaryWorkFilter: inbox/null/empty resolve to 'all'", () => {
  assert.equal(resolvePrimaryWorkFilter(null), "all")
  assert.equal(resolvePrimaryWorkFilter(""), "all")
  assert.equal(resolvePrimaryWorkFilter("inbox"), "all")
})

test("resolvePrimaryWorkFilter: the three work chips resolve to themselves", () => {
  assert.equal(resolvePrimaryWorkFilter("needs_action"), "needs_action")
  assert.equal(resolvePrimaryWorkFilter("waiting"), "waiting")
  assert.equal(resolvePrimaryWorkFilter("done"), "done")
})

test("resolvePrimaryWorkFilter: anything else resolves to 'other' (no chip highlighted)", () => {
  assert.equal(resolvePrimaryWorkFilter("archived"), "other")
  assert.equal(resolvePrimaryWorkFilter("trash"), "other")
  assert.equal(resolvePrimaryWorkFilter("opportunities"), "other")
  assert.equal(resolvePrimaryWorkFilter("scheduled"), "other")
})

/* ── selectSidebarConversations (the "All" terminal-status strip) ─────────── */

test("selectSidebarConversations: non-'all' status trusts the server result verbatim", () => {
  const rows = [row("a", "archived"), row("b", "new")]
  const out = selectSidebarConversations(rows, "archived", undefined)
  assert.deepEqual(out.map((r) => r.id), ["a", "b"])
})

test("selectSidebarConversations: explicit sidebar status trusts the server result verbatim", () => {
  const rows = [row("a", "trashed"), row("b", "new")]
  // status === "all" but the sidebar pushed an explicit status to the backend
  const out = selectSidebarConversations(rows, "all", "trashed")
  assert.deepEqual(out.map((r) => r.id), ["a", "b"])
})

test("selectSidebarConversations: 'all' with no explicit status strips terminal rows", () => {
  const rows = [
    row("a", "new"),
    row("b", "archived"),
    row("c", "closed"),
    row("d", "trashed"),
    row("e", "assigned"),
  ]
  const out = selectSidebarConversations(rows, "all", undefined)
  assert.deepEqual(out.map((r) => r.id), ["a", "e"])
})

test("selectSidebarConversations: rescue — if the strip empties a non-empty list, show everything", () => {
  const rows = [row("a", "archived"), row("b", "closed"), row("c", "trashed")]
  const out = selectSidebarConversations(rows, "all", undefined)
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c"])
})

test("selectSidebarConversations: empty input stays empty (no rescue)", () => {
  assert.deepEqual(selectSidebarConversations([], "all", undefined), [])
})

/* ── selectListConversations (degradation fallback) ──────────────────────── */

test("selectListConversations: empty source yields empty", () => {
  assert.deepEqual(selectListConversations([], []), [])
})

test("selectListConversations: uses the sidebar list when it has rows", () => {
  const conversations = [row("a", "new"), row("b", "archived")]
  const sidebar = [row("a", "new")]
  const out = selectListConversations(conversations, sidebar)
  assert.deepEqual(out.map((r) => r.id), ["a"])
})

test("selectListConversations: degrades to the full list when the sidebar list is empty but data exists", () => {
  const conversations = [row("a", "archived"), row("b", "closed")]
  const out = selectListConversations(conversations, [])
  assert.deepEqual(out.map((r) => r.id), ["a", "b"])
})

/* ── computeTerminalRescueActive (the banner predicate) ──────────────────── */

test("computeTerminalRescueActive: false unless status is 'all'", () => {
  const rows = [row("a", "archived")]
  assert.equal(computeTerminalRescueActive(rows, "archived"), false)
})

test("computeTerminalRescueActive: false on an empty list", () => {
  assert.equal(computeTerminalRescueActive([], "all"), false)
})

test("computeTerminalRescueActive: true when every row is archived/closed/trashed under 'all'", () => {
  const rows = [row("a", "archived"), row("b", "closed"), row("c", "trashed")]
  assert.equal(computeTerminalRescueActive(rows, "all"), true)
})

test("computeTerminalRescueActive: false when at least one active row survives", () => {
  const rows = [row("a", "archived"), row("b", "new")]
  assert.equal(computeTerminalRescueActive(rows, "all"), false)
})

/* ── applyIntentStatusFilter (+ inferConversationIntentStatus behavior) ───── */

type Msg = {
  direction?: string | null
  isInternal?: boolean | null
  metadata?: string | Record<string, unknown> | null
  createdAt?: string | Date | null
}
type Conv = { id: string; messages?: Msg[] }
const conv = (id: string, messages?: Msg[]): Conv => ({ id, messages })

test("applyIntentStatusFilter: 'all' returns every row (equal values)", () => {
  const rows = [conv("a"), conv("b")]
  assert.deepEqual(applyIntentStatusFilter(rows, "all"), rows)
})

test("applyIntentStatusFilter: a conversation with no messages counts as 'open'", () => {
  const rows = [conv("a", [])]
  assert.deepEqual(applyIntentStatusFilter(rows, "open").map((r) => r.id), ["a"])
  assert.deepEqual(applyIntentStatusFilter(rows, "done").map((r) => r.id), [])
})

test("applyIntentStatusFilter: latest inbound intentStatus=done marks the conversation done", () => {
  const done = conv("done", [
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: { intentStatus: "done" } },
  ])
  const open = conv("open", [
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: { intentStatus: "open" } },
  ])
  assert.deepEqual(applyIntentStatusFilter([done, open], "done").map((r) => r.id), ["done"])
  assert.deepEqual(applyIntentStatusFilter([done, open], "open").map((r) => r.id), ["open"])
})

test("applyIntentStatusFilter: uses the LATEST inbound by createdAt, not array order", () => {
  const c = conv("c", [
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: { intentStatus: "done" } },
    { direction: "inbound", createdAt: "2026-02-01T00:00:00Z", metadata: { intentStatus: "open" } },
  ])
  // newest inbound is "open" → the conversation is open
  assert.deepEqual(applyIntentStatusFilter([c], "open").map((r) => r.id), ["c"])
  assert.deepEqual(applyIntentStatusFilter([c], "done").map((r) => r.id), [])
})

test("applyIntentStatusFilter: outbound and internal messages are ignored", () => {
  const c = conv("c", [
    { direction: "outbound", createdAt: "2026-03-01T00:00:00Z", metadata: { intentStatus: "done" } },
    { direction: "inbound", isInternal: true, createdAt: "2026-03-02T00:00:00Z", metadata: { intentStatus: "done" } },
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: { intentStatus: "done" } },
  ])
  // only the plain inbound (done) counts
  assert.deepEqual(applyIntentStatusFilter([c], "done").map((r) => r.id), ["c"])
})

test("applyIntentStatusFilter: soft-trashed inbound messages are skipped", () => {
  const c = conv("c", [
    { direction: "inbound", createdAt: "2026-04-01T00:00:00Z", metadata: { intentStatus: "done", trashedAt: "2026-04-02T00:00:00Z" } },
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: { intentStatus: "open" } },
  ])
  // the newest inbound is trashed → falls back to the older "open" inbound
  assert.deepEqual(applyIntentStatusFilter([c], "open").map((r) => r.id), ["c"])
})

test("applyIntentStatusFilter: string-encoded metadata is parsed defensively", () => {
  const c = conv("c", [
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: JSON.stringify({ intentStatus: "done" }) },
  ])
  assert.deepEqual(applyIntentStatusFilter([c], "done").map((r) => r.id), ["c"])
})

test("applyIntentStatusFilter: corrupted metadata string degrades to 'open'", () => {
  const c = conv("c", [
    { direction: "inbound", createdAt: "2026-01-01T00:00:00Z", metadata: "{not valid json" },
  ])
  assert.deepEqual(applyIntentStatusFilter([c], "open").map((r) => r.id), ["c"])
  assert.deepEqual(applyIntentStatusFilter([c], "done").map((r) => r.id), [])
})

/* ── status option builders ──────────────────────────────────────────────── */

test("buildStatusFilterOptions: excludes 'triaged' and labels 'all' as 'All statuses'", () => {
  const opts = buildStatusFilterOptions("en")
  const values = opts.map((o) => o.value)
  assert.ok(!values.includes("triaged"), "triaged must be excluded from the filter select")
  assert.equal(values[0], "all")
  assert.equal(opts[0].label, "All statuses")
  // every non-'all' option carries a non-empty localized label
  for (const o of opts) assert.ok(o.label.length > 0)
  // exactly the STATUS_OPTIONS minus 'triaged'
  assert.equal(values.length, STATUS_OPTIONS.filter((s) => s !== "triaged").length)
})

test("buildStatusEditOptions: default excludes 'all' and 'triaged'", () => {
  const opts = buildStatusEditOptions("new", "en")
  const values = opts.map((o) => o.value)
  assert.ok(!values.includes("all"), "editor must not offer 'all'")
  assert.ok(!values.includes("triaged"), "editor must not offer 'triaged' for a normal status")
  assert.equal(values.length, STATUS_OPTIONS.filter((s) => s !== "all" && s !== "triaged").length)
})

test("buildStatusEditOptions: a trashed conversation can only go to 'triaged'", () => {
  const opts = buildStatusEditOptions("trashed", "en")
  assert.deepEqual(opts.map((o) => o.value), ["triaged"])
})

test("buildStatusEditOptions: a triaged conversation gets 'triaged' prepended to the base set", () => {
  const opts = buildStatusEditOptions("triaged", "en")
  const values = opts.map((o) => o.value)
  assert.equal(values[0], "triaged")
  // base set (all/triaged excluded) follows, so 'triaged' appears exactly once, at the front
  assert.equal(values.filter((v) => v === "triaged").length, 1)
  assert.equal(values.length, STATUS_OPTIONS.filter((s) => s !== "all" && s !== "triaged").length + 1)
})

test("buildStatusEditOptions: null/undefined selected status yields the base set", () => {
  const opts = buildStatusEditOptions(null, "en")
  const values = opts.map((o) => o.value)
  assert.ok(!values.includes("all"))
  assert.ok(!values.includes("triaged"))
})
