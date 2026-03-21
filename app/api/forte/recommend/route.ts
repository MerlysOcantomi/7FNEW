import { NextRequest } from "next/server"
import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import {
  buildForteRecommendationResponse,
  forteRecommendationRequestSchema,
  getForteRecommendationSurfaceInfo,
} from "@/agents/forte/phase2"

export async function GET() {
  try {
    await requireReadAccess()
    return successResponse(getForteRecommendationSurfaceInfo(), {
      surface: "forte-phase2",
      contract: "pilot-v1",
    })
  } catch (error) {
    return handleError(error, "Forte Recommendation")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const body = await request.json()
    const data = forteRecommendationRequestSchema.parse(body)
    const response = buildForteRecommendationResponse(data)

    return successResponse(response, {
      surface: "forte-phase2",
      contract: "pilot-v1",
      workspaceId,
    })
  } catch (error) {
    return handleError(error, "Forte Recommendation")
  }
}
