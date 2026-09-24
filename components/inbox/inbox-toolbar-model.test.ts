import assert from "node:assert/strict"
import test from "node:test"
import {
  SIMPLE_INBOX_LAYOUT, hasAdvancedInboxFilters, isDefaultInboxView,
  isInboxDatePreset, resetInboxToolbar, selectInboxStatus, selectPendingInboxWork,
  type InboxToolbarProps,
} from "./inbox-toolbar-model"

function fixture(overrides: Partial<InboxToolbarProps> = {}) {
  const calls: Array<[string, string]> = []
  const handler = (key: string) => (value: string) => { calls.push([key, value]) }
  const props: InboxToolbarProps = {
    search: "", primaryWorkFilter: "all", channel: "all", status: "all",
    assignmentFilter: "all", urgencyFilter: "all", datePreset: "all", intentStatusFilter: "all",
    channelOptions: [], statusOptions: [],
    onSearchChange: handler("search"), onChannelChange: handler("channel"),
    onStatusChange: handler("status"), onAssignmentFilterChange: handler("assignment"),
    onUrgencyFilterChange: handler("urgency"), onDatePresetChange: handler("date"),
    onIntentStatusFilterChange: handler("intent"), onPrimaryWorkFilterChange: handler("work"),
    ...overrides,
  }
  return { props, calls }
}

test("default Inbox view has no active dimensions", () => {
  assert.equal(isDefaultInboxView(fixture().props), true)
  assert.equal(hasAdvancedInboxFilters(fixture().props), false)
})

test("All is not selected merely because every channel is included", () => {
  for (const override of [
    { primaryWorkFilter: "needs_action" }, { channel: "instagram" }, { search: "Marta" },
    { datePreset: "7d" as const }, { status: "resolved" }, { urgencyFilter: "alta" },
    { assignmentFilter: "mine" as const }, { intentStatusFilter: "open" as const },
  ]) assert.equal(isDefaultInboxView(fixture(override).props), false, JSON.stringify(override))
})

test("search/channel/date are independent from advanced filters", () => {
  assert.equal(hasAdvancedInboxFilters(fixture({ search: "Marta", channel: "instagram", datePreset: "today" }).props), false)
})

test("All resets each controlled Inbox dimension and updates the URL last", () => {
  const { props, calls } = fixture({ status: "resolved", channel: "instagram", search: "nails", datePreset: "30d" })
  resetInboxToolbar(props)
  assert.deepEqual(calls, [
    ["channel", "all"], ["status", "all"], ["urgency", "all"], ["assignment", "all"],
    ["intent", "all"], ["date", "all"], ["search", ""], ["work", "all"],
  ])
})

test("optional callbacks are not required for a reset", () => {
  const { props, calls } = fixture({ onDatePresetChange: undefined, onUrgencyFilterChange: undefined,
    onIntentStatusFilterChange: undefined, onPrimaryWorkFilterChange: undefined })
  assert.doesNotThrow(() => resetInboxToolbar(props))
  assert.deepEqual(calls, [["channel", "all"], ["status", "all"], ["assignment", "all"], ["search", ""]])
})

test("Pending clears a conflicting status without clearing channel, date or query", () => {
  const { props, calls } = fixture({ status: "resolved", channel: "whatsapp", datePreset: "today" })
  selectPendingInboxWork(props)
  assert.deepEqual(calls, [["status", "all"], ["work", "needs_action"]])
})

test("a status selection stops intersecting Resolved with Pending", () => {
  const { props, calls } = fixture({ primaryWorkFilter: "needs_action" })
  selectInboxStatus(props, "resolved")
  assert.deepEqual(calls, [["work", "all"], ["status", "resolved"]])
})

test("date presets reject unknown values instead of relying on a type cast", () => {
  for (const value of ["all", "today", "7d", "30d"]) assert.equal(isInboxDatePreset(value), true)
  for (const value of ["", "yesterday", "invalid", "7D"]) assert.equal(isInboxDatePreset(value), false)
})

test("the mobile container actually enables grid, not only column spans", () => {
  assert.ok(SIMPLE_INBOX_LAYOUT.row.split(" ").includes("grid"))
  assert.ok(SIMPLE_INBOX_LAYOUT.row.split(" ").includes("grid-cols-6"))
  assert.ok(!SIMPLE_INBOX_LAYOUT.row.split(" ").includes("flex"))
  assert.ok(SIMPLE_INBOX_LAYOUT.row.split(" ").includes("sm:flex"))
  assert.match(SIMPLE_INBOX_LAYOUT.primary, /col-span-2/)
  assert.match(SIMPLE_INBOX_LAYOUT.secondary, /col-span-3/)
  assert.match(SIMPLE_INBOX_LAYOUT.search, /col-span-6/)
})

test("Radix select geometry explicitly matches mobile and desktop controls", () => {
  assert.match(SIMPLE_INBOX_LAYOUT.control, /\bh-10\b/)
  assert.match(SIMPLE_INBOX_LAYOUT.control, /sm:h-8/)
  assert.match(SIMPLE_INBOX_LAYOUT.select, /data-\[size=sm\]:h-10/)
  assert.match(SIMPLE_INBOX_LAYOUT.select, /sm:data-\[size=sm\]:h-8/)
})
