import { APP_BLUE_THEME_KEYS } from "./design/blue-palettes"
import { APP_LIGHT_THEME_KEYS } from "./design/light-palettes"

/** Shared by server resolution, pre-paint bootstrap and the appearance selector. */
export const THEME_STORAGE_KEY = "7f-theme"
export const VALID_THEME_KEYS = [
  ...APP_BLUE_THEME_KEYS,
  ...APP_LIGHT_THEME_KEYS,
  "lavender-mist", "rose-nude", "sage-luxe", "noir-or",
] as const
export type AppThemeKey = typeof VALID_THEME_KEYS[number]

export const GLOBAL_DEFAULT_THEME_KEY: AppThemeKey = "midnight"
export const FINESSE_DEFAULT_THEME_KEY: AppThemeKey = "petrol-pearl"
export const PUBLIC_DEFAULT_THEME_KEY: AppThemeKey = "midnight"

/**
 * Old visual experiments stay readable for compatibility, but active
 * application choices migrate onto the simplified system.
 */
export const LEGACY_THEME_ALIASES = {
  "sevenef-blue-premium": "midnight",
  "finesse-petrol-blue": "midnight",
  "lavender-mist": "sevenef-pearl-blue",
  "rose-nude": "finesse-rose-cream-gold",
} as const satisfies Partial<Record<AppThemeKey, AppThemeKey>>

export const APP_PRIVATE_THEME_KEYS = [
  "sevenef-blue-premium",
  "finesse-petrol-blue",
  "sevenef-pearl-blue",
  "finesse-rose-cream-gold",
] as const

export function isValidThemeKey(value: unknown): value is AppThemeKey {
  return typeof value === "string" && (VALID_THEME_KEYS as readonly string[]).includes(value)
}

export function normalizeThemeKey(value: unknown): AppThemeKey | null {
  if (!isValidThemeKey(value)) return null
  return LEGACY_THEME_ALIASES[value as keyof typeof LEGACY_THEME_ALIASES] ?? value
}

/** Application-only adoption; does not modify Presence theme/template defaults. */
export function applicationDefaultTheme(verticalKey: string | null | undefined, declaredTheme: string): AppThemeKey {
  if (verticalKey === "beauty") return FINESSE_DEFAULT_THEME_KEY
  return normalizeThemeKey(declaredTheme) ?? GLOBAL_DEFAULT_THEME_KEY
}

/** Trusted values only. Also used by the pre-paint script below. */
export function selectAppTheme(query: unknown, stored: unknown, fallback: unknown): AppThemeKey {
  return normalizeThemeKey(query) ?? normalizeThemeKey(stored) ?? normalizeThemeKey(fallback) ?? PUBLIC_DEFAULT_THEME_KEY
}

/** No user-provided CSS or script. Storage failure must not undo an explicit choice. */
export function buildThemeBootstrap(defaultTheme: string): string {
  const fallback = normalizeThemeKey(defaultTheme) ?? PUBLIC_DEFAULT_THEME_KEY
  return `(function(){var A=${JSON.stringify(VALID_THEME_KEYS)},M=${JSON.stringify(LEGACY_THEME_ALIASES)},P=${JSON.stringify(APP_PRIVATE_THEME_KEYS)},K=${JSON.stringify(THEME_STORAGE_KEY)},D=${JSON.stringify(fallback)};function valid(x){return typeof x==='string'&&A.indexOf(x)!==-1;}function norm(x){if(!valid(x))return null;return M[x]||x;}var q=null,s=null;try{q=new URLSearchParams(location.search).get('theme');}catch(e){}try{s=localStorage.getItem(K);}catch(e){}q=norm(q);s=norm(s);var p=location.pathname;var external=['/sites','/widget','/cliente','/finesse'].some(function(x){return p===x||p.indexOf(x+'/')===0;});var isPrivate=function(x){return P.indexOf(x)!==-1;};if(external){if(isPrivate(q))q=null;if(isPrivate(s))s=null;D='midnight';}if(q&&!external){try{localStorage.setItem(K,q);}catch(e){}}document.documentElement.setAttribute('data-theme',q||s||D);})();`
}
