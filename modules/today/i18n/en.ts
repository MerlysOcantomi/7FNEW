import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import type { BeautyTodayMessages } from "./types"

/** English (canonical) catalog for the Finesse "Today" (Beauty Today). */
export const en = {
  locale: "en",
  brandTitle: "7F Beauty",
  eyebrow: BEAUTY_SPECIALIST_AGENT.voice.intelligence,
  brandLine: BEAUTY_SPECIALIST_AGENT.tagline,
  previewChip: "Preview · sample data",
  previewTooltip: "Sample data while we connect your real appointments.",
  statusLabels: {
    confirmed: "Confirmed",
    pending: "Awaiting confirmation",
    arrived: "Arrived",
    no_show: "No-show",
    cancelled: "Cancelled",
  },
  ui: {
    railTitle: "Finesse flow",
    pills: { appointments: "Appointments", unconfirmed: "Unconfirmed", openGaps: "Open gaps", booked: "Earnings" },
    now: "Now",
    openGap: "Open",
    nothingHere: "Nothing here.",
    groups: {
      unconfirmed: "Unconfirmed",
      openGaps: "Open gaps",
      followUps: "Follow-ups",
      messages: "Pending messages",
      care: "Clients to care for",
      content: "Content idea",
    },
    actions: { remind: "Send reminder", waitlist: "Offer the slot", message: "Prepare message" },
  },
  studio: {
    headerTitle: (studio) => `Today at ${studio}`,
    bySevenef: "· by Sevenef",
    intro: "Finesse has your calendar, your decisions and one visual opportunity ready for today.",
    signals: {
      appointments: (count) => (count === 1 ? "1 appointment" : `${count} appointments`),
      openGaps: (count) => (count === 1 ? "1 open gap" : `${count} open gaps`),
      bookedValue: (amount) => `${amount} expected`,
    },
    agendaTitle: "Today's calendar",
    agendaHint: (appointments, gaps) => `${appointments} appointments · ${gaps} gaps`,
    upToDate: "up to date",
    gapRow: {
      title: (start, end) => `Open slot · ${start} – ${end}`,
      note: "Finesse can offer it to your regular clients",
    },
    decisionsTitle: "Needs your decision",
    later: "Later",
    careCountHint: (count) => `${count} today`,
    momentoTitle: "Beauty moment",
    momentoHint: "today's visual idea",
    uploadPhoto: "Upload today's photo",
    disabledHints: {
      connectAppointments: "Available once real appointments are connected",
      connectAssistant: "Available once the assistant is connected",
      connectMarketing: "Available once Marketing is connected",
    },
  },
  real: {
    signals: {
      appointments: (count) => (count === 1 ? "1 appointment" : `${count} appointments`),
      remaining: (count) => (count === 1 ? "1 still ahead" : `${count} still ahead`),
      gaps: (count) => (count === 1 ? "1 open gap" : `${count} open gaps`),
    },
    nextTitle: "Next appointment",
    nextNone: "No more appointments today.",
    phaseCurrent: "Happening now",
    agendaEmpty: "No appointments scheduled for today.",
    openCalendar: "Open calendar",
    openClient: "View client",
    gapRow: {
      title: (start, end) => `Free slot · ${start} – ${end}`,
      minutes: (minutes) => `${minutes} min`,
    },
    urgentTitle: "For today",
    suggestedTitle: "Finesse suggests",
    basisPrefix: "Based on:",
    proposedLabel: "Proposal",
    waitingLabel: "Waiting",
    overdueLabel: "Overdue",
    dueAtLabel: (time) => `Due ${time}`,
    open: "Open",
    messagesRow: (count) =>
      count === 1 ? "1 message awaiting reply" : `${count} messages awaiting reply`,
    openInbox: "Open inbox",
    overdueInvoicesRow: (count, amount) =>
      count === 1 ? `1 overdue invoice (${amount})` : `${count} overdue invoices (${amount})`,
    pendingInvoicesRow: (count, amount) =>
      count === 1
        ? `1 invoice awaiting payment (${amount})`
        : `${count} invoices awaiting payment (${amount})`,
    openBilling: "View billing",
    otherTasksRow: (count) =>
      count === 1 ? "1 more task on your board" : `${count} more tasks on your board`,
    openWorkboard: "Open the work board",
    allClear: "All clear — nothing urgent right now. ✨",
    emptyDay: {
      title: "Your day is open",
      description:
        "No appointments, tasks or pending messages yet. Your calendar is the place to add the first booking.",
      cta: "Open calendar",
    },
    error: {
      title: "We couldn't load your day",
      description: "Something went wrong while loading today's data.",
      retry: "Try again",
    },
    loading: "Loading your day…",
  },
  demo: {
    assistantNote:
      "Your day is on track. Before the afternoon, protect the 16:30 VIP colour and offer the open slot to a regular client.",
    decisions: [
      {
        id: "d1",
        agent: "Francis",
        kind: "VIP loyalty",
        title: "Offer 15% loyalty to Camila before her VIP colour",
        why: "VIP client · 22 visits. It keeps her booking every month.",
        primary: "Confirm",
      },
      {
        id: "d2",
        agent: "Fiona",
        kind: "campaign",
        title: "Approve the summer campaign for inactive clients",
        why: "14 clients without a booking · Freya already prepared the visuals.",
        primary: "Approve",
      },
    ],
    care: [
      { name: "Camila Ruiz", ini: "CR", tag: "VIP", tone: "vip", note: "Colour today 16:30 · 22 visits", action: "Loyalty" },
      { name: "Daniela Prats", ini: "DP", tag: "Inactive", tone: "warn", note: "No booking for 3 months", action: "Win back" },
      { name: "Valentina Mora", ini: "VM", tag: "New", tone: "new", note: "1st visit · left 5★", action: "Welcome" },
    ],
    momento: {
      channel: "Instagram · before/after",
      title: "María's Rose Nude Chrome came out picture-perfect.",
      note: "Finesse spotted a perfect job to publish today. Freya already prepared a caption.",
      primary: "Prepare post",
      secondary: "Another idea",
      link: "Upload more photos · see everything in Marketing",
    },
    services: [
      "Semi-permanent manicure",
      "Polish removal",
      "Nail art",
      "Facial cleansing",
      "Brow shaping",
      "Lash lift",
      "Pedicure",
      "Nail infill",
    ],
  },
  extras: {
    recentClients: ["Marina Velasco", "Nora Díaz", "Sofía Cano", "Laura Méndez"],
    featuredServices: [
      "Semi-permanent manicure",
      "Polish removal",
      "Nail art",
      "Facial cleansing",
    ],
    recommendedActions: [
      { title: "Confirm 2 of today's appointments", meta: "Marina (10:00) · Carla (12:30)" },
      { title: "Fill the 13:30 gap", meta: "Offer it to regular clients" },
      { title: "Publish yesterday's photo", meta: "Nail art · deep red" },
    ],
    pendingMessages: [
      { name: "Claudia", text: "Do you have a slot on Friday afternoon?" },
      { name: "Ana", text: "Can I move my appointment to 17:00?" },
    ],
    clientsToCare: [
      { name: "Elena Soto", meta: "Not seen in 6 weeks · rebooking" },
      { name: "Paula Gil", meta: "Birthday this week 🎂" },
    ],
    postIdea: {
      title: "Before/after of a semi-permanent manicure",
      meta: "Freya can prepare the post · you approve",
    },
  },
} satisfies BeautyTodayMessages
