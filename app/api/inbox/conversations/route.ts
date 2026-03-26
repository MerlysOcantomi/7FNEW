import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { listConversations, parseConversationJsonFields } from "@modules/inbox/service"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
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
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "WorkspaceError"
    ) {
      const workspaceError = error as { code?: string }
      if (workspaceError.code === "NO_WORKSPACE") {
        return successResponse([], {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
          emptyState: "workspace-unavailable",
        })
      }
    }
    return handleError(error, "Conversation")
  }
}
