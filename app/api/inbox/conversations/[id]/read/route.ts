import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { session, workspaceId } = await requireWriteAccess(request)
    const { id } = await params

    const conversation = await db.conversation.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    })
    if (!conversation) {
      return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    }

    const read = await db.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: session.userId,
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        conversationId: id,
        userId: session.userId,
        workspaceId,
        lastSeenAt: new Date(),
      },
    })

    return successResponse({ lastSeenAt: read.lastSeenAt })
  } catch (error) {
    return handleError(error, "ConversationRead")
  }
}
