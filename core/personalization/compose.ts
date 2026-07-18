/**
 * Composition between the i18n catalog and the vertical vocabulary — pure,
 * client-safe, no React/Prisma/i18n imports.
 *
 * Rule (docs/i18n-localization-architecture.md §5): the LOCALE translates the
 * linguistic structure; the VOCABULARY names the entity. For shell labels that
 * ARE entity nouns (nav "Clients"/"Clientas"), the business's explicit
 * vocabulary wins; when the business has no explicit noun (the resolved value
 * still equals the 7F default), the locale catalog's translation is used —
 * so Finesse shows "Clientas" under any locale, while a default-vocabulary
 * workspace shows "Clients"/"Clientes" by locale.
 *
 * This module deliberately builds ON TOP of the existing resolver
 * (`resolveVocabulary` → DEFAULT → preset → workspace overrides): it adds no
 * second source of truth, only the comparison against `DEFAULT_VOCABULARY`
 * that distinguishes "business-chosen noun" from "nobody chose anything".
 */

import { DEFAULT_VOCABULARY } from "./vocabulary"
import type { EntityKey, EntityLabel, EntityVocabulary } from "./types"

export type EntityLabelForm = keyof EntityLabel // "singular" | "plural"

/**
 * True when the resolved vocabulary carries an EXPLICIT noun for this entity
 * form — i.e. a business-type preset or workspace override changed it from
 * the 7F default. A resolved value equal to the default means "no choice".
 */
export function hasVocabularyOverride(
  vocabulary: EntityVocabulary,
  entity: EntityKey,
  form: EntityLabelForm,
): boolean {
  const resolved = vocabulary[entity]?.[form]
  if (typeof resolved !== "string" || !resolved.trim()) return false
  return resolved !== DEFAULT_VOCABULARY[entity][form]
}

/**
 * Entity label for shell/nav composition.
 *
 * - vocabulary override present → the business noun (e.g. "Clientas");
 * - otherwise → `fallback`, the locale catalog's generic translation
 *   (e.g. nav.clients: "Clients" / "Clientes").
 * - `lowercase` supports grammar positions that need the noun mid-sentence
 *   ("Buscar clientas…"); locale-aware via toLocaleLowerCase.
 */
export function composeEntityLabel(input: {
  vocabulary: EntityVocabulary
  entity: EntityKey
  form: EntityLabelForm
  fallback: string
  lowercase?: boolean
}): string {
  const label = hasVocabularyOverride(input.vocabulary, input.entity, input.form)
    ? input.vocabulary[input.entity][input.form]
    : input.fallback
  return input.lowercase ? label.toLocaleLowerCase() : label
}
