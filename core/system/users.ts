import { db } from "@core/db"

/**
 * Public shape for the SevenF System Admin users directory.
 *
 * EXPLICIT WHITELIST. Same discipline as `core/system/workspaces.ts`: every
 * field listed here was vetted as non-sensitive platform metadata. Adding
 * anything else requires an explicit code change AND a re-audit.
 *
 * Excluded by design:
 *   - `User.role` legacy (admin/editor/viewer global). It conflates with
 *     platform-level RBAC; we deliberately omit it from this view to avoid
 *     reinforcing the legacy concept. Workspace-level role lives in the
 *     membership rows below.
 *   - `User.lastLogin`            (sensitive privacy data)
 *   - `User.isPrivate`            (per-tenant visibility flag)
 *   - `User.visibleProjects`      (per-tenant visibility list)
 *   - `User.workspaceId`          (legacy single-workspace pointer; replaced
 *                                  by `WorkspaceMember[]` below)
 *   - PlatformAdmin createdBy / createdAt of the row (not interesting at
 *     the listing level — surface in a future detail view if needed)
 */
export interface SystemUserMembershipSummary {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  role: string
}

export interface SystemUserSummary {
  id: string
  nombre: string | null
  email: string
  avatar: string | null
  createdAt: string
  platformRole: string | null
  workspaceMemberships: SystemUserMembershipSummary[]
}

/**
 * List every user in the platform, with safe identity + workspace memberships.
 *
 * MUST be called only after `requirePlatformRole(...)`. This function does
 * NOT itself authenticate — it's a pure data accessor — so a misuse from a
 * non-platform context would leak the user directory. Reviewers: keep call
 * sites minimal and always behind a platform gate.
 *
 * Strategy:
 *   - Single query with nested `select` for `platformAdmin` and `memberships`
 *     (with `workspace` whitelist). Prisma resolves this in a small number
 *     of joined queries — N+1 free.
 *   - Order by `createdAt asc` so the listing is stable across reloads.
 */
export async function listUsersForSystem(): Promise<SystemUserSummary[]> {
  const rows = await db.user.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      avatar: true,
      createdAt: true,
      platformAdmin: {
        select: { role: true },
      },
      memberships: {
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              nombre: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return rows.map((u) => ({
    id: u.id,
    nombre: u.nombre ?? null,
    email: u.email,
    avatar: u.avatar ?? null,
    createdAt: u.createdAt.toISOString(),
    platformRole: u.platformAdmin?.role ?? null,
    workspaceMemberships: u.memberships.map((m) => ({
      workspaceId: m.workspace.id,
      workspaceName: m.workspace.nombre,
      workspaceSlug: m.workspace.slug,
      role: m.role,
    })),
  }))
}
