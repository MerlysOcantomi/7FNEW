import assert from "node:assert/strict"
import test from "node:test"
import {
  authorizeToolInvocation,
  contextExcludes,
  resolveAvailableTools,
  type ToolResolutionContext,
} from "./tool-authorization"
import { TOOL_CATALOG, TOOL_KEYS } from "./tool-catalog"
import type { PlatformToolDefinition } from "./tool-definition"
import {
  resolveWorkspaceCapabilitySnapshot,
  type WorkspaceCapabilitySources,
} from "./workspace-capabilities"

function sources(
  overrides: Partial<NonNullable<WorkspaceCapabilitySources["workspace"]>> = {},
): WorkspaceCapabilitySources {
  return {
    workspace: {
      id: "ws_test",
      status: "active",
      plan: "free", // grants core + smart_inbox → conversation/ai capabilities
      configModules: null,
      ...overrides,
    },
  }
}

function contextFor(
  role: string | null,
  overrides: Partial<NonNullable<WorkspaceCapabilitySources["workspace"]>> = {},
): ToolResolutionContext {
  return {
    snapshot: resolveWorkspaceCapabilitySnapshot(sources(overrides)),
    membership: role === null ? null : { role },
  }
}

// ─── Happy path & the discovery/execution split ──────────────────────────────

test("authorized workspace + authorized user is allowed at discovery level", () => {
  const decision = authorizeToolInvocation(contextFor("MEMBER"), "summarize_conversation", {
    requireExecutable: false,
  })
  assert.equal(decision.allowed, true)
  assert.deepEqual(decision.reasons, ["allowed"])
  assert.deepEqual(decision.requiredCapabilities, ["conversation.read", "ai.summarize"])
  assert.equal(decision.executable, false)
})

test("unbound tool execution is denied at invocation time (default semantics)", () => {
  // `summarize_conversation` remains unbound, so a real invocation-time
  // authorization must fail closed with tool_not_executable even when
  // capability + permission gates pass.
  const decision = authorizeToolInvocation(contextFor("MEMBER"), "summarize_conversation")
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.includes("tool_not_executable"))
  assert.equal(decision.missingCapabilities.length, 0)
  assert.equal(decision.missingPermissions.length, 0)
})

test("discovery result is not a durable token: invocation-time recheck denies", () => {
  const context = contextFor("MEMBER")
  const discovery = resolveAvailableTools(context)
  const discovered = discovery.discoverable.find((d) => d.toolKey === "summarize_conversation")
  assert.ok(discovered && discovered.allowed)
  // Re-authorizing the same tool for actual execution must be re-evaluated
  // and denies because no executable binding exists for this definition.
  const invocation = authorizeToolInvocation(context, "summarize_conversation")
  assert.equal(invocation.allowed, false)
  // Only definitions with a reference binding are reported executable
  // (AI-06 bound the migrated agent tools; unbound ones never appear).
  for (const decision of discovery.executable) {
    assert.equal(decision.definition?.handler.kind, "reference", decision.toolKey)
  }
  assert.ok(!discovery.executable.some((d) => d.toolKey === "summarize_conversation"))
})

// ─── Workspace gate ──────────────────────────────────────────────────────────

test("workspace missing a required capability denies with the full evidence", () => {
  // free plan has no growth → campaign.create absent; OWNER role is irrelevant.
  const decision = authorizeToolInvocation(contextFor("OWNER"), "send_reply", {
    requireExecutable: false,
  })
  assert.equal(decision.allowed, true) // conversation.reply is granted by smart_inbox

  const growthDenied = authorizeToolInvocation(
    { snapshot: resolveWorkspaceCapabilitySnapshot(sources({ plan: "unknown-plan" })), membership: { role: "OWNER" } },
    "summarize_conversation",
    { requireExecutable: false },
  )
  assert.equal(growthDenied.allowed, false)
  assert.ok(growthDenied.reasons.includes("capability_not_granted"))
  assert.deepEqual(growthDenied.missingCapabilities, ["conversation.read", "ai.summarize"])
})

test("multiple required capabilities: one absent is enough to deny, set preserved", () => {
  // Workspace with core only: conversation.read AND ai.summarize both absent;
  // person.read (core) present for search_client.
  const coreOnly = contextFor("ADMIN", { plan: "unknown-plan" })
  const ok = authorizeToolInvocation(coreOnly, "search_client", { requireExecutable: false })
  assert.equal(ok.allowed, true)
  const denied = authorizeToolInvocation(coreOnly, "summarize_conversation", {
    requireExecutable: false,
  })
  assert.equal(denied.allowed, false)
  assert.equal(denied.missingCapabilities.length, 2)
  assert.deepEqual(denied.requiredCapabilities, ["conversation.read", "ai.summarize"])
})

test("missing or invalid workspace snapshot denies", () => {
  const decision = authorizeToolInvocation(
    { snapshot: null, membership: { role: "OWNER" } },
    "search_client",
    { requireExecutable: false },
  )
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.includes("workspace_not_found"))
})

test("suspended workspace denies regardless of role", () => {
  const decision = authorizeToolInvocation(
    contextFor("OWNER", { status: "suspended" }),
    "search_client",
    { requireExecutable: false },
  )
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.includes("workspace_suspended"))
})

// ─── User gate ───────────────────────────────────────────────────────────────

test("user missing a required permission denies (workspace gate passed)", () => {
  // VIEWER lacks task.write; workspace (core) grants it.
  const decision = authorizeToolInvocation(contextFor("VIEWER"), "create_task", {
    requireExecutable: false,
  })
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.includes("permission_denied"))
  assert.deepEqual(decision.missingPermissions, ["task.write"])
  assert.equal(decision.missingCapabilities.length, 0)
})

test("multiple required permissions: every one must pass", () => {
  // summarize_conversation requires conversation.read + ai.summarize —
  // VIEWER holds both; a fabricated stricter list is exercised via
  // draft_reply for VIEWER (lacks ai.draft but holds conversation.read).
  const ok = authorizeToolInvocation(contextFor("VIEWER"), "summarize_conversation", {
    requireExecutable: false,
  })
  assert.equal(ok.allowed, true)
  const denied = authorizeToolInvocation(contextFor("VIEWER"), "draft_reply", {
    requireExecutable: false,
  })
  assert.equal(denied.allowed, false)
  assert.deepEqual(denied.missingPermissions, ["ai.draft"])
})

test("missing membership denies", () => {
  const decision = authorizeToolInvocation(contextFor(null), "search_client", {
    requireExecutable: false,
  })
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasons.includes("no_membership"))
})

test("corrupt or unknown membership role denies", () => {
  for (const role of ["editor", "", "owner", "ADMIN "]) {
    const decision = authorizeToolInvocation(contextFor(role), "search_client", {
      requireExecutable: false,
    })
    assert.equal(decision.allowed, false)
    assert.ok(decision.reasons.includes("unknown_role"))
  }
})

// ─── Tool identity ───────────────────────────────────────────────────────────

test("unknown tool key denies and echoes the requested key", () => {
  const decision = authorizeToolInvocation(contextFor("OWNER"), "totally_made_up")
  assert.equal(decision.allowed, false)
  assert.deepEqual(decision.reasons, ["unknown_tool"])
  assert.equal(decision.toolKey, "totally_made_up")
  assert.equal(decision.definition, null)
})

// ─── Deterministic reasons & deny-wins ───────────────────────────────────────

test("denial reasons are deterministic and deduplicated across gates", () => {
  const a = authorizeToolInvocation(contextFor(null, { status: "suspended" }), "create_task")
  const b = authorizeToolInvocation(contextFor(null, { status: "suspended" }), "create_task")
  assert.deepEqual(a.reasons, b.reasons)
  assert.equal(a.allowed, false)
  assert.ok(a.reasons.includes("workspace_suspended"))
  assert.ok(a.reasons.includes("no_membership"))
  assert.ok(a.reasons.includes("tool_not_executable"))
  assert.equal(new Set(a.reasons).size, a.reasons.length)
})

// ─── Context narrowing ───────────────────────────────────────────────────────

const NARROWED_FIXTURE: PlatformToolDefinition = {
  ...TOOL_CATALOG.summarize_conversation,
  availability: { experiences: ["finesse"], channels: ["web_chat"] },
}

test("context filter narrows: declared allowlists exclude non-matching contexts", () => {
  assert.equal(contextExcludes(NARROWED_FIXTURE, { experience: "sevenf" }), true)
  assert.equal(contextExcludes(NARROWED_FIXTURE, { experience: "finesse" }), false)
  assert.equal(
    contextExcludes(NARROWED_FIXTURE, { experience: "finesse", channel: "email" }),
    true,
  )
  // Absent context dimension or absent availability → no restriction.
  assert.equal(contextExcludes(NARROWED_FIXTURE, { persona: "fanny" }), false)
  assert.equal(contextExcludes(TOOL_CATALOG.summarize_conversation, { experience: "x" }), false)
  assert.equal(contextExcludes(NARROWED_FIXTURE, undefined), false)
})

test("context never grants: a denied tool stays denied under any narrowing", () => {
  const denied = authorizeToolInvocation(contextFor("VIEWER"), "create_task", {
    requireExecutable: false,
  })
  assert.equal(denied.allowed, false)
  for (const narrowing of [
    undefined,
    { experience: "finesse" },
    { persona: "fanny", channel: "web_chat", vertical: "beauty" },
  ]) {
    const withNarrowing = authorizeToolInvocation(
      { ...contextFor("VIEWER"), narrowing },
      "create_task",
      { requireExecutable: false },
    )
    assert.equal(withNarrowing.allowed, false)
    assert.ok(withNarrowing.reasons.includes("permission_denied"))
  }
})

// ─── Discovery over the whole catalog ────────────────────────────────────────

test("resolveAvailableTools narrows by role and workspace deterministically", () => {
  const member = resolveAvailableTools(contextFor("MEMBER"))
  const viewer = resolveAvailableTools(contextFor("VIEWER"))
  const memberKeys = member.discoverable.map((d) => d.toolKey)
  const viewerKeys = viewer.discoverable.map((d) => d.toolKey)
  // VIEWER's set is a subset of MEMBER's (permission monotonicity).
  for (const key of viewerKeys) assert.ok(memberKeys.includes(key))
  assert.ok(memberKeys.includes("create_task"))
  assert.ok(!viewerKeys.includes("create_task"))
  // Deterministic.
  assert.deepEqual(
    resolveAvailableTools(contextFor("MEMBER")).discoverable.map((d) => d.toolKey),
    memberKeys,
  )
  // Full catalog is considered, nothing beyond it is invented.
  for (const key of memberKeys) assert.ok((TOOL_KEYS as readonly string[]).includes(key))
})

test("decisions expose no secrets or raw membership records", () => {
  const decision = authorizeToolInvocation(contextFor("MEMBER"), "create_task")
  const serialized = JSON.stringify(decision)
  assert.ok(!serialized.includes("role"))
  assert.ok(!serialized.includes("API_KEY"))
})
