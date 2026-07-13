import assert from "node:assert/strict"
import test from "node:test"
import {
  emptyTranscriptStore,
  applyTranscript,
  transcriptLines,
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
