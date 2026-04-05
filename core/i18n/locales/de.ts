import type { TranslationSet } from "../types"

export const de: TranslationSet = {
  locale: "de",
  label: "Deutsch",

  email: {
    ack: {
      heading: "Wir haben Ihre Nachricht erhalten und unser Team wird sich in Kürze bei Ihnen melden.",
      body: "Sie müssen auf diese E-Mail nicht antworten. Wir werden uns direkt bei Ihnen melden.",
      subjectLabel: "Betreff",
      greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    },
    outbound: {
      footer: (ws) => `Gesendet über Smart Inbox — ${ws}`,
      defaultSubject: "Neue Nachricht",
    },
    poweredBy: "Bereitgestellt von 7F",
    sentVia: "Gesendet über 7F",
  },

  activity: {
    created: "Erstellt",
    updated: "Aktualisiert",
    deleted: "Gelöscht",
    status_change: "Statusänderung",
    assigned: "Zugewiesen",
    unassigned: "Zuweisung entfernt",
    comment: "Kommentar",
    mention: "Erwähnung",
    email_sent: "E-Mail gesendet",
    email_failed: "E-Mail fehlgeschlagen",
    email_skipped: "E-Mail übersprungen",
  },

  common: {
    subject: "Betreff",
    message: "Nachricht",
    noReply: "Keine Antwort erforderlich",
    hi: "Hallo",
    thankYou: "Vielen Dank",
    regards: "Mit freundlichen Grüßen",
  },
}
