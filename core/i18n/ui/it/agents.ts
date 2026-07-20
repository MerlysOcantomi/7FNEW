import type { AgentsMessages } from "../types"

/**
 * Italian source for the `agents` UI namespace. "Fanny" is an agent proper
 * name — never translated (see AGENTS.md).
 */
export const agents: AgentsMessages = {
  subtitle: "Cosa stanno facendo i tuoi agenti IA · in tutto il workspace",
  openFull: "Apri Agenti al completo",
  closePanel: "Chiudi il pannello Agenti",
  closeDrawer: "Chiudi Agenti",
  loadingAria: "Caricamento dell'attività degli agenti",
  loadErrorNote: "Impossibile caricare l'attività degli agenti.",
  empty: {
    title: "Ancora nessuna attività degli agenti",
    body: "Quando Fanny automatizza del lavoro, propone un'attività o esegue un'azione, comparirà qui — raggruppato tra ciò che richiede revisione, ciò che è stato automatizzato e ciò che richiede la tua attenzione.",
  },
  lanes: {
    needsReview: { title: "Richiede la tua revisione", empty: "Nessuna proposta in attesa." },
    automated: { title: "Gestito di recente", empty: "Ancora nulla di gestito." },
    attention: { title: "Attenzione", empty: "Nulla richiede attenzione." },
  },
  moreOnFullPage: (count) => `+${count} in più nella pagina Agenti completa`,
  fromInbox: "Dalla posta in arrivo",
}
