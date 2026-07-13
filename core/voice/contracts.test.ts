import assert from "node:assert/strict"
import test from "node:test"
import {
  VOICE_STATES,
  TRANSCRIPT_STATUSES,
  KNOWLEDGE_PROVENANCE,
  TOOL_EFFECTS,
  TOOL_EXECUTION_POLICIES,
  VOICE_ROUTES,
  type TranscriptSegment,
  type ResponseMetadata,
  type VoiceToolDef,
  type JsonObject,
} from "./contracts"

// ─── State machine (adjustment 2 — the seven states, no lone "processing") ───

test("VOICE_STATES has the seven governed states and no 'processing'", () => {
  assert.deepEqual(VOICE_STATES, [
    "idle",
    "connecting",
    "listening",
    "thinking",
    "speaking",
    "interrupted",
    "error",
  ])
  assert.ok(!(VOICE_STATES as readonly string[]).includes("processing"))
})

// ─── Transcript vs provenance separation (adjustment 1) ──────────────────────

test("TRANSCRIPT_STATUSES = partial | final | unavailable", () => {
  assert.deepEqual(TRANSCRIPT_STATUSES, ["partial", "final", "unavailable"])
})

test("KNOWLEDGE_PROVENANCE is separate and includes workspace_data", () => {
  assert.deepEqual(KNOWLEDGE_PROVENANCE, [
    "workspace_data",
    "known",
    "inferred",
    "researched",
  ])
  // Provenance values must NOT leak into transcript statuses (separation).
  for (const p of KNOWLEDGE_PROVENANCE) {
    assert.ok(!(TRANSCRIPT_STATUSES as readonly string[]).includes(p))
  }
})

test("TranscriptSegment carries no provenance; provenance rides ResponseMetadata", () => {
  const seg: TranscriptSegment = {
    turnId: "t1",
    text: "hola",
    status: "partial",
    ts: "2026-01-01T00:00:00.000Z",
  }
  // Structural guard: the transcript object has no `provenance` key.
  assert.ok(!("provenance" in seg))

  const meta: ResponseMetadata = { provenance: "workspace_data" }
  assert.equal(meta.provenance, "workspace_data")
})

// ─── Tool effects + execution policies (adjustment 3) ────────────────────────

test("TOOL_EFFECTS = read | navigate | draft | propose | write", () => {
  assert.deepEqual(TOOL_EFFECTS, ["read", "navigate", "draft", "propose", "write"])
})

test("TOOL_EXECUTION_POLICIES = immediate | controlled | confirmation_required", () => {
  assert.deepEqual(TOOL_EXECUTION_POLICIES, [
    "immediate",
    "controlled",
    "confirmation_required",
  ])
})

test("VOICE_ROUTES = realtime | controlled", () => {
  assert.deepEqual(VOICE_ROUTES, ["realtime", "controlled"])
})

// ─── JSON-serializable contracts (adjustment 1) ──────────────────────────────

test("VoiceToolDef.parameters is a JSON object that survives serialization", () => {
  // Typed as JsonObject — a nested-but-plain JSON value, no functions/Dates.
  const params: JsonObject = {
    type: "object",
    properties: { hora: { type: "string" }, precio: { type: "number" } },
    required: ["hora"],
  }
  const tool: VoiceToolDef = {
    name: "create_appointment",
    description: "Create an appointment",
    parameters: params,
    effect: "write",
    execution: "confirmation_required",
  }
  assert.deepEqual(JSON.parse(JSON.stringify(tool.parameters)), params)
})
