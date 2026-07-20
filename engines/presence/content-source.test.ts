import { test } from "node:test"
import assert from "node:assert/strict"
import { buildPresenceContentSource } from "./content-source"

test("projects identity and services from the business profile", () => {
  const source = buildPresenceContentSource({
    workspaceId: "ws_1",
    businessName: "Fallback Name",
    profile: {
      businessName: "Studio Rosa",
      businessDescription: "Beauty studio",
      services: ["Manicura", "Pedicura"],
      workingHours: "Mon-Fri 9-18",
      region: "Madrid",
    },
  })

  assert.equal(source.identity.name, "Studio Rosa")
  assert.equal(source.identity.description, "Beauty studio")
  assert.equal(source.services.length, 2)
  assert.equal(source.hours, "Mon-Fri 9-18")
  assert.equal(source.region, "Madrid")
})

test("falls back to workspace name when profile has no business name", () => {
  const source = buildPresenceContentSource({
    workspaceId: "ws_1",
    businessName: "Fallback Name",
    profile: {},
  })
  assert.equal(source.identity.name, "Fallback Name")
  assert.equal(source.identity.description, null)
})

test("prefers the structured service catalog over the flat services list", () => {
  const source = buildPresenceContentSource({
    workspaceId: "ws_1",
    businessName: "X",
    profile: { services: ["flat-only"] },
    serviceCatalog: [
      { name: "Manicura", category: "Uñas", active: true },
      { name: "Old", category: "Uñas", active: false },
    ],
  })
  assert.equal(source.services.length, 2)
  assert.equal(source.services[0].name, "Manicura")
  assert.equal(source.services[0].category, "Uñas")
})

test("availableSources reflects only populated data", () => {
  const source = buildPresenceContentSource({
    workspaceId: "ws_1",
    businessName: "X",
    profile: { businessName: "X", services: ["A"], region: "Madrid" },
    channels: { whatsapp: "+34600000000", phone: null, social: {} },
  })
  assert.ok(source.availableSources.includes("identity"))
  assert.ok(source.availableSources.includes("services"))
  assert.ok(source.availableSources.includes("location"))
  assert.ok(source.availableSources.includes("whatsapp"))
  assert.ok(!source.availableSources.includes("phone"))
  assert.ok(!source.availableSources.includes("social"))
})

test("is total on an empty profile", () => {
  const source = buildPresenceContentSource({
    workspaceId: "ws_1",
    businessName: "X",
    profile: {},
  })
  assert.equal(source.services.length, 0)
  assert.equal(source.hours, null)
  assert.ok(Array.isArray(source.availableSources))
})
