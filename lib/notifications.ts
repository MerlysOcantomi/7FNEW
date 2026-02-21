import { db } from "@/lib/db"

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

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message?: string
  link?: string
}

export async function createNotification(input: CreateNotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      link: input.link ?? null,
    },
  })
}

export async function createNotificationForRole(
  role: "admin" | "editor",
  type: NotificationType,
  title: string,
  message?: string,
  link?: string,
  excludeUserId?: string
) {
  const roles = role === "admin" ? ["admin"] : ["admin", "editor"]
  const users = await db.user.findMany({
    where: {
      role: { in: roles },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  })

  if (users.length === 0) return []

  return db.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type,
      title,
      message: message ?? null,
      link: link ?? null,
    })),
  })
}

export async function notifyAdminsAndEditors(
  type: NotificationType,
  title: string,
  message?: string,
  link?: string,
  excludeUserId?: string
) {
  return createNotificationForRole("editor", type, title, message, link, excludeUserId)
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, read: false },
  })
}
