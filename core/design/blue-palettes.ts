import type { PalettePreset } from "./presets"

/**
 * Active dark direction: a true blue Midnight for sevenef and the shared
 * Finesse dark appearance. The two older application keys remain only as
 * compatibility aliases while persisted preferences migrate to Midnight.
 */
export const APP_BLUE_THEME_KEYS = [
  "midnight",
  "sevenef-blue-premium",
  "finesse-petrol-blue",
] as const

export type AppBlueThemeKey = typeof APP_BLUE_THEME_KEYS[number]

const MIDNIGHT_COLORS = {
  canvas: "#070B14",
  surface: "#0D1420",
  surfaceStrong: "#121C2A",
  text: "#F5F7FA",
  muted: "#9DAABA",
  accent: "#2868F4",
  accent2: "#A9B6C6",
  border: "#556579",
} as const

export const APP_BLUE_PALETTES: readonly PalettePreset[] = [
  {
    id: "midnight",
    name: "sevenef / Midnight Blue",
    mode: "dark",
    status: "existing-family",
    note: "Active / sevenef dark / shared Finesse dark",
    guidance:
      "Blue-black canvas, graphite-navy operational surfaces, cool steel neutrals and one electric-blue interaction color. No violet or purple brand cast.",
    colors: { ...MIDNIGHT_COLORS },
  },
  {
    id: "sevenef-blue-premium",
    name: "sevenef / Navy Premium (legacy)",
    mode: "dark",
    status: "candidate",
    note: "Deprecated compatibility key -> Midnight Blue",
    guidance:
      "Retained temporarily for stored preferences and old links. It resolves to the same blue Midnight material and is not offered in the active theme selector.",
    colors: { ...MIDNIGHT_COLORS },
  },
  {
    id: "finesse-petrol-blue",
    name: "Finesse / Petrol Dark (legacy)",
    mode: "dark",
    status: "candidate",
    note: "Deprecated compatibility key -> shared Midnight Blue",
    guidance:
      "The dark petrol experiment is retired. This compatibility key now renders the shared Midnight Blue dark material and is not offered in the active selector.",
    colors: { ...MIDNIGHT_COLORS },
  },
]

export const APP_BLUE_DETAILS: Record<AppBlueThemeKey, { rail: string; hover: string; glow: string }> = {
  midnight: { rail: "#090F19", hover: "#245EE5", glow: "#8EADFF" },
  "sevenef-blue-premium": { rail: "#090F19", hover: "#245EE5", glow: "#8EADFF" },
  "finesse-petrol-blue": { rail: "#090F19", hover: "#245EE5", glow: "#8EADFF" },
}

export function isAppBlueThemeKey(key: unknown): key is AppBlueThemeKey {
  return typeof key === "string" && (APP_BLUE_THEME_KEYS as readonly string[]).includes(key)
}
