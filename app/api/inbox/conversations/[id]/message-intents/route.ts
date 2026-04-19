import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { listMessageShortIntents } from "@modules/inbox/service"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const { id } = await params

    const conversation = await db.conversation.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    })
    if (!conversation) return errorResponse("NOT_FOUND", "Conversation not found", 404)

    const data = await listMessageShortIntents(id, workspaceId)
    return successResponse(data)
  } catch (error) {
    return handleError(error, "MessageIntents")
  }
}
