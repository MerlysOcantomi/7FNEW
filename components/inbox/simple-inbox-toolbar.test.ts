import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { inbox } from "../../core/i18n/ui/en/inbox"
import { SimpleInboxToolbar, type SimpleInboxToolbarProps } from "./simple-inbox-toolbar"

function render(overrides: Partial<SimpleInboxToolbarProps> = {}) {
  const noop = () => {}
  return renderToStaticMarkup(createElement(SimpleInboxToolbar, {
    messages: inbox.toolbar, variant: "simple", search: "", channel: "all", status: "all",
    assignmentFilter: "all", primaryWorkFilter: "all", datePreset: "all",
    channelOptions: [{ value: "all", label: "All channels" }, { value: "instagram", label: "Instagram" }],
    statusOptions: [{ value: "all", label: "All statuses" }, { value: "resolved", label: "Resolved" }],
    onSearchChange: noop, onChannelChange: noop, onStatusChange: noop,
    onPrimaryWorkFilterChange: noop, onAssignmentFilterChange: noop,
    onDatePresetChange: noop, onUrgencyFilterChange: noop, ...overrides,
  }))
}

test("simple toolbar preserves approved control order", () => {
  const html = render()
  let previous = -1
  for (const key of ["all", "channels", "pending", "date", "more", "search"]) {
    const index = html.indexOf(`data-inbox-control="${key}"`)
    assert.ok(index > previous, key)
    previous = index
  }
  assert.match(html, /grid-cols-6/)
  assert.match(html, /data-size="sm"/)
})

test("Finesse does not render enterprise compose/capture controls", () => {
  const html = render({ onCompose: () => {}, onFetchEmails: () => {} })
  assert.doesNotMatch(html, /Compose|Capture|Sync now/)
})

test("All is visibly inactive when the channel is filtered", () => {
  const html = render({ channel: "instagram" })
  assert.match(html, /data-inbox-control="all"[^>]*aria-pressed="false"/)
})

test("More is open initially for an active advanced filter", () => {
  assert.match(render({ status: "resolved" }), /data-inbox-control="more"[^>]*aria-expanded="true"/)
})

test("local search has its own accessible label and clear action", () => {
  const html = render({ search: "Marta" })
  assert.ok(html.includes(inbox.toolbar.filterAria))
  assert.ok(html.includes(inbox.toolbar.clearFilter))
  assert.match(html, /value="Marta"/)
})

test("work options disabled by the caller stay disabled", () => {
  const html = render({ workFilterOptions: [
    { value: "all", label: "All" }, { value: "needs_action", label: "Pending", disabled: true },
  ] })
  assert.match(html, /data-inbox-control="pending"[^>]*disabled=""/)
})
