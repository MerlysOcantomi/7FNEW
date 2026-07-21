import type { TodayMessages } from "../types"

/** Italian source for the `today` UI namespace (chrome + daily workboard). */
export const today: TodayMessages = {
  title: "Oggi",
  empty: {
    title: "Ancora niente per oggi",
    body: "I nuovi elementi compariranno qui man mano che arrivano.",
  },
  chrome: {
    openFull: "Apri Oggi al completo",
    close: "Chiudi Oggi",
  },
  quick: {
    subtitle: "Panoramica del giorno · in tutto il workspace",
    needsCount: (count) =>
      count === 1 ? "1 cosa ha bisogno di te oggi" : `${count} cose hanno bisogno di te oggi`,
    moreInToday: (count) => `+${count} in più in Oggi`,
    aiChip: "IA",
    sources: { inbox: "Posta", calendar: "Calendario", task: "Attività" },
  },
  workboard: {
    loadingAria: "Caricamento di Oggi",
    errorNote: "Impossibile caricare Oggi.",
    toasts: {
      sendToAiFailed: "Impossibile affidare all'IA",
      takeOverFailed: "Impossibile riprendere l'attività",
      tryAgain: "Riprova tra un istante.",
    },
    summary: {
      overdue: (count) => (count === 1 ? "1 in ritardo" : `${count} in ritardo`),
      dueToday: (count) => (count === 1 ? "1 per oggi" : `${count} per oggi`),
      waiting: (count) => (count > 0 ? `${count} in attesa` : "niente in attesa"),
      caption: "la tua bacheca di lavoro quotidiana",
    },
    pills: {
      myWork: "Il mio lavoro",
      aiWork: "Lavoro IA",
      schedule: "Agenda",
      waiting: "In attesa",
    },
    lanes: {
      myWork: {
        title: "Il mio lavoro",
        subtitle: "Il tuo, quello del tuo team e tutto ciò che non è ancora stato affidato all'IA",
        emptyTitle: "Nessun lavoro per te oggi",
        emptyDescription: "Le attività che crei o riprendi arriveranno qui.",
      },
      aiWork: {
        title: "Lavoro IA",
        subtitle: "Proposte di Fanny e tutto ciò che hai affidato all'IA",
        emptyTitle: "Ancora nessun lavoro IA",
        emptyDescription:
          "Il lavoro IA compare quando Fanny propone qualcosa o quando affidi un'attività con “Affida all'IA” da Il mio lavoro.",
        emptyActionLabel: "Rivedi gli Agenti",
      },
      schedule: {
        title: "Agenda",
        subtitle: "Eventi del calendario ancorati a oggi",
        emptyTitle: "Nessun evento oggi",
        emptyDescription: "Gli elementi programmati compariranno qui.",
      },
    },
    sections: {
      overdue: "In ritardo",
      dueToday: "Per oggi",
      waitingBlocked: "In attesa / Bloccate",
      noDate: "Senza data",
    },
    briefingAria: "Briefing di oggi",
    emptyState: {
      title: "Niente in sospeso. Ottimo.",
      body: "Tutto ciò che richiede la tua attenzione comparirà qui.",
      inboxCta: "Oppure controlla la tua posta →",
    },
    row: {
      sendToAi: "Affida all'IA",
      takeOver: "Riprendi",
      proposed: "Proposta",
      proposedByAi: "Proposta dall'IA",
      assignedToMe: "Assegnata a me",
      taskChip: "Attività",
      fromInbox: "Dalla posta",
      fromProject: (name) => `Da ${name}`,
      projectFallback: "Progetto",
      fromCalendar: "Dal calendario",
      eventAria: "Evento",
      atTime: (time) => `alle ${time}`,
      priorities: {
        critical: "Urgente",
        high: "Alta",
        low: "Bassa",
        normal: "Normale",
      },
      due: {
        todayAt: (time) => `Oggi ${time}`,
        yesterday: "Ieri",
        tomorrow: "Domani",
        daysAgo: (days) => `${days} g fa`,
      },
      a11y: {
        task: "Attività",
        priorityPrefix: "priorità",
        duePrefix: "scadenza",
        noDueDate: "senza scadenza",
        inMyLane: "nella mia corsia",
        inAiLane: "nella corsia IA",
        fromInbox: "dalla posta in arrivo",
        fromProject: (name) => `dal progetto ${name}`,
        manualTask: "attività manuale",
      },
    },
  },
  startHere: {
    eyebrow: "Inizia qui · ora",
    ariaLabel: "Inizia qui",
    allClearTitle: "Sei in pari",
    allClearBody:
      "Al momento non c'è nulla che ti richieda. Il nuovo lavoro e le proposte dell'IA compariranno qui man mano che la giornata procede.",
    openTask: "Apri attività",
    sendToAI: "Affida all'IA",
    badges: { overdue: "In ritardo", today: "Per oggi", waiting: "In attesa", undated: "Senza data" },
    source: {
      inbox: "Dalla posta · assegnata a te",
      projectFallback: "Da un progetto",
      fromProject: (name) => `Da ${name}`,
      manual: "Attività",
      calendar: "Dal calendario",
    },
    why: {
      overdue: (since) => `In ritardo${since} — risolverla riordina la tua bacheca e rimette in moto la giornata.`,
      today: (at) => `Per oggi${at}. In questo momento è la vittoria più chiara della bacheca.`,
      waiting: "In attesa di qualcun altro. Un rapido sollecito evita che blocchi la giornata.",
      undated: "Ancora senza scadenza — una buona da chiudere finché la giornata è aperta.",
    },
    sinceDate: (formatted) => ` dal ${formatted}`,
    atTime: (formatted) => ` alle ${formatted}`,
  },
  briefing: {
    ariaLabel: "Resoconto giornaliero",
    eyebrow: { morning: "resoconto del mattino", afternoon: "resoconto del pomeriggio", evening: "resoconto della sera" },
    greeting: { morning: "Buongiorno.", afternoon: "Buon pomeriggio.", evening: "Buonasera." },
    meetings: (count) => `${count} ${count === 1 ? "evento" : "eventi"} in calendario`,
    noMeetings: "nessuna riunione oggi",
    bodyOverdue: (overdue, meetings) =>
      `Hai ${overdue} ${overdue === 1 ? "elemento in ritardo" : "elementi in ritardo"} e ${meetings}. Io ${
        overdue === 1 ? "lo risolverei per primo" : "risolverei prima gli arretrati"
      } — è ciò che frena la giornata.`,
    bodyDueToday: (dueToday, meetings) =>
      `${dueToday} ${dueToday === 1 ? "elemento scade" : "elementi scadono"} oggi e ${meetings}. Inizia da ciò che scade e la bacheca resta avanti.`,
    bodyWaiting: (waiting, meetings) =>
      `Niente in ritardo né per oggi, e ${meetings}. ${waiting} ${
        waiting === 1 ? "elemento è" : "elementi sono"
      } in attesa di altri — un buon momento per fare un sollecito.`,
    bodySchedule: (meetings) => `Nessun lavoro in ritardo o per oggi — solo ${meetings}. La tua coda è libera.`,
    bodyAllClear: "Niente in ritardo, per oggi o in attesa, e nessuna riunione. Sei in pari.",
    aiTail: (ai) => ` 7F si occupa di ${ai} ${ai === 1 ? "elemento" : "elementi"} al tuo fianco.`,
  },
}
