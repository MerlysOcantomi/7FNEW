import assert from "node:assert/strict"
import { test } from "node:test"
import { APP_LUXE_DETAILS, APP_LUXE_PALETTES, APP_LUXE_THEME_KEYS } from "./luxe-palettes"
import { applicationLuxeContract, applicationLuxeStyles, resolveApplicationLuxeTokens } from "./app-luxe"
import { contrastRatio, exportDesignJSON, onAccentColor, parseDesignJSON } from "./resolve"

test("Finesse petrol champagne compiles as a dark application theme", () => {
  for (const key of APP_LUXE_THEME_KEYS) {
    const contract = applicationLuxeContract(key)
    assert.equal(contract.palette.mode, "dark")
    assert.equal(contract.brand.name, "Finesse")
    assert.equal(parseDesignJSON(exportDesignJSON(contract)).ok, true)

    const tokens = resolveApplicationLuxeTokens(key)
    assert.equal(tokens["--background"], "var(--app-canvas)")
    assert.equal(tokens["--foreground"], "var(--text-primary-light)")
    assert.equal(tokens["--premium-metal"], APP_LUXE_DETAILS[key].metal)
  }
})

test("petrol champagne keeps petrol structural and champagne restrained", () => {
  const palette = APP_LUXE_PALETTES[0]
  assert.equal(palette.id, "finesse-petrol-champagne")
  assert.equal(palette.colors.canvas, "#071B23")
  assert.equal(palette.colors.surface, "#0E2B34")
  assert.equal(palette.colors.accent, "#B88A62")
  assert.equal(palette.colors.accent2, "#E5C493")
  assert.ok(contrastRatio(palette.colors.text, palette.colors.canvas) >= 4.5)
  assert.ok(contrastRatio(palette.colors.muted, palette.colors.surfaceStrong) >= 4.5)
  assert.ok(contrastRatio(onAccentColor(palette.colors.accent), palette.colors.accent) >= 4.5)
})

test("compiled luxe CSS is restricted to the luxe application keys", () => {
  const css = applicationLuxeStyles()
  for (const key of APP_LUXE_THEME_KEYS) assert.ok(css.includes(`[data-theme="${key}"]`))
  assert.ok(!css.includes('[data-theme="sevenef-pearl-blue"]'))
  assert.ok(!css.includes("undefined"))
  assert.ok(!css.includes("</style>"))
})
