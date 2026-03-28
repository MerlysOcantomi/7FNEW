/**
 * Server-side workspace vocabulary resolver.
 *
 * Loads workspace config, maps verticalKey to BusinessType,
 * and resolves the full EntityVocabulary with all override layers.
 *
 * This module touches the database (via getWorkspaceWithResolvedConfig)
 * and should only be used in server components or API routes.
 */

import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import type { EntityVocabulary } from "./types"
import { DEFAULT_VOCABULARY } from "./vocabulary"
import { resolveVocabulary, mapVerticalKeyToBusinessType } from "./resolve"

export async function resolveWorkspaceVocabulary(
  workspaceId: string,
): Promise<EntityVocabulary> {
  try {
    const ws = await getWorkspaceWithResolvedConfig(workspaceId)
    if (!ws) return DEFAULT_VOCABULARY

    const businessType = mapVerticalKeyToBusinessType(ws.verticalKey)
    const labels = ws.resolvedConfig?.ui?.labels ?? {}

    return resolveVocabulary(businessType, labels)
  } catch {
    return DEFAULT_VOCABULARY
  }
}
