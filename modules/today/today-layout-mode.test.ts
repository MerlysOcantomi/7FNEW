/**
 * Unit tests for `resolveTodayLayoutMode` — the single gate that decides which
 * Today a workspace sees.
 *
 * The invariant that matters most: appointment_first and job_route NEVER
 * auto-activate for real users. Production keeps `enableVerticalAutoSwitch`
 * off, so the ONLY path to a non-default mode is the internal `?todayLayout=`
 * override used for review. These tests lock that down so a future change can't
 * silently flip a real workspace onto demo data.
 *
 * Test runner: Node's built-in `node:test`, executed via `tsx --test` (matches
 * the convention in modules/inbox/*.test.ts). Run narrowly with:
 *
 *   npm run test:today-layout
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  APPOINTMENT_VERTICAL_KEYS,
  DEFAULT_TODAY_LAYOUT_MODE,
  JOB_ROUTE_VERTICAL_KEYS,
  resolveTodayLayoutMode,
} from "./today-layout-mode"

test("default is work_first", () => {
  assert.equal(DEFAULT_TODAY_LAYOUT_MODE, "work_first")
  assert.equal(resolveTodayLayoutMode(), "work_first")
  assert.equal(resolveTodayLayoutMode({}), "work_first")
})

test("override selects job_route (snake or kebab case)", () => {
  assert.equal(resolveTodayLayoutMode({ override: "job_route" }), "job_route")
  assert.equal(resolveTodayLayoutMode({ override: "job-route" }), "job_route")
})

test("override selects appointment_first and work_first", () => {
  assert.equal(resolveTodayLayoutMode({ override: "appointment_first" }), "appointment_first")
  assert.equal(resolveTodayLayoutMode({ override: "appointment-first" }), "appointment_first")
  assert.equal(resolveTodayLayoutMode({ override: "work_first" }), "work_first")
})

test("unknown / empty override falls back to work_first", () => {
  assert.equal(resolveTodayLayoutMode({ override: "garbage" }), "work_first")
  assert.equal(resolveTodayLayoutMode({ override: "" }), "work_first")
  assert.equal(resolveTodayLayoutMode({ override: null }), "work_first")
  assert.equal(resolveTodayLayoutMode({ override: undefined }), "work_first")
})

test("CRITICAL: field-service vertical does NOT auto-activate while gate is off", () => {
  // No flag → default off. A real cleaning/plumbing workspace stays work_first.
  assert.equal(resolveTodayLayoutMode({ verticalKey: "cleaning" }), "work_first")
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "plumbing", enableVerticalAutoSwitch: false }),
    "work_first",
  )
  // Same protection for appointment verticals.
  assert.equal(resolveTodayLayoutMode({ verticalKey: "clinic" }), "work_first")
})

test("auto-switch resolves verticals only when explicitly enabled", () => {
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "cleaning", enableVerticalAutoSwitch: true }),
    "job_route",
  )
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "hvac", enableVerticalAutoSwitch: true }),
    "job_route",
  )
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "clinic", enableVerticalAutoSwitch: true }),
    "appointment_first",
  )
  // An unrecognised vertical still falls back to the default.
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "agency", enableVerticalAutoSwitch: true }),
    "work_first",
  )
})

test("explicit override beats vertical auto-switch", () => {
  assert.equal(
    resolveTodayLayoutMode({
      override: "work_first",
      verticalKey: "plumbing",
      enableVerticalAutoSwitch: true,
    }),
    "work_first",
  )
})

test("field-service vertical keys cover the named trades and stay disjoint from appointment keys", () => {
  for (const key of ["cleaning", "repair", "plumbing", "electrical", "hvac", "gardening", "maintenance", "installations", "inspections", "pest_control", "moving", "remodeling"]) {
    assert.ok(JOB_ROUTE_VERTICAL_KEYS.has(key), `expected job-route key: ${key}`)
  }
  for (const key of JOB_ROUTE_VERTICAL_KEYS) {
    assert.ok(!APPOINTMENT_VERTICAL_KEYS.has(key), `key in both sets: ${key}`)
  }
})
