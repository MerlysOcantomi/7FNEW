import type { DesignContract, DesignMotionPreset, DesignSurfacePreset } from "../contracts"
import { APP_BLUE_PALETTES } from "../blue-palettes"

export type PalettePreset = {
  id: string
  name: string
  mode: "dark" | "light"
  status: "existing-family" | "candidate"
  note: string
  guidance: string
  colors: { canvas: string; surface: string; surfaceStrong: string; text: string; muted: string; accent: string; accent2: string; border: string }
}

// Lab presets, not replacements for app/globals.css. Existing family keys are
// preserved. Only the two owner-approved blue directions also have an app adapter;
// all other Lab candidates remain independent of application theme allow-lists.
export const PALETTES: readonly PalettePreset[] = [
  ...APP_BLUE_PALETTES,
  { id: "midnight", name: "Midnight", mode: "dark", status: "existing-family", note: "Indigo / violet", guidance: "Violet for focus; pale lavender for text. Keep large reading surfaces deep and quiet.", colors: { canvas: "#16112A", surface: "#211A3A", surfaceStrong: "#2C2448", text: "#F2EEFF", muted: "#B8AED0", accent: "#8B5CFF", accent2: "#C4B2FF", border: "#665780" } },
  { id: "north-sea", name: "North Sea", mode: "dark", status: "candidate", note: "Navy / ice blue", guidance: "A blue alternative to Midnight, not a petrol theme. Ice-blue accents on navy with pearl text.", colors: { canvas: "#081422", surface: "#102338", surfaceStrong: "#19354F", text: "#EDF6FF", muted: "#ACBED3", accent: "#72B5F5", accent2: "#B3D8FC", border: "#516D8C" } },
  { id: "petrol-night", name: "Petrol Night", mode: "dark", status: "candidate", note: "Petrol / cool pearl", guidance: "Blue-green atmosphere with restrained aqua highlights. A dark companion, not a replacement for Petrol Pearl.", colors: { canvas: "#071D25", surface: "#0F303C", surfaceStrong: "#194454", text: "#EFFAFA", muted: "#ACC8CF", accent: "#67CCD0", accent2: "#B5E8E7", border: "#547D89" } },
  { id: "petrol-pearl", name: "Petrol Pearl", mode: "light", status: "existing-family", note: "Pearl / petrol blue", guidance: "Petrol controls and text on cool pearl. Glass and tinted surfaces add depth without a wall of white cards.", colors: { canvas: "#EEF2F4", surface: "#F7F9FA", surfaceStrong: "#E2ECF0", text: "#18262D", muted: "#52656F", accent: "#145F7B", accent2: "#0B3B4F", border: "#8399A6" } },
  { id: "rose-nude", name: "Rose Nude", mode: "light", status: "existing-family", note: "Warm ivory / rose", guidance: "Warm ivory with rose accents. Deep plum text keeps the palette readable; rose is not the body-text color.", colors: { canvas: "#FBF6F2", surface: "#FDF9F6", surfaceStrong: "#F1E2DF", text: "#35292B", muted: "#72585F", accent: "#9A3350", accent2: "#7C2842", border: "#AD8992" } },
  { id: "sage-luxe", name: "Sage Luxe", mode: "light", status: "existing-family", note: "Sage / natural pearl", guidance: "Sage-tinted panels, forest controls and warm light. Use the darker green for text and interaction.", colors: { canvas: "#F3F5F0", surface: "#F8FAF6", surfaceStrong: "#E2EADB", text: "#263128", muted: "#536451", accent: "#3B6B43", accent2: "#2F5335", border: "#839C81" } },
  { id: "noir-or", name: "Noir / Or", mode: "dark", status: "existing-family", note: "Graphite / gold", guidance: "Graphite with limited gold highlights and warm pearl type. Avoid gold across every panel.", colors: { canvas: "#0C0C0D", surface: "#171719", surfaceStrong: "#242225", text: "#F7F3E8", muted: "#B9B2A2", accent: "#C7A75A", accent2: "#EAD79B", border: "#7B7052" } },
  { id: "lavender-mist", name: "Lavender Mist", mode: "light", status: "existing-family", note: "Lavender / violet", guidance: "A light companion to Midnight. Lavender-tinted surfaces and deep violet controls, not neon text on white.", colors: { canvas: "#F4F1FB", surface: "#FAF8FE", surfaceStrong: "#E9E2F6", text: "#211B33", muted: "#5A5470", accent: "#6D3FD4", accent2: "#5B21B6", border: "#9F8DB8" } },
]

export const FONT_STACKS = {
  inter: 'var(--font-inter, Arial), ui-sans-serif, system-ui, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  "system-mono": 'ui-monospace, "Cascadia Code", Consolas, monospace',
  // Backward-compatible fallback; no claim that Geist Mono has been loaded.
  "geist-mono": 'var(--font-geist-mono, ui-monospace), Consolas, monospace',
} as const

export const TYPOGRAPHY_PRESETS: readonly { id: string; name: string; note: string; typography: DesignContract["typography"] }[] = [
  { id: "product", name: "Product Sans", note: "Inter / system sans", typography: { display: "inter", body: "inter", mono: "system-mono", scale: "standard" } },
  { id: "editorial", name: "Editorial", note: "Georgia + Inter / system sans", typography: { display: "georgia", body: "inter", mono: "system-mono", scale: "editorial" } },
  { id: "technical", name: "Technical", note: "System mono + Inter / system sans", typography: { display: "system-mono", body: "inter", mono: "system-mono", scale: "compact" } },
]
export const SURFACE_PRESETS: readonly { id: DesignSurfacePreset; name: string; note: string }[] = [
  { id: "quiet", name: "Quiet", note: "Content without a box" },
  { id: "glass", name: "Glass", note: "Light transparency" },
  { id: "glass-strong", name: "Glass Strong", note: "More separation and blur" },
  { id: "tinted", name: "Tinted", note: "Brand-tinted surface" },
  { id: "elevated", name: "Elevated", note: "Operational depth" },
  { id: "luminous", name: "Luminous", note: "One focus area, not every card" },
]
export const MOTION_PRESETS: readonly { id: DesignMotionPreset; name: string; note: string }[] = [
  { id: "none", name: "None", note: "Static presentation" },
  { id: "fade-reveal", name: "Fade Reveal", note: "Opacity + small translation" },
  { id: "center-reveal", name: "Center Reveal", note: "Center-out appearance" },
  { id: "line-reveal", name: "Line Reveal", note: "Center-out line" },
  { id: "panel-depth", name: "Panel Depth", note: "Subtle panel depth" },
  { id: "hover-lift", name: "Hover Lift", note: "Hover or keyboard focus only" },
  { id: "ai-breathe", name: "AI Breathe", note: "Finite sample of an active state" },
]
export const RADIUS_PRESETS = { precise: 6, soft: 14, "rounded-premium": 22, editorial: 10, borderless: 0 } as const
export function paletteById(id: string): PalettePreset {
  const normalized = id === "petrol" ? "petrol-night" : id
  const result = PALETTES.find((palette) => palette.id === normalized)
  if (!result) throw new Error("Unknown palette")
  return result
}
