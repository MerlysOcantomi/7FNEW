import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
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
    const assignedTo = searchParams.get("assignedTo") ?? undefined

    const [{ data, total, leads, urgent }, wsResolved] = await Promise.all([
      listConversations({
        workspaceId,
        skip,
        take: pageSize,
        status,
        channel,
        urgency,
        q,
        assignedTo,
      }),
      getWorkspaceWithResolvedConfig(workspaceId),
    ])

    if (process.env.NODE_ENV === "development") {
      const rows = data as Array<{ id?: string; status?: string }>
      const statusSample = [...new Set(rows.map((r) => r.status).filter(Boolean))]
      console.log("[inbox:audit:list]", {
        workspaceId,
        queryParams: Object.fromEntries(searchParams.entries()),
        appliedToService: {
          status,
          channel,
          urgency,
          q,
          assignedTo,
          skip,
          take: pageSize,
        },
        page,
        pageSize,
        returnedRows: rows.length,
        total,
        leads,
        urgent,
        sampleIds: rows.slice(0, 8).map((r) => r.id),
        sampleStatuses: statusSample.slice(0, 20),
      })
    }

    return successResponse(
      data.map((record) => parseConversationJsonFields(record)),
      {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        leads,
        urgent,
        locale: wsResolved?.locale ?? "en",
      },
    )
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[inbox:audit:list]", {
        phase: "catch",
        message: error instanceof Error ? error.message : String(error),
      })
    }
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
          pageSize: 50,
          total: 0,
          totalPages: 0,
          leads: 0,
          urgent: 0,
        })
      }
    }
    return handleError(error, "Conversation")
  }
}
