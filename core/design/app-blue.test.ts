import assert from "node:assert/strict"
import { test } from "node:test"
import { runInNewContext } from "node:vm"
import { APP_BLUE_THEME_KEYS, APP_BLUE_DETAILS, APP_BLUE_PALETTES } from "./blue-palettes"
import { APP_LIGHT_THEME_KEYS } from "./light-palettes"
import { applicationBlueContract, applicationBlueStyles, resolveApplicationBlueTokens } from "./app-blue"
import { contrastRatio, exportDesignJSON, parseDesignJSON, resolveDesignTokens } from "./resolve"
import { applicationDefaultTheme, buildThemeBootstrap, isValidThemeKey, selectAppTheme, VALID_THEME_KEYS } from "../theme-registry"

function bootstrap(options: { query?: string; stored?: string; fallback?: string; path?: string; readBlocked?: boolean; writeBlocked?: boolean }) {
  let theme = "", writes = 0
  runInNewContext(buildThemeBootstrap(options.fallback ?? "sevenef-blue-premium"), {
    URLSearchParams,
    location: { search: options.query ?? "", pathname: options.path ?? "/inbox" },
    localStorage: {
      getItem() { if (options.readBlocked) throw new Error("blocked"); return options.stored ?? null },
      setItem() { if (options.writeBlocked) throw new Error("blocked"); writes++ },
    },
    document: { documentElement: { setAttribute(name: string, value: string) { assert.equal(name, "data-theme"); theme = value } } },
  })
  return { theme, writes }
}

test("registry retains all old themes and adds only the approved app blues", () => {
  for (const key of ["midnight", "lavender-mist", "rose-nude", "sage-luxe", "noir-or", ...APP_BLUE_THEME_KEYS, ...APP_LIGHT_THEME_KEYS]) assert.ok(isValidThemeKey(key))
  assert.equal(new Set(VALID_THEME_KEYS).size, VALID_THEME_KEYS.length)
  assert.equal(isValidThemeKey("north-sea"), false)
  assert.equal(isValidThemeKey("bad;css"), false)
})

test("application defaults are distinct and preserve other declared vertical themes", () => {
  assert.equal(applicationDefaultTheme(null, "midnight"), "sevenef-blue-premium")
  assert.equal(applicationDefaultTheme("beauty", "petrol-pearl"), "finesse-petrol-blue")
  assert.equal(applicationDefaultTheme("other", "sage-luxe"), "sage-luxe")
})

test("explicit choices always outrank the new defaults", () => {
  assert.equal(selectAppTheme(null, "midnight", "sevenef-blue-premium"), "midnight")
  assert.equal(selectAppTheme("petrol-pearl", "finesse-petrol-blue", "sevenef-blue-premium"), "petrol-pearl")
  assert.equal(selectAppTheme("invalid", "invalid", "invalid"), "midnight")
})

test("bootstrap agrees with the pure selector for every registered theme", () => {
  for (const query of [undefined, "invalid", ...VALID_THEME_KEYS]) {
    for (const stored of [undefined, "invalid", ...VALID_THEME_KEYS]) {
      const actual = bootstrap({ query: query ? `?theme=${query}` : "", stored })
      assert.equal(actual.theme, selectAppTheme(query, stored, "sevenef-blue-premium"))
      assert.equal(actual.writes, isValidThemeKey(query) ? 1 : 0)
    }
  }
})

test("blocked storage cannot lose the query choice or app default", () => {
  assert.equal(bootstrap({ query: "?theme=finesse-petrol-blue", readBlocked: true, writeBlocked: true }).theme, "finesse-petrol-blue")
  assert.equal(bootstrap({ readBlocked: true }).theme, "sevenef-blue-premium")
})

test("public sites and client portals are not enrolled into app skins", () => {
  for (const path of ["/sites/demo", "/widget", "/cliente/perfil", "/finesse"]) {
    assert.deepEqual(bootstrap({ path, query: "?theme=sevenef-blue-premium", stored: "finesse-petrol-blue" }), { theme: "midnight", writes: 0 })
    assert.equal(bootstrap({ path, stored: "rose-nude" }).theme, "rose-nude")
  }
  assert.equal(bootstrap({ path: "/sites-other" }).theme, "sevenef-blue-premium")
})

test("each premium app palette is serializable with the existing Foundation compiler", () => {
  for (const key of [...APP_BLUE_THEME_KEYS, ...APP_LIGHT_THEME_KEYS]) {
    const c = applicationBlueContract(key)
    assert.equal(parseDesignJSON(exportDesignJSON(c)).ok, true)
    const app = resolveApplicationBlueTokens(key), foundation = resolveDesignTokens(c)
    assert.equal(app["--app-canvas"], foundation["--fd-canvas"])
    assert.equal(app["--app-surface-dark"], foundation["--fd-surface"])
    assert.equal(app["--accent-primary"], foundation["--fd-accent"])
    assert.equal(app["--inbox-chat-text"], "var(--text-primary-light)")
  }
})

test("blue-first guard and text/CTA/focus contrast on the brightest panel", () => {
  for (const p of APP_BLUE_PALETTES) {
    const key = p.id as typeof APP_BLUE_THEME_KEYS[number]
    const d = APP_BLUE_DETAILS[key]
    for (const hex of [p.colors.canvas, p.colors.surface, p.colors.surfaceStrong, p.colors.accent]) {
      assert.ok(parseInt(hex.slice(5, 7), 16) > parseInt(hex.slice(3, 5), 16), `${p.id}: avoid green drift`)
    }
    assert.ok(contrastRatio("#FFFFFF", p.colors.accent) >= 4.5, `${key} CTA`)
    assert.ok(contrastRatio("#FFFFFF", d.hover) >= 4.5, `${key} CTA hover`)
    assert.ok(contrastRatio(p.colors.text, p.colors.surfaceStrong) >= 4.5, `${key} text`)
    assert.ok(contrastRatio(p.colors.muted, p.colors.surfaceStrong) >= 4.5, `${key} muted`)
    assert.ok(contrastRatio(d.glow, p.colors.surfaceStrong) >= 3, `${key} focus`)
  }
})

test("app aliases have no cycles or unresolved internal references", () => {
  for (const key of APP_BLUE_THEME_KEYS) {
    const tokens = resolveApplicationBlueTokens(key)
    function visit(name: string, chain: string[] = []) {
      assert.ok(!chain.includes(name), `Alias cycle: ${chain.join(" -> ")} -> ${name}`)
      assert.ok(name in tokens, `Missing token ${name}`)
      for (const match of tokens[name].matchAll(/var\((--[a-z-]+)/g)) {
        if (match[1].startsWith("--font-")) continue // next/font with explicit fallback
        visit(match[1], [...chain, name])
      }
    }
    for (const name of Object.keys(tokens)) visit(name)
  }
})

test("compiled CSS targets only the two blue themes and contains no unsafe values", () => {
  const css = applicationBlueStyles()
  assert.ok(css.includes(':root[data-theme="sevenef-blue-premium"]'))
  assert.ok(css.includes(':root[data-theme="finesse-petrol-blue"]'))
  assert.ok(css.includes(':root[data-theme="sevenef-pearl-blue"]'))
  assert.ok(css.includes(':root[data-theme="finesse-rose-cream-gold"]'))
  assert.ok(!css.includes('[data-theme="rose-nude"]'))
  assert.ok(!css.includes("undefined"))
  assert.ok(!css.includes("</style>"))
  assert.throws(() => resolveApplicationBlueTokens("unknown" as typeof APP_BLUE_THEME_KEYS[number]))
})
