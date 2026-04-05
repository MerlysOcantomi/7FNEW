import { db } from "@core/db"

export type NotificationType =
  | "tarea_asignada"
  | "tarea_vencida"
  | "tarea_estado"
  | "proyecto_actualizado"
  | "proyecto_estado"
  | "factura_creada"
  | "factura_vencida"
  | "documento_subido"
  | "comentario_nuevo"
  | "mencion"
  | "sistema"
  | "inbox_nueva_conversacion"
  | "inbox_nuevo_mensaje"
  | "inbox_asignacion"

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message?: string
  link?: string
  workspaceId?: string
}

export async function createNotification(input: CreateNotificationInput) {
  if (!input.workspaceId) {
    throw new Error("workspaceId es requerido para crear notificaciones")
  }

  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      link: input.link ?? null,
      workspaceId: input.workspaceId,
    },
  })
}

export async function createNotificationForRole(
  role: "admin" | "editor",
  type: NotificationType,
  title: string,
  message?: string,
  link?: string,
  excludeUserId?: string,
  workspaceId?: string
) {
  if (!workspaceId) {
    throw new Error("workspaceId es requerido para notificaciones por rol")
  }

  const wsId = workspaceId
  const roles = role === "admin" ? ["admin"] : ["admin", "editor"]

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: wsId },
    include: { user: { select: { id: true, role: true } } },
  })

  const targetUsers = members
    .map((m) => m.user)
    .filter((u) => roles.includes(u.role))
    .filter((u) => !excludeUserId || u.id !== excludeUserId)

  if (targetUsers.length === 0) return []

  return db.notification.createMany({
    data: targetUsers.map((u) => ({
      userId: u.id,
      type,
      title,
      message: message ?? null,
      link: link ?? null,
      workspaceId: wsId,
    })),
  })
}

export async function notifyAdminsAndEditors(
  type: NotificationType,
  title: string,
  message?: string,
  link?: string,
  excludeUserId?: string,
  workspaceId?: string
) {
  return createNotificationForRole("editor", type, title, message, link, excludeUserId, workspaceId)
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, read: false },
  })
}
