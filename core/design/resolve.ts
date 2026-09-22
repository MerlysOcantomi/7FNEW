import type { DesignContract } from "./contracts"
import { FONT_STACKS, MOTION_PRESETS, PALETTES, RADIUS_PRESETS, SURFACE_PRESETS, paletteById } from "./presets"

export type ParseResult = { ok: true; contract: DesignContract } | { ok: false; error: string }
export const MAX_CONTRACT_SIZE = 24_000
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object")
  return value as Record<string, unknown>
}
function choice<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`Invalid ${field}`)
  return value as T
}
function boundedText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${field}`)
  return value.trim()
}

/** Whitelist-based validation. Never spread untrusted JSON into CSS or state. */
export function parseDesignContract(input: unknown): ParseResult {
  try {
    const raw = record(input)
    if (raw.version !== "0.1") throw new Error("Unsupported design contract version")
    const brand = record(raw.brand), p = record(raw.palette), t = record(raw.typography)
    const s = record(raw.surfaces), shape = record(raw.shape), e = record(raw.effects), m = record(raw.motion)
    const family = choice(p.family === "petrol" ? "petrol-night" : p.family, PALETTES.map(x => x.id), "palette")
    const palette = paletteById(family)
    if (p.mode !== palette.mode) throw new Error("Palette mode does not match this preset")
    const surfaceIds = SURFACE_PRESETS.map(x => x.id), motionIds = MOTION_PRESETS.map(x => x.id)
    const fontIds = Object.keys(FONT_STACKS)
    const contract: DesignContract = {
      version: "0.1",
      brand: { name: boundedText(brand.name, "brand name", 80) },
      palette: { family, mode: palette.mode },
      typography: {
        display: choice(t.display, fontIds, "display font"), body: choice(t.body, fontIds, "body font"),
        mono: choice(t.mono ?? "system-mono", fontIds, "mono font"),
        scale: choice(t.scale, ["compact", "standard", "editorial"], "type scale"),
      },
      density: choice(raw.density, ["compact", "balanced", "spacious"], "density"),
      shape: { radius: choice(shape.radius, Object.keys(RADIUS_PRESETS) as DesignContract["shape"]["radius"][], "radius"), border: choice(shape.border, ["hairline", "soft", "none"], "border") },
      surfaces: { default: choice(s.default, surfaceIds, "default surface"), focus: choice(s.focus, surfaceIds, "focus surface"), operational: choice(s.operational, surfaceIds, "operational surface") },
      effects: { glow: choice(e.glow, ["off", "subtle", "medium"], "glow"), blur: choice(e.blur, ["off", "soft", "strong"], "blur"), shadow: choice(e.shadow, ["flat", "soft", "deep"], "shadow") },
      motion: { reveal: choice(m.reveal, motionIds, "reveal motion"), panel: choice(m.panel, motionIds, "panel motion"), ai: choice(m.ai, motionIds, "AI motion") },
      componentPreset: choice(raw.componentPreset, ["sevenef-premium"], "component preset"),
    }
    if (brand.logoRef !== undefined) contract.brand.logoRef = boundedText(brand.logoRef, "logo reference", 500)
    if (raw.pagePreset !== undefined) contract.pagePreset = choice(raw.pagePreset, ["landing", "dashboard", "presence", "components"], "page preset")
    return { ok: true, contract }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid design contract" }
  }
}
export function parseDesignJSON(text: string): ParseResult {
  if (text.length > MAX_CONTRACT_SIZE) return { ok: false, error: "Design contract is too large" }
  try { return parseDesignContract(JSON.parse(text)) } catch { return { ok: false, error: "Invalid JSON" } }
}
function rgb(hex: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Expected a six-digit hex color")
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
}
function luminance(hex: string): number {
  const c = rgb(hex).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
}
/** Solid-color contrast only. Glass, images and complete pages need visual QA. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export function onAccentColor(accent: string): string {
  return contrastRatio(accent, "#FFFFFF") >= contrastRatio(accent, "#091119") ? "#FFFFFF" : "#091119"
}
function alpha(hex: string, opacity: number): string { return `rgba(${rgb(hex).join(", ")}, ${opacity})` }

/** Pure contract -> tokens compiler shared by live preview and CSS export. */
export function resolveDesignTokens(input: DesignContract): Record<string, string> {
  const result = parseDesignContract(input)
  if (!result.ok) throw new Error(result.error)
  const c = result.contract, p = paletteById(c.palette.family), colors = p.colors
  const glow = { off: 0, subtle: 0.12, medium: 0.24 }[c.effects.glow]
  const blur = { off: 0, soft: 12, strong: 24 }[c.effects.blur]
  const gap = { compact: 12, balanced: 20, spacious: 28 }[c.density]
  const radius = RADIUS_PRESETS[c.shape.radius]
  const shadowAlpha = p.mode === "light" ? 0.12 : 0.35
  return {
    "--fd-canvas": colors.canvas, "--fd-surface": colors.surface, "--fd-strong": colors.surfaceStrong,
    "--fd-text": colors.text, "--fd-muted": colors.muted, "--fd-accent": colors.accent,
    "--fd-accent-text": colors.accent2, "--fd-on-accent": onAccentColor(colors.accent),
    "--fd-border": alpha(colors.border, 0.65), "--fd-focus": colors.accent2,
    "--fd-border-width": c.shape.border === "none" ? "0px" : c.shape.border === "soft" ? "2px" : "1px",
    "--fd-highlight": alpha(p.mode === "dark" ? "#FFFFFF" : colors.accent, 0.09),
    "--fd-wash": alpha(colors.accent, 0.12), "--fd-glow": alpha(colors.accent, glow),
    "--fd-glass": alpha(colors.surface, 0.75), "--fd-glass-strong": alpha(colors.surfaceStrong, 0.9),
    "--fd-blur": `${blur}px`, "--fd-radius": `${radius}px`, "--fd-control-radius": `${Math.min(radius, 12)}px`,
    "--fd-gap": `${gap}px`, "--fd-space": `${gap * 1.5}px`,
    "--fd-shadow": c.effects.shadow === "flat" ? "none" : c.effects.shadow === "deep" ? `0 22px 48px -18px rgba(0, 0, 0, ${shadowAlpha})` : `0 8px 24px -10px rgba(0, 0, 0, ${shadowAlpha})`,
    "--fd-font-display": FONT_STACKS[c.typography.display as keyof typeof FONT_STACKS],
    "--fd-font-body": FONT_STACKS[c.typography.body as keyof typeof FONT_STACKS],
    "--fd-font-mono": FONT_STACKS[(c.typography.mono ?? "system-mono") as keyof typeof FONT_STACKS],
    "--fd-title-size": c.typography.scale === "editorial" ? "64px" : c.typography.scale === "compact" ? "44px" : "54px",
    "--fd-body-size": c.typography.scale === "compact" ? "14px" : "16px",
  }
}
export function exportDesignCSS(contract: DesignContract): string {
  const tokens = resolveDesignTokens(contract)
  return `/* Forte Design Foundation v0.1: tokens only. Load foundation.css for primitives. */\n.fd-theme {\n${Object.entries(tokens).map(([key, value]) => `  ${key}: ${value};`).join("\n")}\n}\n`
}
export function exportDesignJSON(contract: DesignContract): string {
  const result = parseDesignContract(contract)
  if (!result.ok) throw new Error(result.error)
  return JSON.stringify(result.contract, null, 2)
}
