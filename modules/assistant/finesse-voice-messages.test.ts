import assert from "node:assert/strict"
import test from "node:test"

import {
  applyVoiceMessage,
  buildVoiceConversationSummary,
  markVoiceMessageInterrupted,
  type FinesseAssistantMessage,
} from "./finesse-assistant"

const textMsg = (id: string, role: "user" | "assistant", content: string): FinesseAssistantMessage => ({
  id,
  role,
  content,
})

// ─── One visible conversation: voice upserts ─────────────────────────────────

test("voice turn: partial appears once and is REPLACED by the final transcript", () => {
  let msgs: FinesseAssistantMessage[] = [textMsg("t1", "user", "hola")]

  msgs = applyVoiceMessage(msgs, { id: "voice-user-i1", role: "user", content: "qué tal", status: "partial" })
  assert.equal(msgs.length, 2)
  assert.equal(msgs[1].status, "partial")
  assert.equal(msgs[1].inputMode, "voice")

  msgs = applyVoiceMessage(msgs, { id: "voice-user-i1", role: "user", content: "qué tal mi mes", status: "final" })
  assert.equal(msgs.length, 2, "no duplicate message for the same voice turn")
  assert.equal(msgs[1].content, "qué tal mi mes")
  assert.equal(msgs[1].status, "final")
})

test("voice turn: a late partial never downgrades a finalized transcript", () => {
  let msgs = applyVoiceMessage([], { id: "v1", role: "assistant", content: "respuesta", status: "final" })
  const before = msgs
  msgs = applyVoiceMessage(msgs, { id: "v1", role: "assistant", content: "resp", status: "partial" })
  assert.equal(msgs, before)
})

test("voice turn: identical repeat is a no-op (stable reference)", () => {
  const a = applyVoiceMessage([], { id: "v1", role: "user", content: "hola", status: "partial" })
  const b = applyVoiceMessage(a, { id: "v1", role: "user", content: "hola", status: "partial" })
  assert.equal(a, b)
})

test("text and voice turns coexist in one ordered conversation", () => {
  let msgs: FinesseAssistantMessage[] = [textMsg("t1", "user", "escrito")]
  msgs = applyVoiceMessage(msgs, { id: "v1", role: "user", content: "hablado", status: "final" })
  msgs = [...msgs, textMsg("t2", "assistant", "respuesta escrita")]
  assert.deepEqual(
    msgs.map((m) => [m.id, m.inputMode ?? "text"]),
    [["t1", "text"], ["v1", "voice"], ["t2", "text"]],
  )
})

// ─── Interruption ────────────────────────────────────────────────────────────

test("barge-in marks the streaming assistant turn interrupted, keeps its text", () => {
  let msgs = applyVoiceMessage([], { id: "va1", role: "assistant", content: "Tu mes va", status: "partial" })
  msgs = markVoiceMessageInterrupted(msgs, "va1")
  assert.equal(msgs[0].status, "interrupted")
  assert.equal(msgs[0].content, "Tu mes va")

  // A trailing final transcript must NOT flip it back to a complete answer.
  const after = applyVoiceMessage(msgs, { id: "va1", role: "assistant", content: "Tu mes va bien", status: "final" })
  assert.equal(after[0].status, "interrupted")
})

test("interrupt mark is a no-op for user turns, final answers and unknown ids", () => {
  const finalAnswer = applyVoiceMessage([], { id: "va2", role: "assistant", content: "listo", status: "final" })
  assert.equal(markVoiceMessageInterrupted(finalAnswer, "va2"), finalAnswer)

  const userTurn = applyVoiceMessage([], { id: "vu1", role: "user", content: "hola", status: "partial" })
  assert.equal(markVoiceMessageInterrupted(userTurn, "vu1"), userTurn)
  assert.equal(markVoiceMessageInterrupted(userTurn, "nope"), userTurn)
})

// ─── Conversation summary for new voice sessions ─────────────────────────────

test("summary: last turns only, partials excluded, clipped, null when empty", () => {
  assert.equal(buildVoiceConversationSummary([]), null)

  const msgs: FinesseAssistantMessage[] = [
    textMsg("t1", "user", "primera pregunta"),
    textMsg("t2", "assistant", "primera respuesta"),
    textMsg("t3", "user", "segunda pregunta"),
    textMsg("t4", "assistant", "x".repeat(500)),
    { id: "v1", role: "user", content: "parcial en curso", inputMode: "voice", status: "partial" },
  ]
  const summary = buildVoiceConversationSummary(msgs, { maxTurns: 2, maxCharsPerTurn: 50 })
  assert.ok(summary)
  const lines = summary.split("\n")
  assert.equal(lines.length, 2)
  assert.ok(lines[0].startsWith("User: segunda pregunta"))
  assert.ok(lines[1].length <= "Finesse: ".length + 50)
  assert.ok(!summary.includes("parcial en curso"), "partials never leave the client")
})
