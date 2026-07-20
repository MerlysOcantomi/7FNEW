import type { NavMessages } from "../types"

/**
 * German source for the `nav` UI namespace (I18N-TOP-ACTIONS-01). Entity keys
 * are locale fallbacks — vertical vocabulary overrides them at compose time.
 * "Smart Inbox" / "by Fanny" are product/agent branding kept as-is.
 */
export const nav: NavMessages = {
  today: "Heute",
  calendar: "Kalender",
  clients: "Kunden",
  inbox: "Posteingang",
  services: "Leistungen",
  billing: "Rechnungen",
  team: "Team",
  settings: "Einstellungen",
  tasks: "Aufgaben",
  finance: "Finanzen",
  marketing: "Marketing",
  more: "Mehr",
  new: "Neu",
  search: "Suchen",
  agents: "Agenten",
  agentsOpen: "Agenten öffnen",
  // "Fanny" is the agent's proper name — never translated (see AGENTS.md).
  askFanny: "Fanny fragen",
  expandSidebar: "Navigation ausklappen",
  collapseSidebar: "Navigation einklappen",
  openNavigation: "Navigation öffnen",
  closeNavigation: "Navigation schließen",
  navigationTitle: "Navigation",
  backToWorkspace: "Zurück zu 7F",
  mySalon: "Mein Salon",
  helpers: {
    marketing: "Inhalte, Kampagnen & Wachstum",
    billing: "Rechnungen & Zahlungen",
    forteLab: "Module & Verbesserungen",
  },
  smartInbox: {
    title: "Smart Inbox",
    byFanny: "by Fanny",
    groups: {
      work: "Arbeit",
      smartViews: "Intelligente Ansichten",
      storage: "Ablage",
    },
    items: {
      inbox: "Posteingang",
      needsAction: "Handlungsbedarf",
      waiting: "Wartend",
      done: "Erledigt",
      scheduled: "Geplant",
      opportunities: "Chancen",
      closed: "Geschlossen",
      archived: "Archiviert",
      trash: "Papierkorb",
    },
  },
}
