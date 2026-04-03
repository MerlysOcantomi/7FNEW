import { NextRequest } from "next/server"
import { handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { session, workspaceId } = await requireReadAccess(request)
    const userId = session.userId

    const newCount = await db.conversation.count({
      where: {
        workspaceId,
        status: "new",
      },
    })

    const assignedUnseen = await db.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt
       FROM Conversation c
       LEFT JOIN ConversationRead cr
         ON cr.conversationId = c.id AND cr.userId = ?
       WHERE c.workspaceId = ?
         AND c.assignedTo = ?
         AND c.status NOT IN ('closed', 'archived', 'new')
         AND (cr.lastSeenAt IS NULL OR c.lastMessageAt > cr.lastSeenAt)`,
      userId,
      workspaceId,
      userId,
    )

    const leadUnseen = await db.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt
       FROM Conversation c
       LEFT JOIN ConversationRead cr
         ON cr.conversationId = c.id AND cr.userId = ?
       WHERE c.workspaceId = ?
         AND c.status = 'lead_detected'
         AND c.assignedTo IS NULL
         AND (cr.lastSeenAt IS NULL OR c.lastMessageAt > cr.lastSeenAt)`,
      userId,
      workspaceId,
    )

    const assignedCount = Number(assignedUnseen[0]?.cnt ?? 0)
    const leadCount = Number(leadUnseen[0]?.cnt ?? 0)
    const total = newCount + assignedCount + leadCount

    return successResponse({ total, breakdown: { new: newCount, assignedUnseen: assignedCount, leadUnseen: leadCount } })
  } catch (error) {
    return handleError(error, "AttentionCount")
  }
}
