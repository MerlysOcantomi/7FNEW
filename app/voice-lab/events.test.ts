import assert from "node:assert/strict"
import test from "node:test"
import { parseLabEvent, toTurnUsage } from "./events"

// Fixtures mirror the real @openai/agents@0.3.0 transport event payloads.

test("toTurnUsage: non-cached audio in = audio_tokens - cached_tokens", () => {
  const usage = {
    input_token_details: { audio_tokens: 1000, cached_tokens: 200, text_tokens: 10 },
    output_token_details: { audio_tokens: 2000, text_tokens: 20 },
  }
  assert.deepEqual(toTurnUsage(usage), {
    audioInputTokens: 800,
    cachedAudioInputTokens: 200,
    audioOutputTokens: 2000,
    textInputTokens: 10,
    textOutputTokens: 20,
    transcribedInputSeconds: 0,
  })
})

test("toTurnUsage: missing fields default to 0 (defensive)", () => {
  assert.deepEqual(toTurnUsage(undefined), {
    audioInputTokens: 0,
    cachedAudioInputTokens: 0,
    audioOutputTokens: 0,
    textInputTokens: 0,
    textOutputTokens: 0,
    transcribedInputSeconds: 0,
  })
})

test("response.done → single response_done with responseId + usage", () => {
  const evts = parseLabEvent({
    type: "response.done",
    response: { id: "resp_1", usage: { input_token_details: { audio_tokens: 100 } } },
  })
  assert.equal(evts.length, 1)
  assert.equal(evts[0].kind, "response_done")
  if (evts[0].kind === "response_done") {
    assert.equal(evts[0].responseId, "resp_1")
    assert.equal(evts[0].usage.audioInputTokens, 100)
  }
})

test("response.done without an id is dropped", () => {
  assert.deepEqual(parseLabEvent({ type: "response.done", response: {} }), [])
})

test("speech markers + model audio delta", () => {
  assert.deepEqual(parseLabEvent({ type: "input_audio_buffer.speech_started" }), [
    { kind: "user_speech_started" },
  ])
  assert.deepEqual(parseLabEvent({ type: "input_audio_buffer.speech_stopped" }), [
    { kind: "user_speech_stopped" },
  ])
  assert.deepEqual(parseLabEvent({ type: "response.output_audio.delta" }), [
    { kind: "model_audio_delta" },
  ])
})

test("input transcription completed → final transcript + transcription seconds", () => {
  const evts = parseLabEvent({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "item_1",
    transcript: "hola, quiero una cita",
    usage: { seconds: 3 },
  })
  assert.deepEqual(evts, [
    { kind: "input_transcript", itemId: "item_1", text: "hola, quiero una cita", status: "final" },
    { kind: "transcription_seconds", seconds: 3 },
  ])
})

test("input transcription delta → partial; failed → unavailable", () => {
  assert.deepEqual(
    parseLabEvent({ type: "conversation.item.input_audio_transcription.delta", item_id: "i", delta: "ho" }),
    [{ kind: "input_transcript", itemId: "i", text: "ho", status: "partial" }],
  )
  assert.deepEqual(
    parseLabEvent({ type: "conversation.item.input_audio_transcription.failed", item_id: "i" }),
    [{ kind: "input_transcript", itemId: "i", text: "", status: "unavailable" }],
  )
})

test("output transcript delta/done", () => {
  assert.deepEqual(
    parseLabEvent({ type: "response.output_audio_transcript.delta", item_id: "o", delta: "cla" }),
    [{ kind: "output_transcript", itemId: "o", text: "cla", status: "partial" }],
  )
  assert.deepEqual(
    parseLabEvent({ type: "response.output_audio_transcript.done", item_id: "o", transcript: "claro" }),
    [{ kind: "output_transcript", itemId: "o", text: "claro", status: "final" }],
  )
})

test("unknown event → []; wrapped { event: {...} } still parses", () => {
  assert.deepEqual(parseLabEvent({ type: "session.updated" }), [])
  assert.deepEqual(parseLabEvent({ event: { type: "input_audio_buffer.speech_started" } }), [
    { kind: "user_speech_started" },
  ])
})
