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

export type { UIMessages, UINamespace } from "./types"
export type { CommonMessages, NavMessages } from "./types"

/**
 * Locale → UI messages.
 *
 * Partial by design: only `en` has real content in this phase. `es` and `de`
 * intentionally resolve to the English object below — this is a temporary
 * FALLBACK, not finished translation. When Spanish/German UI content lands,
 * replace these aliases with real per-locale namespace objects.
 */
const UI_MAP: Partial<Record<SupportedLocale, UIMessages>> = {
  en,
  // Fallback (not translated yet): serve English until es/de content exists.
  es: en,
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
