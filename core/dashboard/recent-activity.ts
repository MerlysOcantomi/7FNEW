import { db } from "@core/db"
import type { DashboardActivityItem } from "./types"

function parseActivityData(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function toText(value: unknown) {
  if (value == null) return ""
  return String(value)
}

function buildActivityCopy(activity: {
  module: string
  type: string
  data: string | null
}): Pick<DashboardActivityItem, "label" | "detail"> {
  const data = parseActivityData(activity.data)

  switch (activity.type) {
    case "created":
      return {
        label: "Created",
        detail: toText(data?.label) || activity.module,
      }
    case "comment":
      return {
        label: "Comment",
        detail: toText(data?.comment).slice(0, 80) || "New comment added",
      }
    case "updated":
      return {
        label: "Updated",
        detail: toText(data?.label) || (data?.changes ? "Changes were applied" : activity.module),
      }
    case "deleted":
      return {
        label: "Deleted",
        detail: toText(data?.label) || activity.module,
      }
    case "status_change":
      return {
        label: "Status change",
        detail: data?.field
          ? `${toText(data.field)}: ${toText(data.oldValue)} -> ${toText(data.newValue)}`
          : "Status updated",
      }
    default:
      return {
        label: activity.type,
        detail: toText(data?.label) || activity.module,
      }
  }
}

export async function getDashboardRecentActivity(
  workspaceId: string,
  take = 15,
): Promise<DashboardActivityItem[]> {
  const activities = await db.activity.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take,
  })

  return activities.map((activity) => {
    const copy = buildActivityCopy(activity)
    return {
      id: activity.id,
      module: activity.module,
      recordId: activity.recordId,
      type: activity.type,
      label: copy.label,
      detail: copy.detail,
      userName: activity.userName,
      createdAt: activity.createdAt.toISOString(),
      href: `/${activity.module}/${activity.recordId}`,
    }
  })
}
