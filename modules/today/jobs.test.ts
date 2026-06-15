/**
 * Unit tests for `deriveJobDay` — the pure summary used by the job-route
 * (field-service) Today: counts, booked value, day status and the "next stop".
 *
 * Hermetic fixtures only (no alias imports), `node:test` via `tsx`. Run with:
 *
 *   npm run test:today-jobs
 */

import assert from "node:assert/strict"
import test from "node:test"

import { deriveJobDay, type Job, type JobDay, type JobStatus } from "./jobs"

let seq = 0
function job(status: JobStatus, over: Partial<Job> = {}): Job {
  seq += 1
  return {
    id: over.id ?? `j${seq}`,
    order: over.order ?? seq,
    start: over.start ?? "2026-06-15T09:00:00.000Z",
    end: over.end ?? "2026-06-15T10:00:00.000Z",
    clientName: over.clientName ?? `Client ${seq}`,
    jobType: over.jobType ?? "Deep clean",
    address: over.address ?? "Somewhere 1",
    crewId: over.crewId ?? "ca",
    crewName: over.crewName ?? "Crew A",
    status,
    risks: over.risks,
    evidenceNeeded: over.evidenceNeeded,
    paymentStatus: over.paymentStatus,
    price: over.price,
    point: over.point,
  }
}

function day(jobs: Job[], over: Partial<JobDay> = {}): JobDay {
  return {
    businessName: over.businessName ?? "Demo Co.",
    trade: over.trade ?? "Cleaning",
    canvas: over.canvas ?? "route",
    crews: over.crews ?? [{ id: "ca", name: "Crew A" }],
    jobs,
    route: over.route ?? { optimized: false, distanceMi: 10, driveMinutes: 60 },
  }
}

test("counts statuses, payment and evidence", () => {
  seq = 0
  const d = deriveJobDay(
    day([
      job("completed", { paymentStatus: "paid", price: 100 }),
      job("in_progress", { evidenceNeeded: true, price: 200 }),
      job("scheduled", { paymentStatus: "unpaid", price: 50 }),
    ]),
  )
  assert.equal(d.jobsCount, 3)
  assert.equal(d.completedCount, 1)
  assert.equal(d.inProgressCount, 1)
  assert.equal(d.unpaidCount, 1)
  assert.equal(d.evidenceNeededCount, 1)
  assert.equal(d.bookedValue, 350)
})

test("delayed counts running_late risks; atRisk counts any risk", () => {
  seq = 0
  const d = deriveJobDay(
    day([
      job("on_the_way", { risks: [{ type: "running_late", label: "Late" }] }),
      job("scheduled", { risks: [{ type: "client_not_home", label: "Not home" }] }),
      job("scheduled"),
    ]),
  )
  assert.equal(d.delayedCount, 1)
  assert.equal(d.atRiskCount, 2)
})

test("cancelled jobs leave crewsActive and booked value untouched", () => {
  seq = 0
  const d = deriveJobDay(
    day(
      [
        job("scheduled", { crewId: "ca", price: 100, paymentStatus: "unpaid" }),
        job("cancelled", { crewId: "cb", price: 999 }),
      ],
      { crews: [{ id: "ca", name: "A" }, { id: "cb", name: "B" }] },
    ),
  )
  assert.equal(d.crewsActive, 1)
  assert.equal(d.bookedValue, 100)
})

test("nextStop prefers the on-the-way crew over earlier upcoming order", () => {
  seq = 0
  const d = deriveJobDay(
    day([
      job("scheduled", { id: "early", order: 1 }),
      job("on_the_way", { id: "target", order: 5 }),
    ]),
  )
  assert.equal(d.nextStopId, "target")
})

test("nextStop falls back to earliest upcoming when nobody is on the way", () => {
  seq = 0
  const d = deriveJobDay(
    day([
      job("scheduled", { id: "second", order: 4 }),
      job("confirmed", { id: "first", order: 2 }),
      job("completed", { id: "done", order: 1 }),
    ]),
  )
  assert.equal(d.nextStopId, "first")
})

test("dayStatus: behind with 2+ delays", () => {
  seq = 0
  const d = deriveJobDay(
    day([
      job("on_the_way", { risks: [{ type: "running_late", label: "Late" }] }),
      job("scheduled", { risks: [{ type: "running_late", label: "Late" }] }),
    ]),
  )
  assert.equal(d.dayStatus, "behind")
})

test("dayStatus: at_risk with a single risk", () => {
  seq = 0
  const d = deriveJobDay(day([job("scheduled", { risks: [{ type: "no_access", label: "Locked" }] })]))
  assert.equal(d.dayStatus, "at_risk")
})

test("dayStatus: route_optimized when clean and optimized, else on_track", () => {
  seq = 0
  const optimized = deriveJobDay(day([job("scheduled")], { route: { optimized: true, distanceMi: 5, driveMinutes: 30 } }))
  assert.equal(optimized.dayStatus, "route_optimized")

  const plain = deriveJobDay(day([job("scheduled")], { route: { optimized: false, distanceMi: 5, driveMinutes: 30 } }))
  assert.equal(plain.dayStatus, "on_track")
})
