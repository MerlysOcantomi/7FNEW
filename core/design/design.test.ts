import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_DESIGN_CONTRACT, type DesignContract } from "./contracts"
import { PALETTES, RADIUS_PRESETS, TYPOGRAPHY_PRESETS, paletteById } from "./presets"
import { MAX_CONTRACT_SIZE, contrastRatio, exportDesignCSS, exportDesignJSON, onAccentColor, parseDesignContract, parseDesignJSON, resolveDesignTokens } from "./resolve"
import { DESIGN_DRAFT_KEY, readDesignDraft, saveDesignDraft, type DraftStorage } from "./draft"

const fresh = (): DesignContract => JSON.parse(JSON.stringify(DEFAULT_DESIGN_CONTRACT))
function memoryStorage(): DraftStorage {
  const data = new Map<string, string>()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: key => { data.delete(key) } }
}

test("default contract validates and round-trips without mutation", () => {
  const original = fresh(), before = JSON.stringify(original)
  const result = parseDesignJSON(exportDesignJSON(original))
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.contract, original)
  assert.equal(JSON.stringify(original), before)
})

test("all premium and legacy palettes resolve; existing palette IDs are preserved", () => {
  assert.equal(PALETTES.length, 12)
  for (const key of ["midnight", "lavender-mist", "rose-nude", "sage-luxe", "noir-or", "petrol-pearl", "sevenef-pearl-blue", "finesse-rose-cream-gold"]) assert.ok(PALETTES.some(p => p.id === key))
  for (const p of PALETTES) {
    const contract = fresh(); contract.palette = { family: p.id, mode: p.mode }
    const tokens = resolveDesignTokens(contract)
    assert.equal(tokens["--fd-canvas"], p.colors.canvas)
    assert.ok(Object.values(tokens).every(value => typeof value === "string" && !value.includes("undefined")))
  }
})

test("old petrol alias maps explicitly to petrol-night, never petrol-pearl", () => {
  const contract = fresh(); contract.palette.family = "petrol"
  const result = parseDesignContract(contract)
  assert.ok(result.ok)
  if (result.ok) assert.equal(result.contract.palette.family, "petrol-night")
  assert.equal(paletteById("petrol").id, "petrol-night")
})

test("palette-mode mismatch and unknown palettes fail closed", () => {
  const contract = fresh(); contract.palette.mode = "light"
  assert.equal(parseDesignContract(contract).ok, false)
  contract.palette.family = "does-not-exist"
  assert.equal(parseDesignContract(contract).ok, false)
  assert.throws(() => paletteById("does-not-exist"))
})

test("missing objects, malformed JSON and oversized input return errors", () => {
  for (const value of [null, [], {}, false, "text", { version: "99" }]) assert.equal(parseDesignContract(value).ok, false)
  assert.equal(parseDesignJSON("{broken").ok, false)
  assert.equal(parseDesignJSON(" ".repeat(MAX_CONTRACT_SIZE + 1)).ok, false)
})

test("invalid font and CSS-like values cannot enter the token compiler", () => {
  const contract = fresh(); contract.typography.display = "Arial; background:url(https://example.invalid)"
  assert.equal(parseDesignContract(contract).ok, false)
  assert.throws(() => resolveDesignTokens(contract))
  const other = fresh() as unknown as { effects: { glow: string } }
  other.effects.glow = "infinite"
  assert.equal(parseDesignContract(other).ok, false)
})

test("unknown and prototype-like keys are removed by the whitelist", () => {
  const payload = JSON.parse(exportDesignJSON(fresh()))
  payload.secrets = "do-not-copy"
  payload.brand.extra = "do-not-copy"
  Object.defineProperty(payload, "__proto__", { enumerable: true, value: { injected: true } })
  const result = parseDesignContract(payload)
  assert.ok(result.ok)
  if (result.ok) {
    assert.equal(Object.hasOwn(result.contract, "__proto__"), false)
    assert.equal(JSON.stringify(result.contract).includes("do-not-copy"), false)
  }
})

test("empty or too-long brand names are rejected; names never enter CSS", () => {
  for (const name of ["", "  ", "a".repeat(81)]) { const c = fresh(); c.brand.name = name; assert.equal(parseDesignContract(c).ok, false) }
  const c = fresh(); c.brand.name = "my-brand-unique"
  c.brand.logoRef = "opaque:asset-reference"
  assert.equal(exportDesignCSS(c).includes("my-brand-unique"), false)
  assert.equal(exportDesignCSS(c).includes("opaque:asset-reference"), false)
})

test("every typography choice changes the actual display-font token", () => {
  const resolved = TYPOGRAPHY_PRESETS.map(p => { const c = fresh(); c.typography = { ...p.typography }; return resolveDesignTokens(c)["--fd-font-display"] })
  assert.equal(new Set(resolved).size, TYPOGRAPHY_PRESETS.length)
})

test("radius and density compile to the selected values", () => {
  for (const [radius, value] of Object.entries(RADIUS_PRESETS)) {
    const c = fresh(); c.shape.radius = radius as DesignContract["shape"]["radius"]
    assert.equal(resolveDesignTokens(c)["--fd-radius"], `${value}px`)
  }
  const c = fresh(); c.density = "compact"; assert.equal(resolveDesignTokens(c)["--fd-gap"], "12px")
  c.density = "spacious"; assert.equal(resolveDesignTokens(c)["--fd-gap"], "28px")
})

test("effects can be genuinely disabled", () => {
  const c = fresh(); c.effects = { glow: "off", blur: "off", shadow: "flat" }; c.shape.border = "none"
  const tokens = resolveDesignTokens(c)
  assert.equal(tokens["--fd-blur"], "0px"); assert.equal(tokens["--fd-shadow"], "none")
  assert.equal(tokens["--fd-border-width"], "0px"); assert.match(tokens["--fd-glow"], /, 0\)$/)
})

test("exported CSS is exactly the compiler token set", () => {
  const c = fresh(), css = exportDesignCSS(c)
  for (const [key, value] of Object.entries(resolveDesignTokens(c))) assert.ok(css.includes(`  ${key}: ${value};`))
  assert.equal(css.includes(":root"), false)
})

test("solid-color contrast calculation and button labels are checked", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21)
  assert.equal(contrastRatio("#112233", "#112233"), 1)
  assert.throws(() => contrastRatio("red", "#FFFFFF"))
  for (const p of PALETTES) {
    assert.ok(contrastRatio(p.colors.text, p.colors.canvas) >= 4.5, p.id)
    assert.ok(contrastRatio(onAccentColor(p.colors.accent), p.colors.accent) >= 4.5, p.id)
  }
})

test("local drafts save and restore using an injected storage adapter", () => {
  const storage = memoryStorage(), c = fresh()
  const result = saveDesignDraft(storage, c, new Date("2026-09-22T00:00:00Z"))
  assert.ok(result.ok)
  const restored = readDesignDraft(storage)
  assert.ok(restored.ok)
  if (restored.ok) { assert.deepEqual(restored.contract, c); assert.equal(restored.savedAt, "2026-09-22T00:00:00.000Z") }
})

test("missing, damaged and unsupported drafts fail gracefully", () => {
  const storage = memoryStorage()
  assert.equal(readDesignDraft(storage).ok, false)
  for (const content of ["broken", "null", '{"version":9}', JSON.stringify({ version: 1, savedAt: "invalid", contract: fresh() })]) {
    storage.setItem(DESIGN_DRAFT_KEY, content); assert.equal(readDesignDraft(storage).ok, false)
  }
})

test("blocked storage and invalid contracts never report saved", () => {
  const storage: DraftStorage = { getItem() { throw new Error("blocked") }, setItem() { throw new Error("quota") }, removeItem() {} }
  assert.equal(readDesignDraft(storage).ok, false)
  assert.equal(saveDesignDraft(storage, fresh()).ok, false)
  const c = fresh(); c.brand.name = ""
  assert.equal(saveDesignDraft(memoryStorage(), c).ok, false)
})
