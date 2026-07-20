/**
 * Sevenef Presence — theme bridge (FOUNDATION).
 *
 * Presence does NOT introduce a parallel theming system. It reuses the existing
 * 7F theme tokens (CSS custom-property blocks keyed by `[data-theme="<key>"]` in
 * `app/globals.css`, resolved by `core/theme.ts`). This module only exposes a
 * Presence-facing descriptor over those keys so templates/proposals can talk
 * about themes as data — no colors, no hex, are ever declared here.
 *
 * SYNC: `PRESENCE_THEME_KEYS` MUST stay a subset of `VALID_THEME_KEYS` in
 * `core/theme.ts`. We mirror the list locally (instead of importing it) to keep
 * this module pure and DB-free — `core/theme.ts` imports `@core/db`.
 */

/** Subset of `core/theme.ts` `VALID_THEME_KEYS` that Presence sites may use. */
export const PRESENCE_THEME_KEYS = [
  "midnight",
  "lavender-mist",
  "rose-nude",
  "sage-luxe",
  "noir-or",
] as const
export type PresenceThemeKey = (typeof PRESENCE_THEME_KEYS)[number]

export interface PresenceTheme {
  key: PresenceThemeKey
  /** English label (product theme names are not translated in-repo). */
  label: string
  /** A short note on the audience/mood the theme suits — advisory only. */
  suitedFor: string
  /** Where the actual tokens live (never duplicated here). */
  tokenSource: string
}

const TOKEN_SOURCE = 'app/globals.css [data-theme]'

export const PRESENCE_THEMES: readonly PresenceTheme[] = [
  { key: "midnight", label: "Midnight", suitedFor: "Platform / product, neutral premium", tokenSource: TOKEN_SOURCE },
  { key: "lavender-mist", label: "Lavender Mist", suitedFor: "Soft, modern service brands", tokenSource: TOKEN_SOURCE },
  { key: "rose-nude", label: "Rose Nude", suitedFor: "Beauty / premium (Finesse default)", tokenSource: TOKEN_SOURCE },
  { key: "sage-luxe", label: "Sage Luxe", suitedFor: "Wellness / spa", tokenSource: TOKEN_SOURCE },
  { key: "noir-or", label: "Noir Or", suitedFor: "Luxury / glam", tokenSource: TOKEN_SOURCE },
]

export function isPresenceThemeKey(key: string): key is PresenceThemeKey {
  return (PRESENCE_THEME_KEYS as readonly string[]).includes(key)
}

export function resolvePresenceTheme(key: string): PresenceTheme | null {
  return PRESENCE_THEMES.find((t) => t.key === key) ?? null
}
