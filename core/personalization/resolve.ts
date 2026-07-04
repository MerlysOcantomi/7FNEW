/**
 * Vocabulary resolver.
 *
 * Resolution order (last wins):
 *   1. DEFAULT_VOCABULARY
 *   2. Business-type preset (if any)
 *   3. Workspace-level overrides from VerticalConfig.ui.labels
 *
 * The workspace override layer uses flat keys like "client" or
 * "client.plural" to override specific fields. This aligns with
 * the existing VerticalConfig.ui.labels: Record<string, string>.
 */

import type {
  EntityKey,
  EntityLabel,
  EntityVocabulary,
  BusinessType,
  VocabularyOverrides,
} from "./types"
import { DEFAULT_VOCABULARY } from "./vocabulary"
import { BUSINESS_PRESETS } from "./presets"

const ENTITY_KEYS = Object.keys(DEFAULT_VOCABULARY) as EntityKey[]

function mergeLabel(base: EntityLabel, override?: Partial<EntityLabel>): EntityLabel {
  if (!override) return base
  return {
    singular: override.singular ?? base.singular,
    plural: override.plural ?? base.plural,
  }
}

/**
 * Parse flat workspace label overrides into structured VocabularyOverrides.
 *
 * Accepts two formats:
 *   - "client" -> overrides singular (common case)
 *   - "client.plural" -> overrides plural specifically
 *   - "client.singular" -> overrides singular explicitly
 */
function parseWorkspaceLabels(
  labels: Record<string, string>,
): VocabularyOverrides {
  const overrides: VocabularyOverrides = {}

  for (const [key, value] of Object.entries(labels)) {
    const parts = key.split(".")
    const entityKey = parts[0] as EntityKey
    const field = parts[1] as "singular" | "plural" | undefined

    if (!ENTITY_KEYS.includes(entityKey)) continue

    if (!overrides[entityKey]) {
      overrides[entityKey] = {}
    }

    if (field === "plural") {
      overrides[entityKey]!.plural = value
    } else {
      overrides[entityKey]!.singular = value
    }
  }

  return overrides
}

export function resolveVocabulary(
  businessType?: BusinessType,
  workspaceLabels?: Record<string, string>,
): EntityVocabulary {
  const preset = businessType ? BUSINESS_PRESETS[businessType] ?? {} : {}
  const wsOverrides = workspaceLabels ? parseWorkspaceLabels(workspaceLabels) : {}

  const resolved = {} as EntityVocabulary

  for (const key of ENTITY_KEYS) {
    const base = DEFAULT_VOCABULARY[key]
    const withPreset = mergeLabel(base, preset[key])
    const withWorkspace = mergeLabel(withPreset, wsOverrides[key])
    resolved[key] = withWorkspace
  }

  return resolved
}

export function getLabel(
  vocabulary: EntityVocabulary,
  key: EntityKey,
  form: "singular" | "plural" = "singular",
): string {
  return vocabulary[key]?.[form] ?? DEFAULT_VOCABULARY[key]?.[form] ?? key
}

const VERTICAL_KEY_TO_BUSINESS_TYPE: Record<string, BusinessType> = {
  "creative-agency": "creator",
  creator: "creator",
  school: "school",
  clinic: "clinic",
  service: "service",
  beauty: "beauty",
  salon: "beauty",
  nails: "beauty",
  barber: "beauty",
  barbershop: "beauty",
  spa: "beauty",
  lashes: "beauty",
  estetica: "beauty",
}

export function mapVerticalKeyToBusinessType(verticalKey: string): BusinessType {
  return VERTICAL_KEY_TO_BUSINESS_TYPE[verticalKey] ?? "default"
}
