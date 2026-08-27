import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// AI-06 route-boundary contract, asserted on the SOURCE of the migrated
// path. The behavioral pieces (authorization, loop, validation, usage) are
// covered in `engines/ai/agent-loop.test.ts`; these tests pin the structural
// guarantees of the transport file itself: no provider client, no legacy
// tool authority, canonical use-case wiring, authentication preserved.

const ROUTE_DIR = join(__dirname)
const routeSource = readFileSync(join(ROUTE_DIR, "route.ts"), "utf8")

test("the migrated route owns no OpenAI client and no provider fetch", () => {
  assert.ok(!routeSource.includes("api.openai.com"))
  assert.ok(!routeSource.includes("OPENAI_API_KEY"))
  assert.ok(!/\bfetch\(/.test(routeSource))
  assert.ok(!routeSource.includes("chat/completions"))
})

test("AGENT_TOOLS is no longer the provider-facing authority anywhere", () => {
  assert.ok(!routeSource.includes("AGENT_TOOLS"))
  assert.ok(!routeSource.includes("agents/forte/tools"))
  assert.ok(!routeSource.includes("executeToolCall"))
})

test("the route authenticates and delegates to the shared canonical loop", () => {
  assert.ok(routeSource.includes("requireReadAccess(request)"))
  assert.ok(routeSource.includes("runAgentToolLoop"))
  assert.ok(routeSource.includes("getAgentToolBindings"))
  assert.ok(routeSource.includes("resolveWorkspaceCapabilitySnapshot"))
  // Membership evidence comes from the authenticated role, never the body.
  assert.ok(routeSource.includes("membership: { role: wsRole }"))
})

test("legacy request validation and response vocabulary are preserved", () => {
  assert.ok(routeSource.includes('"El mensaje es requerido"'))
  assert.ok(routeSource.includes("MAX_INPUT = 12000"))
  assert.ok(routeSource.includes("MAX_HISTORY = 20"))
  assert.ok(routeSource.includes("respuesta:"))
  assert.ok(routeSource.includes("actions"))
  // Legacy provider/model/sampling preserved.
  assert.ok(routeSource.includes('"gpt-4.1"'))
  assert.ok(routeSource.includes("temperature: 0.6"))
  assert.ok(routeSource.includes("maxTokens: 8192"))
})

test("the legacy executor, tool list and guardrail files are gone", () => {
  const forteDir = join(ROUTE_DIR, "..", "..", "..", "..", "agents", "forte")
  for (const legacy of [
    "tools.ts",
    "executor.ts",
    "legacy-tool-guardrail.ts",
    join("runtime", "agent-adapter.ts"),
  ]) {
    assert.throws(() => readFileSync(join(forteDir, legacy), "utf8"), legacy)
  }
})

test("image generation cannot be reached from the migrated path", () => {
  assert.ok(!routeSource.includes("image"))
  assert.ok(!routeSource.includes("generateImage"))
  for (const file of ["agent-bindings.ts", "agent-handlers.ts"]) {
    const source = readFileSync(
      join(ROUTE_DIR, "..", "..", "..", "..", "agents", "forte", "canonical", file),
      "utf8",
    )
    // The image generator is documented as excluded, but never imported.
    assert.ok(!source.includes('from "@tools/image-generator"'), file)
    assert.ok(!source.includes("generateImage"), file)
  }
})
