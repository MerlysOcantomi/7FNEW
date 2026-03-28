import { NextRequest } from "next/server"
import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import {
  buildForteRecommendationResponse,
  forteRecommendationRequestSchema,
  getForteRecommendationSurfaceInfo,
} from "@/agents/forte/phase2"
import { createForteContext } from "@/agents/forte/runtime"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, session, wsRole } = await requireReadAccess(request)
    const forteContext = createForteContext({
      tenantId: request.headers.get("x-tenant-id") ?? workspaceId,
      workspaceId,
      userId: session.userId,
      wsRole,
      surface: "recommend",
      requestId: request.headers.get("x-request-id") ?? undefined,
    })

    return successResponse(await getForteRecommendationSurfaceInfo(forteContext), {
      surface: "forte-phase2",
      contract: "pilot-v1",
    })
  } catch (error) {
    return handleError(error, "Forte Recommendation")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session, wsRole } = await requireReadAccess(request)
    const body = await request.json()
    const data = forteRecommendationRequestSchema.parse(body)
    const forteContext = createForteContext({
      tenantId: request.headers.get("x-tenant-id") ?? workspaceId,
      workspaceId,
      userId: session.userId,
      wsRole,
      surface: "recommend",
      requestId: request.headers.get("x-request-id") ?? undefined,
    })
    const response = await buildForteRecommendationResponse(data, forteContext)

    return successResponse(response, {
      surface: "forte-phase2",
      contract: "pilot-v1",
      workspaceId,
    })
  } catch (error) {
    return handleError(error, "Forte Recommendation")
  }
}
