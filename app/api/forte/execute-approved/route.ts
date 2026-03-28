import { NextRequest } from "next/server"
import { handleError, successResponse, errorResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { createForteContext } from "@/agents/forte/runtime/forte-context"
import { executeApprovedPlan } from "@/agents/forte/runtime/approved-execution-service"
import { getForteApprovalStore } from "@/agents/forte/runtime/store-provider"

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session, wsRole } = await requireWriteAccess(request)
    const body = await request.json()

    const { planId, tenantId } = body as {
      planId?: string
      tenantId?: string
    }

    if (!planId || typeof planId !== "string") {
      return errorResponse("VALIDATION", "planId es obligatorio", 400)
    }

    if (!tenantId || typeof tenantId !== "string") {
      return errorResponse("VALIDATION", "tenantId es obligatorio", 400)
    }

    const context = createForteContext({
      tenantId,
      workspaceId,
      userId: session.userId,
      wsRole,
      surface: "assistant",
      requestId: request.headers.get("x-request-id") ?? undefined,
    })

    const store = getForteApprovalStore()
    const result = await executeApprovedPlan({ planId, context }, store)

    return successResponse(result, {
      surface: "forte-execute-approved",
      workspaceId,
    })
  } catch (error) {
    return handleError(error, "Forte Execute Approved")
  }
}
