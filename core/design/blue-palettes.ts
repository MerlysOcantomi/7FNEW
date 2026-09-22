import type { PalettePreset } from "./presets"

/** 7F-DESIGN-02.2: owner-reviewed directions; rollout remains in Preview. */
export const APP_BLUE_THEME_KEYS = ["sevenef-blue-premium", "finesse-petrol-blue"] as const
export type AppBlueThemeKey = typeof APP_BLUE_THEME_KEYS[number]

export const APP_BLUE_PALETTES: readonly PalettePreset[] = [
  {
    id: "sevenef-blue-premium", name: "sevenef / Navy Electric Silver", mode: "dark", status: "candidate",
    note: "Recommended / sevenef application",
    guidance: "Navy-blue planes, electric-blue actions and restrained silver-gray text and edges. No green tint, no flat gray card wall; preserve visible color and depth.",
    colors: { canvas: "#0D1C33", surface: "#1A365C", surfaceStrong: "#25466E", text: "#F3F5F8", muted: "#BBC4D2", accent: "#3264F5", accent2: "#C8D2E2", border: "#63768F" },
  },
  {
    id: "finesse-petrol-blue", name: "Finesse / Petrol Blue", mode: "dark", status: "candidate",
    note: "Recommended / Finesse application",
    guidance: "Deep navy-petrol canvas with neutral charcoal-blue working surfaces. Blue remains the interaction accent instead of filling every card; the palette stays unmistakably blue, never green.",
    colors: { canvas: "#071426", surface: "#101923", surfaceStrong: "#141F2B", text: "#F4F7FA", muted: "#A3B0BD", accent: "#1F6E8C", accent2: "#83B7CE", border: "#6C8496" },
  },
]

// Keep white-label button hovers within a contrast-checked blue range.
// Finesse keeps blue-led petrol identity while moving operational surfaces toward neutral charcoal.
export const APP_BLUE_DETAILS: Record<AppBlueThemeKey, { rail: string; hover: string; glow: string }> = {
  "sevenef-blue-premium": { rail: "#102A46", hover: "#2955D5", glow: "#8AA9FF" },
  "finesse-petrol-blue": { rail: "#0A1520", hover: "#297A99", glow: "#6EA6BD" },
}

export function isAppBlueThemeKey(key: unknown): key is AppBlueThemeKey {
  return typeof key === "string" && (APP_BLUE_THEME_KEYS as readonly string[]).includes(key)
}
