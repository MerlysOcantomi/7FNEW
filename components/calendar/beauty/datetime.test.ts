import { test } from "node:test"
import assert from "node:assert/strict"

import { addMinutesISO, diffMinutes, isoToLocalParts, localToISO, rangesOverlap } from "./datetime"

test("localToISO round-trips through isoToLocalParts (local wall-clock)", () => {
  const iso = localToISO("2026-07-22", "14:30")
  assert.ok(iso)
  const parts = isoToLocalParts(iso as string)
  assert.deepEqual(parts, { date: "2026-07-22", time: "14:30" })
})

test("localToISO returns null on incomplete or invalid input", () => {
  assert.equal(localToISO("", "14:30"), null)
  assert.equal(localToISO("2026-07-22", ""), null)
  assert.equal(localToISO("not-a-date", "14:30"), null)
})

test("addMinutesISO shifts an instant by whole minutes", () => {
  const start = localToISO("2026-07-22", "14:00") as string
  const end = addMinutesISO(start, 45)
  assert.equal(diffMinutes(start, end), 45)
})

test("diffMinutes is null without an end and never negative", () => {
  const start = localToISO("2026-07-22", "14:00") as string
  assert.equal(diffMinutes(start, null), null)
  const earlier = localToISO("2026-07-22", "13:00") as string
  assert.equal(diffMinutes(start, earlier), null)
})

test("rangesOverlap matches the shared half-open interval rule", () => {
  assert.equal(rangesOverlap(0, 10, 5, 15), true)
  assert.equal(rangesOverlap(0, 10, 10, 20), false) // touching, not overlapping
  assert.equal(rangesOverlap(0, 10, 11, 20), false)
})
