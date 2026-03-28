export type {
  EntityKey,
  EntityLabel,
  EntityVocabulary,
  BusinessType,
  VocabularyOverrides,
} from "./types"

export { DEFAULT_VOCABULARY } from "./vocabulary"
export { BUSINESS_PRESETS } from "./presets"
export { resolveVocabulary, getLabel, mapVerticalKeyToBusinessType } from "./resolve"

// resolveWorkspaceVocabulary is NOT re-exported here because it depends on
// @core/db (Prisma) and would break client-side bundling. Server components
// should import it directly: import { resolveWorkspaceVocabulary } from "@core/personalization/resolve-workspace"
