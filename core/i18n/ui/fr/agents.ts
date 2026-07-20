import type { AgentsMessages } from "../types"

/**
 * French source for the `agents` UI namespace. "Fanny" is an agent proper
 * name — never translated (see AGENTS.md).
 */
export const agents: AgentsMessages = {
  subtitle: "Ce que font vos agents IA · sur tout le workspace",
  openFull: "Ouvrir les Agents en entier",
  closePanel: "Fermer le panneau Agents",
  closeDrawer: "Fermer les Agents",
  loadingAria: "Chargement de l'activité des agents",
  loadErrorNote: "Impossible de charger l'activité des agents.",
  empty: {
    title: "Pas encore d'activité d'agents",
    body: "Quand Fanny automatise du travail, propose une tâche ou exécute une action, cela apparaît ici — regroupé entre ce qui demande une revue, ce qui a été automatisé et ce qui requiert votre attention.",
  },
  lanes: {
    needsReview: { title: "À valider par vous", empty: "Aucune proposition en attente." },
    automated: { title: "Traité récemment", empty: "Rien de traité pour l'instant." },
    attention: { title: "Attention", empty: "Rien ne requiert votre attention." },
  },
  moreOnFullPage: (count) => `+${count} de plus sur la page Agents complète`,
  fromInbox: "Depuis la boîte de réception",
}
