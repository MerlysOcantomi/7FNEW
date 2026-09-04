import type { FinesseLandingMessages } from "./types"

/** English — canonical reference. */
export const en: FinesseLandingMessages = {
  locale: "en",
  meta: {
    title: "Finesse — Software for beauty professionals and small salons",
    description:
      "Finesse brings your calendar, your clients, your messages and your business presence together in one app built for your working day.",
    ogTitle: "Finesse — Your beauty business, organized in one place",
    ogDescription:
      "Calendar, clients, messages and presence for hair, nails, aesthetics, barbers and independent professionals.",
  },
  brand: "Finesse",
  nav: {
    features: "Features",
    forWho: "Who it's for",
    cta: "Log in to Finesse",
    skipToContent: "Skip to content",
    menuLabel: "Main navigation",
  },
  hero: {
    title: "Your beauty business, organized in one place.",
    subtitle:
      "Calendar, clients, messages and your business presence, in one app built for your working day. Without feeling like a second office job.",
    cta: "Log in to Finesse",
    secondary: "See how it works",
    previewCaption: "This is your day in Finesse.",
  },
  day: {
    eyebrow: "Your day",
    title: "Know who is coming now and what needs your attention.",
    description:
      "Open Finesse and see what matters today, without digging through menus: the next person, what to prepare and what can't wait.",
    items: [
      {
        title: "Next client",
        description: "Time, service and the notes you need to prepare, one tap away from calling or opening their record.",
      },
      {
        title: "What needs your attention",
        description: "Only what matters: an appointment to confirm, an unanswered message, a pending payment.",
      },
      {
        title: "My inspiration",
        description: "Your work at hand to remember ideas and show them during an appointment.",
      },
    ],
  },
  agenda: {
    eyebrow: "Your calendar",
    title: "Your appointments and your day, in one place.",
    description:
      "Appointments, services and who comes next, ordered the way your day unfolds. Open the full calendar whenever you need it.",
    points: ["Appointments with service and client", "Next client always visible", "Easy access to the full calendar"],
  },
  messages: {
    eyebrow: "Your messages",
    title: "Your clients' messages, with context.",
    description:
      "Every conversation arrives with what you need to reply: who is writing, what about and what to do next. Your conversations, email included, in one place.",
    points: ["You know what each message is about", "Prepared replies you review and send", "No app switching to check the appointment"],
    previewLabel: "Preview · available channels depend on your setup",
  },
  presence: {
    eyebrow: "Your presence",
    title: "Fill in your business information once and use it to build your presence.",
    description:
      "Name, services, opening hours, location and contact: the foundation of your online presence, ready to grow with your business.",
    points: ["Your business and your services", "Images of your work", "Location and contact"],
  },
  forWho: {
    eyebrow: "Who it's for",
    title: "Made for people who work with their hands and with people.",
    description: "Finesse is built for independent professionals and small salons, not for large chains.",
    audiences: ["Hair salons", "Nails and manicure", "Aesthetics", "Barbers", "Independent professionals", "Small salons"],
  },
  why: {
    title: "Your business shouldn't feel like another admin job.",
    description:
      "Finesse brings calendar, clients, messages, presence and your daily work into one app, so you can spend your time on what you do best.",
    pillars: ["Calendar", "Clients", "Messages", "Presence", "Daily work"],
  },
  finalCta: {
    title: "Get started with Finesse",
    description: "Your day, your clients and your messages, in one place.",
    cta: "Log in to Finesse",
  },
  footer: {
    login: "Log in",
    poweredBy: "Powered by SevenF",
    tagline: "Software for beauty professionals and small salons.",
  },
  preview: {
    today: {
      date: "Thursday, 3 September · 4 appointments",
      studio: "Studio Alma",
      nowTitle: "Right now",
      inProgress: "Happening now",
      time: "11:30",
      until: "until 12:30",
      client: "Marta Sánchez",
      service: "Gel manicure",
      noteLabel: "Appointment note",
      note: "Bringing a reference photo · wants an inverted French",
      call: "Call",
      viewClient: "View client",
      nextLabel: "Then",
      nextTime: "13:00",
      nextClient: "Lucía Romero",
      viewAgenda: "See the full calendar",
      attentionTitle: "What needs your attention",
      attention: ["Confirm Lucía's appointment", "2 unanswered messages", "1 payment pending"],
      inspirationTitle: "My inspiration",
      inspirationCount: "12 pieces of work",
      nav: { salon: "My salon", today: "Today", assistant: "Finesse", messages: "Messages", more: "More" },
    },
    agenda: {
      title: "Today",
      rows: [
        { time: "10:00", client: "Carmen Vidal", service: "Pedicure" },
        { time: "11:30", client: "Marta Sánchez", service: "Gel manicure" },
        { time: "13:00", client: "Lucía Romero", service: "Lash lift" },
      ],
      free: "Open gap · 14:00 – 16:00",
    },
    inbox: {
      name: "María López",
      intent: "Reschedule",
      channel: "WhatsApp",
      time: "10:42",
      message: "Could you move my Saturday appointment to Monday?",
      viewAppointment: "View appointment",
      prepareReply: "Prepare reply",
      composerPlaceholder: "Write a message…",
    },
    presence: {
      businessName: "Studio Alma",
      tagline: "Nails and aesthetics in central Valencia",
      servicesLabel: "Services",
      services: ["Gel manicure", "Pedicure", "Lash lift", "Nail art"],
      hoursLabel: "Hours",
      hours: "Mon–Sat · 10:00–19:00",
      locationLabel: "Where",
      location: "Calle de la Paz 12, Valencia",
      contactLabel: "Contact",
      contact: "+34 600 000 000",
      webLabel: "Your online presence",
    },
  },
}
