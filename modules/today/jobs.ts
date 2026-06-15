/**
 * Job-route / field-service Today — data contract.
 *
 * Internal operating model: `field_service`; Today layout mode: `job_route`.
 * User-visible labels are always "Today's route" / "Field work today" / "Jobs
 * today" — never "Job-route mode".
 *
 * For businesses whose day happens at customer locations: cleaning, repair,
 * plumbing, electrical, HVAC, gardening, maintenance, installations,
 * inspections, pest control, small moves, light remodeling. The operator's day
 * is an ordered sequence of JOBS (stops) at client addresses, each moving
 * through a field lifecycle (scheduled → confirmed → on the way → arrived → in
 * progress → completed) plus exception states (waiting on client / no access /
 * cancelled). Operational flags — risks, evidence, payment — ride alongside.
 *
 * This is NOT a maps app and NOT heavy dispatch/logistics: `address` is a plain
 * location label and `point` is an ABSTRACT canvas coordinate (not geographic).
 * It is the operational Today of field work — Job-route orchestrates jobs, it
 * does not own them. A real source (Inbox creates jobs, Calendar supplies
 * windows, Clients supply addresses, Finance supplies payment, an external Maps
 * service supplies route/ETA) will populate this contract later.
 *
 * Until then the ONLY producer is the isolated demo adapter in
 * `components/today/jobs/job-mock.ts`. It is never mixed with real production
 * data — the job-route layout is gated and defaults off (see
 * modules/today/today-layout-mode.ts), so a real operator never sees mock jobs.
 */

/** Job lifecycle position (the status chip on each job card). */
export type JobStatus =
  | "scheduled"
  | "confirmed"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "waiting_on_client"
  | "completed"
  | "cancelled"
  | "no_access"

/** Operational risks that can put a stop "at risk" (drive the Fanny flow rail). */
export type JobRiskType =
  | "client_not_home"
  | "no_access"
  | "missing_materials"
  | "running_late"
  | "weather"

export interface JobRisk {
  type: JobRiskType
  /** Short human label, e.g. "Client not home". */
  label: string
}

export type JobPaymentStatus = "unpaid" | "deposit" | "paid"

export interface JobCrew {
  id: string
  name: string
}

export interface Job {
  id: string
  /** 1-based position in the day's route order. */
  order: number
  /** ISO 8601 arrival-window start. */
  start: string
  /** ISO 8601 arrival-window end. */
  end: string
  clientName: string
  /** What the work is, e.g. "Deep clean", "Drain repair", "AC tune-up". */
  jobType: string
  /** Free-text location label for context (NOT a routed map pin). */
  address: string
  /** Coarse area label, e.g. "Westside", "North Park". */
  zone?: string
  crewId: string
  crewName: string
  status: JobStatus
  /** Operational risk flags — surface the most salient one as the card's chip. */
  risks?: JobRisk[]
  /** After-job proof (before/after photos, signature) still missing. */
  evidenceNeeded?: boolean
  paymentStatus?: JobPaymentStatus
  /** Quoted/booked value in the workspace currency (minor unit not assumed). */
  price?: number
  /**
   * ABSTRACT canvas position in 0–100 space for the premium route
   * visualization — NOT geographic. A real source would project geocoded
   * coordinates onto the canvas; the layout falls back to an even spread when
   * absent, so the contract degrades gracefully.
   */
  point?: { x: number; y: number }
}

/** Lightweight route metadata for the canvas chip ("Optimized · 18.4 mi · 2h40m"). */
export interface JobRouteSummary {
  optimized: boolean
  distanceMi: number
  driveMinutes: number
}

/**
 * Which center canvas a vertical's day reads best in:
 *   - "route"         → ordered stops on an abstract route (cleaning, repair,
 *                       plumbing, HVAC, gardening, pest control, maintenance).
 *   - "timeline"      → arrival windows on a time rail (installations, where the
 *                       window matters more than the path).
 *   - "project_sites" → site cards, not stops (construction / light remodeling;
 *                       long planning lives in Projects, not here).
 */
export type JobCanvasMode = "route" | "timeline" | "project_sites"

export interface JobDay {
  businessName: string
  /** Trade label for vertical framing, e.g. "Cleaning", "Plumbing", "HVAC". */
  trade: string
  /** Canvas the day is designed to read in (defaults to "route"). */
  canvas: JobCanvasMode
  crews: JobCrew[]
  jobs: Job[]
  route: JobRouteSummary
}

/** The day's overall health, shown as a badge next to "Today's route". */
export type JobDayStatus = "on_track" | "route_optimized" | "at_risk" | "behind"

export interface JobDerived {
  jobsCount: number
  /** Stops actively being worked (status === "in_progress"). */
  inProgressCount: number
  completedCount: number
  /** Stops flagged running late (a "running_late" risk). */
  delayedCount: number
  /** Stops not yet paid. */
  unpaidCount: number
  /** Distinct crews with at least one non-cancelled job today. */
  crewsActive: number
  /** Stops carrying any operational risk. */
  atRiskCount: number
  /** Stops still needing after-job evidence. */
  evidenceNeededCount: number
  bookedValue: number
  dayStatus: JobDayStatus
  /** Id of the "next stop" — the crew's current target (on the way), else the
   *  earliest still-upcoming stop by route order. */
  nextStopId: string | null
}

/** Statuses that still owe value today (expected to be billed). */
const BILLABLE_STATUSES: ReadonlySet<JobStatus> = new Set([
  "scheduled",
  "confirmed",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
])

/** Statuses that count as "still on the route" (not finished, not dropped). */
const UPCOMING_STATUSES: ReadonlySet<JobStatus> = new Set([
  "scheduled",
  "confirmed",
])

function hasRisk(job: Job, type: JobRiskType): boolean {
  return Boolean(job.risks?.some((r) => r.type === type))
}

function deriveDayStatus(input: {
  delayedCount: number
  atRiskCount: number
  optimized: boolean
}): JobDayStatus {
  if (input.delayedCount >= 2) return "behind"
  if (input.atRiskCount > 0 || input.delayedCount > 0) return "at_risk"
  if (input.optimized) return "route_optimized"
  return "on_track"
}

export function deriveJobDay(day: JobDay): JobDerived {
  let inProgressCount = 0
  let completedCount = 0
  let delayedCount = 0
  let unpaidCount = 0
  let atRiskCount = 0
  let evidenceNeededCount = 0
  let bookedValue = 0

  const activeCrews = new Set<string>()

  // Next stop: prefer the crew's current target (on the way); otherwise the
  // earliest still-upcoming stop by route order.
  let onTheWayId: string | null = null
  let onTheWayOrder = Number.POSITIVE_INFINITY
  let upcomingId: string | null = null
  let upcomingOrder = Number.POSITIVE_INFINITY

  for (const j of day.jobs) {
    if (j.status === "in_progress") inProgressCount += 1
    if (j.status === "completed") completedCount += 1
    if (hasRisk(j, "running_late")) delayedCount += 1
    if (j.paymentStatus === "unpaid") unpaidCount += 1
    if (j.risks && j.risks.length > 0) atRiskCount += 1
    if (j.evidenceNeeded) evidenceNeededCount += 1

    if (j.status !== "cancelled") activeCrews.add(j.crewId)

    if (BILLABLE_STATUSES.has(j.status) && typeof j.price === "number") {
      bookedValue += j.price
    }

    if (j.status === "on_the_way" && j.order < onTheWayOrder) {
      onTheWayOrder = j.order
      onTheWayId = j.id
    }
    if (UPCOMING_STATUSES.has(j.status) && j.order < upcomingOrder) {
      upcomingOrder = j.order
      upcomingId = j.id
    }
  }

  return {
    jobsCount: day.jobs.length,
    inProgressCount,
    completedCount,
    delayedCount,
    unpaidCount,
    crewsActive: activeCrews.size,
    atRiskCount,
    evidenceNeededCount,
    bookedValue,
    dayStatus: deriveDayStatus({
      delayedCount,
      atRiskCount,
      optimized: day.route.optimized,
    }),
    nextStopId: onTheWayId ?? upcomingId,
  }
}
