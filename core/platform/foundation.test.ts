import assert from "node:assert/strict"
import test from "node:test"
import {
  TOOL_EFFECTS as VOICE_TOOL_EFFECTS,
  TOOL_EXECUTION_POLICIES as VOICE_TOOL_EXECUTION_POLICIES,
  type VoiceToolDef,
} from "@core/voice/contracts"
import { ACTIVITY_KEYS } from "./activities"
import { CAPABILITY_KEYS } from "./capabilities"
import {
  ADDON_GRANTED_CAPABILITIES,
  PRODUCT_CAPABILITIES,
  getCapabilitiesForProduct,
  getToolsForCapability,
  validatePlatformFoundation,
  validateToolDefinition,
} from "./catalog"
import { PRODUCT_KEYS } from "./products"
import { TOOL_CATALOG, TOOL_KEYS } from "./tool-catalog"
import {
  getToolRequiredPermissions,
  parseToolInput,
  parseToolOutput,
  type PlatformToolDefinition,
  type ToolExecutionContext,
  type ToolHandlerFor,
} from "./tool-definition"
import { TOOL_EFFECTS, TOOL_EXECUTION_POLICIES, TOOL_RISK_CLASSES } from "./vocabulary"

// ─── Catalog invariants ──────────────────────────────────────────────────────

test("foundation catalogs hold every declared invariant", () => {
  assert.deepEqual(validatePlatformFoundation(), [])
})

test("all key vocabularies are unique", () => {
  for (const keys of [PRODUCT_KEYS, CAPABILITY_KEYS, TOOL_KEYS, ACTIVITY_KEYS]) {
    assert.equal(new Set(keys).size, keys.length)
  }
})

test("product→capability map covers exactly the product keys", () => {
  assert.deepEqual(Object.keys(PRODUCT_CAPABILITIES).sort(), [...PRODUCT_KEYS].sort())
  for (const product of PRODUCT_KEYS) {
    assert.equal(getCapabilitiesForProduct(product), PRODUCT_CAPABILITIES[product])
  }
})

test("every capability belongs to a product or is a declared add-on capability", () => {
  const mapped = new Set<string>(ADDON_GRANTED_CAPABILITIES)
  for (const product of PRODUCT_KEYS) {
    for (const capability of PRODUCT_CAPABILITIES[product]) mapped.add(capability)
  }
  for (const capability of CAPABILITY_KEYS) {
    assert.ok(mapped.has(capability), `orphan capability: ${capability}`)
  }
})

test("capability→tools relation is derived from tool requirements", () => {
  assert.deepEqual(getToolsForCapability("person.read"), ["search_client"])
  assert.deepEqual(getToolsForCapability("conversation.read"), [
    "summarize_conversation",
    "draft_reply",
  ])
  assert.deepEqual(getToolsForCapability("workspace.settings"), [])
})

test("tool catalog keys match their definitions", () => {
  for (const key of TOOL_KEYS) {
    assert.equal(TOOL_CATALOG[key].key, key)
  }
})

// ─── validateToolDefinition catches invalid definitions at runtime ───────────

test("validateToolDefinition flags orphan references and missing attribution", () => {
  const broken = {
    ...TOOL_CATALOG.summarize_conversation,
    key: "broken_fixture",
    requiresCapabilities: ["ai.summarize", "nonexistent.capability"],
    activity: undefined,
    riskClass: "not_a_risk",
  } as unknown as PlatformToolDefinition

  const violations = validateToolDefinition(broken)
  assert.ok(violations.some((violation) => violation.includes("nonexistent.capability")))
  assert.ok(violations.some((violation) => violation.includes("not_a_risk")))
  assert.ok(violations.some((violation) => violation.includes("must declare an activity")))
})

test("tools requiring ai.* capabilities declare an activity", () => {
  for (const key of TOOL_KEYS) {
    const tool = TOOL_CATALOG[key] as PlatformToolDefinition
    if (tool.requiresCapabilities.some((capability) => capability.startsWith("ai."))) {
      assert.ok(tool.activity, `AI tool without activity: ${key}`)
    }
  }
})

test("tool permissions default to required capabilities and are stricter-only", () => {
  // Omitted permissions default to the tool's capabilities.
  assert.deepEqual(
    getToolRequiredPermissions(TOOL_CATALOG.search_client),
    TOOL_CATALOG.search_client.requiresCapabilities,
  )
  // An explicit list that drops a required capability is a violation.
  const widened = {
    ...TOOL_CATALOG.summarize_conversation,
    requiresPermissions: ["conversation.read"],
  } as unknown as PlatformToolDefinition
  const violations = validateToolDefinition(widened)
  assert.ok(violations.some((violation) => violation.includes("stricter-only")))
  // An explicit list that adds a requirement is valid (stricter).
  const stricter = {
    ...TOOL_CATALOG.summarize_conversation,
    requiresPermissions: ["conversation.read", "ai.summarize", "person.read"],
  } as unknown as PlatformToolDefinition
  assert.deepEqual(validateToolDefinition(stricter), [])
})

test("no catalog tool is bound to a handler in FOUND-01", () => {
  for (const key of TOOL_KEYS) {
    assert.equal((TOOL_CATALOG[key] as PlatformToolDefinition).handler.kind, "unbound")
  }
})

// ─── Untrusted input/output validation (strict, no catch → {}) ───────────────

test("parseToolInput rejects invalid input with typed issues", () => {
  const missing = parseToolInput(TOOL_CATALOG.search_client, {})
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.ok(missing.issues.some((issue) => issue.includes("query")))

  const wrongType = parseToolInput(TOOL_CATALOG.search_client, { query: 42 })
  assert.equal(wrongType.ok, false)

  const excessive = parseToolInput(TOOL_CATALOG.search_client, { query: "ana", limit: 999 })
  assert.equal(excessive.ok, false)
})

test("parseToolInput accepts valid input with inferred typing", () => {
  const parsed = parseToolInput(TOOL_CATALOG.search_client, { query: "ana", limit: 5 })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value.query, "ana")
    assert.equal(parsed.value.limit, 5)
  }
})

test("parseToolOutput rejects outputs that violate the declared schema", () => {
  const invalid = parseToolOutput(TOOL_CATALOG.summarize_conversation, { summary: "" })
  assert.equal(invalid.ok, false)

  const valid = parseToolOutput(TOOL_CATALOG.summarize_conversation, { summary: "Resumen." })
  assert.equal(valid.ok, true)
})

// ─── Schema ↔ handler typing (compile-time contract, exercised once) ─────────

test("ToolHandlerFor infers input/output types from a definition", async () => {
  const context: ToolExecutionContext = {
    workspaceId: "ws_test",
    userId: "user_test",
    requestId: "req_test",
  }
  // Typed against the definition: `input.query` is a string, the return type
  // must match the output schema. This is a local fixture — nothing platform
  // side executes tools in FOUND-01.
  const handler: ToolHandlerFor<typeof TOOL_CATALOG.search_client> = async (input) => ({
    results: [{ personId: "p1", displayName: input.query.toUpperCase() }],
  })
  const result = await handler({ query: "ana" }, context)
  assert.equal(result.results[0].displayName, "ANA")
  const validated = parseToolOutput(TOOL_CATALOG.search_client, result)
  assert.equal(validated.ok, true)
})

// ─── Vocabulary + Voice compatibility (no second canonical source) ───────────

test("risk classes carry the six ARCH-03 classes", () => {
  assert.deepEqual(TOOL_RISK_CLASSES, [
    "read",
    "write",
    "external_side_effect",
    "financial",
    "communication",
    "admin",
  ])
})

test("voice re-exports the exact platform effect/policy vocabularies", () => {
  // Same reference, not merely equal values: one canonical source.
  assert.equal(VOICE_TOOL_EFFECTS, TOOL_EFFECTS)
  assert.equal(VOICE_TOOL_EXECUTION_POLICIES, TOOL_EXECUTION_POLICIES)
  assert.deepEqual(TOOL_EFFECTS, ["read", "navigate", "draft", "propose", "write"])
  assert.deepEqual(TOOL_EXECUTION_POLICIES, ["immediate", "controlled", "confirmation_required"])

  // VoiceToolDef still compiles against the shared types (behavior preserved).
  const voiceTool: VoiceToolDef = {
    name: "get_today_summary",
    description: "fixture",
    parameters: {},
    effect: "read",
    execution: "immediate",
  }
  assert.equal(voiceTool.effect, "read")
})
