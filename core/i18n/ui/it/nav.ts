import type { NavMessages } from "../types"

/**
 * Italian source for the `nav` UI namespace (I18N-TOP-ACTIONS-01). Entity keys
 * are locale fallbacks — vertical vocabulary overrides them at compose time.
 * "Smart Inbox" / "by Fanny" are product/agent branding kept as-is.
 */
export const nav: NavMessages = {
  today: "Oggi",
  calendar: "Calendario",
  clients: "Clienti",
  inbox: "Posta in arrivo",
  services: "Servizi",
  billing: "Fatturazione",
  team: "Team",
  settings: "Impostazioni",
  tasks: "Attività",
  finance: "Finanze",
  marketing: "Marketing",
  more: "Altro",
  new: "Nuovo",
  search: "Cerca",
  agents: "Agenti",
  agentsOpen: "Apri Agenti",
  // "Fanny" is the agent's proper name — never translated (see AGENTS.md).
  askFanny: "Chiedi a Fanny",
  expandSidebar: "Espandi la navigazione",
  collapseSidebar: "Comprimi la navigazione",
  openNavigation: "Apri la navigazione",
  closeNavigation: "Chiudi la navigazione",
  navigationTitle: "Navigazione",
  backToWorkspace: "Torna a 7F",
  mySalon: "Il mio salone",
  helpers: {
    marketing: "Contenuti, campagne e crescita",
    billing: "Fatture e pagamenti",
    forteLab: "Moduli e miglioramenti",
  },
  smartInbox: {
    title: "Smart Inbox",
    byFanny: "by Fanny",
    groups: {
      work: "Lavoro",
      smartViews: "Viste intelligenti",
      storage: "Archivio",
    },
    items: {
      inbox: "Posta in arrivo",
      needsAction: "Richiede azione",
      waiting: "In attesa",
      done: "Completate",
      scheduled: "Programmate",
      opportunities: "Opportunità",
      closed: "Chiuse",
      archived: "Archiviate",
      trash: "Cestino",
    },
  },
}
