/** Ask Finesse — Italian catalog (informal tu, matching the Marketing catalogs). */

import type { FinesseAssistantMessages } from "./types"

export const it = {
  locale: "it",
  launcherLabel: "Chiedi a Finesse",
  launcherAria: "Chiedi a Finesse, la tua assistente di business",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "Sei in",
  pageLabels: {
    "my-salon": "Il mio salone",
    today: "Oggi",
    agenda: "Agenda",
    clients: "Clienti",
    messages: "Messaggi",
    catalog: "Servizi",
    marketing: "Marketing",
    billing: "Pagamenti",
    team: "Team",
    settings: "Impostazioni",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "Posso spiegarti come sta andando il tuo salone in questo periodo e cosa puoi migliorare.",
    today: "Posso aiutarti a organizzare la giornata e a decidere cosa fare per primo.",
    agenda: "Posso aiutarti con i tuoi appuntamenti, gli spazi liberi e le ore di punta.",
    clients: "Posso aiutarti a prenderti cura dei tuoi clienti e a capire chi ha bisogno di attenzione.",
    messages: "Posso aiutarti a mettere ordine nelle tue conversazioni.",
    catalog: "Posso aiutarti a capire quali servizi funzionano meglio.",
    marketing: "Posso darti idee per i tuoi contenuti e le tue campagne.",
    billing: "Posso aiutarti con i pagamenti e le fatture in sospeso.",
    team: "Posso aiutarti a organizzare il lavoro del tuo team.",
    settings: "Posso aiutarti a configurare il tuo spazio di lavoro.",
    other: "Chiedimi quello che ti serve sulla tua attività.",
  },
  suggestionsTitle: "Suggerimenti",
  composerPlaceholder: "Scrivi la tua domanda…",
  send: "Invia",
  close: "Chiudi",
  thinking: "Finesse sta pensando…",
  unavailable: {
    title: "Finesse non è ancora collegata.",
    description:
      "L’assistente sarà disponibile quando il servizio di IA sarà collegato. Tutto il resto del tuo spazio continua a funzionare normalmente.",
  },
  error: {
    title: "Non sono riuscita a rispondere in questo momento.",
    retry: "Riprova tra qualche secondo.",
  },
  honestyNote:
    "Finesse risponde con le informazioni visibili nel tuo spazio. Non esegue ancora azioni al posto tuo.",
  emptyConversation: "Scegli un suggerimento o scrivi la tua domanda.",
  staticSuggestions: {
    "my-salon": [
      "Spiegami questo periodo",
      "Perché sono cambiati i miei incassi?",
      "Quali clienti dovrebbero tornare?",
      "Come posso migliorare il prossimo mese?",
    ],
    today: ["Cosa faccio per primo?", "Riassumi la mia giornata", "Cosa richiede la mia attenzione?"],
    agenda: [
      "Cerca uno spazio libero domani",
      "Quali sono le mie ore di punta?",
      "Dove entrano altri due appuntamenti?",
    ],
    clients: [
      "Chi dovrei ricontattare?",
      "Quali clienti non sono tornati?",
      "Mostrami i miei clienti più fedeli",
    ],
    messages: [
      "Riassumi le conversazioni in sospeso",
      "Quali messaggi aspettano una risposta?",
    ],
    catalog: ["Quale servizio funziona meglio?", "Cosa dovrei promuovere?"],
    marketing: [
      "Crea un post",
      "Suggeriscimi una campagna",
      "Usa il mio ultimo lavoro",
      "Aiutami a riempire gli spazi liberi",
    ],
    billing: ["Quali pagamenti ho in sospeso?", "Riassumi i miei incassi del periodo"],
    team: ["Come va il lavoro del team?"],
    settings: ["Cosa mi manca da configurare?"],
    other: ["Come va la mia attività?", "Cosa richiede la mia attenzione oggi?"],
  },
  dynamicSuggestions: {
    overview: {
      firstPeriod: {
        label: "Cosa controllo nel primo mese?",
        prompt:
          "È il mio primo periodo con dati, senza un confronto precedente. Quali segnali dovrei tenere d’occhio durante il mio primo mese?",
      },
      earningsDrop: {
        label: "Perché sono calati i miei incassi?",
        prompt:
          "I miei incassi sono calati rispetto al periodo precedente. Cosa può aver causato il calo e cosa posso fare?",
      },
      earningsGrowth: {
        label: "Cosa ha spinto la crescita?",
        prompt:
          "I miei incassi sono cresciuti rispetto al periodo precedente. Cosa ha spinto questa crescita e come la mantengo?",
      },
      weakRebooking: {
        label: "Quali clienti dovrebbero tornare?",
        prompt:
          "Il mio tasso di riprenotazione è debole. Quali clienti dovrebbero tornare presto e come li contatto?",
      },
      pendingPayments: {
        label: "Quali pagamenti richiedono attenzione?",
        prompt:
          "Ho pagamenti in sospeso per visite già completate. Quali dovrei gestire per primi?",
      },
      peakAvailability: {
        label: "Come libero il mio giorno di punta?",
        prompt:
          "Il mio giorno più pieno è quasi al completo. Come posso creare più disponibilità senza perdere clienti?",
      },
    },
    today: {
      fillGaps: {
        label: "Come riempio gli spazi di oggi?",
        prompt: (count) =>
          `Oggi ho ${count} spazio/i libero/i in agenda. Come posso riempirli?`,
      },
      firstMove: {
        label: "Cosa faccio per primo?",
        prompt: (count) =>
          `Ho ${count} appuntamenti oggi. Cosa dovrei fare per primo perché la giornata vada bene?`,
      },
      summary: {
        label: "Riassumi la mia giornata",
        prompt: "Riassumi la mia giornata di oggi: appuntamenti, spazi liberi e ciò che richiede la mia attenzione.",
      },
    },
    agenda: {
      fillTomorrow: {
        label: "Come riempio gli spazi di domani?",
        prompt: (count) => `Domani ho ${count} spazio/i libero/i. Come posso riempirli?`,
      },
      pendingConfirmation: {
        label: "Quali appuntamenti sono da confermare?",
        prompt: (count) =>
          `Ho ${count} appuntamento/i da confermare. Quali dovrei confermare per primi?`,
      },
      cancelledSlot: {
        label: "Cosa faccio con lo spazio annullato?",
        prompt: "Oggi è stato annullato un appuntamento. Cosa posso fare con quello spazio?",
      },
      fitUrgent: {
        label: "Dove entra un appuntamento urgente?",
        prompt:
          "La mia giornata è quasi al completo. Dove potrei inserire un appuntamento urgente senza scombinare l’agenda?",
      },
    },
    clients: {
      selectedSummary: {
        label: "Riassumi lo storico recente",
        prompt:
          "Riassumi lo storico recente di questo cliente: visite, servizi e qualsiasi segnale da tenere d’occhio.",
      },
      selectedContact: {
        label: "Dovrei ricontattarlo?",
        prompt: "Dovrei ricontattare questo cliente? Quando e con quale messaggio?",
      },
      overdueRebooking: {
        label: "Chi contatto questa settimana?",
        prompt: (count) =>
          `Ci sono ${count} clienti che non tornano da tempo. Chi dovrei contattare questa settimana e come?`,
      },
    },
    messages: {
      selectedSummary: {
        label: "Riassumi questa conversazione",
        prompt: "Riassumi questa conversazione e dimmi se c’è ancora qualcosa in attesa di risposta.",
      },
      needReply: {
        label: "A quali messaggi rispondo prima?",
        prompt: (count) =>
          `Ho ${count} messaggio/i senza risposta. A quali dovrei rispondere per primi?`,
      },
    },
    marketing: {
      postLatestWork: {
        label: "Crea un post con il mio ultimo lavoro",
        prompt:
          "Ho foto di lavori recenti non ancora usate. Come preparo un post con l’ultimo lavoro?",
      },
      noMedia: {
        label: "Quale contenuto creo oggi?",
        prompt:
          "Non ho ancora caricato foto. Quale contenuto dovrei creare oggi per il mio salone?",
      },
      reviewReady: {
        label: "Cosa pubblico per primo?",
        prompt: (count) =>
          `Ho ${count} post preparato/i. Quale dovrei rivedere e pubblicare per primo?`,
      },
    },
    billing: {
      followUp: {
        label: "Quali pagamenti sollecito per primi?",
        prompt: "Ho pagamenti in sospeso. Quali dovrei sollecitare per primi e come?",
      },
      collectionHealth: {
        label: "Come vanno i miei incassi?",
        prompt:
          "Al momento non ho pagamenti scaduti. Come va il mio ritmo di incasso in generale?",
      },
      revenueChange: {
        label: "Spiega gli incassi del periodo",
        prompt:
          "I miei incassi sono cambiati rispetto al periodo precedente. Spiegami questo cambiamento.",
      },
    },
  },
} satisfies FinesseAssistantMessages
