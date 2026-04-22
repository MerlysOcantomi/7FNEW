import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { listConversations, parseConversationJsonFields } from "@modules/inbox/service"

const INBOX_LIST_DEBUG =
  process.env.NODE_ENV === "development" || process.env.INBOX_DEBUG_INBOX_LIST === "1"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, session, workspaceResolveSource } = await requireReadAccess(request)
    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)

    const status = searchParams.get("status") ?? undefined
    const channel = searchParams.get("channel") ?? undefined
    const urgency = searchParams.get("urgency") ?? undefined
    const q = searchParams.get("q")?.trim() || undefined
    const assignedTo = searchParams.get("assignedTo") ?? undefined

    const whereSummary = {
      workspaceId,
      status: status ?? "(none)",
      channel: channel ?? "(none)",
      urgency: urgency ?? "(none)",
      q: q ? "(set)" : "(none)",
      assignedTo: assignedTo ?? "(none)",
    }

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

    if (INBOX_LIST_DEBUG) {
      const rows = data as Array<{ id?: string; status?: string }>
      const statusSample = [...new Set(rows.map((r) => r.status).filter(Boolean))]
      const expected = process.env.INBOX_EXPECTED_WORKSPACE_ID?.trim()
      console.log("[inbox:debug:list]", {
        userId: session.userId,
        workspaceId,
        workspaceResolveSource,
        whereSummary,
        page,
        pageSize,
        returnedRows: rows.length,
        total,
        leads,
        urgent,
        matchesExpectedWorkspaceId: expected ? workspaceId === expected : undefined,
        expectedWorkspaceId: expected || undefined,
        sampleIds: rows.slice(0, 8).map((r) => r.id),
        sampleStatuses: statusSample.slice(0, 20),
        /** Sin valores de `q` (posible PII); solo qué claves llegaron en la query. */
        queryParamKeys: [...searchParams.keys()],
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
    if (INBOX_LIST_DEBUG) {
      console.error("[inbox:debug:list]", {
        phase: "catch",
        message: error instanceof Error ? error.message : String(error),
        code:
          error && typeof error === "object" && "code" in error
            ? (error as { code?: string }).code
            : undefined,
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
        if (INBOX_LIST_DEBUG) {
          console.warn(
            "[inbox:debug:list] NO_WORKSPACE → returning success with empty data[] (inbox will look empty)",
          )
        }
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
