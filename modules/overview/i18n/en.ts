import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import type { BeautyOverviewMessages } from "./types"

/** English (canonical) catalog for the Finesse "My salon" overview. */
export const en = {
  locale: "en",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Preview · sample data",
    tooltip: "Sample data while we connect your real appointments, payments and clients.",
  },
  header: {
    title: "My salon",
    description:
      "How your salon is doing this period: what you earned, the services people loved and who books again.",
    exportLabel: "Export",
    periodLabels: {
      week: "Week",
      month: "Month",
      quarter: "Quarter",
      year: "Year",
    },
  },
  exportCsv: {
    filenamePrefix: "my-salon",
    columns: {
      service: "Service",
      visits: "Visits",
      revenue: "Revenue",
      visitShare: "% visits",
    },
  },
  periodCard: {
    eyebrow: "Period",
    noComparisonNote: "First period · no comparison",
  },
  brief: {
    agentName: BEAUTY_SPECIALIST_AGENT.name,
    tagline: "beauty intelligence",
    earningsUp: (pct, topService) =>
      `A good period — you earned ${pct} more${topService ? `, mostly thanks to ${topService.toLowerCase()}` : ""}.`,
    earningsDown: (pct) => `A quieter period — you earned ${pct} less than the previous one.`,
    earningsFlat: "A steady period — your earnings are holding.",
    topServiceOnly: (service) => `Your clients are mostly asking for ${service.toLowerCase()}.`,
    peakNearlyFull: "Your peak days are nearly full.",
    returningRate: (pct) => `And ${pct} of your clients booked again.`,
  },
  kpis: {
    earnings: "Earnings",
    visits: "Visits",
    newClients: "New clients",
    returningRate: "Booked again",
    comparisonSuffix: {
      week: "than last week",
      month: "than last month",
      quarter: "than last quarter",
      year: "than last year",
    },
    noComparison: "No comparison yet",
    noData: "No data yet",
    sparkAria: "Recent trend",
    srTones: { more: "more", less: "less", same: "same" },
  },
  revenue: {
    title: "What you earned",
    subtitle: {
      day: "Day by day",
      week: "Week by week",
      month: "Month by month",
    },
    moreSuffix: "more than the previous period",
    lessSuffix: "less than the previous period",
    sameNote: "Same as the previous period",
    empty: {
      title: "No earnings recorded yet.",
      description: "Once you record payments, you'll see their trend here.",
    },
    weekPrefix: "Wk",
  },
  drivers: {
    titleUp: "Why you earned more",
    titleDown: "Why you earned less",
    subtitle: "Finesse analyzed what changed",
    sourceLabels: {
      services: "Your star services were requested more",
      bookings: "There were fewer bookings than the previous period",
      "new-clients": "New clients found you through {detail}",
      rebooking: "More clients rebooked",
      cancellations: "There were more last-minute cancellations",
      "walk-ins": "Fewer walk-in visits",
      campaign: "Your campaign brought bookings",
      schedule: "You extended your opening hours",
      weather: "The weather affected walk-in visits",
    },
    confidenceLabels: {
      confirmed: "Confirmed data",
      correlation: "Based on booking data",
      inference: "Possible influence",
    },
    detailFallback: "social media",
    empty: "No changes to explain this period.",
  },
  lookingAhead: {
    lead: "Looking ahead:",
    texts: {
      "quiet-period":
        "A quieter stretch is coming — many clients travel. A small promo now can keep your calendar full.",
      "peak-nearly-full":
        "Your peak days are nearly full. A couple of extra evening slots would let you see more clients.",
      "service-growing": "One service is growing fast. It may be a good moment to highlight it.",
      "rebooking-falling": "Rebookings are dipping a little. A friendly reminder can help.",
    },
    actions: {
      "quiet-period": "Create campaign",
      "peak-nearly-full": "Review calendar",
      "service-growing": "View services",
      "rebooking-falling": "Contact clients",
    },
  },
  services: {
    title: "What your clients love most",
    hintPrefix: "Out of",
    hintSuffix: "visits this period",
    empty: {
      title: "No service data yet.",
      description: "Once you record appointments with services, you'll see the favourites here.",
    },
    archivedLabel: "Archived",
  },
  demand: {
    title: "Your busiest days",
    hint: "visits per day",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekdaysLong: [
      "Mondays",
      "Tuesdays",
      "Wednesdays",
      "Thursdays",
      "Fridays",
      "Saturdays",
      "Sundays",
    ],
    peakLead: "Your peak hours:",
    peakJoiner: " and ",
    empty: "Not enough appointments yet to see a pattern.",
    actionLabel: "View calendar",
  },
  clientMix: {
    title: "New and returning clients",
    returning: "Returning",
    newLabel: "New",
    centerLabel: "clients",
    empty: "No clients recorded this period yet.",
  },
  topClients: {
    title: "Your most loyal clients",
    hint: "the ones who visit you most",
    visitsSuffix: "visits",
    vipLabel: "VIP",
    empty: "Once you have recorded visits you'll see your regulars here.",
    restrictedSpend: "—",
  },
  sources: {
    title: "How people find you",
    labels: {
      instagram: "Instagram",
      whatsapp: "WhatsApp",
      google: "Google",
      website: "Your website",
      direct: "Direct booking",
      "walk-in": "Walk-in",
      referral: "Referral",
      phone: "Phone",
      unknown: "Unattributed",
    },
    empty: "No booking-source data yet.",
  },
  recommendations: {
    title: "Ideas from Finesse",
    agentLabels: {
      fiona: "Fiona",
      felix: "Felix",
      fanny: "Fanny",
      finesse: "Finesse",
    },
    actionLabels: {
      reactivation: "Create a win-back campaign",
      "pending-payments": "Review payments",
      availability: "Review calendar",
      "quiet-period": "Create campaign",
    },
    texts: {
      reactivation: (count) =>
        `${count} clients haven't visited in a while — a "we miss you" note can bring them back.`,
      pendingPayments: (amount) =>
        `You still have ${amount} to collect from completed visits.`,
      availability: (percent) =>
        `Your peak days are at ${percent}% — a couple of extra evening slots would let you see more clients.`,
      quietPeriod: "A quieter stretch is coming. A simple campaign now can keep your calendar full.",
    },
    emptyPositive: "All good — nothing Finesse wants to flag today. ✨",
  },
  salonProfile: {
    title: "Salon profile",
    regionLabel: "Area",
    hoursLabel: "Hours",
    servicesLabel: "Active services",
    completeness: (pct) => `Profile ${pct} complete`,
    editCta: "Edit profile",
    empty: "Your salon profile is empty. Complete it so clients and Finesse know your business.",
  },
  todayOps: {
    title: "Today at the salon",
    appointmentsTitle: "Today's appointments",
    appointmentsEmpty: "No appointments scheduled for today.",
    pendingConversations: (count) =>
      count === 1 ? "1 message awaiting reply" : `${count} messages awaiting reply`,
    priorityTasks: (count) =>
      count === 1 ? "1 priority task for today" : `${count} priority tasks for today`,
    activeClients: (count) => (count === 1 ? "1 active client" : `${count} active clients`),
    pendingInvoices: (count, amount) =>
      count === 1 ? `1 invoice awaiting payment (${amount})` : `${count} invoices awaiting payment (${amount})`,
    overdueInvoices: (count, amount) =>
      count === 1 ? `1 overdue invoice (${amount})` : `${count} overdue invoices (${amount})`,
    openInbox: "Open inbox",
    openToday: "View tasks",
    openBilling: "View billing",
    openAgenda: "Open calendar",
  },
  states: {
    loading: "Loading My salon",
    error: {
      title: "We couldn't load My salon.",
      description: "Please try again in a few seconds.",
      retry: "Retry",
    },
    emptyPage: {
      title: "Your salon is ready to start.",
      description:
        "Once you have appointments, payments and clients recorded, Finesse will show you here how your business is doing and what you can improve.",
      cta: "View my calendar",
    },
    sectionNoData: "No data in this period.",
    noFinance: "Earnings data is not available.",
  },
  demo: {
    serviceNames: {
      cutStyle: "Cut & styling",
      fullColor: "Full colour",
      balayage: "Highlights & balayage",
      treatment: "Treatment & gloss",
      eventStyle: "Event styling",
    },
  },
} satisfies BeautyOverviewMessages
