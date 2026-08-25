/**
 * FOUND-01 — Declarative catalogs and invariant validation.
 *
 * Relations declared here:
 *   Product → Capabilities   (`PRODUCT_CAPABILITIES`, manual, minimal)
 *   Capability → Tools       (derived from each tool's `requiresCapabilities`
 *                             — never a second hand-maintained list)
 *
 * These catalogs RESOLVE NOTHING: no workspace entitlements, no DB, no
 * navigation, no module visibility, no production wiring. They exist so
 * FOUND-02a (entitlement resolver) and FOUND-02b/AI-04+ (gateway/tool
 * registry) share one vocabulary. Deliberately partial — see per-file notes.
 */

import { ACTIVITY_KEYS } from "./activities"
import { CAPABILITY_KEYS, type CapabilityKey } from "./capabilities"
import { PRODUCT_KEYS, type ProductKey } from "./products"
import { TOOL_CATALOG, TOOL_KEYS, type ToolKey } from "./tool-catalog"
import type { PlatformToolDefinition } from "./tool-definition"
import { TOOL_EFFECTS, TOOL_EXECUTION_POLICIES, TOOL_RISK_CLASSES } from "./vocabulary"

/**
 * Which capabilities each product grants (ARCH-02 §4/§12: capabilities derive
 * from products in code; per-workspace storage holds entitlements only).
 * Partial by design: extend with evidence, appending only.
 */
export const PRODUCT_CAPABILITIES = {
  core: [
    "workspace.read",
    "workspace.settings",
    "member.read",
    "person.read",
    "person.write",
    "task.read",
    "task.write",
    "profile.read",
    "profile.write",
    "audit.read",
  ],
  smart_inbox: [
    "conversation.read",
    "conversation.reply",
    "conversation.convert",
    "channel.connect",
    "channel.manage",
    "ai.classify",
    "ai.summarize",
    "ai.draft",
    "ai.assist",
  ],
  growth: ["campaign.read", "campaign.create", "content.create", "site.publish", "site.manage"],
  finance: ["invoice.read", "invoice.create", "transaction.read"],
} as const satisfies Record<ProductKey, readonly CapabilityKey[]>

/**
 * Capabilities intentionally granted by an ADD-ON or OFFERING rather than a
 * base product (ARCH-02 §4/§13: e.g. voice, `growth.presence`). Entitlement
 * kinds are typed in FOUND-02a; until then this list documents the exception
 * so validation can distinguish "declared add-on capability" from an
 * accidental orphan.
 */
export const ADDON_GRANTED_CAPABILITIES = ["voice.session"] as const satisfies readonly CapabilityKey[]

export function getCapabilitiesForProduct(product: ProductKey): readonly CapabilityKey[] {
  return PRODUCT_CAPABILITIES[product]
}

/** Derived Capability → Tools relation (no second manual list to drift). */
export function getToolsForCapability(capability: CapabilityKey): readonly ToolKey[] {
  return TOOL_KEYS.filter((key) =>
    (TOOL_CATALOG[key] as PlatformToolDefinition).requiresCapabilities.includes(capability),
  )
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value)
    seen.add(value)
  }
  return [...duplicated]
}

/**
 * Structural invariants of the FOUND-01 catalogs. TypeScript already enforces
 * most of them at compile time; this runtime check exists so tests (and any
 * future tooling) fail loudly on drift instead of silently shipping orphan
 * references. Returns human-readable violations; empty array = valid.
 */
export function validatePlatformFoundation(): string[] {
  const violations: string[] = []

  for (const [name, keys] of [
    ["PRODUCT_KEYS", PRODUCT_KEYS],
    ["CAPABILITY_KEYS", CAPABILITY_KEYS],
    ["TOOL_KEYS", TOOL_KEYS],
    ["ACTIVITY_KEYS", ACTIVITY_KEYS],
  ] as const) {
    for (const duplicate of findDuplicates(keys)) {
      violations.push(`${name}: duplicate key "${duplicate}"`)
    }
  }

  const capabilitySet = new Set<string>(CAPABILITY_KEYS)

  const mappedCapabilities = new Set<string>(ADDON_GRANTED_CAPABILITIES)
  for (const product of PRODUCT_KEYS) {
    for (const capability of PRODUCT_CAPABILITIES[product]) {
      if (!capabilitySet.has(capability)) {
        violations.push(`PRODUCT_CAPABILITIES[${product}]: unknown capability "${capability}"`)
      }
      mappedCapabilities.add(capability)
    }
    for (const duplicate of findDuplicates(PRODUCT_CAPABILITIES[product])) {
      violations.push(`PRODUCT_CAPABILITIES[${product}]: duplicate capability "${duplicate}"`)
    }
  }
  for (const capability of CAPABILITY_KEYS) {
    if (!mappedCapabilities.has(capability)) {
      violations.push(
        `capability "${capability}" belongs to no product and is not a declared add-on capability`,
      )
    }
  }

  for (const key of TOOL_KEYS) {
    const tool: PlatformToolDefinition = TOOL_CATALOG[key]
    if (tool.key !== key) {
      violations.push(`TOOL_CATALOG[${key}]: definition key mismatch ("${tool.key}")`)
    }
    violations.push(...validateToolDefinition(tool))
  }

  return violations
}

/**
 * Runtime invariants for one tool definition. The type system enforces these
 * for literal catalog entries; this guard exists for tests and for any future
 * definition that reaches the platform as data rather than as a literal.
 */
export function validateToolDefinition(tool: PlatformToolDefinition): string[] {
  const violations: string[] = []
  const capabilitySet = new Set<string>(CAPABILITY_KEYS)
  const key = tool.key

  if (tool.requiresCapabilities.length === 0) {
    violations.push(`tool "${key}": requiresCapabilities must not be empty`)
  }
  for (const capability of tool.requiresCapabilities) {
    if (!capabilitySet.has(capability)) {
      violations.push(`tool "${key}": unknown capability "${capability}"`)
    }
  }
  for (const permission of tool.requiresPermissions ?? []) {
    if (!capabilitySet.has(permission)) {
      violations.push(`tool "${key}": unknown permission key "${permission}"`)
    }
  }
  if (tool.requiresPermissions) {
    // Stricter-only: an explicit permission list must still require every
    // capability the tool needs — it may add requirements, never drop them.
    for (const capability of tool.requiresCapabilities) {
      if (!tool.requiresPermissions.includes(capability)) {
        violations.push(
          `tool "${key}": requiresPermissions must include required capability "${capability}" (stricter-only)`,
        )
      }
    }
  }
  if (!new Set<string>(TOOL_EFFECTS).has(tool.effect)) {
    violations.push(`tool "${key}": unknown effect "${tool.effect}"`)
  }
  if (!new Set<string>(TOOL_RISK_CLASSES).has(tool.riskClass)) {
    violations.push(`tool "${key}": unknown risk class "${tool.riskClass}"`)
  }
  if (!new Set<string>(TOOL_EXECUTION_POLICIES).has(tool.executionPolicy)) {
    violations.push(`tool "${key}": unknown execution policy "${tool.executionPolicy}"`)
  }
  if (tool.activity !== undefined && !new Set<string>(ACTIVITY_KEYS).has(tool.activity)) {
    violations.push(`tool "${key}": unknown activity "${tool.activity}"`)
  }
  const usesAiCapability = tool.requiresCapabilities.some((capability) =>
    capability.startsWith("ai."),
  )
  if (usesAiCapability && tool.activity === undefined) {
    violations.push(
      `tool "${key}": tools requiring an ai.* capability must declare an activity for usage attribution`,
    )
  }
  return violations
}
