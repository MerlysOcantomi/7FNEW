import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveNavProfile,
  BEAUTY_NAV_PROFILE,
  getVisibleVerticalNavItems,
  showsTeamOnlyItems,
  type VerticalNavItem,
} from "./nav-profile"
import { nav as enNav } from "@core/i18n/ui/en/nav"
import { nav as esNav } from "@core/i18n/ui/es/nav"

// ─── resolveNavProfile: beauty keys ──────────────────────────────────────────

test("resolveNavProfile: 'beauty' returns the Beauty profile", () => {
  const p = resolveNavProfile("beauty")
  assert.equal(p, BEAUTY_NAV_PROFILE)
  assert.equal(p?.verticalKey, "beauty")
  // Fallback literals are English canonical — the rendered language comes
  // from the bindings + the effective locale (P4.FINESSE-ENES).
  assert.equal(p?.locale, "en")
})

test("resolveNavProfile: salon/nails/barber alias to Beauty", () => {
  for (const key of ["salon", "nails", "barber", "barbershop", "spa", "lashes", "estetica"]) {
    assert.equal(resolveNavProfile(key), BEAUTY_NAV_PROFILE, `expected ${key} → beauty`)
  }
})

// ─── resolveNavProfile: fallback (the safety guarantee) ──────────────────────

test("resolveNavProfile: non-beauty verticals fall back to null (default nav)", () => {
  assert.equal(resolveNavProfile("creative-agency"), null)
  assert.equal(resolveNavProfile("construction"), null)
  assert.equal(resolveNavProfile("clinic"), null)
})

test("resolveNavProfile: empty/nullish input → null", () => {
  assert.equal(resolveNavProfile(null), null)
  assert.equal(resolveNavProfile(undefined), null)
  assert.equal(resolveNavProfile(""), null)
})

// ─── Beauty profile shape ────────────────────────────────────────────────────

const primaryIds = (items: VerticalNavItem[]) =>
  items.filter((i) => i.group === "primary").map((i) => i.id)

test("Beauty primary menu is My salon · Today · Calendar · Messages · Clients, in order", () => {
  assert.deepEqual(primaryIds(BEAUTY_NAV_PROFILE.items), [
    "my-salon",
    "today",
    "agenda",
    "mensajes",
    "clientas",
  ])
})

test("Beauty: My salon reuses the core overview route (no invented page)", () => {
  const mySalon = BEAUTY_NAV_PROFILE.items.find((i) => i.id === "my-salon")
  assert.equal(mySalon?.href, "/")
  assert.equal(mySalon?.label, "My salon")
  // Structural binding: the visible label localizes via the nav catalog.
  assert.equal(mySalon?.entityKey, undefined)
  assert.equal(mySalon?.navLabelKey, "mySalon")
})

test("Beauty fallback labels are English canonical and client-neutral", () => {
  // These literals are FALLBACKS — the sidebar composes real labels from
  // entity/nav bindings; the profile never carries a final language.
  const byId = Object.fromEntries(BEAUTY_NAV_PROFILE.items.map((i) => [i.id, i.label]))
  assert.equal(byId.today, "Today")
  assert.equal(byId.agenda, "Calendar")
  assert.equal(byId.clientas, "Clients")
  assert.equal(byId.mensajes, "Messages")
  assert.equal(byId.servicios, "Services")
})

test("Beauty items declare their label source bindings", () => {
  const byId = Object.fromEntries(BEAUTY_NAV_PROFILE.items.map((i) => [i.id, i]))
  assert.equal(byId["my-salon"].navLabelKey, "mySalon")
  assert.equal(byId.today.navLabelKey, "today")
  assert.equal(byId.clientas.entityKey, "client")
  assert.equal(byId.clientas.entityForm, "plural")
  assert.equal(byId.agenda.entityKey, "calendar")
  assert.equal(byId.mensajes.entityKey, "inbox")
  assert.equal(byId.cobros.entityKey, "billing")
  // Brand item stays literal on purpose (label), helper still binds.
  assert.equal(byId.forte.entityKey, undefined)
  assert.equal(byId.forte.navLabelKey, undefined)
  // Helper subtitles are catalog bindings, never profile literals.
  assert.equal(byId.marketing.helperKey, "marketing")
  assert.equal(byId.cobros.helperKey, "billing")
  assert.equal(byId.forte.helperKey, "forteLab")
})

test("Beauty hides Projects / Reports / advanced Finance by omission", () => {
  const ids = new Set(BEAUTY_NAV_PROFILE.items.map((i) => i.id))
  for (const hidden of ["proyectos", "projects", "reports", "finanzas", "inventory", "tareas"]) {
    assert.ok(!ids.has(hidden), `Beauty nav must not surface ${hidden}`)
  }
})

test("every Beauty nav href points at an existing route (starts with '/')", () => {
  for (const item of BEAUTY_NAV_PROFILE.items) {
    assert.match(item.href, /^\//, `${item.id} href must be an app route`)
  }
})

test("Beauty groups items into a 'More' overflow (nav.more localizes it)", () => {
  assert.equal(BEAUTY_NAV_PROFILE.moreLabel, "More")
  const more = BEAUTY_NAV_PROFILE.items.filter((i) => i.group === "more")
  assert.ok(more.length > 0)
  assert.ok(more.some((i) => i.id === "cobros"))
})

// ─── BEAUTY-D1B: final profile shape ─────────────────────────────────────────

const byId = (id: string) => BEAUTY_NAV_PROFILE.items.find((i) => i.id === id)

test("Beauty: Servicios lives in the 'more' group", () => {
  assert.equal(byId("servicios")?.group, "more")
})

test("Beauty: Biblioteca/Herramientas is not in the profile", () => {
  const ids = new Set(BEAUTY_NAV_PROFILE.items.map((i) => i.id))
  assert.ok(!ids.has("herramientas"))
  assert.ok(!BEAUTY_NAV_PROFILE.items.some((i) => i.href === "/biblioteca"))
})

test("Beauty: Notificaciones is not in the profile", () => {
  const ids = new Set(BEAUTY_NAV_PROFILE.items.map((i) => i.id))
  assert.ok(!ids.has("notificaciones"))
  assert.ok(!BEAUTY_NAV_PROFILE.items.some((i) => i.href === "/notificaciones"))
})

test("Beauty: Equipo is the only teamOnly item", () => {
  assert.equal(byId("equipo")?.teamOnly, true)
  const teamOnly = BEAUTY_NAV_PROFILE.items.filter((i) => i.teamOnly === true)
  assert.deepEqual(teamOnly.map((i) => i.id), ["equipo"])
})

test("Beauty: helpers are catalog bindings that describe functions, never agents", () => {
  // Helper text lives in the nav catalog (`nav.helpers`) in both locales —
  // assert the catalog copy never attributes a section to an agent.
  for (const catalog of [enNav, esNav]) {
    for (const text of Object.values(catalog.helpers)) {
      assert.ok(!/freya|fiona|felix|fanny/i.test(text), `helper must not mention an agent: "${text}"`)
      assert.ok(!/\b(por|by)\s+f\w+/i.test(text), `helper must not attribute to an agent: "${text}"`)
    }
  }
})

test("Beauty: Mr. Forte Lab has the correct label", () => {
  assert.equal(byId("forte")?.label, "Mr. Forte Lab")
})

// ─── BEAUTY-D1B: Solo/Team visibility filter (mandatory) ─────────────────────

const visibleIds = (includedSeats: number | null | undefined) =>
  getVisibleVerticalNavItems(BEAUTY_NAV_PROFILE, { includedSeats }).map((i) => i.id)

const moreIds = (includedSeats: number | null | undefined) =>
  getVisibleVerticalNavItems(BEAUTY_NAV_PROFILE, { includedSeats })
    .filter((i) => i.group === "more")
    .map((i) => i.id)

test("showsTeamOnlyItems: 1 → hide, >1 → show, null → show, undefined → hide", () => {
  assert.equal(showsTeamOnlyItems(1), false)
  assert.equal(showsTeamOnlyItems(2), true)
  assert.equal(showsTeamOnlyItems(10), true)
  assert.equal(showsTeamOnlyItems(null), true)
  assert.equal(showsTeamOnlyItems(undefined), false)
})

test("includedSeats === 1 removes Equipo from the visible items", () => {
  assert.ok(!visibleIds(1).includes("equipo"))
})

test("includedSeats === 2 keeps Equipo", () => {
  assert.ok(visibleIds(2).includes("equipo"))
})

test("includedSeats === 10 keeps Equipo", () => {
  assert.ok(visibleIds(10).includes("equipo"))
})

test("includedSeats === null (unlimited) keeps Equipo", () => {
  assert.ok(visibleIds(null).includes("equipo"))
})

test("includedSeats === undefined (loading) removes Equipo", () => {
  assert.ok(!visibleIds(undefined).includes("equipo"))
})

test("Solo 'Más' order is Marketing · Cobros · Servicios · Mr. Forte Lab", () => {
  assert.deepEqual(moreIds(1), ["marketing", "cobros", "servicios", "forte"])
})

test("Team 'Más' order is Marketing · Cobros · Servicios · Equipo · Mr. Forte Lab", () => {
  assert.deepEqual(moreIds(2), ["marketing", "cobros", "servicios", "equipo", "forte"])
})
