"use client"

/**
 * Composed entity nouns for the /clientes journey — ONE derivation shared by
 * the list page, the detail page and the client form.
 *
 * Each noun = workspace/vertical vocabulary (localized preset, workspace
 * override) when the business declared one, else the locale-generic fallback
 * from the `clients.nouns` catalog. Always LOWERCASE — catalog phrase
 * functions capitalize where their grammar needs it. This composes on top of
 * the existing resolver; it is not a second source of truth.
 */

import { useMemo } from "react"
import { useI18n } from "@/components/i18n-provider"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import {
  composeEntityLabel,
  mapVerticalKeyToBusinessType,
  resolveVocabulary,
  type EntityKey,
  type EntityLabelForm,
} from "@core/personalization"

export interface ClientsNouns {
  client: string
  clients: string
  project: string
  projects: string
  invoices: string
}

export function useClientsNouns(): ClientsNouns {
  const { t, locale } = useI18n()
  const { workspace } = useActiveWorkspace()
  const verticalKey = workspace?.verticalKey ?? ""

  return useMemo(() => {
    const vocabulary = resolveVocabulary(
      mapVerticalKeyToBusinessType(verticalKey),
      undefined,
      locale,
    )
    const fallback = t.clients.nouns
    const compose = (entity: EntityKey, form: EntityLabelForm, fb: string) =>
      composeEntityLabel({ vocabulary, entity, form, fallback: fb, lowercase: true })

    return {
      client: compose("client", "singular", fallback.client),
      clients: compose("client", "plural", fallback.clients),
      project: compose("project", "singular", fallback.project),
      projects: compose("project", "plural", fallback.projects),
      // billing entity: Finesse es → "cobros", Finesse en → "billing",
      // default workspaces → the locale-generic "invoices"/"facturas".
      invoices: compose("billing", "plural", fallback.invoices),
    }
  }, [t, locale, verticalKey])
}

/** First-letter capitalization for headings built from composed nouns. */
export function capNoun(noun: string): string {
  return noun ? noun.charAt(0).toUpperCase() + noun.slice(1) : noun
}
