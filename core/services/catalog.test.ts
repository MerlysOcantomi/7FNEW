import { test } from "node:test"
import assert from "node:assert/strict"
import {
  slugifyServiceName,
  makeServiceId,
  normalizeServiceItem,
  resolveServiceCatalog,
  normalizeServiceCatalog,
  activeServiceNames,
  MAX_SERVICE_CATALOG_ITEMS,
  type ServiceCatalogItem,
} from "./catalog"

test("slugifyServiceName strips accents, lowercases and dashes", () => {
  assert.equal(slugifyServiceName("Manicura semipermanente"), "manicura-semipermanente")
  assert.equal(slugifyServiceName("Depilación de cejas"), "depilacion-de-cejas")
  assert.equal(slugifyServiceName("  Nail Art!!  "), "nail-art")
  assert.equal(slugifyServiceName("💅✨"), "")
})

test("makeServiceId derives from name and avoids collisions", () => {
  const used = new Set<string>()
  const a = makeServiceId("Pedicura", used)
  used.add(a)
  const b = makeServiceId("Pedicura", used)
  used.add(b)
  assert.equal(a, "pedicura")
  assert.equal(b, "pedicura-2")
})

test("makeServiceId falls back to 'service' for empty slugs", () => {
  assert.equal(makeServiceId("💅", new Set()), "service")
})

test("normalizeServiceItem drops entries without a name", () => {
  assert.equal(normalizeServiceItem({ category: "Uñas", active: true }, new Set()), null)
  assert.equal(normalizeServiceItem({ name: "   " }, new Set()), null)
  assert.equal(normalizeServiceItem(null, new Set()), null)
  assert.equal(normalizeServiceItem("nope", new Set()), null)
})

test("normalizeServiceItem generates a stable id when missing (seed shape)", () => {
  const item = normalizeServiceItem({ name: "Pedicura", category: "Uñas", active: true }, new Set())
  assert.deepEqual(item, { id: "pedicura", name: "Pedicura", category: "Uñas", active: true })
})

test("normalizeServiceItem defaults active to true when absent", () => {
  const item = normalizeServiceItem({ name: "Lifting de pestañas" }, new Set())
  assert.equal(item?.active, true)
})

test("normalizeServiceItem keeps a provided id and honors active:false", () => {
  const item = normalizeServiceItem({ id: "svc_custom", name: "Nail art", active: false }, new Set())
  assert.equal(item?.id, "svc_custom")
  assert.equal(item?.active, false)
})

test("normalizeServiceItem regenerates a colliding provided id", () => {
  const used = new Set<string>(["taken"])
  const item = normalizeServiceItem({ id: "taken", name: "Manicura" }, used)
  assert.equal(item?.id, "manicura")
})

test("resolveServiceCatalog tolerates the beauty seed shape (no ids)", () => {
  const seed = [
    { name: "Manicura semipermanente", category: "Uñas", active: true },
    { name: "Pedicura", category: "Uñas", active: true },
  ]
  const resolved = resolveServiceCatalog(seed)
  assert.equal(resolved.length, 2)
  assert.deepEqual(
    resolved.map((s) => s.id),
    ["manicura-semipermanente", "pedicura"],
  )
})

test("resolveServiceCatalog is tolerant: non-array and junk entries", () => {
  assert.deepEqual(resolveServiceCatalog(null), [])
  assert.deepEqual(resolveServiceCatalog("x"), [])
  assert.deepEqual(resolveServiceCatalog(undefined), [])
  const mixed = resolveServiceCatalog([{ name: "OK" }, null, 3, { category: "x" }])
  assert.equal(mixed.length, 1)
  assert.equal(mixed[0].name, "OK")
})

test("resolveServiceCatalog de-duplicates ids across the whole list", () => {
  const resolved = resolveServiceCatalog([
    { name: "Pedicura" },
    { name: "Pedicura" },
    { name: "Pedicura" },
  ])
  assert.deepEqual(resolved.map((s) => s.id), ["pedicura", "pedicura-2", "pedicura-3"])
})

test("resolveServiceCatalog caps the list at MAX_SERVICE_CATALOG_ITEMS", () => {
  const many = Array.from({ length: MAX_SERVICE_CATALOG_ITEMS + 10 }, (_, i) => ({
    name: `Service ${i}`,
  }))
  assert.equal(resolveServiceCatalog(many).length, MAX_SERVICE_CATALOG_ITEMS)
})

test("normalizeServiceCatalog mirrors resolveServiceCatalog (never trusts client shape)", () => {
  const out = normalizeServiceCatalog([{ name: " Trim me ", active: false }])
  assert.deepEqual(out, [{ id: "trim-me", name: "Trim me", active: false }])
})

test("activeServiceNames returns only active names, de-duplicated, in order", () => {
  const catalog: ServiceCatalogItem[] = [
    { id: "a", name: "Manicura", active: true },
    { id: "b", name: "Pedicura", active: false },
    { id: "c", name: "Nail art", active: true },
    { id: "d", name: "Manicura", active: true },
  ]
  assert.deepEqual(activeServiceNames(catalog), ["Manicura", "Nail art"])
})

test("activeServiceNames excludes inactive services from the agent bridge", () => {
  const catalog: ServiceCatalogItem[] = [
    { id: "a", name: "Servicio oculto", active: false },
  ]
  assert.deepEqual(activeServiceNames(catalog), [])
})
