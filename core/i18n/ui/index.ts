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
import { SUPPORTED_LOCALES, type SupportedLocale } from "../types"
import type { LocaleCatalogOverrides, UIMessages, UINamespace } from "./types"
import { en } from "./en"
import { es as esOverrides } from "./es"

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
 * Per-locale catalog CONTRIBUTIONS (§9, P4.CORE-5L). A locale contributes only
 * the namespaces it really translates; everything else falls back to English
 * at composition time below. `de`/`fr`/`it` are OFFICIAL locales with empty
 * contributions so far — an explicit, honest fallback, never English copies
 * pretending to be translations. To translate a namespace: add its complete
 * typed object to the locale's contribution — coverage below updates itself.
 */
const LOCALE_OVERRIDES: Record<SupportedLocale, LocaleCatalogOverrides> = {
  en,
  es: esOverrides,
  de: {},
  fr: {},
  it: {},
}

const UI_NAMESPACES = Object.keys(en) as UINamespace[]

/**
 * Full composed catalog per locale: English base + the locale's contributed
 * namespaces. `getUIMessages` therefore ALWAYS returns a complete UIMessages
 * for all five locales — components never check for missing keys.
 */
const UI_MAP: Record<SupportedLocale, UIMessages> = Object.fromEntries(
  SUPPORTED_LOCALES.map((code) => [
    code,
    code === "en" ? en : ({ ...en, ...LOCALE_OVERRIDES[code] } as UIMessages),
  ]),
) as Record<SupportedLocale, UIMessages>

/** Per-namespace catalog status for each official locale. */
export type CatalogCoverage = "native" | "fallback-en"

/**
 * Real coverage matrix — DERIVED from the contributions above, so it cannot
 * drift or lie: a namespace is "native" exactly when the locale contributed
 * it. Consumers (settings UI, docs, tests) read this instead of guessing.
 */
export const UI_NAMESPACE_COVERAGE: Record<
  SupportedLocale,
  Record<UINamespace, CatalogCoverage>
> = Object.fromEntries(
  SUPPORTED_LOCALES.map((code) => [
    code,
    Object.fromEntries(
      UI_NAMESPACES.map((ns) => [
        ns,
        code === "en" || LOCALE_OVERRIDES[code][ns] !== undefined ? "native" : "fallback-en",
      ]),
    ),
  ]),
) as Record<SupportedLocale, Record<UINamespace, CatalogCoverage>>

/** True when the locale still serves at least one namespace from English. */
export function localeHasPendingCoverage(locale: SupportedLocale): boolean {
  return Object.values(UI_NAMESPACE_COVERAGE[locale]).includes("fallback-en")
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
