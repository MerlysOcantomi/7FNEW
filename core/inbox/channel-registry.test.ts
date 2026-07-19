import assert from "node:assert/strict"
import test from "node:test"
import {
  INBOX_CHANNELS,
  INBOX_CHANNEL_IDS,
  UNKNOWN_CHANNEL_CAPABILITIES,
  getInboxChannel,
  getInboxChannelCapabilities,
  getInboxChannelKind,
  isChannelSelectableInFilters,
  isInboxChannelId,
  normalizeInboxChannelId,
} from "./channel-registry"

// ─── Registry integrity ──────────────────────────────────────────────────────

test("registry ids are unique and consistent with the definitions record", () => {
  assert.equal(new Set(INBOX_CHANNEL_IDS).size, INBOX_CHANNEL_IDS.length)
  assert.deepEqual(
    [...INBOX_CHANNEL_IDS].sort(),
    Object.keys(INBOX_CHANNELS).sort(),
  )
  for (const id of INBOX_CHANNEL_IDS) {
    assert.equal(INBOX_CHANNELS[id].id, id)
  }
})

test("every definition declares availability, kind and capability confidence", () => {
  for (const id of INBOX_CHANNEL_IDS) {
    const def = INBOX_CHANNELS[id]
    assert.ok(["available", "data_only", "planned"].includes(def.availability), id)
    assert.ok(["email", "chat", "social", "internal"].includes(def.kind), id)
    assert.ok(["confirmed", "provisional"].includes(def.capabilitiesConfidence), id)
  }
})

test("channels without a real integration are never marked confirmed", () => {
  // Only channels with an implemented data/transport path may claim
  // confirmed capabilities; planned/data_only channels stay provisional.
  for (const id of INBOX_CHANNEL_IDS) {
    const def = INBOX_CHANNELS[id]
    if (def.availability !== "available") {
      assert.equal(def.capabilitiesConfidence, "provisional", id)
    }
  }
})

test("planned channels are not selectable in filters; the rest are", () => {
  for (const id of INBOX_CHANNEL_IDS) {
    const def = INBOX_CHANNELS[id]
    assert.equal(isChannelSelectableInFilters(def), def.availability !== "planned", id)
  }
})

// ─── Capability resolution ───────────────────────────────────────────────────

test("email capabilities reflect the implemented email path", () => {
  const caps = getInboxChannelCapabilities("email")
  assert.equal(caps.subject, true)
  assert.equal(caps.cc, true)
  assert.equal(caps.bcc, true)
  assert.equal(caps.forward, true)
  assert.equal(caps.inbound, true)
  assert.equal(caps.outbound, true)
  assert.equal(caps.initiateConversation, true)
  // Open-pixel heuristic exists; protocol delivery receipts do not.
  assert.equal(caps.readReceipts, true)
  assert.equal(caps.deliveryReceipts, false)
})

test("no non-email channel claims subject/cc/bcc support", () => {
  for (const id of INBOX_CHANNEL_IDS) {
    if (id === "email") continue
    const caps = INBOX_CHANNELS[id].capabilities
    assert.equal(caps.subject, false, id)
    assert.equal(caps.cc, false, id)
    assert.equal(caps.bcc, false, id)
    assert.equal(caps.forward, false, id)
  }
})

test("manual is an internal record: nothing arrives or is delivered externally", () => {
  const caps = getInboxChannelCapabilities("manual")
  assert.equal(caps.inbound, false)
  assert.equal(caps.outbound, false)
  assert.equal(getInboxChannelKind("manual"), "internal")
})

test("unknown channels resolve to conservative text-only capabilities", () => {
  assert.equal(getInboxChannel("telegram"), null)
  assert.deepEqual(getInboxChannelCapabilities("telegram"), UNKNOWN_CHANNEL_CAPABILITIES)
  assert.equal(getInboxChannelCapabilities("telegram").subject, false)
  assert.equal(getInboxChannelKind("telegram"), "internal")
})

test("normalization handles casing, whitespace, aliases and garbage", () => {
  assert.equal(normalizeInboxChannelId(" Email "), "email")
  assert.equal(normalizeInboxChannelId("WEB"), "web_chat")
  assert.equal(normalizeInboxChannelId("webchat"), "web_chat")
  assert.equal(normalizeInboxChannelId("no-such-channel"), null)
  assert.equal(normalizeInboxChannelId(""), null)
  assert.equal(normalizeInboxChannelId(null), null)
  assert.equal(normalizeInboxChannelId(undefined), null)
  assert.ok(isInboxChannelId("whatsapp"))
  assert.ok(!isInboxChannelId("web"))
})

test("provisional platform constraints are recorded, not invented as parity", () => {
  assert.equal(INBOX_CHANNELS.whatsapp.capabilities.replyWindowHours, 24)
  assert.equal(INBOX_CHANNELS.whatsapp.capabilities.templates, true)
  assert.equal(INBOX_CHANNELS.sms.capabilities.maxTextLength, 1600)
  assert.equal(INBOX_CHANNELS.sms.capabilities.images, false)
  // TikTok's DM surface is under-documented — the provisional set stays minimal.
  assert.equal(INBOX_CHANNELS.tiktok.capabilities.templates, false)
  assert.equal(INBOX_CHANNELS.tiktok.capabilities.deliveryReceipts, false)
})
