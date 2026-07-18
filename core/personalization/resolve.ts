/**
 * Vocabulary resolver.
 *
 * Resolution order (last wins):
 *   1. DEFAULT_VOCABULARY                      (English base)
 *   2. Business-type BASE preset               (vertical default, English)
 *   3. LOCALIZED preset variant for the locale (vertical default, es/…)
 *   4. Workspace-level overrides from the workspace's OWN
 *      VerticalConfig.ui.labels                (explicit personalization)
 *
 * Layers 2–3 are vertical DEFAULTS chosen by the effective locale; layer 4
 * is the only layer that represents a deliberate workspace choice and is
 * locale-independent (a business that renames Clients to "Socios" sees
 * "Socios" under any UI language). Callers must never feed vertical-default
 * labels (e.g. a Vertical.defaultConfig ui.labels blob) into layer 4 — that
 * would disguise a preset as a personalization.
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
import { isValidLocale } from "@core/i18n/locale"
import { DEFAULT_VOCABULARY } from "./vocabulary"
import { BUSINESS_PRESETS, LOCALIZED_BUSINESS_PRESETS } from "./presets"

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

/**
 * Normalize an arbitrary locale string to the canonical prefix used as the
 * LOCALIZED_BUSINESS_PRESETS key ("es-MX" → "es"). Local on purpose — this
 * module stays decoupled from @core/i18n.
 */
function presetLocaleKey(locale: string | null | undefined) {
  if (!locale || typeof locale !== "string") return null
  const prefix = locale.trim().toLowerCase().split(/[-_]/)[0]
  // Single source of validity: the core i18n registry (no local allowlist).
  return prefix && isValidLocale(prefix) ? prefix : null
}

export function resolveVocabulary(
  businessType?: BusinessType,
  workspaceLabels?: Record<string, string>,
  locale?: string | null,
): EntityVocabulary {
  const preset = businessType ? BUSINESS_PRESETS[businessType] ?? {} : {}
  const localeKey = presetLocaleKey(locale)
  const localized =
    businessType && localeKey
      ? LOCALIZED_BUSINESS_PRESETS[businessType]?.[localeKey] ?? {}
      : {}
  const wsOverrides = workspaceLabels ? parseWorkspaceLabels(workspaceLabels) : {}

  const resolved = {} as EntityVocabulary

  for (const key of ENTITY_KEYS) {
    const base = DEFAULT_VOCABULARY[key]
    const withPreset = mergeLabel(base, preset[key])
    const withLocalized = mergeLabel(withPreset, localized[key])
    const withWorkspace = mergeLabel(withLocalized, wsOverrides[key])
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
