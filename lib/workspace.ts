import { db } from "@/lib/db"

export const DEFAULT_WORKSPACE_ID = "ws_default"
export const DEFAULT_WORKSPACE_SLUG = "default"

/**
 * Returns the default workspace, creating it if it doesn't exist.
 * Used as fallback when no workspace context is available.
 */
export async function getOrCreateDefaultWorkspace() {
  const existing = await db.workspace.findUnique({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
  })
  if (existing) return existing

  return db.workspace.create({
    data: {
      id: DEFAULT_WORKSPACE_ID,
      nombre: "Default Workspace",
      slug: DEFAULT_WORKSPACE_SLUG,
      vertical: "creative-agency",
    },
  })
}

/**
 * Resolves the active workspaceId for a query.
 * For now returns DEFAULT_WORKSPACE_ID as a safe fallback.
 * Will be replaced with session-based resolution in Step 4.
 */
export function getActiveWorkspaceId(): string {
  return DEFAULT_WORKSPACE_ID
}

/**
 * Builds a Prisma where-clause filter scoped to a workspace.
 * If workspaceId is null, returns empty object (no filtering) for backwards compat.
 */
export function workspaceFilter(workspaceId: string | null): { workspaceId?: string } {
  if (!workspaceId) return {}
  return { workspaceId }
}
