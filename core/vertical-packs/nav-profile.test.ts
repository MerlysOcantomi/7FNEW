import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveNavProfile,
  BEAUTY_NAV_PROFILE,
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

test("Beauty primary menu is Hoy · Agenda · Clientas · Mensajes · Marketing · Servicios, in order", () => {
  assert.deepEqual(primaryIds(BEAUTY_NAV_PROFILE.items), [
    "today",
    "agenda",
    "clientas",
    "mensajes",
    "marketing",
    "servicios",
  ])
})

test("Beauty labels are Spanish", () => {
  const byId = Object.fromEntries(BEAUTY_NAV_PROFILE.items.map((i) => [i.id, i.label]))
  assert.equal(byId.today, "Hoy")
  assert.equal(byId.agenda, "Agenda")
  assert.equal(byId.clientas, "Clientas")
  assert.equal(byId.mensajes, "Mensajes")
  assert.equal(byId.servicios, "Servicios")
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
