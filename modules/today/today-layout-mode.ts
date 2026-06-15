/**
 * Today layout mode — lets `/today` adapt to the workspace's operating model.
 *
 * Product intent: 7F does not ship one Today for every business. During
 * onboarding Mr. Forte learns how the business runs and configures Today to
 * match — the operator only ever feels "7F understood my business and organised
 * my day the right way". These mode names are INTERNAL: never surface
 * "work-first" / "appointment-first" / "operating model" in the UI.
 *
 *   - "work_first"        → the default deliverables workboard (My work / AI
 *                            work / Schedule / Waiting). Agencies, consulting,
 *                            design, marketing, software, deliverable businesses.
 *   - "appointment_first" → the booking/agenda canvas (day book / agenda + a
 *                            Fanny flow rail). Clinics, salons, barbers, nails,
 *                            spa, by-appointment services.
 *   - "job_route"         → the field-service canvas (route timeline / crew
 *                            board of stops at client locations + a Fanny flow
 *                            rail). Cleaning, repair, plumbing, electrical,
 *                            HVAC, gardening, maintenance, installations,
 *                            inspections, pest control, small moves, light
 *                            remodeling. NOT a maps/dispatch app — the operative
 *                            Today of work that happens at customer locations.
 *
 * Future modes (NOT implemented here — the switch is intentionally open so they
 * can slot in without touching callers): order-first, case-first,
 * session/class-first.
 *
 * Today Peek (topbar dropdown) note: when "appointment_first" is the active mode,
 * the peek should summarise next appointments / unconfirmed / open gaps / booked
 * value; when "job_route" is active it should summarise next stop / on site / en
 * route / remaining instead of My work / AI work / Schedule. Those peek variants
 * are a deliberate follow-up (not built here) and would branch on this same mode.
 */
export type TodayLayoutMode = "work_first" | "appointment_first" | "job_route"

export const DEFAULT_TODAY_LAYOUT_MODE: TodayLayoutMode = "work_first"

/**
 * verticalKeys whose operating model is appointment/booking-based. Prepared for
 * when REAL appointment data exists. We deliberately do NOT auto-switch a real
 * workspace into appointment_first yet: the appointment layout currently renders
 * isolated DEMO data, so flipping a real clinic/salon here would show mock
 * bookings to a real operator. Auto-switch stays gated behind
 * `enableVerticalAutoSwitch` until a real appointment source is wired.
 */
export const APPOINTMENT_VERTICAL_KEYS: ReadonlySet<string> = new Set([
  "clinic",
  "salon",
  "barber",
  "barbershop",
  "nails",
  "spa",
  "beauty",
  "appointments",
])

/**
 * verticalKeys whose operating model is field-service / job-route based: the
 * day happens at customer locations. Prepared for when REAL field-service data
 * exists. Same gating as appointment verticals — we deliberately do NOT
 * auto-switch a real workspace into job_route yet: the job-route layout
 * currently renders isolated DEMO data, so flipping a real cleaning/plumbing
 * company here would show mock jobs to a real operator. Auto-switch stays gated
 * behind `enableVerticalAutoSwitch` until a real field-service source is wired.
 */
export const JOB_ROUTE_VERTICAL_KEYS: ReadonlySet<string> = new Set([
  "cleaning",
  "repair",
  "plumbing",
  "electrical",
  "hvac",
  "gardening",
  "landscaping",
  "maintenance",
  "handyman",
  "installation",
  "installations",
  "inspection",
  "inspections",
  "pest_control",
  "pest",
  "moving",
  "movers",
  "remodeling",
  "field_service",
])

function normalizeMode(value: string | null | undefined): TodayLayoutMode | null {
  switch (value) {
    case "appointment_first":
    case "appointment-first":
      return "appointment_first"
    case "job_route":
    case "job-route":
      return "job_route"
    case "work_first":
    case "work-first":
      return "work_first"
    default:
      return null
  }
}

export interface ResolveTodayLayoutModeInput {
  /**
   * Explicit override — internal/preview only (e.g. a `?todayLayout=` URL param
   * used to review the appointment canvas). Wins when valid. Not user-facing.
   */
  override?: string | null
  /** Active workspace verticalKey (from `useActiveWorkspace`). */
  verticalKey?: string | null
  /**
   * Flip ON only once a real appointment/field-service data source exists. While
   * `false` (default), verticalKey never auto-activates appointment_first or
   * job_route — production stays work_first regardless of vertical, so no real
   * workspace ever lands on demo data.
   */
  enableVerticalAutoSwitch?: boolean
}

/**
 * Resolve the active Today layout mode. Always returns "work_first" unless an
 * explicit (internal) override asks for another mode, or — once real data exists
 * and `enableVerticalAutoSwitch` is turned on — the workspace's vertical is an
 * appointment or field-service vertical. Never throws; unknown input falls back
 * to the safe default.
 *
 * In production today `enableVerticalAutoSwitch` is `false` everywhere, so the
 * ONLY way to reach appointment_first / job_route is the internal
 * `?todayLayout=` override used for review. Real users always get work_first.
 */
export function resolveTodayLayoutMode(
  input: ResolveTodayLayoutModeInput = {},
): TodayLayoutMode {
  const override = normalizeMode(input.override)
  if (override) return override

  if (input.enableVerticalAutoSwitch && input.verticalKey) {
    if (APPOINTMENT_VERTICAL_KEYS.has(input.verticalKey)) {
      return "appointment_first"
    }
    if (JOB_ROUTE_VERTICAL_KEYS.has(input.verticalKey)) {
      return "job_route"
    }
  }

  return DEFAULT_TODAY_LAYOUT_MODE
}
