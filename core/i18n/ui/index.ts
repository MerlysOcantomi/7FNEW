/**
 * Typed UI namespace layer — pure data + pure resolvers.
 *
 * Import path: `@core/i18n/ui` (NOT the root `@core/i18n` barrel). Kept off the
 * root barrel on purpose so the legacy email/notifications/Inbox/workspace-locale
 * consumers never pull the UI dictionaries into their bundle.
 *
 * No React, no Prisma, no import from `../index`. Depends only on `../locale`,
 * `../types` and `./types` / `./en`.
 */

import { parseLocale } from "../locale"
import type { SupportedLocale } from "../types"
import type { UIMessages, UINamespace } from "./types"
import { en } from "./en"
import { es } from "./es"

export type { UIMessages, UINamespace } from "./types"
export type {
  CommonMessages,
  NavMessages,
  GlobalSearchMessages,
  GlobalNewMessages,
  SettingsMessages,
  TodayMessages,
  ClientsMessages,
  CalendarMessages,
  BillingMessages,
} from "./types"

/**
 * Locale → UI messages.
 *
 * `en` and `es` are real catalogs (P4.1: Spanish is fully translated for
 * settings/common; the remaining namespaces carry English values until their
 * surfaces are wired in the Finesse pilot). `de` still resolves to the
 * English object — a temporary FALLBACK, not finished translation; replace
 * the alias with a real `./de` catalog when German content lands.
 */
const UI_MAP: Partial<Record<SupportedLocale, UIMessages>> = {
  en,
  es,
  // Fallback (not translated yet): serve English until de content exists.
  de: en,
}

/** Resolve the full set of UI messages for a locale (English fallback). */
export function getUIMessages(locale?: string | null): UIMessages {
  const key = parseLocale(locale)
  return UI_MAP[key] ?? en
}

/**
 * Resolve a single UI namespace for a locale. Generic over the namespace key so
 * `getNamespace("en", "nav")` returns exactly `NavMessages`, not a wide union.
 */
export function getNamespace<K extends UINamespace>(
  locale: string | null | undefined,
  namespace: K,
): UIMessages[K] {
  return getUIMessages(locale)[namespace]
}
