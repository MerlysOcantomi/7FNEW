import { APP_BLUE_THEME_KEYS } from "./design/blue-palettes"
import { APP_LIGHT_THEME_KEYS } from "./design/light-palettes"

/** Shared by server resolution, pre-paint bootstrap and the appearance selector. */
export const THEME_STORAGE_KEY = "7f-theme"
export const VALID_THEME_KEYS = [
  ...APP_BLUE_THEME_KEYS,
  ...APP_LIGHT_THEME_KEYS,
  "midnight", "lavender-mist", "rose-nude", "sage-luxe", "noir-or",
] as const
export type AppThemeKey = typeof VALID_THEME_KEYS[number]
export const GLOBAL_DEFAULT_THEME_KEY: AppThemeKey = "sevenef-blue-premium"
export const FINESSE_DEFAULT_THEME_KEY: AppThemeKey = "finesse-petrol-blue"
export const PUBLIC_DEFAULT_THEME_KEY: AppThemeKey = "midnight"
export const APP_PRIVATE_THEME_KEYS = [
  ...APP_BLUE_THEME_KEYS,
  "sevenef-pearl-blue",
  "finesse-rose-cream-gold",
] as const

export function isValidThemeKey(value: unknown): value is AppThemeKey {
  return typeof value === "string" && (VALID_THEME_KEYS as readonly string[]).includes(value)
}

/** Application-only adoption; does not modify Presence theme/template defaults. */
export function applicationDefaultTheme(verticalKey: string | null | undefined, declaredTheme: string): AppThemeKey {
  if (verticalKey === "beauty") return FINESSE_DEFAULT_THEME_KEY
  if (declaredTheme === "midnight") return GLOBAL_DEFAULT_THEME_KEY
  return isValidThemeKey(declaredTheme) ? declaredTheme : GLOBAL_DEFAULT_THEME_KEY
}

/** Trusted values only. Also used by the pre-paint script below. */
export function selectAppTheme(query: unknown, stored: unknown, fallback: unknown): AppThemeKey {
  if (isValidThemeKey(query)) return query
  if (isValidThemeKey(stored)) return stored
  return isValidThemeKey(fallback) ? fallback : PUBLIC_DEFAULT_THEME_KEY
}

/** No user-provided CSS or script. Storage failure must not undo an explicit choice. */
export function buildThemeBootstrap(defaultTheme: string): string {
  const fallback = isValidThemeKey(defaultTheme) ? defaultTheme : PUBLIC_DEFAULT_THEME_KEY
  return `(function(){var A=${JSON.stringify(VALID_THEME_KEYS)},K=${JSON.stringify(THEME_STORAGE_KEY)},D=${JSON.stringify(fallback)};function valid(x){return typeof x==='string'&&A.indexOf(x)!==-1;}var q=null,s=null;try{q=new URLSearchParams(location.search).get('theme');}catch(e){}try{s=localStorage.getItem(K);}catch(e){}var p=location.pathname;var external=['/sites','/widget','/cliente','/finesse'].some(function(x){return p===x||p.indexOf(x+'/')===0;});var isNew=function(x){return ${JSON.stringify(APP_PRIVATE_THEME_KEYS)}.indexOf(x)!==-1;};if(external){if(isNew(q))q=null;if(isNew(s))s=null;D='midnight';}if(valid(q)&&!external){try{localStorage.setItem(K,q);}catch(e){}}document.documentElement.setAttribute('data-theme',valid(q)?q:valid(s)?s:D);})();`
}
