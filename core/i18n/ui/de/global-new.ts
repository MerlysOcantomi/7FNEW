import type { GlobalNewMessages } from "../types"

/** German source for the `globalNew` UI namespace. */
export const globalNew: GlobalNewMessages = {
  trigger: "Neu",
  title: "Neu",
  subtitle: "In deinem gesamten Workspace erstellen",
  close: "Neu-Panel schließen",
  groups: {
    capture: "Erfassen",
    work: "Arbeit",
    assets: "Ressourcen",
    vertical: "Branche",
  },
  items: {
    conversation: {
      label: "Neue Konversation",
      description: "Öffnet den Posteingang, um Arbeit zu starten oder fortzusetzen",
    },
    manualIntake: {
      label: "Manuelle Erfassung",
      description: "Unstrukturierte Eingaben mit KI-Zuordnung erfassen",
    },
    request: {
      label: "Neue Anfrage",
      description: "Portal-Anfragen prüfen und verwalten",
    },
    quickNote: {
      label: "Schnellnotiz",
      description: "Schnell als Aufgabe oder Erinnerung festhalten",
    },
    client: {
      label: "Neuer Kunde",
      description: "Konto oder Interessenten hinzufügen",
    },
    project: {
      label: "Neues Projekt",
      description: "Lieferarbeit planen",
    },
    task: {
      label: "Neue Aufgabe",
      description: "Ausführungsarbeit verfolgen",
    },
    invoice: {
      label: "Neue Rechnung",
      description: "Rechnungen und Zahlungen",
    },
    document: {
      label: "Neues Dokument",
      description: "Bibliothek und strukturierte Dateien",
    },
    upload: {
      label: "Datei hochladen",
      description: "Dateien zum Workspace hinzufügen",
    },
    contentCampaign: {
      label: "Neuer Inhalt / Kampagne",
      description: "Marketinginhalte und Kampagnen",
    },
  },
}
