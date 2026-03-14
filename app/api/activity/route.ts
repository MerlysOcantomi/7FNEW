import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { createNotification } from "@/lib/notifications"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const module = searchParams.get("module")
    const recordId = searchParams.get("recordId")
    const type = searchParams.get("type")
    const search = searchParams.get("search")?.trim()
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))

    // Modo global: sin module/recordId → listado por workspace
    if (!module || !recordId) {
      const where: Record<string, unknown> = { workspaceId }
      if (module) where.module = module
      if (type) where.type = type

      let activities = await db.activity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      })

      if (search && activities.length > 0) {
        const q = search.toLowerCase()
        activities = activities.filter((a) => {
          const data = a.data ? JSON.parse(a.data) : null
          const label = String(data?.label ?? "").toLowerCase()
          const comment = String(data?.comment ?? "").toLowerCase()
          const userName = String(a.userName ?? "").toLowerCase()
          const userEmail = String(a.userEmail ?? "").toLowerCase()
          return label.includes(q) || comment.includes(q) || userName.includes(q) || userEmail.includes(q)
        })
      }

      const parsed = activities.map((a) => ({
        ...a,
        data: a.data ? JSON.parse(a.data) : null,
      }))
      return successResponse(parsed)
    }

    // Modo por entidad: module + recordId
    const activities = await db.activity.findMany({
      where: { module, recordId, workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    const parsed = activities.map((a) => ({
      ...a,
      data: a.data ? JSON.parse(a.data) : null,
    }))

    return successResponse(parsed)
  } catch (error) {
    return handleError(error, "Activity")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const body = await request.json()
    const { module, recordId, comment, mentions } = body

    if (!module || !recordId || !comment?.trim()) {
      return errorResponse("VALIDATION_ERROR", "module, recordId y comment son requeridos")
    }

    const mentionedEmails: string[] = []
    const mentionRegex = /@(\S+)/g
    let match
    while ((match = mentionRegex.exec(comment)) !== null) {
      mentionedEmails.push(match[1])
    }

    const activity = await logActivity({
      module,
      recordId,
      type: "comment",
      data: {
        comment: comment.trim(),
        mentions: mentions ?? mentionedEmails,
      },
      userId: session.userId,
      userName: session.nombre ?? session.email,
      userEmail: session.email,
      workspaceId,
    })

    const allMentions = [...new Set([...(mentions ?? []), ...mentionedEmails])]
    if (allMentions.length > 0) {
      const memberUserIds = await db.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      })
      const users = memberUserIds.length > 0
        ? await db.user.findMany({
            where: {
              id: { in: memberUserIds.map((m) => m.userId) },
              OR: [
                { email: { in: allMentions } },
                { nombre: { in: allMentions } },
              ],
            },
            select: { id: true, email: true },
          })
        : []

      for (const u of users) {
        if (u.id === session.userId) continue
        createNotification({
          userId: u.id,
          type: "mencion",
          title: `${session.nombre ?? session.email} te mencionó`,
          message: comment.trim().slice(0, 120),
          link: `/${module}/${recordId}`,
          workspaceId,
        }).catch(() => {})
      }
    }

    return successResponse({
      ...activity,
      data: activity.data ? JSON.parse(activity.data) : null,
    })
  } catch (error) {
    return handleError(error, "Activity")
  }
}
