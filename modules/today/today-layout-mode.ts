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
 *
 * Future modes (NOT implemented here — the switch is intentionally open so they
 * can slot in without touching callers): job-route / field-service, order-first,
 * case-first, session/class-first.
 *
 * Today Peek (topbar dropdown) note: when "appointment_first" is the active mode,
 * the peek should summarise next appointments / unconfirmed / open gaps / booked
 * value instead of My work / AI work / Schedule. That peek variant is a
 * deliberate follow-up (not built in this PR) and would branch on this same mode.
 */
export type TodayLayoutMode = "work_first" | "appointment_first"

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

function normalizeMode(value: string | null | undefined): TodayLayoutMode | null {
  switch (value) {
    case "appointment_first":
    case "appointment-first":
      return "appointment_first"
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
   * Flip ON only once a real appointment data source exists. While `false`
   * (default), verticalKey never auto-activates appointment_first — production
   * stays work_first regardless of vertical, so no real workspace ever lands on
   * demo data.
   */
  enableVerticalAutoSwitch?: boolean
}

/**
 * Resolve the active Today layout mode. Always returns "work_first" unless an
 * explicit (internal) override asks for appointment_first, or — once real
 * appointment data exists and `enableVerticalAutoSwitch` is turned on — the
 * workspace's vertical is an appointment vertical. Never throws; unknown input
 * falls back to the safe default.
 */
export function resolveTodayLayoutMode(
  input: ResolveTodayLayoutModeInput = {},
): TodayLayoutMode {
  const override = normalizeMode(input.override)
  if (override) return override

  if (
    input.enableVerticalAutoSwitch &&
    input.verticalKey &&
    APPOINTMENT_VERTICAL_KEYS.has(input.verticalKey)
  ) {
    return "appointment_first"
  }

  return DEFAULT_TODAY_LAYOUT_MODE
}
