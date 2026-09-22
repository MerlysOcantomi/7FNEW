import assert from "node:assert/strict"
import { test } from "node:test"
import { APP_LIGHT_PALETTES, APP_LIGHT_THEME_KEYS } from "./light-palettes"
import { applicationLightContract, applicationLightStyles, resolveApplicationLightTokens } from "./app-light"
import { contrastRatio, exportDesignJSON, parseDesignJSON } from "./resolve"

test("premium light palettes compile independently from the dark blue adapter", () => {
  for (const key of APP_LIGHT_THEME_KEYS) {
    const contract = applicationLightContract(key)
    assert.equal(contract.palette.mode, "light")
    assert.equal(parseDesignJSON(exportDesignJSON(contract)).ok, true)
    const tokens = resolveApplicationLightTokens(key)
    assert.equal(tokens["--background"], "var(--app-canvas)")
    assert.equal(tokens["--foreground"], "var(--text-primary-light)")
    assert.equal(tokens["--premium-metal"].startsWith("#"), true)
  }
})

test("premium light palette text and actions keep solid-color contrast", () => {
  for (const palette of APP_LIGHT_PALETTES) {
    assert.ok(contrastRatio(palette.colors.text, palette.colors.canvas) >= 4.5, palette.id)
    assert.ok(contrastRatio(palette.colors.text, palette.colors.surface) >= 4.5, palette.id)
  }
})

test("compiled light CSS is restricted to the approved light application keys", () => {
  const css = applicationLightStyles()
  for (const key of APP_LIGHT_THEME_KEYS) assert.ok(css.includes(`[data-theme="${key}"]`))
  assert.ok(!css.includes('[data-theme="sevenef-blue-premium"]'))
  assert.ok(!css.includes("undefined"))
  assert.ok(!css.includes("</style>"))
})
