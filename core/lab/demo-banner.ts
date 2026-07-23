/**
 * Mr Forte Lab — "is this the demo session?" check for the permanent banner
 * (DEV-PREVIEW-01C). Server-only, no DB, no `NEXT_PUBLIC_*`.
 *
 * True ONLY when ALL hold: the deployment passes the infrastructure gate, a
 * normal Sevenef session exists, its user is EXACTLY the demo user, and the
 * active workspace cookie is EXACTLY the demo workspace. In production (gate
 * denied) or for any other user/workspace it is false, so the banner never
 * shows outside the Lab.
 */

import "server-only"
import { cookies } from "next/headers"
import { getSessionFromCookies } from "@core/auth/session"
import { WORKSPACE_COOKIE } from "@core/workspace-context"
import { getLabGateDecision } from "./gate"
import { readLabDataConfig } from "./data-config"

export async function isLabDemoActiveSession(): Promise<boolean> {
  const gate = await getLabGateDecision()
  if (!gate.allowed) return false

  const dataConfig = readLabDataConfig(process.env)
  if (!dataConfig.ok) return false

  const session = await getSessionFromCookies()
  if (!session || session.userId !== dataConfig.config.userId) return false

  const cookieStore = await cookies()
  const activeWorkspace = cookieStore.get(WORKSPACE_COOKIE)?.value
  return activeWorkspace === dataConfig.config.workspaceId
}
