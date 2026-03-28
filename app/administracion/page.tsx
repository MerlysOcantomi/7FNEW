/**
 * Workspace Settings page (server component).
 *
 * Loads real workspace configuration from the database and passes it
 * to the client component for rendering. Module toggles reflect the
 * real `resolvedConfig.modules` state and persist via the existing
 * workspace API (`POST /api/workspaces/[id]/modules`).
 *
 * Navigation:
 *   - "Improvements" in sidebar/search → /forte/improvements
 *   - "Workspace settings" in context bar → /administracion (this page)
 */

import { redirect } from "next/navigation"
import { getSessionFromCookies } from "@/core/auth/session"
import { getRequiredWorkspaceId } from "@/core/workspace-context"
import { checkMembership, getWorkspaceWithResolvedConfig } from "@/core/workspace"
import { parseSettingsHandoff } from "@/agents/forte/runtime/business/settings-handoff"
import { AdministracionContent } from "@/components/administracion-content"
import { resolveWorkspaceVocabulary } from "@core/personalization/resolve-workspace"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdministracionPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies()
  if (!session) redirect("/login")

  const params = await searchParams
  const handoff = parseSettingsHandoff(params)

  let workspaceId = ""
  let wsRole = "VIEWER"
  let moduleConfig: Record<string, boolean> = {}
  let vocabulary: import("@core/personalization").EntityVocabulary | undefined

  try {
    workspaceId = await getRequiredWorkspaceId()
    const member = await checkMembership(session.userId, workspaceId)
    wsRole = (member?.role as string) ?? "VIEWER"

    const ws = await getWorkspaceWithResolvedConfig(workspaceId)
    if (ws) {
      moduleConfig = ws.resolvedConfig.modules
    }

    vocabulary = await resolveWorkspaceVocabulary(workspaceId)
  } catch {
    // If workspace resolution fails, render with empty config + default vocabulary
  }

  return (
    <AdministracionContent
      handoff={handoff}
      workspaceId={workspaceId}
      wsRole={wsRole}
      moduleConfig={moduleConfig}
      vocabulary={vocabulary}
    />
  )
}
