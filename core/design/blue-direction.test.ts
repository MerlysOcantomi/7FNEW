import assert from "node:assert/strict"
import { test } from "node:test"
import { APP_BLUE_DETAILS, APP_BLUE_PALETTES, APP_BLUE_THEME_KEYS, isAppBlueThemeKey } from "./blue-palettes"

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

const APPROVED_MIDNIGHT = {
  canvas: "#070B14",
  surface: "#0D1420",
  surfaceStrong: "#121C2A",
  text: "#F5F7FA",
  muted: "#9DAABA",
  accent: "#2868F4",
  accent2: "#A9B6C6",
  border: "#556579",
}

test("Midnight is true blue-black with no violet brand cast", () => {
  const p = palette("midnight").colors
  assert.deepEqual(p, APPROVED_MIDNIGHT)
  assert.deepEqual(APP_BLUE_DETAILS.midnight, { rail: "#090F19", hover: "#245EE5", glow: "#8EADFF" })

  for (const color of [p.canvas, p.surface, p.surfaceStrong]) {
    const [r, g, b] = rgb(color)
    assert.ok(b > g && g > r, "night surfaces must remain blue-led")
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, "night surfaces must stay low-chroma")
  }

  const [ar, ag, ab] = rgb(p.accent)
  assert.ok(ab - ag > 100 && ab - ar > 150, "interaction color must read electric blue")
})

test("deprecated dark keys render the same shared Midnight material", () => {
  for (const key of ["sevenef-blue-premium", "finesse-petrol-blue"] as const) {
    assert.deepEqual(palette(key).colors, APPROVED_MIDNIGHT)
    assert.deepEqual(APP_BLUE_DETAILS[key], APP_BLUE_DETAILS.midnight)
  }
})

test("Midnight labels, secondary text and focus retain solid-color contrast", () => {
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

test("accepted dark keys keep the compatibility boundary finite", () => {
  assert.deepEqual(APP_BLUE_THEME_KEYS, ["midnight", "sevenef-blue-premium", "finesse-petrol-blue"])
  assert.equal(APP_BLUE_PALETTES.length, 3)
  for (const p of APP_BLUE_PALETTES) {
    assert.ok(isAppBlueThemeKey(p.id))
    assert.equal(p.mode, "dark")
    for (const color of Object.values(p.colors)) assert.match(color, /^#[0-9a-f]{6}$/i)
  }
  for (const invalid of [null, {}, "navy", "bad;css", ""]) assert.equal(isAppBlueThemeKey(invalid), false)
})
