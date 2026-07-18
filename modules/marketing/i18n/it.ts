import type { BeautyMarketingMessages } from "./types"

/** Italian catalog for Finesse Marketing. */
export const it = {
  locale: "it",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Anteprima · dati di esempio",
    tooltip:
      "Dati di esempio: le modifiche non vengono salvate e non viene ancora pubblicato nulla sui tuoi social — le connessioni reali arriveranno più avanti.",
  },
  header: {
    title: "Marketing",
    description:
      "Trasforma i tuoi lavori in pubblicazioni. Freya prepara i contenuti, tu devi solo approvare.",
    uploadCta: "Carica foto",
    weekLabel: "Questa settimana",
    mobileTagline: "Le tue foto, pronte grazie a Freya",
    readyPhotos: (count) => (count === 1 ? "1 foto pronta" : `${count} foto pronte`),
    scheduledPosts: (count) => (count === 1 ? "1 programmata" : `${count} programmate`),
    activeCampaigns: (count) =>
      count === 1 ? "1 campagna attiva" : `${count} campagne attive`,
  },
  featured: {
    sectionTitle: "Pubblicazione di oggi",
    sectionHint: "preparata da Freya",
    freyaPrepared: "ha preparato la didascalia",
    goalLabel: "Obiettivo",
    bestTimeLabel: "Orario migliore",
    publishNow: "Pubblica ora",
    schedule: "Programma",
    edit: "Modifica",
    channelPendingNote:
      "Il collegamento al canale è ancora in sospeso. Una volta approvata, la pubblicazione è pronta a uscire appena colleghi il tuo account.",
    approvedState: "Approvata · collegamento del canale in sospeso",
    scheduledState: "Programmata",
    empty: {
      title: "Non hai ancora lavori pronti da pubblicare.",
      description: "Carica una foto e Freya creerà una proposta per te.",
      action: "Carica il mio primo lavoro",
    },
  },
  gallery: {
    sectionTitle: "I tuoi lavori",
    sectionHint: "foto recenti",
    uploadTile: "Carica foto",
    viewAll: "Vedi tutta la galleria →",
    preparePost: "Prepara pubblicazione",
    preparePostAria: (title) => `Prepara pubblicazione: ${title}`,
    empty: {
      title: "Ancora nessuna foto dei tuoi lavori.",
      description: "Carica il tuo primo lavoro così Freya inizia a preparare contenuti.",
      action: "Carica il mio primo lavoro",
    },
  },
  calendar: {
    sectionTitle: "Calendario dei contenuti",
    sectionHint: "prossimi 7 giorni",
    mobileToggle: "Vedi il calendario dei contenuti",
    empty: "Nessuna pubblicazione programmata in questi giorni.",
    itemKindLabels: {
      post: "Post",
      reel: "Reel",
      story: "Story",
      "campaña": "Campagna",
    },
  },
  freya: {
    name: "Freya",
    role: "studio creativo",
    readyForReview: (count) => (count === 1 ? "1 pronta" : `${count} pronte`),
    empty:
      "Carica una foto del tuo ultimo lavoro e ti preparo una proposta di pubblicazione.",
  },
  campaigns: {
    sectionTitle: "Campagne semplici",
    activeCountHint: (count) => (count === 1 ? "1 attiva" : `${count} attive`),
    approve: "Approva",
    view: "Vedi",
    pause: "Metti in pausa",
    resume: "Riprendi",
    detail: "Vedi dettagli",
    empty: {
      title: "Nessuna campagna per ora.",
      description: "Fiona ti suggerirà campagne semplici quando vedrà un’opportunità.",
    },
    audienceFallback: "persone",
    transitionToast: (status) => {
      switch (status) {
        case "sugerida":
          return "Campagna suggerita."
        case "aprobada":
          return "Campagna approvata."
        case "programada":
          return "Campagna programmata."
        case "activa":
          return "Campagna attivata."
        case "pausada":
          return "Campagna in pausa."
        case "finalizada":
          return "Campagna conclusa."
      }
    },
  },
  pulse: {
    sectionTitle: "Polso social",
    sectionHint: "ultimi 7 giorni",
    channelsPendingNote: "Collega i tuoi social per vedere qui dati reali.",
  },
  upload: {
    title: "Carica le foto di un lavoro",
    takePhoto: "Scatta una foto",
    fromGallery: "Scegli dalla galleria",
    selectHint: "Puoi selezionare più immagini alla volta.",
    clientLabel: "Cliente (opzionale)",
    clientPlaceholder: "Maria",
    serviceLabel: "Servizio eseguito (opzionale)",
    servicePlaceholder: "Manicure semipermanente",
    styleLabel: "Stile o trattamento (opzionale)",
    stylePlaceholder: "Rose nude chrome",
    beforeAfterLabel: "È un prima e dopo",
    notesLabel: "Note per Freya (opzionale)",
    notesPlaceholder: "Es.: metti in risalto la brillantezza del finish…",
    confirm: "Salva lavoro",
    cancel: "Annulla",
    errorType: "Sono ammesse solo immagini.",
    errorEmpty: "Seleziona almeno un’immagine.",
    successToast: "Lavoro salvato. Ora puoi preparare la sua pubblicazione.",
    defaultWorkTitle: "Nuovo lavoro",
    removeImageAria: (name) => `Rimuovi ${name}`,
  },
  editPost: {
    title: "Modifica pubblicazione",
    titleLabel: "Titolo o contesto",
    captionLabel: "Didascalia",
    hashtagsLabel: "Hashtag",
    hashtagsHint: "Separati da virgole, senza #.",
    channelLabel: "Canale",
    kindLabel: "Tipo di contenuto",
    goalLabel: "Obiettivo",
    ctaLabel: "Invito all’azione",
    save: "Salva modifiche",
    cancel: "Annulla",
    errorCaption: "La didascalia non può restare vuota.",
    successToast: "Pubblicazione aggiornata.",
  },
  schedule: {
    title: "Programma pubblicazione",
    dateLabel: "Data",
    timeLabel: "Ora",
    channelLabel: "Canale",
    confirm: "Programma",
    cancel: "Annulla",
    errorPast: "Scegli una data e un’ora future.",
    successToast: "Pubblicazione programmata.",
  },
  publish: {
    approvedToast: "Pubblicazione approvata. Uscirà appena colleghi il canale.",
    proposalNote: "Proposta iniziale · modificala a tuo piacere",
  },
  errorState: {
    title: "Non siamo riusciti a caricare Marketing.",
    description: "Riprova tra qualche secondo.",
    retry: "Riprova",
  },
  a11y: {
    loadingMarketing: "Caricamento di Marketing",
    workPhotoAlt: (title) => `Foto: ${title}`,
    workPhotoFallback: "Foto del lavoro",
  },
  workStatusLabels: {
    nuevo: "Nuovo",
    sin_usar: "Non usato",
    preparado: "Preparato",
    programado: "Programmato",
    publicado: "Pubblicato",
  },
  postStatusLabels: {
    borrador: "Bozza",
    preparada: "Pronta",
    aprobada: "Approvata",
    programada: "Programmata",
    publicada: "Pubblicata",
  },
  campaignStatusLabels: {
    sugerida: "Suggerita",
    aprobada: "Approvata",
    programada: "Programmata",
    activa: "Attiva",
    pausada: "In pausa",
    finalizada: "Conclusa",
  },
  channelLabels: {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
  },
  kindLabels: {
    post: "Post",
    reel: "Reel",
    story: "Story",
    carrusel: "Carosello",
  },
  agentLabels: { fiona: "Fiona", freya: "Freya" },
  draftTemplates: {
    fallbackSubject: "lavoro",
    caption: ({ subject, clientName, beforeAfter }) =>
      `${subject}${clientName ? ` di ${clientName}` : ""}, appena uscito dallo studio ✨${
        beforeAfter ? " Prima e dopo reale, senza filtri." : ""
      } Prenotiamo il tuo? Restano posti questa settimana 💅`,
    goal: "Attirare nuovi clienti",
    cta: "Prenota il tuo appuntamento",
  },
  demo: {
    works: {
      w1: {
        title: "Rose Nude Chrome · María",
        clientName: "María",
        service: "Manicure semipermanente",
        style: "Rose nude chrome",
      },
      w2: {
        title: "Nail art floreale · Marta",
        clientName: "Marta",
        service: "Nail art",
        style: "Floreale primavera",
      },
      w3: {
        title: "Baby boomer · Laura",
        clientName: "Laura",
        service: "Manicure semipermanente",
        style: "Baby boomer",
      },
      w4: {
        title: "Smalto rosso · Andrea",
        clientName: "Andrea",
        service: "Smalto",
        style: "Rosso classico",
      },
      w5: {
        title: "French moderna · Sara",
        clientName: "Sara",
        service: "Manicure",
        style: "French moderna",
      },
    },
    posts: {
      p1: {
        title: "Il Rose Nude Chrome di María è da far vedere.",
        caption:
          "Rose nude con finish a specchio ✨ La tonalità che sta bene tutto l’anno. Prenotiamo il tuo? Restano posti questa settimana 💅",
        hashtags: ["RoseNude", "unghieConStile", "manicure"],
        goal: "Attirare nuovi clienti",
        bestTime: "Oggi 19:00",
        cta: "Prenota il tuo appuntamento",
      },
      p2: {
        title: "La nail art floreale di Marta",
        caption:
          "Fiori che durano più di un mazzo 🌸 Nail art a mano libera per aprire la stagione.",
        hashtags: ["nailart", "floreale", "manicure"],
        goal: "Mostrare un lavoro recente",
        bestTime: null,
        cta: "Scrivici per il tuo design",
      },
      p3: {
        title: "Il baby boomer di Laura",
        caption:
          "La sfumatura che non delude mai. Baby boomer con finish naturale per tutti i giorni ✨",
        hashtags: ["babyBoomer", "unghieNaturali"],
        goal: "Copertura",
        bestTime: null,
        cta: null,
      },
    },
    campaigns: {
      c1: {
        title: "“Estate delle unghie” in corso",
        reason: "3 pubblicazioni programmate · 480 persone raggiunte.",
        audienceLabel: "persone raggiunte",
      },
      c2: {
        title: "“Torna al colore” per chi non prenota da tempo",
        reason: "14 clienti senza prenotazione da 2+ mesi · Freya ha già preparato i contenuti.",
        audienceLabel: "clienti senza prenotazione da 2+ mesi",
      },
    },
    pulse: {
      periodLabel: "ultimi 7 giorni",
      metrics: {
        followers: { label: "Follower", value: "1.240", delta: "+18 questo mese" },
        reach: { label: "Copertura", value: "4,8k", delta: "+32% vs settimana scorsa" },
        saves: { label: "Salvataggi", value: "96", delta: "+11 oggi" },
        inquiries: { label: "Richieste", value: "12", delta: "+3 questa settimana" },
        newClients: { label: "Clienti dai contenuti", value: "3", delta: "questa settimana" },
      },
      insight:
        "3 nuovi clienti hanno scritto questa settimana dopo aver visto una pubblicazione. Fanny se ne sta già occupando.",
    },
    freyaMessage:
      "Il Rose Nude di María è pronto da pubblicare e c’è un’idea di reel dal baby boomer di Laura. Pubblica oggi prima delle 19:00 per più copertura.",
  },
} satisfies BeautyMarketingMessages
