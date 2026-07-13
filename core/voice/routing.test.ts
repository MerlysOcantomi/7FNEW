import assert from "node:assert/strict"
import test from "node:test"
import {
  routeIntent,
  resolveToolExecution,
  routeToolExecution,
  routeTool,
} from "./routing"
import { TOOL_EFFECTS } from "./contracts"

// ─── routeIntent: Realtime vs controlled ─────────────────────────────────────

test("routeIntent: effect-free conversational query → realtime", () => {
  const d = routeIntent({
    hasEffect: false,
    sensitive: false,
    needsDurableTranscript: false,
    deterministic: false,
  })
  assert.equal(d.route, "realtime")
})

test("routeIntent: any of effect/sensitive/durable/deterministic → controlled", () => {
  assert.equal(
    routeIntent({ hasEffect: true, sensitive: false, needsDurableTranscript: false, deterministic: false }).route,
    "controlled",
  )
  assert.equal(
    routeIntent({ hasEffect: false, sensitive: true, needsDurableTranscript: false, deterministic: false }).route,
    "controlled",
  )
  assert.equal(
    routeIntent({ hasEffect: false, sensitive: false, needsDurableTranscript: true, deterministic: false }).route,
    "controlled",
  )
  assert.equal(
    routeIntent({ hasEffect: false, sensitive: false, needsDurableTranscript: false, deterministic: true }).route,
    "controlled",
  )
})

test("routeIntent: effect wins the reason over other controlled signals", () => {
  const d = routeIntent({
    hasEffect: true,
    sensitive: true,
    needsDurableTranscript: true,
    deterministic: true,
  })
  assert.equal(d.route, "controlled")
  assert.match(d.reason, /side effects/)
})

// ─── Tool effect → execution policy (adjustment 3) ───────────────────────────

test("resolveToolExecution: read/navigate → immediate", () => {
  assert.equal(resolveToolExecution("read"), "immediate")
  assert.equal(resolveToolExecution("navigate"), "immediate")
})

test("resolveToolExecution: draft/propose → controlled", () => {
  assert.equal(resolveToolExecution("draft"), "controlled")
  assert.equal(resolveToolExecution("propose"), "controlled")
})

test("resolveToolExecution: write → confirmation_required", () => {
  assert.equal(resolveToolExecution("write"), "confirmation_required")
})

test("resolveToolExecution: total over every declared effect", () => {
  for (const e of TOOL_EFFECTS) {
    assert.ok(["immediate", "controlled", "confirmation_required"].includes(resolveToolExecution(e)))
  }
})

// ─── Execution policy → transport route ──────────────────────────────────────

test("routeToolExecution: only immediate may be realtime", () => {
  assert.equal(routeToolExecution("immediate"), "realtime")
  assert.equal(routeToolExecution("controlled"), "controlled")
  assert.equal(routeToolExecution("confirmation_required"), "controlled")
})

test("routeTool: write is confirmation_required + controlled; read is immediate + realtime", () => {
  assert.deepEqual(routeTool("write"), { policy: "confirmation_required", route: "controlled" })
  assert.deepEqual(routeTool("read"), { policy: "immediate", route: "realtime" })
})
