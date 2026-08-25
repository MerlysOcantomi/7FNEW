/**
 * FOUND-02a — Canonical role → permission-set policy.
 *
 * OWNER DECISION (ARCH-02 §11): the permission atom IS the canonical
 * `CapabilityKey`. There is deliberately NO parallel "PermissionKey"
 * namespace — the same stable business key passes through two independent
 * security gates:
 *
 *   Workspace capability   what the WORKSPACE can do (entitlements)
 *   Role permission        which of those capabilities THIS membership role
 *                          may exercise
 *   Effective capability   intersection of both — never a union
 *
 * The separation lives in different sets, different resolution stages and
 * different denial reasons (see `access.ts`), not in a duplicated catalog.
 * A finer permission namespace would be a future explicit owner decision,
 * only if real product evidence shows capability-level granularity is
 * insufficient.
 *
 * The mapping below is DERIVED FROM CURRENT ROUTE THRESHOLDS (evidence per
 * group), not invented: `requireReadAccess` = VIEWER, `requireWriteAccess` =
 * MEMBER, `requireAdminAccess` = ADMIN. Background pipelines (e.g. Fanny
 * ingestion) run as a SYSTEM PRINCIPAL, not through a member role — system-
 * principal permission resolution is documented future work, not implemented
 * here.
 *
 * Read-only policy: nothing in this file is wired as enforcement; current
 * routes keep using the existing RBAC helpers.
 */

import type { CapabilityKey } from "./capabilities"
import { CAPABILITY_KEYS } from "./capabilities"
import type { WorkspaceRole } from "./roles"
import { parseWorkspaceRole } from "./roles"

/**
 * VIEWER — read/safe permissions. Evidence: routes gated by
 * `requireReadAccess` (inbox reads, module list/detail reads, business
 * profile GET, activity history, Ask Fanny / summaries, Finesse voice token).
 */
const VIEWER_PERMISSIONS = [
  "workspace.read",
  "person.read",
  "task.read",
  "profile.read",
  "audit.read",
  "conversation.read",
  "campaign.read",
  "invoice.read",
  "transaction.read",
  "ai.classify",
  "ai.summarize",
  "voice.session",
] as const satisfies readonly CapabilityKey[]

/**
 * MEMBER — VIEWER plus normal operational writes. Evidence: routes gated by
 * `requireWriteAccess` (module CRUD, composer send/assist, conversation
 * conversion, task writes).
 */
const MEMBER_EXTRA = [
  "person.write",
  "task.write",
  "conversation.reply",
  "conversation.convert",
  "campaign.create",
  "content.create",
  "invoice.create",
  "ai.draft",
  "ai.assist",
] as const satisfies readonly CapabilityKey[]

/**
 * ADMIN — MEMBER plus administrative permissions. Evidence: routes gated by
 * `requireAdminAccess` (business profile PATCH, team/usuarios management,
 * channel administration); site publishing grouped as administrative until
 * Presence ships public routes.
 */
const ADMIN_EXTRA = [
  "workspace.settings",
  "profile.write",
  "member.read",
  "channel.connect",
  "channel.manage",
  "site.publish",
  "site.manage",
] as const satisfies readonly CapabilityKey[]

const VIEWER_SET: ReadonlySet<CapabilityKey> = new Set(VIEWER_PERMISSIONS)
const MEMBER_SET: ReadonlySet<CapabilityKey> = new Set([...VIEWER_PERMISSIONS, ...MEMBER_EXTRA])
const ADMIN_SET: ReadonlySet<CapabilityKey> = new Set([
  ...VIEWER_PERMISSIONS,
  ...MEMBER_EXTRA,
  ...ADMIN_EXTRA,
])
/**
 * OWNER may exercise every declared capability — but an owner still cannot
 * bypass a capability the Workspace does not have (intersection rule).
 * Documented exception to strict growth: today OWNER's set equals ADMIN's,
 * because no current route enforces an OWNER-exclusive threshold
 * (`requireOwnerAccess` exists but is unused). Future owner-only
 * capabilities (e.g. billing/danger operations) will separate them.
 */
const OWNER_SET: ReadonlySet<CapabilityKey> = new Set(CAPABILITY_KEYS)

const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, ReadonlySet<CapabilityKey>>> = {
  OWNER: OWNER_SET,
  ADMIN: ADMIN_SET,
  MEMBER: MEMBER_SET,
  VIEWER: VIEWER_SET,
}

const EMPTY_PERMISSIONS: ReadonlySet<CapabilityKey> = new Set()

/**
 * Permission set for a role. Accepts untrusted role input; an unknown/corrupt
 * role resolves to NO permissions (fail closed). Returned sets are shared and
 * readonly — never mutate them.
 */
export function getRolePermissions(role: string | null | undefined): ReadonlySet<CapabilityKey> {
  const parsed = parseWorkspaceRole(role)
  return parsed ? ROLE_PERMISSIONS[parsed] : EMPTY_PERMISSIONS
}

/** Whether this role may exercise the capability (permission gate only). */
export function roleMay(role: string | null | undefined, capability: CapabilityKey): boolean {
  return getRolePermissions(role).has(capability)
}

/**
 * Effective allowed capabilities = workspace capabilities ∩ role
 * permissions. A pure intersection: it can only remove, never add — no role
 * (OWNER included) manufactures a capability the workspace does not have.
 */
export function resolveEffectiveCapabilities(
  workspaceCapabilities: ReadonlySet<CapabilityKey>,
  rolePermissions: ReadonlySet<CapabilityKey>,
): ReadonlySet<CapabilityKey> {
  const effective = new Set<CapabilityKey>()
  for (const capability of workspaceCapabilities) {
    if (rolePermissions.has(capability)) effective.add(capability)
  }
  return effective
}
