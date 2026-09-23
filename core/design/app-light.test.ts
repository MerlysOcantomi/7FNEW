import assert from "node:assert/strict"
import { test } from "node:test"
import { APP_LIGHT_DETAILS, APP_LIGHT_PALETTES, APP_LIGHT_THEME_KEYS } from "./light-palettes"
import { applicationLightContract, applicationLightStyles, resolveApplicationLightTokens } from "./app-light"
import { contrastRatio, exportDesignJSON, parseDesignJSON } from "./resolve"

function palette(id: typeof APP_LIGHT_THEME_KEYS[number]) {
  const found = APP_LIGHT_PALETTES.find((item) => item.id === id)
  assert.ok(found)
  return found
}

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

test("Finesse Petrol Pearl preserves the approved onboarding material language", () => {
  assert.deepEqual(palette("petrol-pearl").colors, {
    canvas: "#F7F5F0",
    surface: "#FFFFFF",
    surfaceStrong: "#EFECE4",
    text: "#082D34",
    muted: "#5E7477",
    accent: "#073B45",
    accent2: "#0B5664",
    border: "#8C9B9C",
  })
  assert.deepEqual(APP_LIGHT_DETAILS["petrol-pearl"], {
    rail: "#EFECE4",
    hover: "#032F38",
    glow: "#3A7C89",
    metal: "#CBA77B",
    metalSoft: "#E7D6BC",
  })
})

test("premium light palette text and actions keep solid-color contrast", () => {
  for (const item of APP_LIGHT_PALETTES) {
    assert.ok(contrastRatio(item.colors.text, item.colors.canvas) >= 4.5, item.id)
    assert.ok(contrastRatio(item.colors.text, item.colors.surface) >= 4.5, item.id)
  }
})

test("compiled light CSS is restricted to the approved light application keys", () => {
  const css = applicationLightStyles()
  for (const key of APP_LIGHT_THEME_KEYS) assert.ok(css.includes(`[data-theme="${key}"]`))
  assert.ok(!css.includes('[data-theme="sevenef-blue-premium"]'))
  assert.ok(!css.includes("undefined"))
  assert.ok(!css.includes("</style>"))
})
