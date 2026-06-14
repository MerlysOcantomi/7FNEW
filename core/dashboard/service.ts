import type { WorkspaceAuth } from "@core/auth/workspace-auth"
import type { DashboardData, ForteInsight } from "./types"
import { getDashboardContext } from "./context"
import { getDashboardModulesSummary } from "./modules-summary"
import { getDashboardPriorityActions } from "./priority-actions"
import { getDashboardRecentActivity } from "./recent-activity"
import { getDashboardFinanceSummary } from "./finance-summary"
import { getDashboardRecommendationsPreview } from "./recommendations-preview"
import { getLatestForteSnapshot } from "@/agents/forte/runtime/business/snapshot-store"

function buildHeroSummary(input: {
  workspaceName: string
  priorityCount: number
  topPriorityTitle?: string
}) {
  if (input.priorityCount === 0) {
    return `${input.workspaceName} is stable across delivery, tasks, and billing today.`
  }

  if (input.priorityCount === 1 && input.topPriorityTitle) {
    return `${input.topPriorityTitle} needs attention in ${input.workspaceName}.`
  }

  return `${input.priorityCount} priority actions need attention in ${input.workspaceName}.`
}

export async function buildDashboardData(auth: WorkspaceAuth): Promise<DashboardData> {
  const context = await getDashboardContext(auth)

  const [modulesSummary, priorityActions, recentActivity, financeSummary] = await Promise.all([
    getDashboardModulesSummary(context.workspaceId),
    getDashboardPriorityActions(context.workspaceId),
    getDashboardRecentActivity(context.workspaceId),
    getDashboardFinanceSummary(context.workspaceId),
  ])

  const actionablePriorities = priorityActions.filter((action) => action.kind !== "workspace-stable")
  const recommendations = getDashboardRecommendationsPreview({
    modulesSummary,
    priorityActions,
  })

  let forteInsight: ForteInsight | undefined
  try {
    const snapshot = await getLatestForteSnapshot(context.workspaceId)
    if (snapshot) {
      forteInsight = {
        maturity: snapshot.maturity,
        analyzedAt: snapshot.analyzedAt,
        topPriorities: snapshot.topPriorities.slice(0, 2).map((p) => ({
          label: p.label,
          href: p.href,
        })),
        nextMove: snapshot.recommendedNextMove
          ? { label: snapshot.recommendedNextMove.label, href: snapshot.recommendedNextMove.href }
          : null,
      }
    }
  } catch {
    // Snapshot read failure should not break the dashboard
  }

  return {
    context,
    hero: {
      summary: buildHeroSummary({
        workspaceName: context.workspaceName,
        priorityCount: actionablePriorities.length,
        topPriorityTitle: actionablePriorities[0]?.title,
      }),
      quickActions: [
        {
          id: "open-inbox",
          label: "Open Smart Inbox",
          href: "/inbox/overview",
        },
        {
          id: "view-recommendations",
          label: "View insights",
          href: "/forte/improvements",
        },
      ],
    },
    modulesSummary,
    priorityActions,
    recentActivity,
    financeSummary,
    recommendations,
    forteInsight,
    meta: {
      generatedAt: new Date().toISOString(),
      source: "dashboard-service",
    },
  }
}
