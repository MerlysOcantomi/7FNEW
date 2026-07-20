import type { AgentsMessages } from "../types"

/**
 * German source for the `agents` UI namespace (quick view + full page).
 * "Fanny" and the other agent names are proper names — never translated
 * (see AGENTS.md). Activity item titles come from the API as content.
 */
export const agents: AgentsMessages = {
  subtitle: "Was deine KI-Agenten gerade tun · im gesamten Workspace",
  openFull: "Agenten vollständig öffnen",
  closePanel: "Agenten-Panel schließen",
  closeDrawer: "Agenten schließen",
  loadingAria: "Agenten-Aktivität wird geladen",
  loadErrorNote: "Die Agenten-Aktivität konnte nicht geladen werden.",
  empty: {
    title: "Noch keine Agenten-Aktivität",
    body: "Wenn Fanny Arbeit automatisiert, eine Aufgabe vorschlägt oder eine Aktion ausführt, erscheint sie hier — gruppiert nach dem, was Prüfung braucht, was automatisiert wurde und was deine Aufmerksamkeit erfordert.",
  },
  lanes: {
    needsReview: { title: "Braucht deine Prüfung", empty: "Keine wartenden Vorschläge." },
    automated: { title: "Kürzlich erledigt", empty: "Noch nichts erledigt." },
    attention: { title: "Aufmerksamkeit", empty: "Nichts erfordert Aufmerksamkeit." },
  },
  moreOnFullPage: (count) => `+${count} weitere auf der vollständigen Agenten-Seite`,
  fromInbox: "Aus dem Posteingang",
  states: {
    working: "Arbeitet",
    waiting: "Wartet auf dich",
    idle: "Inaktiv",
    comingOnline: "Wird aktiviert",
  },
  autonomyLabels: { auto: "Auto", suggests: "Schlägt vor" },
  time: {
    now: "jetzt",
    minutesAgo: (n) => `vor ${n} Min.`,
    hoursAgo: (n) => `vor ${n} Std.`,
  },
  page: {
    live: "Live",
    loadingAria: "Agenten werden geladen",
    loadError: "Agenten konnten nicht geladen werden.",
    summary: {
      agentsCount: (n) => `${n} Agenten`,
      workingNow: (n) => `${n} arbeiten jetzt`,
      awaitingYou: (n) => `${n} warten auf dich`,
    },
    kpis: {
      workingNow: "Arbeiten jetzt",
      needsReview: "Braucht Prüfung",
      automatedToday: "Heute automatisiert",
      attention: "Aufmerksamkeit",
    },
    hero: {
      leadRoleSuffix: "CEO",
      leadsTeam: "Führt das Team",
      briefingWorking: "Fanny kümmert sich um deinen Posteingang",
      briefingCalm: "dein Posteingang ist ruhig",
      needsProposals: (n) => (n === 1 ? "1 Vorschlag wartet" : `${n} Vorschläge warten`),
      needsAttention: (n) => (n === 1 ? "1 erfordert Aufmerksamkeit" : `${n} erfordern Aufmerksamkeit`),
      needsJoiner: "und",
      briefingWithNeeds: (opening, needs) =>
        `Gerade jetzt: ${opening} — ${needs} für dich. Der Rest deines Teams wird aktiviert.`,
      briefingNoNeeds: (opening) =>
        `Gerade jetzt: ${opening} — nichts wartet auf dich. Der Rest deines Teams wird aktiviert.`,
      reviewProposals: (n) => (n === 1 ? "1 Vorschlag prüfen" : `${n} Vorschläge prüfen`),
      noProposals: "Keine Vorschläge zu prüfen",
      adjustAutonomy: "Autonomie anpassen",
      adjustAutonomyTitle: "Autonomie-Einstellungen kommen bald",
    },
    roster: {
      heading: "Deine Agenten · live",
      defaultTagline: "6 Spezialisten + Francis",
      review: "Prüfen →",
      handledToday: (n) => (n === 1 ? "1 heute erledigt" : `${n} heute erledigt`),
      watching: "Beobachtet",
      comingOnline: "Wird aktiviert",
      upToDate: "Auf dem neuesten Stand — hält Ausschau nach neuer Arbeit.",
      readyInRegistry: "Bereit in deinem Register — wird aktiviert.",
      openDetailsSuffix: "Details öffnen",
    },
    liveActivity: {
      title: "Live-Aktivität",
      executedToday: (n) => `Heute ausgeführt · ${n}`,
      empty: "Heute wurde noch keine Aktion ausgeführt.",
    },
    rail: {
      needsReview: "Braucht deine Prüfung",
      attention: "Aufmerksamkeit",
      needsReviewEmpty: "Keine Vorschläge warten auf dich.",
      attentionEmpty: "Nichts erfordert deine Aufmerksamkeit.",
      proposes: "schlägt vor",
      approve: "Genehmigen",
      dismiss: "Verwerfen",
      approveTitle: "Genehmigen & verwerfen aus Agenten kommt bald",
      viewContext: "Kontext ansehen",
      view: "Ansehen",
    },
    autonomy: {
      title: "Autonomie",
      auto: "Auto",
      suggests: "Schlägt vor",
      approval: "Freigabe",
      autoText: "Erledigt risikoarme Arbeit eigenständig",
      suggestsText: "Schlägt vor und wartet auf dein Ja",
      approvalText: "Handelt nie ohne deine Freigabe",
    },
  },
  detail: {
    doingNow: "Macht gerade",
    today: "Heute",
    todayEmpty: "Heute noch keine Aktivität.",
    worksWithTeam: "Arbeitet mit dem Team",
    watching: "Beobachtet",
    recentlyHandled: "Kürzlich erledigt",
    openInPrefix: "Öffnen in",
    sectionComingOnline: "Bereich wird aktiviert",
    sectionComingOnlineTitle: "Der Bereich dieses Agenten wird aktiviert",
    close: "Schließen",
    closeDetailsAria: "Agenten-Details schließen",
    detailsAria: (name) => `Details zu ${name}`,
  },
  roster: {
    francis: {
      role: "CEO · Betrieb & Koordination",
      watching: [
        "Der gesamte Betrieb",
        "Team, Rollen & Kapazität",
        "Was deine Entscheidung braucht",
        "Blocker & Prioritäten",
        "Geschäftsgesundheit",
      ],
      collaborationNote:
        "Francis dirigiert das Team — leitet Arbeit an den richtigen Agenten weiter, koordiniert Menschen und bringt nur das zum Vorschein, was dich braucht.",
    },
    forte: {
      role: "Architektur · Module · Lab",
      watching: ["Fehlende Module", "Branchen-Passung", "Wiederverwendbare Muster", "Backend- & Produktlogik"],
      collaborationNote:
        "Mr. Forte baut die Systeme, die Freya visuell gestaltet und Fiona kommerziell nutzt; er hört auf Fathoms Trends.",
    },
    fanny: {
      role: "Konversationen · Posteingang",
      watching: ["Ungelesene Kundenantworten", "Wartende Konversationen", "Heute fällige Follow-ups", "Dringende Nachrichten"],
      collaborationNote:
        "Wenn eine Nachricht nach einer Rechnung fragt, übergibt Fanny sie an Felix; neue Kontakte werden mit Fiona synchronisiert.",
    },
    freya: {
      role: "Kreativstudio · Visuell",
      watching: ["Visuelle Inhalte & Assets", "Design & Interfaces", "Kreative Stücke für Wachstum & Module"],
      collaborationNote:
        "Freya produziert die Visuals, die Fiona für Wachstum braucht, und die Interfaces, die Mr. Fortes Module kleiden.",
    },
    fiona: {
      role: "7F Wachstum · Marketing",
      watching: [
        "Kampagnen & Funnels",
        "CRM & Beziehungen",
        "Zielgruppen & Segmentierung",
        "SEO / AEO-Sichtbarkeit",
        "Reaktivierungschancen",
      ],
      collaborationNote:
        "Fiona verwandelt Fannys neue Kontakte und Freyas Visuals in Kampagnen, Reaktivierungen und Wachstum.",
    },
    felix: {
      role: "Finanzen · Rechnungen",
      watching: ["Unbezahlte Rechnungen", "Anzahlungen", "Überfällige Zahlungen", "Finanzrisiko"],
      collaborationNote: "Felix erstellt Rechnungen aus den Anfragen, die Fanny übergibt.",
    },
    fathom: {
      role: "Recherche · Branchentrends",
      watching: ["Markttrends", "Branchenchancen", "Wettbewerbs- & Produktsignale"],
      collaborationNote:
        "Fathom liefert Branchentrends an Mr. Forte, SEO/AEO- & Marktsignale an Fiona und Content-Ansätze an Freya.",
    },
    finesse: {
      role: "Beauty-Spezialist",
      watching: ["Der Geschäftstag", "Was deine Aufmerksamkeit braucht", "Team-Koordination"],
      collaborationNote:
        "Führt das 7F-Beauty-Erlebnis: liest den Geschäftskontext, koordiniert den Tag und präsentiert die Aktionen. Arbeitet auf den Kern-Agenten (Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom) auf, ohne sie zu ersetzen.",
    },
  },
}
