/**
 * Mr Forte Lab — fixed synthetic demo identity (DEV-PREVIEW-01C).
 *
 * Stable internal identifiers for the ONE demo user + workspace the Lab DB is
 * allowed to contain. Everything is synthetic: the email uses the reserved
 * `.invalid` TLD (RFC 2606) so it can never route to a real person, and the
 * user is never a platform admin.
 *
 * Two role systems exist in this repo and must not be conflated:
 *   - `User.role` (legacy, gates pages in `middleware.ts`): the demo user is
 *     `editor`, so `/finanzas`, `/calendario`, … are reachable. This is the
 *     "editor" from the approved D5 decision and the role stamped into the
 *     normal session JWT.
 *   - `WorkspaceMember.role` (canonical RBAC, `core/auth/workspace-auth.ts`
 *     uses OWNER/ADMIN/MEMBER/VIEWER): the demo membership is `ADMIN`, giving
 *     full interaction inside the isolated, reset-able demo workspace.
 */

export const LAB_DEMO_IDENTITY = {
  userId: "lab-preview-user",
  userEmail: "lab-preview@sevenef.invalid",
  workspaceId: "lab-preview-workspace",
  workspaceSlug: "finesse-preview",
  workspaceName: "Finesse Preview Salon",
  verticalKey: "beauty",
  vertical: "beauty",
  /** `User.role` → JWT `role` claim (middleware gating). */
  sessionRole: "editor",
  /** `WorkspaceMember.role` (canonical workspace RBAC). */
  membershipRole: "ADMIN",
} as const

/**
 * Minimum row counts, per surface, that a provisioned demo workspace must
 * hold for `assessLabDemoEnvironment` to consider the dataset present. Kept at
 * "≥ 1 where the surface needs content" so the check tracks real coverage
 * without pinning exact Finesse-seed totals.
 */
export const LAB_DEMO_DATASET_MINIMUMS = {
  clients: 1, // Clients + Today + Calendar contacts
  events: 1, // Calendar / appointments
  conversations: 1, // Inbox
  messages: 1, // Inbox
  invoices: 1, // Finance
  workspaceTasks: 1, // Today / Tasks lanes
} as const

/** Only these synthetic user ids may exist in the Lab demo database. */
export const LAB_DEMO_ALLOWED_USER_IDS: readonly string[] = [LAB_DEMO_IDENTITY.userId]

/** Exactly one workspace is permitted in the Lab demo database. */
export const LAB_DEMO_MAX_WORKSPACES = 1
