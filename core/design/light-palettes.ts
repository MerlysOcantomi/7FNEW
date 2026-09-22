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
    note: "White pearl / blue petrol",
    guidance:
      "Finesse defaults to polished white and pearl surfaces. Petrol is the signature interaction color for buttons, focus, navigation and selected states, not the material of every card.",
    colors: {
      canvas: "#F5F7F8",
      surface: "#FFFFFF",
      surfaceStrong: "#F0F4F6",
      text: "#15222A",
      muted: "#657680",
      accent: "#17617F",
      accent2: "#0F4B64",
      border: "#9AAAB3",
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
    rail: "#EDF2F4",
    hover: "#104F69",
    glow: "#4D8CA5",
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
