import type {
  Job,
  JobCanvasMode,
  JobCrew,
  JobDay,
  JobRouteSummary,
} from "@modules/today/jobs"

/**
 * ISOLATED demo adapter for the job-route (field-service) Today layout.
 *
 * ⚠️ DEMO DATA ONLY. There is no real field-service backend yet (see
 * modules/today/jobs.ts). This module is the single, clearly-named place that
 * produces mock jobs, used ONLY by the job-route layout while it is in
 * preview/disabled-by-default mode. It performs no I/O, registers no provider,
 * and is never mixed with real production data. When a real source lands, swap
 * the layout's data hook and delete this file — nothing else depends on it.
 *
 * `point` coordinates are ABSTRACT (0–100 canvas space), not geographic — this
 * is a premium abstract route visualization, never a maps/dispatch app.
 */

/** Build an ISO timestamp for *today* at a given local hour/minute. */
function at(hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ─── Cleaning (hero · route canvas) ─────────────────────────────────────────
// Matches the reference: SparkleHome Co. · 8 jobs · 2 crews · 1 delayed ·
// 3 unpaid · 2 route risks · 1 evidence needed · next stop = Patel @ 1:30.

const CLEANING_CREWS: JobCrew[] = [
  { id: "ca", name: "Crew A" },
  { id: "cb", name: "Crew B" },
]

function cleaningJobs(): Job[] {
  return [
    {
      id: "j1", order: 1, start: at(8, 0), end: at(9, 0),
      clientName: "Rivera House", jobType: "Deep clean", address: "Maple Ave 124", zone: "Maple Ave",
      crewId: "ca", crewName: "Crew A", status: "arrived", evidenceNeeded: true, paymentStatus: "paid",
      price: 140, point: { x: 14, y: 80 },
    },
    {
      id: "j2", order: 2, start: at(9, 30), end: at(10, 30),
      clientName: "Studio Verde", jobType: "Office clean", address: "Downtown 5th", zone: "Downtown",
      crewId: "ca", crewName: "Crew A", status: "arrived", paymentStatus: "unpaid",
      price: 180, point: { x: 40, y: 48 },
    },
    {
      id: "j3", order: 3, start: at(11, 0), end: at(12, 30),
      clientName: "Nguyen Home", jobType: "Move-out clean", address: "Westside", zone: "Westside",
      crewId: "ca", crewName: "Crew A", status: "in_progress", paymentStatus: "paid",
      price: 220, point: { x: 55, y: 62 },
    },
    {
      id: "j4", order: 4, start: at(13, 30), end: at(14, 30),
      clientName: "Patel Office", jobType: "Recurring clean", address: "North Park", zone: "North Park",
      crewId: "cb", crewName: "Crew B", status: "on_the_way", paymentStatus: "paid", price: 160,
      risks: [
        { type: "client_not_home", label: "Client not home" },
        { type: "running_late", label: "Running late" },
      ],
      point: { x: 73, y: 30 },
    },
    {
      id: "j5", order: 5, start: at(15, 0), end: at(16, 0),
      clientName: "Okafor House", jobType: "Deep clean", address: "Riverside", zone: "Riverside",
      crewId: "cb", crewName: "Crew B", status: "scheduled", paymentStatus: "paid", price: 150,
      risks: [{ type: "missing_materials", label: "Missing supplies" }],
      point: { x: 87, y: 42 },
    },
    // Remaining stops fill the day to 8 (list rows; no abstract pin in the demo).
    {
      id: "j6", order: 6, start: at(16, 30), end: at(17, 30),
      clientName: "Bright Loft", jobType: "Office clean", address: "Eastend", zone: "Eastend",
      crewId: "ca", crewName: "Crew A", status: "scheduled", paymentStatus: "unpaid", price: 170,
    },
    {
      id: "j7", order: 7, start: at(12, 0), end: at(13, 0),
      clientName: "Marin Flat", jobType: "Deep clean", address: "Harbor", zone: "Harbor",
      crewId: "cb", crewName: "Crew B", status: "completed", paymentStatus: "paid", price: 130,
    },
    {
      id: "j8", order: 8, start: at(17, 30), end: at(18, 30),
      clientName: "Cedar Suites", jobType: "Move-out clean", address: "Old Town", zone: "Old Town",
      crewId: "cb", crewName: "Crew B", status: "scheduled", paymentStatus: "unpaid", price: 240,
    },
  ]
}

// ─── Repair / tech (route · urgent first) ───────────────────────────────────

function repairJobs(): Job[] {
  return [
    {
      id: "r1", order: 1, start: at(8, 30), end: at(9, 30),
      clientName: "Cortez Residence", jobType: "No hot water — diagnosis", address: "Pine St 8", zone: "Pine St",
      crewId: "t1", crewName: "Diego", status: "in_progress", paymentStatus: "unpaid", price: 90,
      point: { x: 16, y: 70 },
    },
    {
      id: "r2", order: 2, start: at(10, 0), end: at(11, 30),
      clientName: "Hashimi Flat", jobType: "Leak repair — parts needed", address: "Bay 22", zone: "Bayfront",
      crewId: "t1", crewName: "Diego", status: "on_the_way", price: 210,
      risks: [{ type: "missing_materials", label: "Parts on order" }],
      point: { x: 44, y: 40 },
    },
    {
      id: "r3", order: 3, start: at(12, 30), end: at(13, 30),
      clientName: "Okoye Home", jobType: "Breaker trips — inspection", address: "Hill 5", zone: "Hillside",
      crewId: "t1", crewName: "Diego", status: "scheduled", price: 120,
      risks: [{ type: "no_access", label: "No access — gate code" }],
      point: { x: 66, y: 58 },
    },
    {
      id: "r4", order: 4, start: at(14, 30), end: at(16, 0),
      clientName: "Vance Studio", jobType: "Water heater swap", address: "Mill 14", zone: "Milltown",
      crewId: "t1", crewName: "Diego", status: "scheduled", paymentStatus: "deposit", price: 480,
      point: { x: 88, y: 34 },
    },
  ]
}

// ─── Landscaping (route + weather) ──────────────────────────────────────────

function landscapingJobs(): Job[] {
  return [
    {
      id: "l1", order: 1, start: at(8, 0), end: at(9, 30),
      clientName: "Aspen Court", jobType: "Recurring mow + edge", address: "Grove 3", zone: "Grove",
      crewId: "g1", crewName: "Field crew", status: "completed", paymentStatus: "paid", price: 95,
      point: { x: 15, y: 64 },
    },
    {
      id: "l2", order: 2, start: at(10, 0), end: at(12, 0),
      clientName: "Lindqvist Garden", jobType: "Hedge trim + cleanup", address: "Lake 9", zone: "Lakeside",
      crewId: "g1", crewName: "Field crew", status: "in_progress", evidenceNeeded: true, price: 180,
      point: { x: 46, y: 44 },
    },
    {
      id: "l3", order: 3, start: at(13, 0), end: at(15, 0),
      clientName: "Bramble Park HOA", jobType: "Seasonal planting", address: "Park 2", zone: "Parkview",
      crewId: "g1", crewName: "Field crew", status: "scheduled", paymentStatus: "unpaid", price: 320,
      risks: [{ type: "weather", label: "Rain expected 2pm" }],
      point: { x: 78, y: 56 },
    },
  ]
}

// ─── Installation (timeline · arrival window) ───────────────────────────────

function installationJobs(): Job[] {
  return [
    {
      id: "i1", order: 1, start: at(9, 0), end: at(11, 0),
      clientName: "Demir Apartment", jobType: "Dishwasher install", address: "Elm 17", zone: "Elm",
      crewId: "f1", crewName: "Install team", status: "arrived", evidenceNeeded: true, paymentStatus: "deposit", price: 260,
    },
    {
      id: "i2", order: 2, start: at(11, 30), end: at(14, 0),
      clientName: "Nakamura House", jobType: "AC unit install", address: "Cedar 40", zone: "Cedar",
      crewId: "f1", crewName: "Install team", status: "on_the_way", paymentStatus: "deposit", price: 1450,
    },
    {
      id: "i3", order: 3, start: at(14, 30), end: at(17, 0),
      clientName: "Pereira Loft", jobType: "Smart panel install", address: "Dock 6", zone: "Dockside",
      crewId: "f1", crewName: "Install team", status: "scheduled", price: 980,
      risks: [{ type: "running_late", label: "Tight window" }],
    },
  ]
}

// ─── Construction / remodeling (project-sites · not a route) ────────────────

function constructionJobs(): Job[] {
  return [
    {
      id: "c1", order: 1, start: at(8, 0), end: at(17, 0),
      clientName: "Harborview Remodel", jobType: "Phase 2 · framing", address: "Site A — Harbor", zone: "Harbor",
      crewId: "k1", crewName: "Build crew", status: "in_progress", evidenceNeeded: true, paymentStatus: "deposit", price: 0,
    },
    {
      id: "c2", order: 2, start: at(8, 0), end: at(17, 0),
      clientName: "Maple Kitchen", jobType: "Phase 3 · cabinetry", address: "Site B — Maple", zone: "Maple",
      crewId: "k2", crewName: "Finish crew", status: "in_progress", price: 0,
      risks: [{ type: "missing_materials", label: "Counters delayed" }],
    },
    {
      id: "c3", order: 3, start: at(10, 0), end: at(12, 0),
      clientName: "Oak Extension", jobType: "Inspection · electrical rough-in", address: "Site C — Oak", zone: "Oak",
      crewId: "k1", crewName: "Build crew", status: "scheduled", price: 0,
      risks: [{ type: "running_late", label: "Inspector window 10–12" }],
    },
  ]
}

interface Preset {
  businessName: string
  trade: string
  canvas: JobCanvasMode
  crews: JobCrew[]
  jobs: () => Job[]
  route: JobRouteSummary
}

const PRESETS: Record<string, Preset> = {
  cleaning: {
    businessName: "SparkleHome Co.",
    trade: "Cleaning",
    canvas: "route",
    crews: CLEANING_CREWS,
    jobs: cleaningJobs,
    route: { optimized: true, distanceMi: 18.4, driveMinutes: 160 },
  },
  repair: {
    businessName: "RapidFix Services",
    trade: "Repair",
    canvas: "route",
    crews: [{ id: "t1", name: "Diego" }],
    jobs: repairJobs,
    route: { optimized: true, distanceMi: 22.1, driveMinutes: 145 },
  },
  landscaping: {
    businessName: "GreenLine Grounds",
    trade: "Landscaping",
    canvas: "route",
    crews: [{ id: "g1", name: "Field crew" }],
    jobs: landscapingJobs,
    route: { optimized: false, distanceMi: 31.6, driveMinutes: 190 },
  },
  installation: {
    businessName: "NorthPeak Installs",
    trade: "Installation",
    canvas: "timeline",
    crews: [{ id: "f1", name: "Install team" }],
    jobs: installationJobs,
    route: { optimized: true, distanceMi: 26.3, driveMinutes: 175 },
  },
  construction: {
    businessName: "Cornerstone Build",
    trade: "Construction",
    canvas: "project_sites",
    crews: [{ id: "k1", name: "Build crew" }, { id: "k2", name: "Finish crew" }],
    jobs: constructionJobs,
    route: { optimized: false, distanceMi: 0, driveMinutes: 0 },
  },
}

export const JOB_MOCK_TRADES = Object.keys(PRESETS)

/**
 * Demo day. `trade` lets a reviewer preview the vertical variants (and, through
 * each preset's `canvas`, the adaptive center: route / timeline / project_sites).
 * Defaults to the cleaning hero day.
 */
export function getJobDayMock(trade = "cleaning"): JobDay {
  const preset = PRESETS[trade] ?? PRESETS.cleaning
  return {
    businessName: preset.businessName,
    trade: preset.trade,
    canvas: preset.canvas,
    crews: preset.crews,
    jobs: preset.jobs(),
    route: preset.route,
  }
}
