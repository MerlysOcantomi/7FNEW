import { redirect } from "next/navigation"
import { getSessionFromCookies } from "@/core/auth/session"
import { getRequiredWorkspaceId } from "@/core/workspace-context"
import { checkMembership } from "@/core/workspace"
import { createForteContext } from "@/agents/forte/runtime/forte-context"
import { loadForteImprovements } from "@/agents/forte/runtime/business/improvements-loader"
import { ForteImprovementsContent } from "@/components/forte/improvements-content"

export default async function ForteImprovementsPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect("/login")

  let viewModel

  try {
    const workspaceId = await getRequiredWorkspaceId()
    const member = await checkMembership(session.userId, workspaceId)
    const wsRole = (member?.role as string) ?? "VIEWER"

    const context = createForteContext({
      tenantId: workspaceId,
      workspaceId,
      userId: session.userId,
      wsRole,
      surface: "recommend",
    })

    viewModel = await loadForteImprovements(context)
  } catch {
    viewModel = {
      domains: [],
      maturity: "empty" as const,
      recommendations: [],
      nextMove: null,
    }
  }

  return <ForteImprovementsContent viewModel={viewModel} />
}
