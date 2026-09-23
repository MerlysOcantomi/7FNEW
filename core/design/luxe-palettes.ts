import type { PalettePreset } from "./presets"

/**
 * Finesse luxury dark themes. These are application candidates, not Presence
 * defaults. The salon reference is translated into semantic UI colors rather
 * than copied as raw photographic swatches.
 */
export const APP_LUXE_THEME_KEYS = ["finesse-petrol-champagne"] as const
export type AppLuxeThemeKey = typeof APP_LUXE_THEME_KEYS[number]

export const APP_LUXE_PALETTES: readonly PalettePreset[] = [
  {
    id: "finesse-petrol-champagne",
    name: "Finesse / Petrol Champagne",
    mode: "dark",
    status: "candidate",
    note: "Deep petrol / champagne / warm pearl",
    guidance:
      "Deep blue-petrol material inspired by a luxury salon interior. Champagne metal is reserved for primary actions, focus and refined detail; warm pearl carries text. Blush is not a structural UI color.",
    colors: {
      canvas: "#071B23",
      surface: "#0E2B34",
      surfaceStrong: "#153B45",
      text: "#F8F2E8",
      muted: "#C9BEB0",
      accent: "#B88A62",
      accent2: "#E5C493",
      border: "#806F62",
    },
  },
]

export const APP_LUXE_DETAILS: Record<
  AppLuxeThemeKey,
  { rail: string; hover: string; glow: string; metal: string }
> = {
  "finesse-petrol-champagne": {
    rail: "#09232B",
    hover: "#9B704F",
    glow: "#D8B789",
    metal: "#C99C6E",
  },
}

export function isAppLuxeThemeKey(value: unknown): value is AppLuxeThemeKey {
  return typeof value === "string" && (APP_LUXE_THEME_KEYS as readonly string[]).includes(value)
}
