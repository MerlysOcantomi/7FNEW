import { getSessionFromCookies, type SessionUser } from "@core/auth/session"
import { resolveRequiredWorkspace, type WorkspaceResolveSource } from "@core/workspace-context"
import { checkMembership } from "@core/workspace"

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

const WS_ROLE_LEVEL: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

const HEADER_ALLOWLIST = ["/api/ai/agent", "/api/admin"]

export class RbacError extends Error {
  status = 403
  code: string
  constructor(
    code: "INSUFFICIENT_ROLE" | "WRITE_NOT_ALLOWED" | "HEADER_NOT_ALLOWED",
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = "RbacError"
  }
}

export interface WorkspaceAuth {
  session: SessionUser
  workspaceId: string
  wsRole: WorkspaceRole
  /** Origen de `workspaceId` (cookie, primera membresía, header). */
  workspaceResolveSource: WorkspaceResolveSource
}

function isHeaderAllowlisted(req?: Request): boolean {
  if (!req) return false
  try {
    const url = new URL(req.url)
    return HEADER_ALLOWLIST.some((p) => url.pathname.startsWith(p))
  } catch {
    return false
  }
}

export async function requireWorkspaceRole(
  minRole: WorkspaceRole = "VIEWER",
  req?: Request,
): Promise<WorkspaceAuth> {
  const session = await getSessionFromCookies()
  if (!session) {
    const { WorkspaceError } = await import("@core/workspace-context")
    throw new WorkspaceError("UNAUTHORIZED", "No autenticado", 401)
  }

  const headerPresent = !!req?.headers.get("x-workspace-id")
  const headerAllowed = isHeaderAllowlisted(req)
  const effectiveReq = headerPresent && !headerAllowed ? undefined : req

  const { workspaceId, source: workspaceResolveSource } =
    await resolveRequiredWorkspace(effectiveReq)

  const member = await checkMembership(session.userId, workspaceId)
  const wsRole = (member?.role as WorkspaceRole) ?? "VIEWER"

  if (headerPresent && headerAllowed) {
    if (WS_ROLE_LEVEL[wsRole] < WS_ROLE_LEVEL["ADMIN"]) {
      throw new RbacError(
        "HEADER_NOT_ALLOWED",
        "Header x-workspace-id requiere rol ADMIN o superior",
      )
    }
  }

  if (WS_ROLE_LEVEL[wsRole] < WS_ROLE_LEVEL[minRole]) {
    throw new RbacError(
      "INSUFFICIENT_ROLE",
      `Requiere rol ${minRole} o superior en este workspace`,
    )
  }

  return { session, workspaceId, wsRole, workspaceResolveSource }
}

export const requireReadAccess = (req?: Request) =>
  requireWorkspaceRole("VIEWER", req)
export const requireWriteAccess = (req?: Request) =>
  requireWorkspaceRole("MEMBER", req)
export const requireAdminAccess = (req?: Request) =>
  requireWorkspaceRole("ADMIN", req)
export const requireOwnerAccess = (req?: Request) =>
  requireWorkspaceRole("OWNER", req)

/**
 * Strict path-scoped RBAC helper. Validates that the authenticated user has at least
 * `minRole` in the EXACT `workspaceId` passed (typically `params.id` from a route).
 *
 * IMPORTANT — why this exists alongside `requireWorkspaceRole`:
 *   `requireWorkspaceRole` resolves the active workspace from the cookie / header /
 *   first-membership fallback. That is correct for routes whose tenant is implicit
 *   (e.g. `/api/inbox/...`), but it is UNSAFE for `/api/workspaces/[id]/...` routes,
 *   because the cookie's workspace can differ from `params.id`. A user who is
 *   ADMIN/OWNER in workspace A (cookie) but only MEMBER/VIEWER in workspace B can
 *   reach an admin handler on `/api/workspaces/B/...`, pass `requireAdminAccess()`
 *   (which checks role in A, the cookie one), and only get a `checkMembership(_, B)`
 *   existence test afterwards — which a MEMBER/VIEWER passes. That is a real
 *   cross-tenant escalation. This helper closes that gap by validating role in B.
 *
 * Behaviour:
 *   - Requires an authenticated session; throws WorkspaceError(401) otherwise.
 *   - Requires a membership row in `workspaceId`; throws WorkspaceError(403) if missing.
 *   - Requires `member.role >= minRole`; throws RbacError(INSUFFICIENT_ROLE) otherwise.
 *   - Returns the same `WorkspaceAuth` shape as the cookie-based helpers, with
 *     `workspaceId` set to the path param and `workspaceResolveSource = "path-param"`
 *     so call sites can audit how the tenant was decided.
 *
 * Unlike `requireWorkspaceRole`, this helper deliberately ignores the active
 * workspace cookie and the `x-workspace-id` header. Path-scoped routes must NOT
 * trust those.
 */
export async function requireRoleInWorkspace(
  workspaceId: string,
  minRole: WorkspaceRole = "VIEWER",
): Promise<WorkspaceAuth> {
  if (!workspaceId || typeof workspaceId !== "string") {
    const { WorkspaceError } = await import("@core/workspace-context")
    throw new WorkspaceError("VALIDATION_ERROR", "workspaceId es requerido", 400)
  }

  const session = await getSessionFromCookies()
  if (!session) {
    const { WorkspaceError } = await import("@core/workspace-context")
    throw new WorkspaceError("UNAUTHORIZED", "No autenticado", 401)
  }

  const member = await checkMembership(session.userId, workspaceId)
  if (!member) {
    const { WorkspaceError } = await import("@core/workspace-context")
    throw new WorkspaceError("FORBIDDEN", "Sin acceso a este workspace", 403)
  }

  const wsRole = (member.role as WorkspaceRole) ?? "VIEWER"
  const userLevel = WS_ROLE_LEVEL[wsRole]
  if (!userLevel || userLevel < WS_ROLE_LEVEL[minRole]) {
    throw new RbacError(
      "INSUFFICIENT_ROLE",
      `Requiere rol ${minRole} o superior en este workspace`,
    )
  }

  return {
    session,
    workspaceId,
    wsRole,
    workspaceResolveSource: "path-param",
  }
}

export const requireViewerInWorkspace = (workspaceId: string) =>
  requireRoleInWorkspace(workspaceId, "VIEWER")
export const requireMemberInWorkspace = (workspaceId: string) =>
  requireRoleInWorkspace(workspaceId, "MEMBER")
export const requireAdminInWorkspace = (workspaceId: string) =>
  requireRoleInWorkspace(workspaceId, "ADMIN")
export const requireOwnerInWorkspace = (workspaceId: string) =>
  requireRoleInWorkspace(workspaceId, "OWNER")
