import assert from "node:assert/strict"
import test from "node:test"
import { TOOL_CATALOG, TOOL_KEYS } from "@core/platform/tool-catalog"

process.env.DATABASE_URL ??= "file:./dev.db"

// The registry imports handlers, which import the db module — but nothing
// here executes a query: these tests assert the SHAPE of the binding layer.

test("registry binds exactly the catalog tools that declare a reference handler", async () => {
  const { getAgentToolBindings } = await import("./agent-bindings")
  const bindings = getAgentToolBindings()
  const referenceKeys = TOOL_KEYS.filter(
    (key) => TOOL_CATALOG[key].handler.kind === "reference",
  )
  assert.deepEqual([...bindings.keys()].sort(), [...referenceKeys].sort())
})

test("bindings are execution-only: no metadata duplicated from the catalog", async () => {
  const { getAgentToolBindings } = await import("./agent-bindings")
  for (const [key, binding] of getAgentToolBindings()) {
    assert.deepEqual(Object.keys(binding), ["run"], key)
  }
})

test("deliberately absent bindings: every write tool and image generation", async () => {
  const { getAgentToolBindings } = await import("./agent-bindings")
  const bindings = getAgentToolBindings()
  for (const key of ["create_task", "create_content", "create_idea", "create_campaign"] as const) {
    assert.ok(!bindings.has(key), key)
  }
  for (const key of bindings.keys()) {
    assert.equal(TOOL_CATALOG[key].effect, "read", key)
    assert.ok(!key.includes("image"), key)
  }
  // And the canonical vocabulary itself carries no image-generation tool.
  assert.ok(!TOOL_KEYS.some((key) => key.includes("image")))
})

test("with the REAL registry, discovery offers exactly the four read tools — for OWNER too", async () => {
  const { getAgentToolBindings } = await import("./agent-bindings")
  const { buildProviderToolsForContext } = await import("@/engines/ai/agent-loop")
  const { resolveWorkspaceCapabilitySnapshot } = await import(
    "@core/platform/workspace-capabilities"
  )
  const snapshot = resolveWorkspaceCapabilitySnapshot({
    workspace: { id: "ws_1", status: "active", plan: "enterprise", configModules: null },
  })
  for (const role of ["OWNER", "ADMIN", "MEMBER"]) {
    const { offeredKeys } = buildProviderToolsForContext(
      { snapshot, membership: { role } },
      getAgentToolBindings(),
    )
    assert.deepEqual(
      [...offeredKeys].sort(),
      ["get_client", "search_client", "search_invoice", "search_task"],
      role,
    )
  }
})
