import { db } from "@core/db"
import { getOptionalWorkspaceId } from "@core/workspace-context"
import { resolveWorkspaceExperience } from "@core/vertical-packs/experience"
import { applicationDefaultTheme, PUBLIC_DEFAULT_THEME_KEY } from "./theme-registry"

export { VALID_THEME_KEYS, GLOBAL_DEFAULT_THEME_KEY } from "./theme-registry"

/**
 * App-only premium adoption. The vertical pack still describes existing public
 * presets; the application adapter selects Midnight for sevenef and Pearl for Finesse.
 * Explicit browser/query choices win in the shared pre-paint bootstrap.
 * No workspace writes, Presence migrations or forced overwrite of user choices.
 */
export async function resolveWorkspaceDefaultThemeKey(): Promise<string> {
  try {
    const workspaceId = await getOptionalWorkspaceId()
    if (!workspaceId) return PUBLIC_DEFAULT_THEME_KEY
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { verticalKey: true },
    })
    if (!ws) return PUBLIC_DEFAULT_THEME_KEY
    const declaredTheme = resolveWorkspaceExperience(ws.verticalKey).defaultThemeKey
    return applicationDefaultTheme(ws.verticalKey, declaredTheme)
  } catch {
    // Fail safely to the established theme when workspace resolution fails.
    return PUBLIC_DEFAULT_THEME_KEY
  }
}
