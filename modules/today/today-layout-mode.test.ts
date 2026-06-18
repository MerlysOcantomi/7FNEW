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
  SESSION_VERTICAL_KEYS,
  normalizeSessionVariant,
  resolveTodayLayoutMode,
} from "./today-layout-mode"

test("default is work_first", () => {
  assert.equal(DEFAULT_TODAY_LAYOUT_MODE, "work_first")
  assert.equal(resolveTodayLayoutMode(), "work_first")
  assert.equal(resolveTodayLayoutMode({}), "work_first")
})

test("override selects work_first_v2 hero (snake or kebab case)", () => {
  assert.equal(resolveTodayLayoutMode({ override: "work_first_v2" }), "work_first_v2")
  assert.equal(resolveTodayLayoutMode({ override: "work-first-v2" }), "work_first_v2")
})

test("work_first_v2 is override-only — no vertical ever auto-activates it", () => {
  // It maps to no vertical key, so even with auto-switch ON a real workspace
  // resolves to its own vertical mode (or the work_first default), never v2.
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "agency", enableVerticalAutoSwitch: true }),
    "work_first",
  )
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "clinic", enableVerticalAutoSwitch: true }),
    "appointment_first",
  )
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

test("override selects session_first (snake or kebab case)", () => {
  assert.equal(resolveTodayLayoutMode({ override: "session_first" }), "session_first")
  assert.equal(resolveTodayLayoutMode({ override: "session-first" }), "session_first")
})

test("unknown / empty override falls back to work_first", () => {
  assert.equal(resolveTodayLayoutMode({ override: "garbage" }), "work_first")
  assert.equal(resolveTodayLayoutMode({ override: "" }), "work_first")
  assert.equal(resolveTodayLayoutMode({ override: null }), "work_first")
  assert.equal(resolveTodayLayoutMode({ override: undefined }), "work_first")
})

test("CRITICAL: field-service / session verticals do NOT auto-activate while gate is off", () => {
  // No flag → default off. A real cleaning/plumbing workspace stays work_first.
  assert.equal(resolveTodayLayoutMode({ verticalKey: "cleaning" }), "work_first")
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "plumbing", enableVerticalAutoSwitch: false }),
    "work_first",
  )
  // Same protection for appointment and session verticals.
  assert.equal(resolveTodayLayoutMode({ verticalKey: "clinic" }), "work_first")
  assert.equal(resolveTodayLayoutMode({ verticalKey: "school" }), "work_first")
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "tutoring", enableVerticalAutoSwitch: false }),
    "work_first",
  )
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
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "school", enableVerticalAutoSwitch: true }),
    "session_first",
  )
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "tutoring", enableVerticalAutoSwitch: true }),
    "session_first",
  )
  // An unrecognised vertical still falls back to the default.
  assert.equal(
    resolveTodayLayoutMode({ verticalKey: "agency", enableVerticalAutoSwitch: true }),
    "work_first",
  )
})

test("normalizeSessionVariant accepts variants + aliases, falls back safely", () => {
  assert.equal(normalizeSessionVariant("class"), "class")
  assert.equal(normalizeSessionVariant("tutor"), "tutor")
  assert.equal(normalizeSessionVariant("care"), "care")
  // aliases
  assert.equal(normalizeSessionVariant("classes"), "class")
  assert.equal(normalizeSessionVariant("sessions"), "tutor")
  assert.equal(normalizeSessionVariant("community"), "care")
  // invalid / empty → safe default (class), never throws
  assert.equal(normalizeSessionVariant("therapy"), "class")
  assert.equal(normalizeSessionVariant(""), "class")
  assert.equal(normalizeSessionVariant(null), "class")
  assert.equal(normalizeSessionVariant(undefined), "class")
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

test("session vertical keys cover the named verticals and stay disjoint from the other sets", () => {
  for (const key of ["school", "academy", "tutoring", "coaching", "mentoring", "music", "dance", "language", "arts"]) {
    assert.ok(SESSION_VERTICAL_KEYS.has(key), `expected session key: ${key}`)
  }
  for (const key of SESSION_VERTICAL_KEYS) {
    assert.ok(!APPOINTMENT_VERTICAL_KEYS.has(key), `session key in appointment set: ${key}`)
    assert.ok(!JOB_ROUTE_VERTICAL_KEYS.has(key), `session key in job-route set: ${key}`)
  }
})
