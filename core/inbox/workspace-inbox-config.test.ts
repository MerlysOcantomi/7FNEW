import assert from "node:assert/strict"
import test from "node:test"
import {
  extractInboxConfigSlice,
  parseWorkspaceInboxConfigSlice,
  withInboxConfigKey,
} from "./workspace-inbox-config"

const CONFIG = JSON.stringify({
  modules: { inbox: true },
  ui: { labels: { "client.plural": "Clientas" } },
  inbox: {
    channels: { enabled: ["email", "whatsapp"], order: ["whatsapp", "email"] },
    filters: { primary: ["all", "unanswered"] },
    webChat: { enabled: true },
    cannedResponses: [{ id: "old", label: "Old", content: "Old body" }],
  },
  taxonomies: { inbox: ["Ventas"] },
})

test("withInboxConfigKey replaces exactly one inbox key and preserves every other inbox override", () => {
  const next = withInboxConfigKey(CONFIG, "cannedResponses", [
    { id: "new", label: "New", content: "New body" },
  ])
  assert.deepEqual(next.channels, { enabled: ["email", "whatsapp"], order: ["whatsapp", "email"] })
  assert.deepEqual(next.filters, { primary: ["all", "unanswered"] })
  assert.deepEqual(next.webChat, { enabled: true })
  assert.deepEqual(next.cannedResponses, [{ id: "new", label: "New", content: "New body" }])
  assert.deepEqual(Object.keys(next).sort(), ["cannedResponses", "channels", "filters", "webChat"])
})

test("withInboxConfigKey adds the key when the workspace had no inbox slice yet", () => {
  assert.deepEqual(withInboxConfigKey(null, "cannedResponses", []), { cannedResponses: [] })
  assert.deepEqual(withInboxConfigKey(undefined, "webChat", { enabled: false }), { webChat: { enabled: false } })
  assert.deepEqual(withInboxConfigKey(JSON.stringify({ modules: {} }), "cannedResponses", []), {
    cannedResponses: [],
  })
})

test("malformed JSON or a non-object inbox slice degrade to an empty slice (never throw)", () => {
  assert.deepEqual(withInboxConfigKey("{not json", "cannedResponses", []), { cannedResponses: [] })
  assert.deepEqual(withInboxConfigKey(JSON.stringify({ inbox: [1, 2] }), "k", 1), { k: 1 })
  assert.deepEqual(withInboxConfigKey(JSON.stringify({ inbox: "x" }), "k", 1), { k: 1 })
  assert.deepEqual(withInboxConfigKey(JSON.stringify({ inbox: null }), "k", 1), { k: 1 })
  assert.deepEqual(parseWorkspaceInboxConfigSlice(""), {})
})

test("extractInboxConfigSlice returns a shallow copy, never the caller's object", () => {
  const inbox = { a: 1 }
  const out = extractInboxConfigSlice({ inbox })
  assert.deepEqual(out, { a: 1 })
  assert.notEqual(out, inbox)
  assert.deepEqual(extractInboxConfigSlice(null), {})
  assert.deepEqual(extractInboxConfigSlice([]), {})
  assert.deepEqual(extractInboxConfigSlice({ inbox: 3 }), {})
})

test("withInboxConfigKey does not touch keys outside inbox (they are the caller's concern)", () => {
  const next = withInboxConfigKey(CONFIG, "cannedResponses", [])
  assert.equal("modules" in next, false)
  assert.equal("taxonomies" in next, false)
})
