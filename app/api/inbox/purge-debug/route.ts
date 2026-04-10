import { NextRequest } from "next/server"
import { successResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)

    const debugConversations = await db.conversation.findMany({
      where: {
        workspaceId,
        OR: [
          { source: "debug" },
          { contact: { email: { contains: "@debug.local" } } },
          { contact: { email: { contains: "@ejemplo.com" } } },
          { contact: { nombre: "Test Visitor" } },
        ],
      },
      select: { id: true, subject: true, source: true },
    })

    const deleted: string[] = []

    for (const conv of debugConversations) {
      await db.$transaction(async (tx) => {
        await tx.conversationRead.deleteMany({ where: { conversationId: conv.id } })
        await tx.message.deleteMany({ where: { conversationId: conv.id } })
        await tx.conversationAction.deleteMany({ where: { conversationId: conv.id } })
        await tx.conversationDraft.deleteMany({ where: { conversationId: conv.id } })
        await tx.aIClassification.deleteMany({ where: { conversationId: conv.id } })
        await tx.conversationHandoff.deleteMany({ where: { conversationId: conv.id } })
        await tx.inboxEntry.updateMany({ where: { conversationId: conv.id }, data: { conversationId: null } })
        await tx.conversation.delete({ where: { id: conv.id } })
      })
      deleted.push(`${conv.id} (${conv.subject?.slice(0, 40)})`)
    }

    // Also clean orphaned debug contacts
    const deletedContacts = await db.contact.deleteMany({
      where: {
        workspaceId,
        conversations: { none: {} },
        OR: [
          { email: { contains: "@debug.local" } },
          { email: { contains: "@ejemplo.com" } },
          { nombre: "Test Visitor" },
          { source: { startsWith: "debug_" } },
        ],
      },
    })

    return successResponse({
      deletedConversations: deleted,
      deletedOrphanedContacts: deletedContacts.count,
      remaining: await db.conversation.count({
        where: {
          workspaceId,
          OR: [
            { source: "debug" },
            { contact: { email: { contains: "@debug.local" } } },
            { contact: { email: { contains: "@ejemplo.com" } } },
          ],
        },
      }),
    })
  } catch (error) {
    return handleError(error, "PurgeDebug")
  }
}
