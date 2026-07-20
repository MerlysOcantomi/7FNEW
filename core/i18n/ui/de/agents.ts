import type { AgentsMessages } from "../types"

/**
 * German source for the `agents` UI namespace. "Fanny" is an agent proper
 * name — never translated (see AGENTS.md).
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
}
