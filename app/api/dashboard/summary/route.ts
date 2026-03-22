import { NextRequest } from "next/server"
import { successResponse, handleError } from "@core/api"
import { requireReadAccess } from "@core/auth/workspace-auth"
import { buildDashboardData } from "@core/dashboard"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireReadAccess(request)
    const dashboardData = await buildDashboardData(auth)

    return successResponse(dashboardData, {
      workspaceId: dashboardData.context.workspaceId,
      generatedAt: dashboardData.meta.generatedAt,
    })
  } catch (error) {
    return handleError(error, "Dashboard")
  }
}
