import type { TodayMessages } from "../types"

/** German source for the `today` UI namespace (chrome + daily workboard). */
export const today: TodayMessages = {
  title: "Heute",
  empty: {
    title: "Noch nichts für heute",
    body: "Neue Elemente erscheinen hier, sobald sie eintreffen.",
  },
  chrome: {
    openFull: "Heute vollständig öffnen",
    close: "Heute schließen",
  },
  quick: {
    subtitle: "Tagesüberblick · im gesamten Workspace",
    needsCount: (count) =>
      count === 1 ? "1 Sache braucht dich heute" : `${count} Dinge brauchen dich heute`,
    moreInToday: (count) => `+${count} weitere in Heute`,
    aiChip: "KI",
    sources: { inbox: "Posteingang", calendar: "Kalender", task: "Aufgabe" },
  },
  workboard: {
    loadingAria: "Heute wird geladen",
    errorNote: "Heute konnte nicht geladen werden.",
    toasts: {
      sendToAiFailed: "Konnte nicht an die KI übergeben werden",
      takeOverFailed: "Konnte nicht übernommen werden",
      tryAgain: "Bitte versuche es gleich noch einmal.",
    },
    summary: {
      overdue: (count) => (count === 1 ? "1 überfällig" : `${count} überfällig`),
      dueToday: (count) => (count === 1 ? "1 heute fällig" : `${count} heute fällig`),
      waiting: (count) => (count > 0 ? `${count} wartend` : "nichts wartend"),
      caption: "dein tägliches Arbeitsboard",
    },
    pills: {
      myWork: "Meine Arbeit",
      aiWork: "KI-Arbeit",
      schedule: "Termine",
      waiting: "Wartend",
    },
    lanes: {
      myWork: {
        title: "Meine Arbeit",
        subtitle: "Deins, das deines Teams und alles, was noch nicht an die KI übergeben wurde",
        emptyTitle: "Heute keine Arbeit für dich",
        emptyDescription: "Aufgaben, die du erstellst oder übernimmst, landen hier.",
      },
      aiWork: {
        title: "KI-Arbeit",
        subtitle: "Vorschläge von Fanny und alles, was du an die KI übergeben hast",
        emptyTitle: "Noch keine KI-Arbeit",
        emptyDescription:
          "KI-Arbeit erscheint, wenn Fanny Arbeit vorschlägt oder wenn du eine Aufgabe mit „An die KI übergeben“ aus Meine Arbeit abgibst.",
        emptyActionLabel: "Agenten prüfen",
      },
      schedule: {
        title: "Termine",
        subtitle: "Kalendereinträge, die an heute hängen",
        emptyTitle: "Heute keine Termine",
        emptyDescription: "Geplante Einträge erscheinen hier.",
      },
    },
    sections: {
      overdue: "Überfällig",
      dueToday: "Heute fällig",
      waitingBlocked: "Wartend / Blockiert",
      noDate: "Ohne Datum",
    },
    briefingAria: "Heute-Briefing",
    emptyState: {
      title: "Nichts offen. Sehr gut.",
      body: "Alles, was deine Aufmerksamkeit braucht, erscheint hier.",
      inboxCta: "Oder sieh in deinen Posteingang →",
    },
    row: {
      sendToAi: "An die KI übergeben",
      takeOver: "Übernehmen",
      proposed: "Vorgeschlagen",
      proposedByAi: "Von der KI vorgeschlagen",
      assignedToMe: "Mir zugewiesen",
      taskChip: "Aufgabe",
      fromInbox: "Aus dem Posteingang",
      fromProject: (name) => `Aus ${name}`,
      projectFallback: "Projekt",
      fromCalendar: "Aus dem Kalender",
      eventAria: "Termin",
      atTime: (time) => `um ${time}`,
      priorities: {
        critical: "Dringend",
        high: "Hoch",
        low: "Niedrig",
        normal: "Normal",
      },
      due: {
        todayAt: (time) => `Heute ${time}`,
        yesterday: "Gestern",
        tomorrow: "Morgen",
        daysAgo: (days) => `vor ${days} T.`,
      },
      a11y: {
        task: "Aufgabe",
        priorityPrefix: "Priorität",
        duePrefix: "fällig",
        noDueDate: "kein Fälligkeitsdatum",
        inMyLane: "in meiner Spur",
        inAiLane: "in der KI-Spur",
        fromInbox: "aus dem Posteingang",
        fromProject: (name) => `aus dem Projekt ${name}`,
        manualTask: "manuelle Aufgabe",
      },
    },
  },
}
