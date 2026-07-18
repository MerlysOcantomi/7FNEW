/** Ask Finesse — German catalog (informal du, matching the Marketing catalogs). */

import type { FinesseAssistantMessages } from "./types"

export const de = {
  locale: "de",
  launcherLabel: "Finesse fragen",
  launcherAria: "Finesse fragen, deine Business-Assistentin",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "Du bist in",
  pageLabels: {
    "my-salon": "Mein Salon",
    today: "Heute",
    agenda: "Agenda",
    clients: "Kundschaft",
    messages: "Nachrichten",
    catalog: "Leistungen",
    marketing: "Marketing",
    billing: "Zahlungen",
    team: "Team",
    settings: "Einstellungen",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "Ich kann dir erklären, wie dein Salon in diesem Zeitraum läuft und was du verbessern kannst.",
    today: "Ich kann dir helfen, deinen Tag zu organisieren und zu entscheiden, was zuerst ansteht.",
    agenda: "Ich kann dir mit deinen Terminen, freien Slots und Stoßzeiten helfen.",
    clients: "Ich kann dir helfen, deine Kundschaft zu pflegen und zu erkennen, wer Aufmerksamkeit braucht.",
    messages: "Ich kann dir helfen, Ordnung in deine Unterhaltungen zu bringen.",
    catalog: "Ich kann dir helfen zu verstehen, welche Leistungen am besten laufen.",
    marketing: "Ich kann dir Ideen für deine Inhalte und Kampagnen geben.",
    billing: "Ich kann dir mit deinen offenen Zahlungen und Rechnungen helfen.",
    team: "Ich kann dir helfen, die Arbeit deines Teams zu organisieren.",
    settings: "Ich kann dir helfen, deinen Arbeitsbereich einzurichten.",
    other: "Frag mich alles, was du über dein Geschäft wissen willst.",
  },
  suggestionsTitle: "Vorschläge",
  composerPlaceholder: "Schreib deine Frage…",
  send: "Senden",
  close: "Schließen",
  thinking: "Finesse denkt nach…",
  unavailable: {
    title: "Finesse ist noch nicht verbunden.",
    description:
      "Die Assistentin ist verfügbar, sobald der KI-Dienst verbunden ist. Alles andere in deinem Arbeitsbereich funktioniert normal weiter.",
  },
  error: {
    title: "Ich konnte gerade nicht antworten.",
    retry: "Versuche es in ein paar Sekunden erneut.",
  },
  honestyNote:
    "Finesse antwortet mit den Informationen, die in deinem Arbeitsbereich sichtbar sind. Aktionen führt sie noch nicht für dich aus.",
  emptyConversation: "Wähle einen Vorschlag oder schreib deine Frage.",
  staticSuggestions: {
    "my-salon": [
      "Erkläre mir diesen Zeitraum",
      "Warum haben sich meine Einnahmen verändert?",
      "Wer sollte wiederkommen?",
      "Wie kann ich den nächsten Monat verbessern?",
    ],
    today: ["Was mache ich zuerst?", "Fasse meinen Tag zusammen", "Was braucht meine Aufmerksamkeit?"],
    agenda: [
      "Such einen freien Slot für morgen",
      "Was sind meine Stoßzeiten?",
      "Wo passen zwei weitere Termine hin?",
    ],
    clients: [
      "Wen sollte ich wieder kontaktieren?",
      "Wer ist nicht wiedergekommen?",
      "Zeig mir meine treueste Kundschaft",
    ],
    messages: [
      "Fasse die offenen Unterhaltungen zusammen",
      "Welche Nachrichten brauchen eine Antwort?",
    ],
    catalog: ["Welche Leistung läuft am besten?", "Was sollte ich bewerben?"],
    marketing: [
      "Erstelle einen Beitrag",
      "Schlag mir eine Kampagne vor",
      "Nimm meine letzte Arbeit",
      "Hilf mir, freie Slots zu füllen",
    ],
    billing: ["Welche Zahlungen sind noch offen?", "Fasse meine Einnahmen des Zeitraums zusammen"],
    team: ["Wie läuft die Arbeit meines Teams?"],
    settings: ["Was muss ich noch einrichten?"],
    other: ["Wie läuft mein Geschäft?", "Was braucht heute meine Aufmerksamkeit?"],
  },
  dynamicSuggestions: {
    overview: {
      firstPeriod: {
        label: "Worauf achte ich im ersten Monat?",
        prompt:
          "Das ist mein erster Zeitraum mit Daten, ohne vorherigen Vergleich. Auf welche Signale sollte ich in meinem ersten Monat achten?",
      },
      earningsDrop: {
        label: "Warum sind meine Einnahmen gesunken?",
        prompt:
          "Meine Einnahmen sind im Vergleich zum vorherigen Zeitraum gesunken. Was könnte den Rückgang verursacht haben und was kann ich tun?",
      },
      earningsGrowth: {
        label: "Was hat das Wachstum getrieben?",
        prompt:
          "Meine Einnahmen sind im Vergleich zum vorherigen Zeitraum gewachsen. Was hat dieses Wachstum getrieben und wie halte ich es?",
      },
      weakRebooking: {
        label: "Wer sollte wiederkommen?",
        prompt:
          "Meine Wiederbuchungsrate ist schwach. Wer sollte bald wiederkommen und wie kontaktiere ich diese Personen?",
      },
      pendingPayments: {
        label: "Welche Zahlungen brauchen Aufmerksamkeit?",
        prompt:
          "Ich habe offene Zahlungen aus bereits abgeschlossenen Besuchen. Welche sollte ich zuerst angehen?",
      },
      peakAvailability: {
        label: "Wie entlaste ich meinen vollsten Tag?",
        prompt:
          "Mein vollster Tag ist fast ausgebucht. Wie kann ich mehr Verfügbarkeit schaffen, ohne Kundschaft zu verlieren?",
      },
    },
    today: {
      fillGaps: {
        label: "Wie fülle ich die Lücken von heute?",
        prompt: (count) =>
          `Ich habe heute ${count} freie(n) Slot(s) in der Agenda. Wie kann ich sie füllen?`,
      },
      firstMove: {
        label: "Was mache ich zuerst?",
        prompt: (count) =>
          `Ich habe heute ${count} Termine. Was sollte ich zuerst tun, damit der Tag gut läuft?`,
      },
      summary: {
        label: "Fasse meinen Tag zusammen",
        prompt: "Fasse meinen heutigen Tag zusammen: Termine, Lücken und was meine Aufmerksamkeit braucht.",
      },
    },
    agenda: {
      fillTomorrow: {
        label: "Wie fülle ich die Lücken von morgen?",
        prompt: (count) => `Morgen habe ich ${count} freie(n) Slot(s). Wie kann ich sie füllen?`,
      },
      pendingConfirmation: {
        label: "Welche Termine sind unbestätigt?",
        prompt: (count) =>
          `Ich habe ${count} unbestätigte(n) Termin(e). Welche sollte ich zuerst bestätigen?`,
      },
      cancelledSlot: {
        label: "Was mache ich mit dem stornierten Slot?",
        prompt: "Heute wurde ein Termin storniert. Was kann ich mit diesem Slot machen?",
      },
      fitUrgent: {
        label: "Wo passt ein dringender Termin hin?",
        prompt:
          "Mein Tag ist fast voll. Wo könnte ich einen dringenden Termin unterbringen, ohne die Agenda durcheinanderzubringen?",
      },
    },
    clients: {
      selectedSummary: {
        label: "Fasse den letzten Verlauf zusammen",
        prompt:
          "Fasse den letzten Verlauf dieser Person zusammen: Besuche, Leistungen und alle Signale, auf die ich achten sollte.",
      },
      selectedContact: {
        label: "Sollte ich wieder Kontakt aufnehmen?",
        prompt: "Sollte ich mit dieser Person wieder Kontakt aufnehmen? Wann und mit welcher Nachricht?",
      },
      overdueRebooking: {
        label: "Wen kontaktiere ich diese Woche?",
        prompt: (count) =>
          `${count} Personen waren länger nicht mehr da. Wen sollte ich diese Woche kontaktieren und wie?`,
      },
    },
    messages: {
      selectedSummary: {
        label: "Fasse diese Unterhaltung zusammen",
        prompt: "Fasse diese Unterhaltung zusammen und sag mir, ob noch etwas auf eine Antwort wartet.",
      },
      needReply: {
        label: "Welche Nachrichten beantworte ich zuerst?",
        prompt: (count) =>
          `Ich habe ${count} unbeantwortete Nachricht(en). Welche sollte ich zuerst beantworten?`,
      },
    },
    marketing: {
      postLatestWork: {
        label: "Erstelle einen Beitrag mit meiner letzten Arbeit",
        prompt:
          "Ich habe unbenutzte Fotos von aktuellen Arbeiten. Wie bereite ich einen Beitrag mit der letzten Arbeit vor?",
      },
      noMedia: {
        label: "Welche Inhalte erstelle ich heute?",
        prompt:
          "Ich habe noch keine Fotos hochgeladen. Welche Inhalte sollte ich heute für meinen Salon erstellen?",
      },
      reviewReady: {
        label: "Was veröffentliche ich zuerst?",
        prompt: (count) =>
          `Ich habe ${count} vorbereitete(n) Beitrag/Beiträge. Welchen sollte ich zuerst prüfen und veröffentlichen?`,
      },
    },
    billing: {
      followUp: {
        label: "Welchen Zahlungen gehe ich zuerst nach?",
        prompt: "Ich habe offene Zahlungen. Welchen sollte ich zuerst nachgehen und wie?",
      },
      collectionHealth: {
        label: "Wie läuft mein Zahlungseingang?",
        prompt:
          "Ich habe gerade keine überfälligen Zahlungen. Wie läuft mein Zahlungseingang insgesamt?",
      },
      revenueChange: {
        label: "Erkläre die Einnahmen des Zeitraums",
        prompt:
          "Meine Einnahmen haben sich im Vergleich zum vorherigen Zeitraum verändert. Erkläre mir diese Veränderung.",
      },
    },
  },
} satisfies FinesseAssistantMessages
