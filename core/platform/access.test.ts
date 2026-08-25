import assert from "node:assert/strict"
import test from "node:test"
import { canUser, canWorkspace } from "./access"
import { CAPABILITY_KEYS, type CapabilityKey } from "./capabilities"
import { PRODUCT_CAPABILITIES } from "./catalog"
import {
  getRolePermissions,
  resolveEffectiveCapabilities,
  roleMay,
} from "./role-policy"
import { WORKSPACE_ROLES, isWorkspaceRole, parseWorkspaceRole } from "./roles"
import {
  resolveWorkspaceCapabilitySnapshot,
  type WorkspaceCapabilitySources,
} from "./workspace-capabilities"

function sources(
  overrides: Partial<NonNullable<WorkspaceCapabilitySources["workspace"]>> = {},
  presence = false,
): WorkspaceCapabilitySources {
  return {
    workspace: {
      id: "ws_test",
      status: "active",
      plan: "free",
      configModules: null,
      ...overrides,
    },
    presenceStandaloneActive: presence,
  }
}

// ─── Roles: strict parsing, fail closed ──────────────────────────────────────

test("role keys are unique and strictly parsed", () => {
  assert.equal(new Set(WORKSPACE_ROLES).size, WORKSPACE_ROLES.length)
  for (const role of WORKSPACE_ROLES) {
    assert.equal(parseWorkspaceRole(role), role)
    assert.ok(isWorkspaceRole(role))
  }
})

test("unknown or malformed roles fail closed", () => {
  for (const bad of ["owner", "editor", "", null, undefined, 4, {}, "ADMIN "]) {
    assert.equal(parseWorkspaceRole(bad), null)
    assert.equal(getRolePermissions(bad as string).size, 0)
  }
})

// ─── Role policy ─────────────────────────────────────────────────────────────

test("every role permission references a canonical CapabilityKey", () => {
  const canonical = new Set<string>(CAPABILITY_KEYS)
  for (const role of WORKSPACE_ROLES) {
    for (const permission of getRolePermissions(role)) {
      assert.ok(canonical.has(permission), `${role}: ${permission}`)
    }
  }
})

test("role sets obey the hierarchy VIEWER ⊆ MEMBER ⊆ ADMIN ⊆ OWNER", () => {
  const ladder = ["VIEWER", "MEMBER", "ADMIN", "OWNER"] as const
  for (let i = 0; i < ladder.length - 1; i++) {
    const lower = getRolePermissions(ladder[i])
    const higher = getRolePermissions(ladder[i + 1])
    for (const permission of lower) {
      assert.ok(higher.has(permission), `${ladder[i + 1]} missing ${permission}`)
    }
  }
  // Strict growth up to ADMIN; OWNER == ADMIN today because no route
  // requires an OWNER-exclusive capability yet (documented in role-policy).
  assert.ok(getRolePermissions("MEMBER").size > getRolePermissions("VIEWER").size)
  assert.ok(getRolePermissions("ADMIN").size > getRolePermissions("MEMBER").size)
  assert.ok(getRolePermissions("OWNER").size >= getRolePermissions("ADMIN").size)
})

test("VIEWER cannot exercise write/admin capabilities", () => {
  for (const capability of ["person.write", "invoice.create", "workspace.settings", "channel.manage"]) {
    assert.equal(roleMay("VIEWER", capability as CapabilityKey), false)
  }
  assert.equal(roleMay("VIEWER", "conversation.read"), true)
})

test("MEMBER exercises operational writes but not admin permissions", () => {
  assert.equal(roleMay("MEMBER", "conversation.reply"), true)
  assert.equal(roleMay("MEMBER", "task.write"), true)
  assert.equal(roleMay("MEMBER", "invoice.create"), true)
  assert.equal(roleMay("MEMBER", "workspace.settings"), false)
  assert.equal(roleMay("MEMBER", "profile.write"), false)
})

test("ADMIN exercises administrative permissions", () => {
  assert.equal(roleMay("ADMIN", "workspace.settings"), true)
  assert.equal(roleMay("ADMIN", "profile.write"), true)
  assert.equal(roleMay("ADMIN", "channel.connect"), true)
  assert.equal(roleMay("ADMIN", "member.read"), true)
})

test("OWNER has every declared permission", () => {
  const owner = getRolePermissions("OWNER")
  for (const capability of CAPABILITY_KEYS) {
    assert.ok(owner.has(capability), `OWNER missing ${capability}`)
  }
})

test("effective capabilities are an intersection, never a union", () => {
  const workspaceCaps = new Set<CapabilityKey>(["conversation.read", "invoice.create"])
  const effective = resolveEffectiveCapabilities(workspaceCaps, getRolePermissions("VIEWER"))
  assert.deepEqual([...effective], ["conversation.read"])
  // Inputs are not mutated.
  assert.equal(workspaceCaps.size, 2)
  // Nothing outside the workspace set can appear, even for OWNER.
  const ownerEffective = resolveEffectiveCapabilities(workspaceCaps, getRolePermissions("OWNER"))
  assert.deepEqual([...ownerEffective].sort(), ["conversation.read", "invoice.create"])
})

// ─── Workspace capability resolver ───────────────────────────────────────────

test("core capability resolution is deterministic and always includes core", () => {
  const a = resolveWorkspaceCapabilitySnapshot(sources())
  const b = resolveWorkspaceCapabilitySnapshot(sources())
  assert.deepEqual([...a.capabilities].sort(), [...b.capabilities].sort())
  for (const capability of PRODUCT_CAPABILITIES.core) {
    assert.ok(a.capabilities.has(capability), `core capability missing: ${capability}`)
  }
  assert.ok(a.products.some((p) => p.product === "core"))
  assert.equal(a.observational, true)
})

test("free plan grants smart_inbox; unknown plan grants nothing beyond core", () => {
  const free = resolveWorkspaceCapabilitySnapshot(sources({ plan: "free" }))
  assert.ok(free.products.some((p) => p.product === "smart_inbox"))
  assert.ok(free.capabilities.has("conversation.read"))

  const unknown = resolveWorkspaceCapabilitySnapshot(sources({ plan: "super-mega-plan" }))
  assert.deepEqual(unknown.products.map((p) => p.product), ["core"])
  assert.equal(unknown.capabilities.has("conversation.read"), false)
  assert.ok(unknown.diagnostics.some((d) => d.includes("unknown value")))
})

test("enterprise `all` maps to every sellable product", () => {
  const snapshot = resolveWorkspaceCapabilitySnapshot(sources({ plan: "enterprise" }))
  for (const product of ["smart_inbox", "growth", "finance"]) {
    assert.ok(snapshot.products.some((p) => p.product === product), product)
  }
})

test("config.modules maps to canonical products and flags unknowns as diagnostics", () => {
  const snapshot = resolveWorkspaceCapabilitySnapshot(
    sources({ plan: "unknown-plan", configModules: { campaigns: true, mystery: true, automation: true } }),
  )
  assert.ok(snapshot.products.some((p) => p.product === "growth"))
  assert.ok(snapshot.capabilities.has("campaign.create"))
  assert.ok(snapshot.diagnostics.some((d) => d.includes('unmapped key "mystery"')))
  assert.ok(snapshot.diagnostics.some((d) => d.includes('"automation" has no canonical product')))
  // Unknown keys never grant products.
  assert.equal(snapshot.products.some((p) => p.product === "finance"), false)
})

test("divergent legacy sources produce diagnostics, never widened or removed access", () => {
  const snapshot = resolveWorkspaceCapabilitySnapshot(
    sources({ plan: "free", configModules: { inbox: false } }),
  )
  // Plan grants smart_inbox; config disagrees — diagnostic, access unchanged.
  assert.ok(snapshot.products.some((p) => p.product === "smart_inbox"))
  assert.ok(snapshot.diagnostics.some((d) => d.includes("divergence")))
})

test("presence standalone grants site.* as add-on capabilities without growth", () => {
  const snapshot = resolveWorkspaceCapabilitySnapshot(sources({ plan: "free" }, true))
  assert.ok(snapshot.capabilities.has("site.publish"))
  assert.ok(snapshot.capabilities.has("site.manage"))
  assert.equal(snapshot.products.some((p) => p.product === "growth"), false)
  assert.equal(snapshot.capabilities.has("campaign.create"), false)
})

test("resolver performs no writes and does not mutate its inputs", () => {
  const input = sources({ configModules: { inbox: true } })
  const before = JSON.stringify(input)
  resolveWorkspaceCapabilitySnapshot(input)
  assert.equal(JSON.stringify(input), before)
})

// ─── Access decisions ────────────────────────────────────────────────────────

test("canWorkspace fails closed on missing/suspended workspace and unknown capability", () => {
  assert.equal(canWorkspace(null, "conversation.read").reason, "workspace_not_found")
  const suspended = resolveWorkspaceCapabilitySnapshot(sources({ status: "suspended" }))
  assert.equal(canWorkspace(suspended, "conversation.read").reason, "workspace_suspended")
  const active = resolveWorkspaceCapabilitySnapshot(sources())
  assert.equal(canWorkspace(active, "not.a.capability").reason, "unknown_capability")
  assert.equal(canWorkspace(active, "campaign.create").reason, "capability_not_granted")
  assert.equal(canWorkspace(active, "conversation.read").allowed, true)
})

test("canUser checks workspace gate before user gate and denies fail-closed", () => {
  const snapshot = resolveWorkspaceCapabilitySnapshot(sources({ plan: "free" }))
  // Workspace gate first: capability missing beats membership missing.
  assert.equal(canUser(snapshot, null, "campaign.create").reason, "capability_not_granted")
  assert.equal(canUser(snapshot, null, "conversation.read").reason, "no_membership")
  assert.equal(canUser(snapshot, { role: "editor" }, "conversation.read").reason, "unknown_role")
  assert.equal(
    canUser(snapshot, { role: "VIEWER" }, "conversation.reply").reason,
    "permission_denied",
  )
  assert.equal(canUser(snapshot, { role: "MEMBER" }, "conversation.reply").allowed, true)
})

test("OWNER is still denied when the workspace lacks the capability", () => {
  const inboxOnly = resolveWorkspaceCapabilitySnapshot(sources({ plan: "free" }))
  const decision = canUser(inboxOnly, { role: "OWNER" }, "invoice.create")
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, "capability_not_granted")
})

test("unknown capability requests deny for users too", () => {
  const snapshot = resolveWorkspaceCapabilitySnapshot(sources())
  assert.equal(canUser(snapshot, { role: "OWNER" }, "totally.made.up").reason, "unknown_capability")
})
