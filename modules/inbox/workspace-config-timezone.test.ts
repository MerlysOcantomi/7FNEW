import assert from "node:assert/strict"
import test from "node:test"

import { pickWorkspaceTimezoneFromConfig } from "./workspace-config-timezone"

test("returns root timeZone when non-empty string", () => {
  assert.equal(
    pickWorkspaceTimezoneFromConfig({ timeZone: "Europe/Madrid" }),
    "Europe/Madrid",
  )
  assert.equal(
    pickWorkspaceTimezoneFromConfig({ timeZone: "  America/New_York  " }),
    "America/New_York",
  )
})

test("returns UTC when timeZone missing", () => {
  assert.equal(pickWorkspaceTimezoneFromConfig({}), "UTC")
  assert.equal(pickWorkspaceTimezoneFromConfig(null), "UTC")
  assert.equal(pickWorkspaceTimezoneFromConfig(undefined), "UTC")
})

test("locale language string does not supply timezone", () => {
  assert.equal(pickWorkspaceTimezoneFromConfig({ locale: "es" }), "UTC")
})

test("locale object with timeZone is ignored (no root timeZone)", () => {
  assert.equal(
    pickWorkspaceTimezoneFromConfig({
      locale: { timeZone: "America/Los_Angeles" },
    }),
    "UTC",
  )
})

test("root timeZone wins even when locale object also has timeZone", () => {
  assert.equal(
    pickWorkspaceTimezoneFromConfig({
      timeZone: "Europe/Berlin",
      locale: { timeZone: "Pacific/Kiritimati" },
    }),
    "Europe/Berlin",
  )
})

test("malformed or empty timeZone returns UTC", () => {
  assert.equal(pickWorkspaceTimezoneFromConfig({ timeZone: "" }), "UTC")
  assert.equal(pickWorkspaceTimezoneFromConfig({ timeZone: "   " }), "UTC")
  assert.equal(pickWorkspaceTimezoneFromConfig({ timeZone: 123 }), "UTC")
  assert.equal(pickWorkspaceTimezoneFromConfig({ timeZone: true }), "UTC")
})

test("raw JSON string input yields UTC (caller must pass parsed config)", () => {
  assert.equal(pickWorkspaceTimezoneFromConfig('{"timeZone":"Europe/Paris"}'), "UTC")
})
