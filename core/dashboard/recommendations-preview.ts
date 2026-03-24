import type {
  DashboardModulesSummary,
  DashboardPriorityAction,
  DashboardRecommendationPreview,
} from "./types"

export function getDashboardRecommendationsPreview(input: {
  modulesSummary: DashboardModulesSummary
  priorityActions: DashboardPriorityAction[]
}): DashboardRecommendationPreview[] {
  const hasOperationalPressure = input.priorityActions.some(
    (action) => action.sourceModule === "projects" || action.sourceModule === "tasks",
  )
  const hasInboxValue =
    input.modulesSummary.totalClients > 0 || input.modulesSummary.activeProjects > 0

  const recommendations: DashboardRecommendationPreview[] = []

  if (hasInboxValue) {
    recommendations.push({
      id: "smart-inbox",
      title: "Smart Inbox",
      helper: "by Farah",
      description: "Review new conversations, capture demand, and turn messages into next steps.",
      href: "/inbox",
      cta: "Open Smart Inbox",
      source: "module",
      freshness: "static",
    })
  }

  recommendations.push({
    id: "forte-recommendations",
    title: "Workspace improvements",
    helper: "by Mr. Forte",
    description: "Review suggested upgrades, optional capabilities, and next improvements for this workspace.",
    href: "/administracion",
    cta: "Open improvements",
    source: "forte",
    freshness: "cached",
  })

  if (hasOperationalPressure || input.modulesSummary.overdueTasks > 0 || input.modulesSummary.activeProjects > 0) {
    recommendations.push({
      id: "operations-follow-up",
      title: "Operations follow-up",
      helper: "supported by Francis",
      description: "Keep projects and tasks aligned so operational follow-up stays clear and controlled.",
      href: "/tareas",
      cta: "Review tasks",
      source: "operations",
      freshness: "static",
    })
  }

  return recommendations.slice(0, 3)
}
