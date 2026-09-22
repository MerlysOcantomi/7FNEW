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
    guidance: "The exact petrol-blue palette previously shown as sevenef Blue, now the owner's chosen Finesse direction. Preserve its blue balance and brightness. Petrol Pearl remains the light alternative.",
    colors: { canvas: "#071C2C", surface: "#12384E", surfaceStrong: "#184863", text: "#F2F7FA", muted: "#A9C0CE", accent: "#1F7AA8", accent2: "#9ED3EF", border: "#2D6B8A" },
  },
]

// Keep white-label button hovers within a contrast-checked blue range.
// Finesse deliberately retains every former sevenef petrol material value.
export const APP_BLUE_DETAILS: Record<AppBlueThemeKey, { rail: string; hover: string; glow: string }> = {
  "sevenef-blue-premium": { rail: "#102A46", hover: "#2955D5", glow: "#8AA9FF" },
  "finesse-petrol-blue": { rail: "#0B2A3D", hover: "#17678F", glow: "#58AEDA" },
}

export function isAppBlueThemeKey(key: unknown): key is AppBlueThemeKey {
  return typeof key === "string" && (APP_BLUE_THEME_KEYS as readonly string[]).includes(key)
}
