import type { PalettePreset } from "./presets"

/**
 * Premium LIGHT application companions.
 *
 * petrol-pearl keeps its stable public key for backward compatibility.
 * The other two keys are application-only until a later Presence decision.
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
      "A cool pearl working canvas with navy ink and restrained electric-blue actions. Surfaces stay bright without becoming paper-white card walls.",
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
    note: "Pearl / blue petrol",
    guidance:
      "Low-fatigue pearl canvas with blue-petrol controls. The product reads clean and luminous while keeping Finesse identity in focus, selection and navigation.",
    colors: {
      canvas: "#EEF2F4",
      surface: "#F7F9FA",
      surfaceStrong: "#E2ECF0",
      text: "#18262D",
      muted: "#52656F",
      accent: "#145F7B",
      accent2: "#0B3B4F",
      border: "#8399A6",
    },
  },
  {
    id: "finesse-rose-cream-gold",
    name: "Finesse / Rose Cream Gold",
    mode: "light",
    status: "candidate",
    note: "Cream / antique rose / champagne",
    guidance:
      "Cream and pearl are the dominant material. Champagne-gold carries primary actions; antique rose is a restrained focus/detail tone, never a wall of dusty pink.",
    colors: {
      canvas: "#F7F1EA",
      surface: "#FFFAF5",
      surfaceStrong: "#EFE2D8",
      text: "#342A2A",
      muted: "#6F5E5C",
      accent: "#B78A66",
      accent2: "#7C4F58",
      border: "#BFAEA2",
    },
  },
]

export const APP_LIGHT_DETAILS: Record<
  AppLightThemeKey,
  { rail: string; hover: string; glow: string; metal: string }
> = {
  "sevenef-pearl-blue": {
    rail: "#E5EBF3",
    hover: "#244FC0",
    glow: "#4777E8",
    metal: "#9BA8B8",
  },
  "petrol-pearl": {
    rail: "#E3E9EC",
    hover: "#0E4B63",
    glow: "#2C7FA2",
    metal: "#C8A77E",
  },
  "finesse-rose-cream-gold": {
    rail: "#EADDD2",
    hover: "#A77A57",
    glow: "#7C4F58",
    metal: "#B78A66",
  },
}

export function isAppLightThemeKey(value: unknown): value is AppLightThemeKey {
  return typeof value === "string" && (APP_LIGHT_THEME_KEYS as readonly string[]).includes(value)
}
