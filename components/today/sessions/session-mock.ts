import type {
  SessionVariant,
  TodaySession,
  TodaySessionDay,
} from "@modules/today/sessions"

/**
 * ISOLATED demo adapter for the session-first Today layout.
 *
 * ⚠️ DEMO DATA ONLY. There is no real session backend yet (see
 * modules/today/sessions.ts). This module is the single, clearly-named place
 * that produces mock sessions/people, used ONLY by the session layout while it
 * is in preview/disabled-by-default mode. It performs no I/O, registers no
 * provider, and is never mixed with real production data. When a real source
 * lands, swap the layout's data hook and delete this file — nothing else
 * depends on it.
 *
 * One preset per variant: class (group classes), tutor (1:1 students), care
 * (lightweight people follow-up). Numbers are designed to read as a believable
 * day; deriveSessionDay computes the KPIs from this data, never hardcoded.
 */

/** Build an ISO timestamp for *today* at a given local hour/minute. */
function at(hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ─── class — group classes (school / academy) ───────────────────────────────
// 5 sessions · 18 students · 3 unpaid · 2 materials pending.

function classSessions(): TodaySession[] {
  return [
    {
      id: "c1", title: "Beginner Guitar", groupName: "Beginner Guitar", startsAt: at(9, 0), endsAt: at(10, 0),
      mode: "in_person", locationLabel: "Room A", subjectOrTopic: "Guitar · Unit 3", participantCount: 5,
      status: "completed", attendanceMarked: true, homeworkStatus: "to_review",
    },
    {
      id: "c2", title: "Music Theory", groupName: "Music Theory", startsAt: at(10, 30), endsAt: at(11, 30),
      mode: "in_person", locationLabel: "Room B", subjectOrTopic: "Theory · Grade 2", participantCount: 4,
      status: "completed", attendanceMarked: false, paymentStatus: "unpaid", paymentNote: "1 student unpaid",
    },
    {
      id: "c3", title: "Spanish A1", groupName: "Spanish A1", startsAt: at(12, 0), endsAt: at(13, 0),
      mode: "online", subjectOrTopic: "Spanish · A1", focus: "Unit 5 · past tense", participantCount: 4,
      expectedAttendance: 4, status: "starting_soon", materialStatus: "missing",
      progressNote: "Last: greetings + numbers",
      prepChecklist: [
        { label: "Lesson plan ready", done: true },
        { label: "Slides ready", done: true },
        { label: "Worksheet to send", done: false },
        { label: "Last homework checked", done: true },
      ],
    },
    {
      id: "c4", title: "Kids Art", groupName: "Kids Art", startsAt: at(16, 0), endsAt: at(17, 0),
      mode: "in_person", locationLabel: "Studio", subjectOrTopic: "Art · Color & shapes", participantCount: 3,
      status: "scheduled", materialStatus: "pending", paymentStatus: "unpaid", paymentNote: "2 unpaid",
      risks: [{ type: "parent_message", label: "Parent asked about recital" }],
    },
    {
      id: "c5", title: "Dance Intermediate", groupName: "Dance Intermediate", startsAt: at(18, 0), endsAt: at(19, 0),
      mode: "in_person", locationLabel: "Main hall", subjectOrTopic: "Dance · Routine 2", participantCount: 2,
      status: "scheduled", paymentStatus: "overdue", paymentNote: "Overdue 6 days",
    },
  ]
}

// ─── tutor — 1:1 students (private tutor / coach) ────────────────────────────
// 6 sessions · 6 students · 2 unpaid · 1 homework to review · practiced 5/6.

function tutorSessions(): TodaySession[] {
  return [
    {
      id: "t1", title: "Emma Ruiz", studentName: "Emma Ruiz", startsAt: at(9, 0), endsAt: at(9, 45),
      mode: "in_person", subjectOrTopic: "Guitar", level: "Beginner", status: "completed", practice: { done: 5, goal: 5 },
    },
    {
      id: "t2", title: "Andrés Polo", studentName: "Andrés Polo", startsAt: at(10, 30), endsAt: at(11, 15),
      mode: "in_person", subjectOrTopic: "Theory", level: "Grade 2", status: "completed", paymentStatus: "paid",
      practice: { done: 0, goal: 5 },
    },
    {
      id: "t3", title: "Lucas Moreno", studentName: "Lucas Moreno", startsAt: at(12, 0), endsAt: at(12, 45),
      mode: "in_person", subjectOrTopic: "Piano", level: "Intermediate · 8 months in", status: "starting_soon",
      focus: "Für Elise — first phrase, both hands", progressNote: "Last: scales + left hand",
      homeworkStatus: "to_review", practice: { done: 4, goal: 5 },
    },
    {
      id: "t4", title: "Sofía León", studentName: "Sofía León", startsAt: at(14, 0), endsAt: at(14, 45),
      mode: "in_person", subjectOrTopic: "Piano", level: "Beginner", status: "scheduled",
      focus: "Review: C major scale + simple song", practice: { done: 5, goal: 5 },
      risks: [{ type: "parent_message", label: "Asked about recital in July" }],
    },
    {
      id: "t5", title: "Mateo Gil", studentName: "Mateo Gil", startsAt: at(15, 30), endsAt: at(16, 15),
      mode: "in_person", subjectOrTopic: "Violin", level: "Grade 1", status: "scheduled",
      focus: "Bow hold + open strings", practice: { done: 2, goal: 5 },
      paymentStatus: "unpaid", paymentNote: "This month · $110",
    },
    {
      id: "t6", title: "Valentina Ruiz", studentName: "Valentina Ruiz", startsAt: at(17, 0), endsAt: at(17, 45),
      mode: "online", subjectOrTopic: "Voice", level: "Intermediate", status: "needs_follow_up",
      focus: "Breathing + warm-up range", practice: { done: 3, goal: 5 },
      paymentStatus: "overdue", paymentNote: "Overdue 8 days · $95",
      risks: [{ type: "reschedule", label: "Rebook" }],
    },
  ]
}

// ─── care — lightweight people follow-up (pastoral / small NGO / mentoring) ──
// 9 people · 3 visits · 2 urgent · 4 reminders · 1 waiting reply.

function careSessions(): TodaySession[] {
  return [
    {
      id: "p1", title: "Ana Morales", personName: "Ana Morales", startsAt: at(15, 0), endsAt: at(15, 20),
      mode: "online", contactKind: "call", situation: "Isolated · missed group 3 weeks",
      lastContactLabel: "Last spoke 13 days ago", locationLabel: "Tuesday group", status: "scheduled",
      fannySuggestion: "A short call before 3 PM could mean a lot. I drafted a warm message if you'd rather text first.",
      risks: [{ type: "urgent", label: "Urgent" }],
    },
    {
      id: "p2", title: "Roberto Díaz", personName: "Roberto Díaz", startsAt: at(10, 0), endsAt: at(10, 20),
      mode: "online", contactKind: "call", situation: "Recovering after surgery",
      lastContactLabel: "Visited last week", status: "scheduled",
    },
    {
      id: "p3", title: "Familia Delgado", personName: "Familia Delgado", startsAt: at(13, 0), endsAt: at(13, 45),
      mode: "in_person", contactKind: "visit", situation: "New baby · welcome visit",
      lastContactLabel: "New to community", status: "scheduled",
    },
    {
      id: "p4", title: "Don Manuel", personName: "Don Manuel", startsAt: at(17, 0), endsAt: at(17, 45),
      mode: "in_person", contactKind: "visit", situation: "Elderly · weekly check-in",
      lastContactLabel: "Visited 6 days ago", status: "scheduled",
      risks: [{ type: "reminder", label: "Weekly check-in" }],
    },
    {
      id: "p5", title: "Carmen Ruiz", personName: "Carmen Ruiz", startsAt: at(11, 30), endsAt: at(11, 50),
      mode: "online", contactKind: "call", situation: "Just widowed · needs a gentle call",
      lastContactLabel: "Last spoke 9 days ago", status: "scheduled",
      risks: [{ type: "urgent", label: "Urgent" }],
    },
    {
      id: "p6", title: "Pedro Salas", personName: "Pedro Salas", startsAt: at(16, 0), endsAt: at(16, 30),
      mode: "in_person", contactKind: "visit", situation: "Recovering · drop groceries",
      lastContactLabel: "Visited 3 days ago", status: "scheduled",
      risks: [{ type: "reminder", label: "Bring groceries" }],
    },
    {
      id: "p7", title: "Marta Torres", personName: "Marta Torres", situation: "Turns 60 today · birthday",
      mode: "online", lastContactLabel: "Spoke last Sunday", status: "needs_follow_up",
      risks: [{ type: "reminder", label: "Birthday" }],
    },
    {
      id: "p8", title: "Elena Páez", personName: "Elena Páez", startsAt: at(9, 30), endsAt: at(9, 50),
      mode: "online", contactKind: "call", situation: "Anniversary of loss this week",
      lastContactLabel: "Last spoke 5 days ago", status: "scheduled",
      risks: [{ type: "reminder", label: "Anniversary" }],
    },
    {
      id: "p9", title: "Lucía Vega", personName: "Lucía Vega", situation: "Going through a separation",
      mode: "online", lastContactLabel: "Yesterday evening", status: "waiting_reply",
    },
  ]
}

interface Preset {
  businessName: string
  contextLabel?: string
  sessions: () => TodaySession[]
}

const PRESETS: Record<SessionVariant, Preset> = {
  class: { businessName: "Harmony Music School", sessions: classSessions },
  tutor: { businessName: "Sofía's Piano & Theory", sessions: tutorSessions },
  care: { businessName: "Casa de Esperanza", sessions: careSessions },
}

/** Demo day for the given variant (defaults to class). */
export function getSessionDayMock(variant: SessionVariant = "class"): TodaySessionDay {
  const preset = PRESETS[variant] ?? PRESETS.class
  return {
    variant,
    businessName: preset.businessName,
    contextLabel: preset.contextLabel,
    sessions: preset.sessions(),
  }
}
