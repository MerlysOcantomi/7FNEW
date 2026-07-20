import type { AgentsMessages } from "../types"

/**
 * Italian source for the `agents` UI namespace (quick view + full page).
 * "Fanny" and the other agent names are proper names — never translated
 * (see AGENTS.md). Activity item titles come from the API as content.
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
  states: {
    working: "Al lavoro",
    waiting: "In attesa di te",
    idle: "Inattivo",
    comingOnline: "In attivazione",
  },
  autonomyLabels: { auto: "Auto", suggests: "Suggerisce" },
  time: {
    now: "adesso",
    minutesAgo: (n) => `${n} min fa`,
    hoursAgo: (n) => `${n} h fa`,
  },
  page: {
    live: "In diretta",
    loadingAria: "Caricamento degli Agenti",
    loadError: "Impossibile caricare gli Agenti.",
    summary: {
      agentsCount: (n) => `${n} agenti`,
      workingNow: (n) => `${n} al lavoro adesso`,
      awaitingYou: (n) => `${n} in attesa di te`,
    },
    kpis: {
      workingNow: "Al lavoro adesso",
      needsReview: "Richiede revisione",
      automatedToday: "Automatizzato oggi",
      attention: "Attenzione",
    },
    hero: {
      leadRoleSuffix: "CEO",
      leadsTeam: "Guida il team",
      briefingWorking: "Fanny è sulla tua posta in arrivo",
      briefingCalm: "la tua posta in arrivo è tranquilla",
      needsProposals: (n) => (n === 1 ? "1 proposta in attesa" : `${n} proposte in attesa`),
      needsAttention: (n) => (n === 1 ? "1 richiede attenzione" : `${n} richiedono attenzione`),
      needsJoiner: "e",
      briefingWithNeeds: (opening, needs) =>
        `Proprio ora: ${opening} — ${needs} per te. Il resto del tuo team si sta attivando.`,
      briefingNoNeeds: (opening) =>
        `Proprio ora: ${opening} — non c'è nulla in attesa di te. Il resto del tuo team si sta attivando.`,
      reviewProposals: (n) => (n === 1 ? "Rivedi 1 proposta" : `Rivedi ${n} proposte`),
      noProposals: "Nessuna proposta da rivedere",
      adjustAutonomy: "Regola l'autonomia",
      adjustAutonomyTitle: "Le impostazioni di autonomia arriveranno presto",
    },
    roster: {
      heading: "I tuoi agenti · in diretta",
      defaultTagline: "6 specialisti + Francis",
      review: "Rivedi →",
      handledToday: (n) => (n === 1 ? "1 fatto oggi" : `${n} fatti oggi`),
      watching: "Sorveglia",
      comingOnline: "In attivazione",
      upToDate: "Aggiornato — in cerca di nuovo lavoro.",
      readyInRegistry: "Pronto nel tuo registro — in attivazione.",
      openDetailsSuffix: "Apri i dettagli",
    },
    liveActivity: {
      title: "Attività in diretta",
      executedToday: (n) => `Eseguito oggi · ${n}`,
      empty: "Oggi non è ancora stata eseguita alcuna azione.",
    },
    rail: {
      needsReview: "Richiede la tua revisione",
      attention: "Attenzione",
      needsReviewEmpty: "Nessuna proposta in attesa di te.",
      attentionEmpty: "Nulla richiede la tua attenzione.",
      proposes: "propone",
      approve: "Approva",
      dismiss: "Ignora",
      approveTitle: "Approvare e ignorare dagli Agenti arriverà presto",
      viewContext: "Vedi il contesto",
      view: "Vedi",
    },
    autonomy: {
      title: "Autonomia",
      auto: "Auto",
      suggests: "Suggerisce",
      approval: "Approvazione",
      autoText: "Esegue da solo il lavoro a basso rischio",
      suggestsText: "Propone e aspetta il tuo sì",
      approvalText: "Non agisce mai senza la tua approvazione",
    },
  },
  detail: {
    doingNow: "Sta facendo",
    today: "Oggi",
    todayEmpty: "Ancora nessuna attività oggi.",
    worksWithTeam: "Lavora con il team",
    watching: "Sorveglia",
    recentlyHandled: "Gestito di recente",
    openInPrefix: "Apri in",
    sectionComingOnline: "Sezione in attivazione",
    sectionComingOnlineTitle: "La sezione di questo agente è in attivazione",
    close: "Chiudi",
    closeDetailsAria: "Chiudi i dettagli dell'agente",
    detailsAria: (name) => `Dettagli di ${name}`,
  },
  roster: {
    francis: {
      role: "CEO · Operazioni e coordinamento",
      watching: [
        "L'intera operazione",
        "Team, ruoli e capacità",
        "Ciò che richiede la tua decisione",
        "Blocchi e priorità",
        "Salute dell'attività",
      ],
      collaborationNote:
        "Francis dirige il team — indirizza il lavoro all'agente giusto, coordina le persone e fa emergere solo ciò che ti riguarda.",
    },
    forte: {
      role: "Architettura · Moduli · Lab",
      watching: ["Moduli mancanti", "Adattamento verticale", "Schemi riutilizzabili", "Logica di backend e prodotto"],
      collaborationNote:
        "Mr. Forte costruisce i sistemi che Freya veste visivamente e Fiona usa a livello commerciale; ascolta le tendenze di Fathom.",
    },
    fanny: {
      role: "Conversazioni · Posta in arrivo",
      watching: ["Risposte dei clienti non lette", "Conversazioni in attesa", "Follow-up di oggi", "Messaggi urgenti"],
      collaborationNote:
        "Quando un messaggio chiede una fattura, Fanny la passa a Felix; i nuovi contatti si sincronizzano con Fiona.",
    },
    freya: {
      role: "Studio creativo · Visual",
      watching: ["Contenuti e risorse visive", "Design e interfacce", "Pezzi creativi per crescita e moduli"],
      collaborationNote:
        "Freya produce i visual di cui Fiona ha bisogno per la crescita e le interfacce che vestono i moduli di Mr. Forte.",
    },
    fiona: {
      role: "Crescita 7F · Marketing",
      watching: [
        "Campagne e funnel",
        "CRM e relazioni",
        "Audience e segmentazione",
        "Visibilità SEO / AEO",
        "Opportunità di riattivazione",
      ],
      collaborationNote:
        "Fiona trasforma i nuovi contatti di Fanny e i visual di Freya in campagne, riattivazioni e crescita.",
    },
    felix: {
      role: "Finanza · Fatture",
      watching: ["Fatture non pagate", "Acconti", "Pagamenti scaduti", "Rischio finanziario"],
      collaborationNote: "Felix prepara le fatture a partire dalle richieste che gli passa Fanny.",
    },
    fathom: {
      role: "Ricerca · Tendenze di settore",
      watching: ["Tendenze di mercato", "Opportunità di settore", "Segnali di concorrenza e prodotto"],
      collaborationNote:
        "Fathom porta le tendenze di settore a Mr. Forte, i segnali SEO/AEO e di mercato a Fiona e gli spunti di contenuto a Freya.",
    },
    finesse: {
      role: "Specialista Beauty",
      watching: ["La giornata dell'attività", "Ciò che richiede la tua attenzione", "Coordinamento con il team"],
      collaborationNote:
        "Guida l'esperienza 7F Beauty: interpreta il contesto dell'attività, coordina la giornata e presenta le azioni. Lavora sopra gli agenti core (Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom) senza sostituirli.",
    },
  },
}
