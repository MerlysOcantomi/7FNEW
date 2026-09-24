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
    note: "Polished white / cool pearl / deep blue petrol",
    guidance:
      "Bright polished white and cool pearl are the working material. Deep blue-petrol gives Finesse its identity in actions, focus and navigation; no beige or green cast.",
    colors: {
      canvas: "#F2F5F6",
      surface: "#FFFFFF",
      surfaceStrong: "#E8EEF0",
      text: "#10242D",
      muted: "#5F737D",
      accent: "#0B4A64",
      accent2: "#11677F",
      border: "#92A4AC",
    },
  },
  {
    id: "finesse-rose-cream-gold",
    name: "Finesse / Rose Cream Gold",
    mode: "light",
    status: "candidate",
    note: "Ivory cream / champagne / antique rose",
    guidance:
      "Ivory and cream are the dominant material. Champagne-gold carries primary actions and premium metal; antique rose appears only in focus, selection and fine detail. This is deliberately not the old Rose Nude palette.",
    colors: {
      canvas: "#F8F4EE",
      surface: "#FFFDFC",
      surfaceStrong: "#F1E6DA",
      text: "#2F2927",
      muted: "#71645E",
      accent: "#B18A63",
      accent2: "#9D6671",
      border: "#C8B8AA",
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
    rail: "#E9EFF1",
    hover: "#083D54",
    glow: "#3B809A",
    metal: "#C6A779",
    metalSoft: "#F0E5D5",
  },
  "finesse-rose-cream-gold": {
    rail: "#EFE6DC",
    hover: "#95704F",
    glow: "#B57E88",
    metal: "#C7A06E",
    metalSoft: "#F0E2CC",
  },
}

export function isAppLightThemeKey(value: unknown): value is AppLightThemeKey {
  return typeof value === "string" && (APP_LIGHT_THEME_KEYS as readonly string[]).includes(value)
}
