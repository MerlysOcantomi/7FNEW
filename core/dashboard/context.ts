import { db } from "@core/db"
import type { WorkspaceAuth } from "@core/auth/workspace-auth"
import type { DashboardContext } from "./types"

export async function getDashboardContext(auth: WorkspaceAuth): Promise<DashboardContext> {
  const workspace = await db.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: {
      id: true,
      nombre: true,
      slug: true,
    },
  })

  return {
    workspaceId: auth.workspaceId,
    workspaceName: workspace?.nombre ?? "Workspace",
    workspaceSlug: workspace?.slug ?? auth.workspaceId,
    role: auth.wsRole,
  }
}
