import type { PalettePreset } from "./presets"

/**
 * Premium LIGHT application companions.
 *
 * petrol-pearl keeps its stable public key for backward compatibility.
 * The Finesse values intentionally share material DNA with the approved
 * v0 onboarding: pearl/ivory canvas, polished white surfaces, deep blue-petrol
 * interaction color and a restrained champagne metal accent.
 */
export const APP_LIGHT_THEME_KEYS = [
  "sevenef-pearl-blue",
  "petrol-pearl",
  "finesse-rose-cream-gold",
] as const

export type AppLightThemeKey = typeof APP_LIGHT_THEME_KEYS[number]

export const APP_LIGHT_PALETTES: readonly PalettePreset[] = [
  {
    id: "sevenef-pearl-blue",
    name: "sevenef / Navy Pearl",
    mode: "light",
    status: "candidate",
    note: "Pearl / navy / electric blue",
    guidance:
      "A cool pearl working canvas with navy ink and restrained electric-blue actions. Surfaces stay bright without becoming a flat paper-white card wall.",
    colors: {
      canvas: "#F3F6FA",
      surface: "#FFFFFF",
      surfaceStrong: "#E7EEF6",
      text: "#0C1A2B",
      muted: "#506176",
      accent: "#2D63E6",
      accent2: "#244FC0",
      border: "#8DA0B8",
    },
  },
  {
    id: "petrol-pearl",
    name: "Finesse / Petrol Pearl",
    mode: "light",
    status: "existing-family",
    note: "Ivory pearl / deep blue petrol / champagne",
    guidance:
      "The approved Finesse onboarding material translated to the operational app: warm pearl canvas, polished white surfaces and deep blue-petrol controls. Champagne is a restrained material accent, never the body-text color.",
    colors: {
      canvas: "#F7F5F0",
      surface: "#FFFFFF",
      surfaceStrong: "#EFECE4",
      text: "#082D34",
      muted: "#5E7477",
      accent: "#073B45",
      accent2: "#0B5664",
      border: "#8C9B9C",
    },
  },
  {
    id: "finesse-rose-cream-gold",
    name: "Finesse / Rose Cream Gold",
    mode: "light",
    status: "candidate",
    note: "Cream / antique rose / champagne",
    guidance:
      "Cream and pearl are the dominant material. Champagne-gold carries material highlights; antique rose is a restrained focus/detail tone, never a wall of dusty pink.",
    colors: {
      canvas: "#F8F3EE",
      surface: "#FFFDFC",
      surfaceStrong: "#F0E3DC",
      text: "#342A2A",
      muted: "#6F5E5C",
      accent: "#9B6670",
      accent2: "#7C4F58",
      border: "#BDA9A3",
    },
  },
]

export const APP_LIGHT_DETAILS: Record<
  AppLightThemeKey,
  { rail: string; hover: string; glow: string; metal: string; metalSoft: string }
> = {
  "sevenef-pearl-blue": {
    rail: "#E5EBF3",
    hover: "#244FC0",
    glow: "#4777E8",
    metal: "#9BA8B8",
    metalSoft: "rgba(155, 168, 184, 0.18)",
  },
  "petrol-pearl": {
    rail: "#EFECE4",
    hover: "#032F38",
    glow: "#3A7C89",
    metal: "#CBA77B",
    metalSoft: "#E7D6BC",
  },
  "finesse-rose-cream-gold": {
    rail: "#EADDD5",
    hover: "#83535D",
    glow: "#A46E79",
    metal: "#C6A071",
    metalSoft: "#EFE0CB",
  },
}

export function isAppLightThemeKey(value: unknown): value is AppLightThemeKey {
  return typeof value === "string" && (APP_LIGHT_THEME_KEYS as readonly string[]).includes(value)
}
