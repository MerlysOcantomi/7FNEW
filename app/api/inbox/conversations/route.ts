import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { listConversations, parseConversationJsonFields } from "@/lib/modules/inbox/service"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)

    const status = searchParams.get("status") ?? undefined
    const channel = searchParams.get("channel") ?? undefined
    const urgency = searchParams.get("urgency") ?? undefined
    const q = searchParams.get("q")?.trim() || undefined

    const { data, total } = await listConversations({
      workspaceId,
      skip,
      take: pageSize,
      status,
      channel,
      urgency,
      q,
    })

    return successResponse(
      data.map((record) => parseConversationJsonFields(record)),
      {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    )
  } catch (error) {
    return handleError(error, "Conversation")
  }
}
