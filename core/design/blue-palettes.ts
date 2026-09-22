import type { PalettePreset } from "./presets"

/** 7F-DESIGN-02: approved direction; application rollout remains in Preview. */
export const APP_BLUE_THEME_KEYS = ["sevenef-blue-premium", "finesse-petrol-blue"] as const
export type AppBlueThemeKey = typeof APP_BLUE_THEME_KEYS[number]

export const APP_BLUE_PALETTES: readonly PalettePreset[] = [
  {
    id: "sevenef-blue-premium", name: "sevenef / Petrol Blue Premium", mode: "dark", status: "candidate",
    note: "Recommended / sevenef application",
    guidance: "Clearly blue petrol, pearl text and a restrained blue highlight. A complete application direction, not a green teal variation.",
    colors: { canvas: "#071C2C", surface: "#12384E", surfaceStrong: "#184863", text: "#F2F7FA", muted: "#A9C0CE", accent: "#1F7AA8", accent2: "#9ED3EF", border: "#2D6B8A" },
  },
  {
    id: "finesse-petrol-blue", name: "Finesse / Petrol Blue", mode: "dark", status: "candidate",
    note: "Recommended / Finesse application",
    guidance: "The same blue-first language, with brighter surfaces for Finesse. Petrol Pearl remains available as the light alternative.",
    colors: { canvas: "#082433", surface: "#17485C", surfaceStrong: "#205D74", text: "#F6FAFB", muted: "#C0D1D9", accent: "#267EA6", accent2: "#AFDCEC", border: "#5B8DA3" },
  },
]

// Muted Finesse text is lifted slightly from the visual proposal so it remains
// readable on its brightest elevated panel. Lighter proposed hover colors are reserved for edges/light, not white-label
// button fills. These darker fills retain the approved CTA hue and contrast.
export const APP_BLUE_DETAILS: Record<AppBlueThemeKey, { rail: string; hover: string; glow: string }> = {
  "sevenef-blue-premium": { rail: "#0B2A3D", hover: "#17678F", glow: "#58AEDA" },
  "finesse-petrol-blue": { rail: "#0E3446", hover: "#23759C", glow: "#76C2D8" },
}

export function isAppBlueThemeKey(key: unknown): key is AppBlueThemeKey {
  return typeof key === "string" && (APP_BLUE_THEME_KEYS as readonly string[]).includes(key)
}
