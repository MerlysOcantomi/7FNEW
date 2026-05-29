/**
 * Unit tests for the Agents activity classifier (PR 1).
 *
 * The classifier is the single pure gate that decides which Agents
 * lane a `WorkspaceTask` / `ConversationAction` row belongs to. Because
 * the aggregator trusts it verbatim, its behavior is locked down with
 * deterministic coverage here.
 *
 * Test runner: Node's built-in `node:test`, executed via `tsx --test`
 * (matches `modules/inbox/auto-task-policy.test.ts`). Run narrowly:
 *
 *   npm run test:agents-activity
 *
 * or directly:
 *
 *   npx tsx --test modules/agents/activity-classify.test.ts
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyConversationAction,
  classifyWorkspaceTask,
} from "./activity-classify"

// ─── WorkspaceTask ───────────────────────────────────────────────────────────

test("fanny_auto task → automated", () => {
  assert.equal(
    classifyWorkspaceTask({ status: "open", sourceType: "fanny_auto" }),
    "automated",
  )
})

test("fanny_auto wins regardless of status (e.g. done)", () => {
  assert.equal(
    classifyWorkspaceTask({ status: "done", sourceType: "fanny_auto" }),
    "automated",
  )
})

test("proposed + fanny_suggestion → needs_review", () => {
  assert.equal(
    classifyWorkspaceTask({ status: "proposed", sourceType: "fanny_suggestion" }),
    "needs_review",
  )
})

test("proposed but not fanny_suggestion → null (not shown)", () => {
  assert.equal(
    classifyWorkspaceTask({ status: "proposed", sourceType: "manual" }),
    null,
  )
})

test("fanny_suggestion already approved (open) → null (not a proposal anymore)", () => {
  assert.equal(
    classifyWorkspaceTask({ status: "open", sourceType: "fanny_suggestion" }),
    null,
  )
})

test("plain manual/inbox task → null", () => {
  assert.equal(
    classifyWorkspaceTask({ status: "open", sourceType: "inbox_conversation" }),
    null,
  )
  assert.equal(classifyWorkspaceTask({ status: "open", sourceType: null }), null)
})

// ─── ConversationAction ────────────────────────────────────────────────────────

test("executed action → executed", () => {
  assert.equal(
    classifyConversationAction({ status: "executed", errorMessage: null }),
    "executed",
  )
})

test("suggested action → attention", () => {
  assert.equal(
    classifyConversationAction({ status: "suggested", errorMessage: null }),
    "attention",
  )
})

test("errorMessage present → attention (even when status would be executed)", () => {
  assert.equal(
    classifyConversationAction({ status: "executed", errorMessage: "boom" }),
    "attention",
  )
})

test("errorMessage present on suggested → attention", () => {
  assert.equal(
    classifyConversationAction({ status: "suggested", errorMessage: "boom" }),
    "attention",
  )
})

test("empty / whitespace errorMessage is treated as absent", () => {
  assert.equal(
    classifyConversationAction({ status: "executed", errorMessage: "" }),
    "executed",
  )
  assert.equal(
    classifyConversationAction({ status: "executed", errorMessage: "   " }),
    "executed",
  )
})

test("approved action → null (decided, not on the board)", () => {
  assert.equal(
    classifyConversationAction({ status: "approved", errorMessage: null }),
    null,
  )
})

test("dismissed action → null", () => {
  assert.equal(
    classifyConversationAction({ status: "dismissed", errorMessage: null }),
    null,
  )
})
