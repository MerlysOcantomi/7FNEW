/**
 * FOUND-03 — Canonical tool resolution & fail-closed authorization.
 *
 * Connects the FOUND-01 tool catalog with the FOUND-02a access foundation
 * into one deterministic, read-only decision layer:
 *
 *   workspace CAN every required capability      (capability gate)
 *   AND user MAY every required permission       (permission gate)
 *   AND the tool identity is canonical           (catalog gate)
 *   AND an executable binding exists,            (execution gate —
 *       when actual execution is requested        discovery may skip it)
 *   AND optional context restrictions allow it   (narrowing — see below)
 *
 * Pure and deterministic: no DB, no network, no provider, no UI state.
 * Denials are typed results with stable reasons, never exceptions. Deny
 * wins; every required capability and every required permission must pass
 * — there is no "primary capability" shortcut, and the full requirement
 * sets are preserved in the decision.
 *
 * Discovery vs execution: `resolveAvailableTools` answers "which canonical
 * tools are relevant/potentially available to this context"; its result is
 * NEVER a durable authorization token. `authorizeToolInvocation` must be
 * re-evaluated for each specific invocation, and (by default) additionally
 * requires an executable binding — an unbound definition is discoverable
 * metadata, never executable.
 *
 * Context (persona / experience / channel / vertical) may only NARROW: it
 * can exclude an otherwise-authorized tool, and can never turn a denied
 * tool into an allowed one — this holds by construction, because narrowing
 * only ever APPENDS a denial reason. AI agents and personas are not
 * security boundaries.
 *
 * READ-ONLY FOUNDATION: no live route consumes these decisions as
 * enforcement yet (the bounded legacy guardrail in
 * `agents/forte/legacy-tool-guardrail.ts` enforces the permission gate
 * only, on the legacy agent executor). Full runtime adoption is AI-05/06.
 */

import { canWorkspace, type MembershipEvidence } from "./access"
import type { CapabilityKey } from "./capabilities"
import { getRolePermissions } from "./role-policy"
import { parseWorkspaceRole } from "./roles"
import { TOOL_CATALOG, TOOL_KEYS, type ToolKey } from "./tool-catalog"
import {
  getToolRequiredPermissions,
  type PlatformToolDefinition,
} from "./tool-definition"
import type { WorkspaceCapabilitySnapshot } from "./workspace-capabilities"

export const TOOL_ACCESS_REASONS = [
  "allowed",
  "unknown_tool",
  "workspace_not_found",
  "workspace_suspended",
  "capability_not_granted",
  "no_membership",
  "unknown_role",
  "permission_denied",
  "tool_not_executable",
  "context_excluded",
] as const
export type ToolAccessReason = (typeof TOOL_ACCESS_REASONS)[number]

/**
 * Optional narrowing context. Each declared dimension may EXCLUDE tools
 * whose `availability` names an allowlist that does not contain the
 * context's value. Absent dimensions restrict nothing; nothing here can
 * grant authority.
 */
export interface ToolNarrowingContext {
  persona?: string
  experience?: string
  channel?: string
  vertical?: string
}

export interface ToolResolutionContext {
  snapshot: WorkspaceCapabilitySnapshot | null
  membership: MembershipEvidence | null
  narrowing?: ToolNarrowingContext
}

export interface ToolAccessDecision {
  readonly allowed: boolean
  /** Stable denial reasons, deduplicated, in gate order. `["allowed"]` iff allowed. */
  readonly reasons: readonly ToolAccessReason[]
  /** The requested key, echoed even when unknown. */
  readonly toolKey: string
  /** Canonical definition when the key is canonical; `null` otherwise. */
  readonly definition: PlatformToolDefinition | null
  /** Full requirement sets — never collapsed to a "primary" entry. */
  readonly requiredCapabilities: readonly CapabilityKey[]
  readonly requiredPermissions: readonly CapabilityKey[]
  /** Requirements that failed their gate (empty when the gate passed). */
  readonly missingCapabilities: readonly CapabilityKey[]
  readonly missingPermissions: readonly CapabilityKey[]
  /** Whether an executable binding exists on the definition. */
  readonly executable: boolean
}

function denied(
  toolKey: string,
  definition: PlatformToolDefinition | null,
  reasons: ToolAccessReason[],
  detail: Partial<
    Pick<
      ToolAccessDecision,
      | "requiredCapabilities"
      | "requiredPermissions"
      | "missingCapabilities"
      | "missingPermissions"
      | "executable"
    >
  > = {},
): ToolAccessDecision {
  return {
    allowed: false,
    reasons: [...new Set(reasons)],
    toolKey,
    definition,
    requiredCapabilities: detail.requiredCapabilities ?? [],
    requiredPermissions: detail.requiredPermissions ?? [],
    missingCapabilities: detail.missingCapabilities ?? [],
    missingPermissions: detail.missingPermissions ?? [],
    executable: detail.executable ?? false,
  }
}

function isCanonicalToolKey(value: string): value is ToolKey {
  return (TOOL_KEYS as readonly string[]).includes(value)
}

/** Pure narrowing predicate (exported for tests; only ever EXCLUDES). */
export function contextExcludes(
  definition: PlatformToolDefinition,
  narrowing: ToolNarrowingContext | undefined,
): boolean {
  if (!narrowing || !definition.availability) return false
  const dimensions: Array<[string | undefined, readonly string[] | undefined]> = [
    [narrowing.persona, definition.availability.personas],
    [narrowing.experience, definition.availability.experiences],
    [narrowing.channel, definition.availability.channels],
    [narrowing.vertical, definition.availability.verticals],
  ]
  return dimensions.some(
    ([value, allowlist]) => value !== undefined && allowlist !== undefined && !allowlist.includes(value),
  )
}

/**
 * Authorize one specific tool invocation. Fail-closed on every gate; deny
 * wins; all required capabilities AND all required permissions must pass.
 * `requireExecutable` defaults to true (execution semantics); discovery
 * passes false to inspect unbound definitions as metadata.
 */
export function authorizeToolInvocation(
  context: ToolResolutionContext,
  toolKey: string,
  options?: { requireExecutable?: boolean },
): ToolAccessDecision {
  const requireExecutable = options?.requireExecutable ?? true

  if (!isCanonicalToolKey(toolKey)) {
    return denied(toolKey, null, ["unknown_tool"])
  }
  const definition: PlatformToolDefinition = TOOL_CATALOG[toolKey]
  const requiredCapabilities = definition.requiresCapabilities
  const requiredPermissions = getToolRequiredPermissions(definition)
  const executable = definition.handler.kind === "reference"

  const reasons: ToolAccessReason[] = []

  // Gate 1 — workspace CAN: every required capability must pass canWorkspace.
  const missingCapabilities: CapabilityKey[] = []
  for (const capability of requiredCapabilities) {
    const decision = canWorkspace(context.snapshot, capability)
    if (decision.allowed) continue
    if (decision.reason === "capability_not_granted") {
      missingCapabilities.push(capability)
      reasons.push("capability_not_granted")
    } else if (
      decision.reason === "workspace_not_found" ||
      decision.reason === "workspace_suspended"
    ) {
      reasons.push(decision.reason)
    } else {
      // unknown_capability from a canonical definition is a contradictory
      // catalog state — fail closed as an unknown tool identity.
      reasons.push("unknown_tool")
    }
  }

  // Gate 2 — user MAY: every required permission must be in the role's set.
  const missingPermissions: CapabilityKey[] = []
  if (!context.membership) {
    reasons.push("no_membership")
  } else {
    const role = parseWorkspaceRole(context.membership.role)
    if (!role) {
      reasons.push("unknown_role")
    } else {
      const permissions = getRolePermissions(role)
      for (const permission of requiredPermissions) {
        if (!permissions.has(permission)) {
          missingPermissions.push(permission)
          reasons.push("permission_denied")
        }
      }
    }
  }

  // Gate 3 — executable binding (execution semantics only).
  if (requireExecutable && !executable) {
    reasons.push("tool_not_executable")
  }

  // Gate 4 — narrowing: may only append a denial, never remove one.
  if (contextExcludes(definition, context.narrowing)) {
    reasons.push("context_excluded")
  }

  if (reasons.length > 0) {
    return denied(toolKey, definition, reasons, {
      requiredCapabilities,
      requiredPermissions,
      missingCapabilities,
      missingPermissions,
      executable,
    })
  }

  return {
    allowed: true,
    reasons: ["allowed"],
    toolKey,
    definition,
    requiredCapabilities,
    requiredPermissions,
    missingCapabilities: [],
    missingPermissions: [],
    executable,
  }
}

export interface ToolResolutionResult {
  /**
   * Canonical tools this context may use, as metadata (binding not
   * required). NOT a durable authorization token — re-authorize with
   * `authorizeToolInvocation` at the moment of each execution.
   */
  readonly discoverable: readonly ToolAccessDecision[]
  /** The subset of `discoverable` that also has an executable binding. */
  readonly executable: readonly ToolAccessDecision[]
}

/**
 * Resolve the canonical tools available to a context (discovery). Iterates
 * the whole catalog and evaluates each tool without the executable-binding
 * requirement, so unbound definitions surface as discoverable metadata but
 * are never reported executable.
 */
export function resolveAvailableTools(context: ToolResolutionContext): ToolResolutionResult {
  const discoverable: ToolAccessDecision[] = []
  for (const key of TOOL_KEYS) {
    const decision = authorizeToolInvocation(context, key, { requireExecutable: false })
    if (decision.allowed) discoverable.push(decision)
  }
  return {
    discoverable,
    executable: discoverable.filter((decision) => decision.executable),
  }
}
