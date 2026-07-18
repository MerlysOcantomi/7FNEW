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
import { parseJsonConfig } from "@core/verticals"
import type { EntityVocabulary } from "./types"
import { DEFAULT_VOCABULARY } from "./vocabulary"
import { resolveVocabulary, mapVerticalKeyToBusinessType } from "./resolve"

export async function resolveWorkspaceVocabulary(
  workspaceId: string,
  locale?: string | null,
): Promise<EntityVocabulary> {
  try {
    const ws = await getWorkspaceWithResolvedConfig(workspaceId)
    if (!ws) return DEFAULT_VOCABULARY

    const businessType = mapVerticalKeyToBusinessType(ws.verticalKey)
    /**
     * P4.2.1: read the workspace's OWN raw config labels — NOT
     * `resolvedConfig.ui.labels`, which merges the Vertical.defaultConfig
     * seeds on top. Those seeds are vertical DEFAULTS (a preset in DB form);
     * feeding them here made the Spanish Beauty seed masquerade as an
     * explicit workspace personalization and win under any locale. Vertical
     * defaults now flow through the localized preset layer instead.
     */
    const labels = parseJsonConfig(ws.config)?.ui?.labels ?? {}

    return resolveVocabulary(businessType, labels, locale)
  } catch {
    return DEFAULT_VOCABULARY
  }
}
