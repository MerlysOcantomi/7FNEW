/**
 * FOUND-02a — Canonical workspace role vocabulary.
 *
 * Single source of truth for the four workspace roles (`WorkspaceMember.role`
 * values). `core/auth/workspace-auth.ts` re-exports these so existing imports
 * keep working; do not declare parallel role unions in other modules.
 *
 * Strictness rule (fail closed): a role string that is not exactly one of the
 * four canonical values parses to `null`. Missing membership or an
 * unknown/corrupt role must always DENY — never fall back to VIEWER.
 *
 * The Prisma `WorkspaceMember.role` column stays a plain String in this
 * mission; strict parsing at the boundary is the guard.
 */

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

/**
 * Ladder used by the existing RBAC helpers (min-role checks). Kept as
 * metadata for compatibility; the permission POLICY lives in
 * `role-policy.ts`, not in this number.
 */
export const WORKSPACE_ROLE_LEVELS: Readonly<Record<WorkspaceRole, number>> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && (WORKSPACE_ROLES as readonly string[]).includes(value)
}

/** Strict parse: canonical role or `null`. Never coerces, never defaults. */
export function parseWorkspaceRole(value: unknown): WorkspaceRole | null {
  return isWorkspaceRole(value) ? value : null
}
