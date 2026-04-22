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
