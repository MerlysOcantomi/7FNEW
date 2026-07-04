"use client"

import { useMemo } from "react"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import {
  resolveWorkspaceExperience,
  type WorkspaceExperience,
} from "@core/vertical-packs/experience"

/**
 * The resolved vertical experience for the active workspace.
 *
 * Convenience hook over `useActiveWorkspace()` + the pure
 * `resolveWorkspaceExperience(verticalKey)`. Components can keep calling the
 * individual pure resolvers (nav profile, specialist, today mode) directly; this
 * hook is the single-object seam that Beauty Home / Today / a future Mr Forte
 * flow will read. While the workspace is loading, `verticalKey` is null and the
 * resolver returns the safe default experience.
 */
export function useWorkspaceExperience(): {
  experience: WorkspaceExperience
  loading: boolean
} {
  const { workspace, loading } = useActiveWorkspace()
  const experience = useMemo(
    () => resolveWorkspaceExperience(workspace?.verticalKey ?? null),
    [workspace?.verticalKey],
  )
  return { experience, loading }
}
