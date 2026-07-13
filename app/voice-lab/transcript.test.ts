import assert from "node:assert/strict"
import test from "node:test"
import {
  emptyTranscriptStore,
  applyTranscript,
  transcriptLines,
  markInterrupted,
} from "./transcript"

test("partial is replaced by final for the same id", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "i1", role: "user", text: "ho", status: "partial" })
  s = applyTranscript(s, { id: "i1", role: "user", text: "hola", status: "partial" })
  s = applyTranscript(s, { id: "i1", role: "user", text: "hola mundo", status: "final" })
  const lines = transcriptLines(s)
  assert.equal(lines.length, 1)
  assert.deepEqual(lines[0], { id: "i1", role: "user", text: "hola mundo", status: "final" })
})

test("repeated history item does NOT duplicate lines", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "i1", role: "assistant", text: "claro", status: "final" })
  s = applyTranscript(s, { id: "i1", role: "assistant", text: "claro", status: "final" })
  s = applyTranscript(s, { id: "i1", role: "assistant", text: "otra cosa", status: "partial" })
  const lines = transcriptLines(s)
  assert.equal(lines.length, 1)
  // A partial after final is ignored; the finalized text stays.
  assert.equal(lines[0].text, "claro")
})

test("transcription error → unavailable (may override a non-final entry)", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "i2", role: "user", text: "…", status: "partial" })
  s = applyTranscript(s, { id: "i2", role: "user", text: "", status: "unavailable" })
  assert.equal(transcriptLines(s)[0].status, "unavailable")
})

test("insertion order is preserved across ids", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "a", role: "user", text: "1", status: "final" })
  s = applyTranscript(s, { id: "b", role: "assistant", text: "2", status: "final" })
  s = applyTranscript(s, { id: "a", role: "user", text: "1", status: "final" }) // repeat, no move
  assert.deepEqual(transcriptLines(s).map((l) => l.id), ["a", "b"])
})

test("normal entries never carry an interrupted key (keeps equality simple)", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "i1", role: "assistant", text: "hola", status: "final" })
  assert.deepEqual(transcriptLines(s)[0], { id: "i1", role: "assistant", text: "hola", status: "final" })
})

test("markInterrupted marks an assistant line and is a no-op for unknown/user ids", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "a", role: "assistant", text: "respondi", status: "partial" })
  s = applyTranscript(s, { id: "u", role: "user", text: "espera", status: "final" })
  s = markInterrupted(s, "a")
  s = markInterrupted(s, "u") // user turn → ignored
  s = markInterrupted(s, "missing") // unknown → ignored
  const byId = Object.fromEntries(transcriptLines(s).map((l) => [l.id, l]))
  assert.equal(byId.a.interrupted, true)
  assert.equal(byId.u.interrupted, undefined)
})

test("interrupted mark survives a later partial/final update to the same id", () => {
  let s = emptyTranscriptStore()
  s = applyTranscript(s, { id: "a", role: "assistant", text: "respon", status: "partial" })
  s = markInterrupted(s, "a")
  // A trailing transcript for the same id must not erase the interrupted mark.
  s = applyTranscript(s, { id: "a", role: "assistant", text: "respondiendo", status: "partial" })
  assert.equal(transcriptLines(s)[0].interrupted, true)
})
