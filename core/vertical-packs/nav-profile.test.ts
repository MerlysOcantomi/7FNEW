import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveNavProfile,
  BEAUTY_NAV_PROFILE,
  getVisibleVerticalNavItems,
  showsTeamOnlyItems,
  type VerticalNavItem,
} from "./nav-profile"

// ─── resolveNavProfile: beauty keys ──────────────────────────────────────────

test("resolveNavProfile: 'beauty' returns the Beauty profile", () => {
  const p = resolveNavProfile("beauty")
  assert.equal(p, BEAUTY_NAV_PROFILE)
  assert.equal(p?.verticalKey, "beauty")
  assert.equal(p?.locale, "es")
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

test("Beauty primary menu is Hoy · Agenda · Mensajes · Clientas, in order", () => {
  assert.deepEqual(primaryIds(BEAUTY_NAV_PROFILE.items), [
    "today",
    "agenda",
    "mensajes",
    "clientas",
  ])
})

test("Beauty fallback labels are Spanish and client-neutral (P4.2.1)", () => {
  // These literals are FALLBACKS — the sidebar composes real labels from
  // entity/nav bindings; standard Finesse never shows "Clientas".
  const byId = Object.fromEntries(BEAUTY_NAV_PROFILE.items.map((i) => [i.id, i.label]))
  assert.equal(byId.today, "Hoy")
  assert.equal(byId.agenda, "Agenda")
  assert.equal(byId.clientas, "Clientes")
  assert.equal(byId.mensajes, "Mensajes")
  assert.equal(byId.servicios, "Servicios")
})

test("Beauty items declare their label source bindings", () => {
  const byId = Object.fromEntries(BEAUTY_NAV_PROFILE.items.map((i) => [i.id, i]))
  assert.equal(byId.today.navLabelKey, "today")
  assert.equal(byId.clientas.entityKey, "client")
  assert.equal(byId.clientas.entityForm, "plural")
  assert.equal(byId.agenda.entityKey, "calendar")
  assert.equal(byId.mensajes.entityKey, "inbox")
  assert.equal(byId.cobros.entityKey, "billing")
  // Brand item stays literal on purpose.
  assert.equal(byId.forte.entityKey, undefined)
  assert.equal(byId.forte.navLabelKey, undefined)
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

test("Beauty groups items into a 'Más' overflow", () => {
  assert.equal(BEAUTY_NAV_PROFILE.moreLabel, "Más")
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

test("Beauty: helpers describe functions, never agents", () => {
  const marketing = byId("marketing")?.helper ?? ""
  assert.ok(!/freya/i.test(marketing), "Marketing helper must not mention Freya")
  assert.ok(!/fiona/i.test(marketing), "Marketing helper must not mention Fiona")

  const cobros = byId("cobros")?.helper ?? ""
  assert.ok(!/felix/i.test(cobros), "Cobros helper must not mention Felix")

  // No Beauty helper attributes a section to an agent ("por <Agente>").
  for (const item of BEAUTY_NAV_PROFILE.items) {
    if (!item.helper) continue
    assert.ok(
      !/\bpor\s+f\w+/i.test(item.helper),
      `${item.id} helper must not attribute the section to an agent: "${item.helper}"`,
    )
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
