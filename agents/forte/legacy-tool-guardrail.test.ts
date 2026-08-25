import assert from "node:assert/strict"
import test from "node:test"
import {
  isLegacyToolPermittedForRole,
  LEGACY_TOOL_REQUIRED_CAPABILITIES,
} from "./legacy-tool-guardrail"
import { CAPABILITY_KEYS } from "@core/platform/capabilities"

// Regression coverage for the confirmed pre-existing bypass: legacy WRITE
// tools were discoverable and executable behind read-only access with no
// role/permission check (agent route → adapter unfiltered append →
// executor switch with no recheck).

const GATED_WRITE_TOOLS = [
  "crear_tarea",
  "crear_campana",
  "crear_contenido",
  "crear_idea",
  "generar_imagen",
] as const

test("every guardrail entry references canonical capability keys only", () => {
  const canonical = new Set<string>(CAPABILITY_KEYS)
  for (const [tool, capabilities] of Object.entries(LEGACY_TOOL_REQUIRED_CAPABILITIES)) {
    assert.ok(capabilities.length > 0, tool)
    for (const capability of capabilities) {
      assert.ok(canonical.has(capability), `${tool}: ${capability}`)
    }
  }
})

test("VIEWER can no longer use legacy write/generate tools (the confirmed bypass)", () => {
  for (const tool of GATED_WRITE_TOOLS) {
    assert.equal(isLegacyToolPermittedForRole(tool, "VIEWER"), false, tool)
  }
})

test("missing, corrupt or unknown roles fail closed on gated tools", () => {
  for (const role of [undefined, null, "", "editor", "admin", "MEMBER "]) {
    for (const tool of GATED_WRITE_TOOLS) {
      assert.equal(isLegacyToolPermittedForRole(tool, role), false, `${tool} / ${String(role)}`)
    }
  }
})

test("MEMBER, ADMIN and OWNER keep their current write-tool behavior", () => {
  for (const role of ["MEMBER", "ADMIN", "OWNER"]) {
    for (const tool of GATED_WRITE_TOOLS) {
      assert.equal(isLegacyToolPermittedForRole(tool, role), true, `${tool} / ${role}`)
    }
  }
})

test("buscar_facturas stays available to every valid role (no behavior change)", () => {
  for (const role of ["VIEWER", "MEMBER", "ADMIN", "OWNER"]) {
    assert.equal(isLegacyToolPermittedForRole("buscar_facturas", role), true, role)
  }
})

test("tools outside the guardrail map are not gated here", () => {
  // Bridged read tools keep their Forte capability filtering; unknown names
  // are denied by the executor's default branch — the guardrail itself only
  // gates its declared set.
  assert.equal(isLegacyToolPermittedForRole("buscar_clientes", "VIEWER"), true)
  assert.equal(isLegacyToolPermittedForRole("nonexistent_tool", "VIEWER"), true)
})
