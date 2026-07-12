/**
 * Workspace experience resolver.
 *
 * ONE pure function that resolves everything the product needs to know about a
 * workspace's vertical experience, from just its `verticalKey`. It COMPOSES the
 * existing pure resolvers (business type, nav profile, specialist agent) with
 * declarative pack data (theme keys, channels, recommended modules, today mode)
 * — it does not duplicate or replace any of them.
 *
 * This is the shared foundation for two layers:
 *   1. Admin/manual today — the /system vertical selector reads it to show what
 *      a vertical implies.
 *   2. Mr Forte / product later — the guided onboarding will apply the same
 *      resolved experience after the user approves a vertical.
 *
 * Pure and DB-free (no `@core/db`): safe on the client, the server and in tests.
 * `todayMode` is the DECLARED operating model (data) — it does NOT turn on the
 * real appointment Today, which stays gated until real appointment data exists.
 * Theme keys for non-beauty verticals are PROVISIONAL placeholders that the
 * future theme foundation finalizes.
 */

import { mapVerticalKeyToBusinessType } from "@core/personalization"
import { resolveNavProfile } from "./nav-profile"
import { resolveVerticalSpecialist, type VerticalSpecialistAgent } from "./specialists"
import { BEAUTY_PACK } from "./beauty"

/**
 * Whether the vertical has a real, fully-built experience pack or only falls
 * back to the default. Prevents confusing "registered in seed" (e.g. construction,
 * clinic, law, florals) with "actually built" (beauty).
 */
export type ExperienceState = "complete" | "default"

export interface WorkspaceExperience {
  /** "complete" = has a real vertical pack; "default" = seeded but no pack yet. */
  experienceState: ExperienceState
  businessType: string
  verticalKey: string
  verticalName: string | null
  specialistAgentId: string | null
  specialistAgent: VerticalSpecialistAgent | null
  brandLine: string | null
  /** Theme key as data; the theme foundation maps it to a real palette later. */
  defaultThemeKey: string
  availableThemeKeys: string[]
  /** Declared operating model (data). Does NOT enable the real Today by itself. */
  todayMode: string
  /**
   * Whether a REAL workspace of this vertical should actually ACTIVATE its
   * declared `todayMode` (vs. staying on the safe `work_first` Today). Driven by
   * the vertical pack's own gate — for Beauty this is
   * `BEAUTY_PACK.today.activateRealForRealWorkspaces`. While `false`, the
   * declared mode (e.g. `appointment_first`) is a design-review PREVIEW only:
   * it renders demo data and is reachable via an explicit `?vertical=` /
   * `?todayLayout=` override, so a real operator never auto-lands on demo
   * bookings. Flip the pack flag on only once a real backend for that mode
   * exists.
   */
  todayActivatesRealWorkspaces: boolean
  navProfileId: string | null
  recommendedChannels: string[]
  recommendedModules: string[]
}

/**
 * Default (agency / creative-agency / unknown) experience. No specialist, no
 * beauty nav, standard Today. Theme keys are provisional until the theme
 * foundation lands.
 */
const DEFAULT_THEME_KEY = "midnight"
const DEFAULT_AVAILABLE_THEME_KEYS = ["midnight", "lavender-mist", "north-sea"]

/**
 * Resolve the full vertical experience for a workspace. Total and pure: unknown
 * or empty `verticalKey` returns the safe default experience, never throws.
 */
export function resolveWorkspaceExperience(
  verticalKey: string | null | undefined,
): WorkspaceExperience {
  const key = verticalKey ?? "creative-agency"
  const businessType = mapVerticalKeyToBusinessType(key)
  const specialist = resolveVerticalSpecialist(key)
  const navProfile = resolveNavProfile(key)

  // Beauty (covers aliases salon/nails/… via businessType).
  if (businessType === "beauty") {
    return {
      experienceState: "complete",
      businessType,
      verticalKey: key,
      verticalName: BEAUTY_PACK.verticalName,
      specialistAgentId: specialist?.id ?? null,
      specialistAgent: specialist,
      brandLine: specialist?.tagline ?? null,
      defaultThemeKey: BEAUTY_PACK.themes.default,
      availableThemeKeys: BEAUTY_PACK.themes.available,
      todayMode: BEAUTY_PACK.today.mode,
      todayActivatesRealWorkspaces: BEAUTY_PACK.today.activateRealForRealWorkspaces,
      navProfileId: navProfile?.verticalKey ?? BEAUTY_PACK.navProfileId,
      recommendedChannels: BEAUTY_PACK.channels,
      recommendedModules: BEAUTY_PACK.recommendedModules,
    }
  }

  // Default / agency / unknown, and seeded-but-unbuilt verticals
  // (construction, clinic, law, florals) — all resolve to the default experience.
  return {
    experienceState: "default",
    businessType,
    verticalKey: key,
    verticalName: null,
    specialistAgentId: null,
    specialistAgent: null,
    brandLine: null,
    defaultThemeKey: DEFAULT_THEME_KEY,
    availableThemeKeys: DEFAULT_AVAILABLE_THEME_KEYS,
    todayMode: "work_first",
    // work_first is the safe default Today and is always real — no gate needed.
    todayActivatesRealWorkspaces: false,
    navProfileId: navProfile?.verticalKey ?? null,
    recommendedChannels: [],
    recommendedModules: [],
  }
}
