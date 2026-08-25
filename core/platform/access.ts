/**
 * FOUND-02a — Read-only access decisions (ARCH-02 §2 resolution chain).
 *
 * `canWorkspace()` and `canUser()` answer, with an explicit reason, whether a
 * capability is available — Workspace gate first (entitlement/capability),
 * user gate second (membership → role permission). Deny wins; nothing later
 * can re-allow. All inputs are treated as untrusted (capability and role
 * arrive as plain strings and are strictly validated).
 *
 * READ-ONLY: no route, UI or AI tool consumes these decisions as enforcement
 * in this mission — current APIs keep using the existing RBAC helpers
 * (`requireReadAccess` / `requireWriteAccess` / …). Tests may call them.
 *
 * Note on `workspace_suspended`: `Workspace.status` is observational today
 * (see `core/system/workspace-status.ts`); this resolver REPORTS suspension
 * as a denial reason, which is the fail-closed posture enforcement will
 * adopt. Because nothing is wired, reporting it changes no current behavior.
 */

import { CAPABILITY_KEYS, type CapabilityKey } from "./capabilities"
import { getRolePermissions } from "./role-policy"
import { parseWorkspaceRole } from "./roles"
import type { WorkspaceCapabilitySnapshot } from "./workspace-capabilities"

export const ACCESS_DECISION_REASONS = [
  "allowed",
  "workspace_not_found",
  "workspace_suspended",
  "no_membership",
  "unknown_role",
  "unknown_capability",
  "capability_not_granted",
  "permission_denied",
] as const
export type AccessDecisionReason = (typeof ACCESS_DECISION_REASONS)[number]

export interface AccessDecision {
  readonly allowed: boolean
  readonly reason: AccessDecisionReason
}

const ALLOWED: AccessDecision = { allowed: true, reason: "allowed" }

function deny(reason: Exclude<AccessDecisionReason, "allowed">): AccessDecision {
  return { allowed: false, reason }
}

const CAPABILITY_SET = new Set<string>(CAPABILITY_KEYS)

function isCapabilityKey(value: string): value is CapabilityKey {
  return CAPABILITY_SET.has(value)
}

/** Minimal membership evidence the caller loads (or `null` when absent). */
export interface MembershipEvidence {
  /** Raw `WorkspaceMember.role` string — validated strictly here. */
  readonly role: string | null | undefined
}

/**
 * Workspace gate: does the WORKSPACE have this capability? (ARCH-02 §2
 * steps 1–2). Fail closed on missing workspace, suspension/archival and
 * unknown capability keys.
 */
export function canWorkspace(
  snapshot: WorkspaceCapabilitySnapshot | null,
  capability: string,
): AccessDecision {
  if (!snapshot || !snapshot.workspaceId) return deny("workspace_not_found")
  if (snapshot.status === "suspended" || snapshot.status === "archived") {
    return deny("workspace_suspended")
  }
  if (!isCapabilityKey(capability)) return deny("unknown_capability")
  if (!snapshot.capabilities.has(capability)) return deny("capability_not_granted")
  return ALLOWED
}

/**
 * Full read-only decision: Workspace CAN and user MAY (ARCH-02 §2 steps
 * 1–4, context step excluded until tool execution exists). The workspace
 * gate always runs first; a role/permission can never repair a missing
 * workspace capability.
 */
export function canUser(
  snapshot: WorkspaceCapabilitySnapshot | null,
  membership: MembershipEvidence | null,
  capability: string,
): AccessDecision {
  const workspaceDecision = canWorkspace(snapshot, capability)
  if (!workspaceDecision.allowed) return workspaceDecision

  if (!membership) return deny("no_membership")
  const role = parseWorkspaceRole(membership.role)
  if (!role) return deny("unknown_role")
  if (!getRolePermissions(role).has(capability as CapabilityKey)) {
    return deny("permission_denied")
  }
  return ALLOWED
}
