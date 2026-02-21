import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"

export type ActivityType =
  | "created"
  | "updated"
  | "deleted"
  | "status_change"
  | "assigned"
  | "unassigned"
  | "relation_added"
  | "relation_removed"
  | "comment"
  | "mention"

export interface ActivityData {
  field?: string
  oldValue?: unknown
  newValue?: unknown
  comment?: string
  mentions?: string[]
  label?: string
  [key: string]: unknown
}

interface LogActivityInput {
  module: string
  recordId: string
  type: ActivityType
  data?: ActivityData
  userId?: string
  userName?: string
  userEmail?: string
}

export async function logActivity(input: LogActivityInput) {
  let { userId, userName, userEmail } = input

  if (!userId) {
    try {
      const session = await getSessionFromCookies()
      if (session) {
        userId = session.userId
        userName = session.nombre ?? session.email
        userEmail = session.email
      }
    } catch {
      /* no session available */
    }
  }

  return db.activity.create({
    data: {
      module: input.module,
      recordId: input.recordId,
      type: input.type,
      userId: userId ?? null,
      userName: userName ?? null,
      userEmail: userEmail ?? null,
      data: input.data ? JSON.stringify(input.data) : null,
    },
  })
}

export function detectChanges(
  previous: Record<string, unknown>,
  updated: Record<string, unknown>,
  trackedFields: string[]
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = []

  for (const field of trackedFields) {
    if (!(field in updated)) continue
    const oldVal = previous[field]
    const newVal = updated[field]
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push({ field, oldValue: oldVal ?? null, newValue: newVal ?? null })
    }
  }

  return changes
}

export async function logChanges(
  module: string,
  recordId: string,
  previous: Record<string, unknown>,
  updateData: Record<string, unknown>,
  trackedFields: string[]
) {
  const changes = detectChanges(previous, updateData, trackedFields)
  if (changes.length === 0) return

  const statusChange = changes.find((c) => c.field === "estado")
  const assignChange = changes.find((c) => c.field === "usuarioId")

  const promises: Promise<unknown>[] = []

  if (statusChange) {
    promises.push(
      logActivity({
        module,
        recordId,
        type: "status_change",
        data: { field: "estado", oldValue: statusChange.oldValue, newValue: statusChange.newValue },
      })
    )
  }

  if (assignChange) {
    promises.push(
      logActivity({
        module,
        recordId,
        type: assignChange.newValue ? "assigned" : "unassigned",
        data: { field: "usuarioId", oldValue: assignChange.oldValue, newValue: assignChange.newValue },
      })
    )
  }

  const otherChanges = changes.filter((c) => c.field !== "estado" && c.field !== "usuarioId")
  if (otherChanges.length > 0) {
    promises.push(
      logActivity({
        module,
        recordId,
        type: "updated",
        data: { changes: otherChanges },
      })
    )
  }

  await Promise.allSettled(promises)
}
