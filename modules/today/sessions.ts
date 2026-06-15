/**
 * Session-first Today — data contract (continuity, not bookings).
 *
 * Internal operating model: session_first; Today layout mode: "session_first".
 * User-visible labels are always natural — "Today's classes" / "Today's
 * sessions" / "Community today" — never "session_first" / "layout mode".
 *
 * For businesses whose day turns around recurring sessions, classes,
 * students/people, continuity, preparation, attendance, materials, payments,
 * homework, follow-up or light care. Three variants share one mother layout:
 *
 *   - "class" → schools, academies, group classes (music/dance/language/art),
 *               workshops, group training. Canvas centres on a GROUP.
 *   - "tutor" → private tutor / coach / mentor, 1:1 lessons. Canvas centres on
 *               ONE STUDENT (progress + homework).
 *   - "care"  → lightweight people follow-up: pastoral care, small NGOs,
 *               mentoring, gentle wellness check-ins. Canvas centres on a PERSON
 *               who needs attention (visits / calls / gentle follow-ups).
 *
 * Session-first reuses some appointment ideas (time, duration, up-next, no-show,
 * reminder, reschedule, status) but it is NOT appointment_first: appointments
 * are about bookings & capacity (who comes, when, with which resource, what gaps
 * remain); sessions are about CONTINUITY (what happened last time, what to
 * continue today, materials, homework, notes, progress, attendance, the ongoing
 * relationship with a person/group).
 *
 * Scope boundary for "care": it is a *light* people-follow-up shape, NOT the
 * full church/NGO/community operating model (services, volunteers, members,
 * donations, programs, ministry ops) — that is a future community_first /
 * ministry_first mode. It is also NOT a clinical/therapy product: no diagnosis,
 * no treatment workflow, no medical claims. "Urgent" here means "a human should
 * reach out soon", never medical triage.
 *
 * There is NO real backend yet (`Evento` carries title + start/end only). This
 * is the small, explicit contract the session layout renders against. Until a
 * real source exists, the ONLY producer is the isolated demo adapter in
 * `components/today/sessions/session-mock.ts`, never mixed with production data
 * (the layout is gated and defaults off — see today-layout-mode.ts).
 */

export type SessionVariant = "class" | "tutor" | "care"

export type SessionStatus =
  | "scheduled"
  | "starting_soon"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "needs_follow_up"
  | "waiting_reply"

export type SessionMode = "online" | "in_person" | "hybrid"

export type SessionRiskType =
  | "urgent"
  | "no_show"
  | "unpaid"
  | "material_missing"
  | "homework_missing"
  | "reschedule"
  | "waiting_reply"
  | "follow_up"
  | "parent_message"
  | "reminder"

export interface SessionRisk {
  type: SessionRiskType
  label: string
}

export type PaymentStatus = "paid" | "unpaid" | "overdue" | "deposit"
export type MaterialStatus = "ready" | "sent" | "pending" | "missing"
export type HomeworkStatus = "none" | "assigned" | "submitted" | "to_review" | "reviewed"

export interface SessionParticipant {
  id: string
  name: string
}

/** For care: whether today's scheduled contact is a visit or a call. */
export type ContactKind = "visit" | "call"

export interface TodaySession {
  id: string
  title: string
  /** ISO start. Optional: a care person may be a follow-up with no slot today. */
  startsAt?: string
  endsAt?: string
  mode: SessionMode
  locationLabel?: string
  groupName?: string
  studentName?: string
  personName?: string
  participants?: SessionParticipant[]
  participantCount?: number
  expectedAttendance?: number
  attendanceMarked?: boolean
  subjectOrTopic?: string
  /** "Grade 3", "Intermediate · 8 months in", "Individual · 14th". */
  level?: string
  /** care: short human situation; class/tutor: optional context line. */
  situation?: string
  /** "Today's focus" / "Intention for today". */
  focus?: string
  /** "Where you left off" / "Last: scales + left hand". */
  progressNote?: string
  materialStatus?: MaterialStatus
  homeworkStatus?: HomeworkStatus
  paymentStatus?: PaymentStatus
  /** Short payment context for the flow card, e.g. "This month · $110". */
  paymentNote?: string
  /** class "Ready to teach" checklist (label + done). */
  prepChecklist?: { label: string; done: boolean }[]
  /** tutor education progress, e.g. { done: 4, goal: 5 } practice days. */
  practice?: { done: number; goal: number }
  /** "Last spoke 13 days ago" / "Since January" / "Last: 2 weeks ago". */
  lastContactLabel?: string
  /** care only: today's contact kind for the visits & calls timeline. */
  contactKind?: ContactKind
  firstTime?: boolean
  /** A short Fanny suggestion shown on the protagonist (care). */
  fannySuggestion?: string
  status: SessionStatus
  risks?: SessionRisk[]
}

export interface TodaySessionDay {
  variant: SessionVariant
  businessName: string
  /** "Counseling", "Sofía's Piano & Theory", "Casa de Esperanza". */
  contextLabel?: string
  sessions: TodaySession[]
}

export type FlowTone = "accent" | "info" | "success" | "lead" | "urgency"

export interface SessionFlowItem {
  id: string
  title: string
  meta: string
  /** Label of the single primary action (icon chosen by the layout). */
  actionLabel: string
}

export interface SessionFlowSection {
  label: string
  tone: FlowTone
  items: SessionFlowItem[]
}

export interface SessionDerived {
  variant: SessionVariant
  /** Sessions (class/tutor) or people (care). */
  count: number
  /** Sum of attendees (class "students"); 1 per session otherwise. */
  participants: number
  unpaid: number
  materialsPending: number
  homeworkToReview: number
  practicedDone: number
  practicedTotal: number
  visits: number
  calls: number
  urgent: number
  reminders: number
  firstTime: number
  waitingReply: number
  /** The hero session/person the canvas opens on. */
  protagonistId: string | null
  /** Derived Fanny flow (non-empty sections only), variant-aware. */
  flow: SessionFlowSection[]
}

// ─── Predicates ──────────────────────────────────────────────────────────────

function hasRisk(s: TodaySession, type: SessionRiskType): boolean {
  return Boolean(s.risks?.some((r) => r.type === type))
}
function isUnpaid(s: TodaySession): boolean {
  return s.paymentStatus === "unpaid" || s.paymentStatus === "overdue"
}
function materialPending(s: TodaySession): boolean {
  return s.materialStatus === "missing" || s.materialStatus === "pending"
}
function homeworkToReview(s: TodaySession): boolean {
  return s.homeworkStatus === "to_review" || s.homeworkStatus === "submitted"
}
function isWaitingReply(s: TodaySession): boolean {
  return s.status === "waiting_reply" || hasRisk(s, "waiting_reply")
}
function startMs(s: TodaySession): number {
  return s.startsAt ? new Date(s.startsAt).getTime() : Number.POSITIVE_INFINITY
}
function participantsOf(s: TodaySession): number {
  return s.participantCount ?? s.participants?.length ?? 1
}

// ─── Protagonist ──────────────────────────────────────────────────────────────

function pickProtagonist(day: TodaySessionDay): string | null {
  const { sessions, variant } = day
  if (sessions.length === 0) return null

  if (variant === "care") {
    // Needs you most: the most urgent person, else earliest scheduled contact.
    const urgent = sessions.find((s) => hasRisk(s, "urgent"))
    if (urgent) return urgent.id
    const scheduled = [...sessions]
      .filter((s) => s.startsAt)
      .sort((a, b) => startMs(a) - startMs(b))
    return (scheduled[0] ?? sessions[0]).id
  }

  // class / tutor: the live moment — starting soon / in progress, else the
  // earliest still-upcoming session, else the first row.
  const live = sessions.find((s) => s.status === "starting_soon" || s.status === "in_progress")
  if (live) return live.id
  const upcoming = [...sessions]
    .filter((s) => s.status === "scheduled" && s.startsAt)
    .sort((a, b) => startMs(a) - startMs(b))
  return (upcoming[0] ?? sessions[0]).id
}

// ─── Flow (Fanny) ──────────────────────────────────────────────────────────────

function flowItem(s: TodaySession, meta: string, actionLabel: string): SessionFlowItem {
  return {
    id: s.id,
    title: s.title,
    meta,
    actionLabel,
  }
}

function section(label: string, tone: FlowTone, items: SessionFlowItem[]): SessionFlowSection[] {
  return items.length > 0 ? [{ label, tone, items }] : []
}

function buildClassFlow(sessions: TodaySession[]): SessionFlowSection[] {
  return [
    ...section("Starting soon", "accent",
      sessions.filter((s) => s.status === "starting_soon")
        .map((s) => flowItem(s, s.subjectOrTopic ?? "Class begins shortly", "Mark attendance"))),
    ...section("Attendance needed", "info",
      sessions.filter((s) => (s.status === "in_progress" || s.status === "completed") && !s.attendanceMarked)
        .map((s) => flowItem(s, "Mark who showed up", "Mark attendance"))),
    ...section("Materials to send", "lead",
      sessions.filter(materialPending)
        .map((s) => flowItem(s, s.subjectOrTopic ?? "Material pending", "Send material"))),
    ...section("Payment pending", "lead",
      sessions.filter(isUnpaid)
        .map((s) => flowItem(s, "Unpaid for this class", "Send reminder"))),
    ...section("Parent messages", "info",
      sessions.filter((s) => hasRisk(s, "parent_message"))
        .map((s) => flowItem(s, "A parent is waiting", "Draft reply"))),
    ...section("Sessions to summarize", "success",
      sessions.filter((s) => s.status === "completed")
        .map((s) => flowItem(s, "Wrap up what happened", "Add note"))),
  ]
}

function buildTutorFlow(sessions: TodaySession[]): SessionFlowSection[] {
  return [
    ...section("Homework to review", "accent",
      sessions.filter(homeworkToReview)
        .map((s) => flowItem(s, "Submitted before the lesson", "Review now"))),
    ...section("Payment pending", "lead",
      sessions.filter(isUnpaid)
        .map((s) => flowItem(s, s.paymentStatus === "overdue" ? "Overdue" : "Due this month", "Mark paid / remind"))),
    ...section("Parent messages", "info",
      sessions.filter((s) => hasRisk(s, "parent_message"))
        .map((s) => flowItem(s, "A parent is waiting", "Draft reply"))),
    ...section("Follow-ups", "lead",
      sessions.filter((s) => s.status === "needs_follow_up" || hasRisk(s, "reschedule"))
        .map((s) => flowItem(s, "Missed last week — suggest a slot", "Send times"))),
  ]
}

function buildCareFlow(sessions: TodaySession[]): SessionFlowSection[] {
  return [
    ...section("People needing attention", "urgency",
      sessions.filter((s) => hasRisk(s, "urgent"))
        .map((s) => flowItem(s, s.situation ?? "A call could mean a lot", "Call now"))),
    ...section("Calls to make", "info",
      sessions.filter((s) => s.contactKind === "call" && !hasRisk(s, "urgent"))
        .map((s) => flowItem(s, s.situation ?? "Check in", "Call"))),
    ...section("Visits today", "success",
      sessions.filter((s) => s.contactKind === "visit")
        .map((s) => flowItem(s, s.situation ?? "Stop by", "Get directions"))),
    ...section("Waiting your reply", "lead",
      sessions.filter(isWaitingReply)
        .map((s) => flowItem(s, "Messaged you — a reply would help", "Reply"))),
    ...section("Community reminders", "lead",
      sessions.filter((s) => hasRisk(s, "reminder") && !s.contactKind)
        .map((s) => flowItem(s, "A note would brighten their day", "Send wishes"))),
  ]
}

function buildFlow(day: TodaySessionDay): SessionFlowSection[] {
  switch (day.variant) {
    case "tutor":
      return buildTutorFlow(day.sessions)
    case "care":
      return buildCareFlow(day.sessions)
    default:
      return buildClassFlow(day.sessions)
  }
}

// ─── Derivation ─────────────────────────────────────────────────────────────

export function deriveSessionDay(day: TodaySessionDay): SessionDerived {
  let participants = 0
  let unpaid = 0
  let materialsPending = 0
  let homeworkReview = 0
  let practicedDone = 0
  let practicedTotal = 0
  let visits = 0
  let calls = 0
  let urgent = 0
  let reminders = 0
  let firstTime = 0
  let waitingReply = 0

  for (const s of day.sessions) {
    participants += participantsOf(s)
    if (isUnpaid(s)) unpaid += 1
    if (materialPending(s)) materialsPending += 1
    if (homeworkToReview(s)) homeworkReview += 1
    if (s.practice) {
      practicedTotal += 1
      if (s.practice.done > 0) practicedDone += 1
    }
    if (s.contactKind === "visit") visits += 1
    if (s.contactKind === "call") calls += 1
    if (hasRisk(s, "urgent")) urgent += 1
    if (hasRisk(s, "reminder")) reminders += 1
    if (s.firstTime) firstTime += 1
    if (isWaitingReply(s)) waitingReply += 1
  }

  return {
    variant: day.variant,
    count: day.sessions.length,
    participants,
    unpaid,
    materialsPending,
    homeworkToReview: homeworkReview,
    practicedDone,
    practicedTotal,
    visits,
    calls,
    urgent,
    reminders,
    firstTime,
    waitingReply,
    protagonistId: pickProtagonist(day),
    flow: buildFlow(day),
  }
}
