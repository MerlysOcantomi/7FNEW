/**
 * Finesse "Hoy" (Beauty Today) — localized message contract (P4.FINESSE-ENES).
 *
 * Mirrors the Marketing/Overview precedent: the Core owns the locale runtime;
 * this vertical namespace owns every visible string of the appointment-first
 * Beauty Today preview (the Studio overview) plus the localized status labels
 * for the internal appointment states. Internal state VALUES
 * (confirmed/pending/arrived/completed/no_show/cancelled) never change — only
 * their visible labels live here. English is canonical; Spanish is complete.
 *
 * Demo narrative content (assistant note, decisions, care, momento, mock
 * service names) is product-owned sample data and localizes with the UI; real
 * client names stay proper nouns and are never translated.
 */

import type { SupportedLocale } from "@core/i18n/types"
import type { AppointmentStatus } from "../appointments"

export interface BeautyTodayMessages {
  locale: SupportedLocale
  brandTitle: string
  eyebrow: string
  brandLine: string
  previewChip: string
  previewTooltip: string
  statusLabels: Record<AppointmentStatus, string>
  ui: {
    railTitle: string
    pills: { appointments: string; unconfirmed: string; openGaps: string; booked: string }
    now: string
    openGap: string
    nothingHere: string
    groups: {
      unconfirmed: string
      openGaps: string
      followUps: string
      messages: string
      care: string
      content: string
    }
    actions: { remind: string; waitlist: string; message: string }
  }
  /** The Finesse Studio overview surface (header, agenda, right rail). */
  studio: {
    headerTitle: (studio: string) => string
    bySevenef: string
    intro: string
    signals: {
      appointments: (count: number) => string
      openGaps: (count: number) => string
      bookedValue: (amount: string) => string
    }
    agendaTitle: string
    agendaHint: (appointments: number, gaps: number) => string
    upToDate: string
    gapRow: {
      title: (start: string, end: string) => string
      note: string
    }
    decisionsTitle: string
    later: string
    careCountHint: (count: number) => string
    momentoTitle: string
    momentoHint: string
    uploadPhoto: string
    disabledHints: {
      connectAppointments: string
      connectAssistant: string
      connectMarketing: string
    }
  }
  /** The REAL Beauty "Hoy" surface (agenda from Evento, actions from tasks). */
  real: {
    /** Header signals — real counts only (Evento has no price → no value figure). */
    signals: {
      appointments: (count: number) => string
      remaining: (count: number) => string
      gaps: (count: number) => string
    }
    nextTitle: string
    nextNone: string
    /** "Terminada"-style claims are banned — phases are time words only. */
    phaseCurrent: string
    agendaEmpty: string
    openCalendar: string
    openClient: string
    gapRow: {
      title: (start: string, end: string) => string
      minutes: (minutes: number) => string
    }
    urgentTitle: string
    suggestedTitle: string
    /** "Based on:" prefix before an action's real basis chips. */
    basisPrefix: string
    proposedLabel: string
    waitingLabel: string
    overdueLabel: string
    dueAtLabel: (time: string) => string
    open: string
    messagesRow: (count: number) => string
    openInbox: string
    overdueInvoicesRow: (count: number, amount: string) => string
    pendingInvoicesRow: (count: number, amount: string) => string
    openBilling: string
    otherTasksRow: (count: number) => string
    openWorkboard: string
    allClear: string
    emptyDay: {
      title: string
      description: string
      cta: string
    }
    error: { title: string; description: string; retry: string }
    loading: string
  }
  /** Product-owned demo narrative + mock content. */
  demo: {
    assistantNote: string
    decisions: Array<{
      id: string
      /** Agent proper noun — never translated. */
      agent: string
      kind: string
      title: string
      why: string
      primary: string
    }>
    care: Array<{
      /** Demo client proper noun — same across locales. */
      name: string
      ini: string
      tag: string
      tone: "vip" | "warn" | "new"
      note: string
      action: string
    }>
    momento: {
      channel: string
      title: string
      note: string
      primary: string
      secondary: string
      link: string
    }
    /** Localized service names for the beauty appointment mock (by slot). */
    services: string[]
  }
  /** Legacy appointment-layout extras (kept for the generic layout contract). */
  extras: {
    recentClients: string[]
    featuredServices: string[]
    recommendedActions: { title: string; meta: string }[]
    pendingMessages: { name: string; text: string }[]
    clientsToCare: { name: string; meta: string }[]
    postIdea: { title: string; meta: string }
  }
}
