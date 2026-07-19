import assert from "node:assert/strict"
import test from "node:test"
import { attachmentKindFromMime, buildAttachmentKey } from "./attachment-keys"

// ─── Tier priority ──────────────────────────────────────────────────────────

test("tier 1: provider media id wins over everything", () => {
  assert.equal(
    buildAttachmentKey({
      provider: "meta",
      externalMediaId: "media-9",
      storageKey: "blob/x",
      checksum: "abc",
      position: 3,
    }),
    "media:meta:media-9",
  )
  // Missing provider still keys on the media id deterministically.
  assert.equal(buildAttachmentKey({ externalMediaId: "media-9", position: 0 }), "media:unknown:media-9")
})

test("tier 2: storage key when no media id", () => {
  assert.equal(
    buildAttachmentKey({ storageKey: "blob/inbox/a.pdf", checksum: "abc", position: 1 }),
    "store:blob/inbox/a.pdf",
  )
})

test("tier 3: checksum discriminated by creation position", () => {
  // The same file attached TWICE intentionally must yield two keys.
  const first = buildAttachmentKey({ checksum: "abc", position: 0 })
  const second = buildAttachmentKey({ checksum: "abc", position: 1 })
  assert.equal(first, "sha256:abc#0")
  assert.equal(second, "sha256:abc#1")
  assert.notEqual(first, second)
})

test("tier 4: positional fallback is deterministic", () => {
  assert.equal(buildAttachmentKey({ position: 2 }), "pos:2")
  assert.equal(buildAttachmentKey({ position: 2 }), "pos:2")
})

test("blank strings do not count as identity sources", () => {
  assert.equal(
    buildAttachmentKey({ provider: "meta", externalMediaId: "  ", storageKey: "", position: 0 }),
    "pos:0",
  )
})

// ─── Stability contract ─────────────────────────────────────────────────────

test("a provisional row completing later keeps its original key", () => {
  // Created as external reference (tier 1)…
  const created = buildAttachmentKey({ provider: "meta", externalMediaId: "m1", position: 0 })
  // …later the file is downloaded (storageKey/checksum now known). The key
  // builder is only called at creation; recomputing with MORE data must
  // still yield the same tier-1 key, proving the anchor is stable.
  const recomputed = buildAttachmentKey({
    provider: "meta",
    externalMediaId: "m1",
    storageKey: "blob/now-stored",
    checksum: "def",
    position: 5,
  })
  assert.equal(created, recomputed)
})

// ─── Kind mapping ───────────────────────────────────────────────────────────

test("attachment kind derives coarsely from MIME", () => {
  assert.equal(attachmentKindFromMime("image/png"), "image")
  assert.equal(attachmentKindFromMime("video/mp4"), "video")
  assert.equal(attachmentKindFromMime("audio/ogg"), "audio")
  assert.equal(attachmentKindFromMime("application/pdf"), "file")
  assert.equal(attachmentKindFromMime(null), "file")
})
