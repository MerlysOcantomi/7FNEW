import { db } from "@core/db"
import { getOptionalWorkspaceId } from "@core/workspace-context"
import { resolveWorkspaceExperience } from "@core/vertical-packs/experience"

/**
 * Theme resolution (server side).
 *
 * The client theme bridge in `app/layout.tsx` decides the active `data-theme`
 * before paint, in this precedence:
 *   1. `?theme=<key>` in the URL  (explicit, also persisted to localStorage)
 *   2. `localStorage['7f-theme']` (the user's explicit choice via the toggle)
 *   3. the workspace's vertical DEFAULT  ← this module
 *   4. the global default (`midnight`)
 *
 * Step 3 is what makes a Beauty/Finesse workspace open in `rose-nude` by default
 * without ever forcing it: the default is only applied when the user has made no
 * explicit choice, and it is NOT written to localStorage, so switching the theme
 * (which does write localStorage) is always respected afterwards.
 *
 * Everything derives from the pure vertical experience (`beauty → rose-nude` via
 * `BEAUTY_PACK.themes.default`) — no colors are hardcoded, no new tokens, no
 * parallel theme system. Keep `VALID_THEME_KEYS` in sync with `app/layout.tsx`
 * and `components/theme-mode-toggle.tsx`.
 */

export const VALID_THEME_KEYS = [
  "midnight",
  "lavender-mist",
  "rose-nude",
  "sage-luxe",
  "noir-or",
] as const

export const GLOBAL_DEFAULT_THEME_KEY = "midnight"

function isValidThemeKey(key: string): boolean {
  return (VALID_THEME_KEYS as readonly string[]).includes(key)
}

/**
 * The `data-theme` default for the active workspace when the user has not chosen
 * a theme. Resolves the active workspace (cookie/membership) → its `verticalKey`
 * → the vertical experience's `defaultThemeKey`. Total and resilient: any failure
 * (signed out, public route, no workspace, DB error) falls back to the global
 * default, so it never blocks a render.
 */
export async function resolveWorkspaceDefaultThemeKey(): Promise<string> {
  try {
    const workspaceId = await getOptionalWorkspaceId()
    if (!workspaceId) return GLOBAL_DEFAULT_THEME_KEY

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { verticalKey: true },
    })
    const key = resolveWorkspaceExperience(ws?.verticalKey).defaultThemeKey
    return isValidThemeKey(key) ? key : GLOBAL_DEFAULT_THEME_KEY
  } catch {
    return GLOBAL_DEFAULT_THEME_KEY
  }
}
