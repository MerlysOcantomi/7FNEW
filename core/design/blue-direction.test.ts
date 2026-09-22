import assert from "node:assert/strict"
import { test } from "node:test"
import { APP_BLUE_DETAILS, APP_BLUE_PALETTES, APP_BLUE_THEME_KEYS, isAppBlueThemeKey } from "./blue-palettes"

// Independent solid-color checks for the reviewed palette values, not a claim
// of full-page accessibility over transparency, photos or legacy components.
function rgb(hex: string): number[] {
  assert.match(hex, /^#[0-9a-f]{6}$/i)
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
function palette(id: typeof APP_BLUE_THEME_KEYS[number]) {
  const found = APP_BLUE_PALETTES.find(item => item.id === id)
  assert.ok(found)
  return found
}

const APPROVED_PETROL = {
  canvas: "#071C2C", surface: "#12384E", surfaceStrong: "#184863",
  text: "#F2F7FA", muted: "#A9C0CE", accent: "#1F7AA8",
  accent2: "#9ED3EF", border: "#2D6B8A",
}

test("Finesse is the exact former sevenef Blue, not a new greener interpretation", () => {
  assert.deepEqual(palette("finesse-petrol-blue").colors, APPROVED_PETROL)
  assert.deepEqual(APP_BLUE_DETAILS["finesse-petrol-blue"], { rail: "#0B2A3D", hover: "#17678F", glow: "#58AEDA" })
})

test("sevenef has navy planes, electric blue actions and low-chroma silver neutrals", () => {
  const p = palette("sevenef-blue-premium").colors
  for (const color of [p.canvas, p.surface, p.surfaceStrong]) {
    const [r, g, b] = rgb(color)
    assert.ok(b > g && g > r, "blue must remain visibly dominant")
    assert.ok(b - g >= 20)
  }
  const [r, g, b] = rgb(p.accent)
  assert.ok(b - g > 100 && b - r > 150, "action color must read electric blue")
  for (const color of [p.text, p.muted, p.accent2]) {
    const channels = rgb(color)
    assert.ok(Math.max(...channels) - Math.min(...channels) < 30, "silver neutrals must not become teal")
  }
})

test("sevenef does not become darker while shifting from petrol toward navy", () => {
  const p = palette("sevenef-blue-premium").colors
  for (const key of ["canvas", "surface", "surfaceStrong"] as const) {
    assert.ok(luminance(p[key]) >= luminance(APPROVED_PETROL[key]), `${key}: brightness must not decrease`)
  }
})

test("labels, secondary text and focus retain solid-color contrast", () => {
  for (const key of APP_BLUE_THEME_KEYS) {
    const p = palette(key).colors, d = APP_BLUE_DETAILS[key]
    assert.ok(contrast("#FFFFFF", p.accent) >= 4.5, `${key}: CTA label`)
    assert.ok(contrast("#FFFFFF", d.hover) >= 4.5, `${key}: hover label`)
    for (const surface of [p.canvas, p.surface, p.surfaceStrong, d.rail]) {
      assert.ok(contrast(p.text, surface) >= 4.5, `${key}: primary text`)
      assert.ok(contrast(p.muted, surface) >= 4.5, `${key}: secondary text`)
      assert.ok(contrast(d.glow, surface) >= 3, `${key}: focus edge`)
    }
  }
})

test("existing theme identities and accepted-key boundaries stay stable", () => {
  assert.deepEqual(APP_BLUE_THEME_KEYS, ["sevenef-blue-premium", "finesse-petrol-blue"])
  assert.equal(APP_BLUE_PALETTES.length, 2)
  for (const p of APP_BLUE_PALETTES) {
    assert.ok(isAppBlueThemeKey(p.id))
    assert.equal(p.mode, "dark")
    assert.equal(p.status, "candidate")
    for (const color of Object.values(p.colors)) assert.match(color, /^#[0-9a-f]{6}$/i)
  }
  for (const invalid of [null, {}, "navy", "bad;css", ""]) assert.equal(isAppBlueThemeKey(invalid), false)
})
