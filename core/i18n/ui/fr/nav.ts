import type { NavMessages } from "../types"

/**
 * French source for the `nav` UI namespace (I18N-TOP-ACTIONS-01). Entity keys
 * are locale fallbacks — vertical vocabulary overrides them at compose time.
 * "Smart Inbox" / "by Fanny" are product/agent branding kept as-is.
 */
export const nav: NavMessages = {
  today: "Aujourd'hui",
  calendar: "Calendrier",
  clients: "Clients",
  inbox: "Boîte de réception",
  services: "Services",
  billing: "Facturation",
  team: "Équipe",
  settings: "Réglages",
  tasks: "Tâches",
  finance: "Finances",
  marketing: "Marketing",
  more: "Plus",
  new: "Nouveau",
  search: "Rechercher",
  agents: "Agents",
  agentsOpen: "Ouvrir les Agents",
  // "Fanny" is the agent's proper name — never translated (see AGENTS.md).
  askFanny: "Demander à Fanny",
  expandSidebar: "Déployer la navigation",
  collapseSidebar: "Réduire la navigation",
  openNavigation: "Ouvrir la navigation",
  closeNavigation: "Fermer la navigation",
  navigationTitle: "Navigation",
  backToWorkspace: "Retour à 7F",
  mySalon: "Mon salon",
  helpers: {
    marketing: "Contenus, campagnes et croissance",
    billing: "Factures et paiements",
    forteLab: "Modules et améliorations",
  },
  smartInbox: {
    title: "Smart Inbox",
    byFanny: "by Fanny",
    groups: {
      work: "Travail",
      smartViews: "Vues intelligentes",
      storage: "Stockage",
    },
    items: {
      inbox: "Boîte de réception",
      needsAction: "Action requise",
      waiting: "En attente",
      done: "Terminées",
      scheduled: "Programmées",
      opportunities: "Opportunités",
      closed: "Fermées",
      archived: "Archivées",
      trash: "Corbeille",
    },
  },
}
