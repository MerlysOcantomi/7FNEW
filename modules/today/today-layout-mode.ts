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
 *   - "work_first_v2"     → preview of the work_first workboard with a Fanny
 *                            morning briefing + "Start Here" protagonist hero
 *                            mounted above it. Same real /api/today data;
 *                            override-only (?todayLayout=work_first_v2), never
 *                            auto-activated.
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
 *   - "session_first"     → the continuity canvas (ordered people/sessions list
 *                            + a protagonist "up next / needs you most" + a
 *                            Fanny flow rail). Three variants (see
 *                            `SessionVariant`): class (schools/academies/group
 *                            classes), tutor (1:1 tutoring/coaching/mentoring),
 *                            care (lightweight people follow-up — pastoral care,
 *                            small NGOs, gentle wellness check-ins). It is about
 *                            CONTINUITY (what happened last time, what to
 *                            continue, materials, homework, notes, attendance),
 *                            NOT bookings/capacity — it is not appointment_first.
 *
 * Future modes (NOT implemented here — the switch is intentionally open so they
 * can slot in without touching callers): order-first, case-first, and the full
 * community/ministry operating model (community_first / ministry_first — for
 * which session_first's `care` variant is only a lightweight follow-up shape,
 * never the whole church/NGO Today).
 *
 * Today Peek (topbar dropdown) note: each non-default mode wants its own peek
 * summary (appointment_first → next appointments / unconfirmed / open gaps;
 * job_route → next stop / on site / en route; session_first → next session /
 * follow-ups / unpaid, or people / visits / urgent for care) instead of My work
 * / AI work / Schedule. Those peek variants are a deliberate follow-up (not
 * built here) and would branch on this same mode.
 */
import type { SessionVariant } from "./sessions"

export type TodayLayoutMode =
  | "work_first"
  | "work_first_v2"
  | "appointment_first"
  | "job_route"
  | "session_first"

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

/**
 * verticalKeys whose operating model is session/continuity-based: the day turns
 * around recurring sessions, classes, students/people, progress, attendance,
 * materials, homework and follow-up. Prepared for when REAL session data exists.
 * Same gating as the other verticals — we deliberately do NOT auto-switch a real
 * workspace into session_first yet (the layout renders isolated DEMO data), so
 * auto-switch stays behind `enableVerticalAutoSwitch`.
 */
export const SESSION_VERTICAL_KEYS: ReadonlySet<string> = new Set([
  "school",
  "academy",
  "education",
  "tutoring",
  "tutor",
  "coaching",
  "coach",
  "mentoring",
  "mentor",
  "music_school",
  "music",
  "dance",
  "language_school",
  "language",
  "arts",
  "classes",
  "lessons",
  "care_follow_up",
])

/** Internal session sub-layouts. Never surfaced to the user as a mode name. */
export const DEFAULT_SESSION_VARIANT: SessionVariant = "class"

/**
 * Normalise a `?variant=` override to a valid `SessionVariant`. Accepts the
 * canonical names plus a few obvious aliases; anything else falls back to the
 * safe default so `/today` never breaks on a typo.
 */
export function normalizeSessionVariant(
  value: string | null | undefined,
): SessionVariant {
  switch (value) {
    case "class":
    case "classes":
      return "class"
    case "tutor":
    case "sessions":
      return "tutor"
    case "care":
    case "community":
      return "care"
    default:
      return DEFAULT_SESSION_VARIANT
  }
}

function normalizeMode(value: string | null | undefined): TodayLayoutMode | null {
  switch (value) {
    case "appointment_first":
    case "appointment-first":
      return "appointment_first"
    case "job_route":
    case "job-route":
      return "job_route"
    case "session_first":
    case "session-first":
      return "session_first"
    case "work_first":
    case "work-first":
      return "work_first"
    case "work_first_v2":
    case "work-first-v2":
      return "work_first_v2"
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
   * Flip ON only once a real data source exists for the target operating model.
   * While `false` (default), verticalKey never auto-activates appointment_first,
   * job_route or session_first — production stays work_first regardless of
   * vertical, so no real workspace ever lands on demo data.
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
 * ONLY way to reach appointment_first / job_route / session_first is the
 * internal `?todayLayout=` override used for review. Real users always get
 * work_first.
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
    if (SESSION_VERTICAL_KEYS.has(input.verticalKey)) {
      return "session_first"
    }
  }

  return DEFAULT_TODAY_LAYOUT_MODE
}

export interface VerticalTodayActivationInput {
  /**
   * The operator explicitly asked to review the vertical Today (e.g. the
   * `?vertical=beauty` design-review helper). A preview always activates the
   * declared mode over demo data — it never reaches a real, unprompted operator.
   */
  isExplicitPreview: boolean
  /**
   * The vertical pack's own gate for REAL workspaces
   * (`WorkspaceExperience.todayActivatesRealWorkspaces`). `false` means the
   * declared mode is still preview-only; `true` means a real backend exists and
   * the mode may auto-activate for real operators.
   */
  todayActivatesRealWorkspaces: boolean
}

/**
 * P0 guardrail — decide whether a workspace's declared vertical Today mode
 * should feed `resolveTodayLayoutMode({ enableVerticalAutoSwitch })`.
 *
 * The rule, stated once and tested, so it never hides inside a React component:
 * a REAL workspace activates its vertical Today ONLY when the pack flips its own
 * `activateRealForRealWorkspaces` gate on. Until then the declared mode
 * (e.g. Beauty's `appointment_first`, which renders demo bookings) is reachable
 * only as an explicit preview. The independent `?todayLayout=` override still
 * wins inside `resolveTodayLayoutMode` regardless of this flag.
 *
 * Pure and total: no I/O, no clock — trivially unit-testable.
 */
export function shouldActivateVerticalToday(
  input: VerticalTodayActivationInput,
): boolean {
  return input.isExplicitPreview || input.todayActivatesRealWorkspaces
}
