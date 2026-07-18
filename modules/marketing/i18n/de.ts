import type { BeautyMarketingMessages } from "./types"

/** German catalog for Finesse Marketing. */
export const de = {
  locale: "de",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Vorschau · Beispieldaten",
    tooltip:
      "Beispieldaten: Änderungen werden nicht gespeichert und noch wird nichts in deinen Netzwerken veröffentlicht — echte Verbindungen folgen später.",
  },
  header: {
    title: "Marketing",
    description:
      "Mach aus deinen Arbeiten Beiträge. Freya bereitet die Inhalte vor, du gibst nur frei.",
    uploadCta: "Fotos hochladen",
    weekLabel: "Diese Woche",
    mobileTagline: "Deine Fotos, vorbereitet von Freya",
    readyPhotos: (count) => (count === 1 ? "1 Foto bereit" : `${count} Fotos bereit`),
    scheduledPosts: (count) => (count === 1 ? "1 geplant" : `${count} geplant`),
    activeCampaigns: (count) =>
      count === 1 ? "1 aktive Kampagne" : `${count} aktive Kampagnen`,
  },
  featured: {
    sectionTitle: "Beitrag des Tages",
    sectionHint: "vorbereitet von Freya",
    freyaPrepared: "hat die Bildunterschrift vorbereitet",
    goalLabel: "Ziel",
    bestTimeLabel: "Beste Zeit",
    publishNow: "Jetzt veröffentlichen",
    schedule: "Planen",
    edit: "Bearbeiten",
    channelPendingNote:
      "Die Kanalverbindung steht noch aus. Nach der Freigabe ist der Beitrag bereit und geht raus, sobald du dein Konto verbindest.",
    approvedState: "Freigegeben · Kanalverbindung ausstehend",
    scheduledState: "Geplant",
    empty: {
      title: "Du hast noch keine Arbeiten, die bereit zur Veröffentlichung sind.",
      description: "Lade ein Foto hoch und Freya erstellt einen Vorschlag für dich.",
      action: "Meine erste Arbeit hochladen",
    },
  },
  gallery: {
    sectionTitle: "Deine Arbeiten",
    sectionHint: "aktuelle Fotos",
    uploadTile: "Fotos hochladen",
    viewAll: "Ganze Galerie ansehen →",
    preparePost: "Beitrag vorbereiten",
    preparePostAria: (title) => `Beitrag vorbereiten: ${title}`,
    empty: {
      title: "Noch keine Fotos deiner Arbeiten.",
      description: "Lade deine erste Arbeit hoch, damit Freya Inhalte vorbereiten kann.",
      action: "Meine erste Arbeit hochladen",
    },
  },
  calendar: {
    sectionTitle: "Content-Kalender",
    sectionHint: "nächste 7 Tage",
    mobileToggle: "Content-Kalender ansehen",
    empty: "Keine geplanten Beiträge an diesen Tagen.",
    itemKindLabels: {
      post: "Post",
      reel: "Reel",
      story: "Story",
      "campaña": "Kampagne",
    },
  },
  freya: {
    name: "Freya",
    role: "Kreativstudio",
    readyForReview: (count) => (count === 1 ? "1 bereit" : `${count} bereit`),
    empty:
      "Lade ein Foto deiner letzten Arbeit hoch und ich bereite dir einen Beitragsvorschlag vor.",
  },
  campaigns: {
    sectionTitle: "Einfache Kampagnen",
    activeCountHint: (count) => (count === 1 ? "1 aktiv" : `${count} aktiv`),
    approve: "Freigeben",
    view: "Ansehen",
    pause: "Pausieren",
    resume: "Fortsetzen",
    detail: "Details ansehen",
    empty: {
      title: "Momentan keine Kampagnen.",
      description: "Fiona schlägt dir einfache Kampagnen vor, sobald sie eine Gelegenheit sieht.",
    },
    audienceFallback: "Personen",
    transitionToast: (status) => {
      switch (status) {
        case "sugerida":
          return "Kampagne vorgeschlagen."
        case "aprobada":
          return "Kampagne freigegeben."
        case "programada":
          return "Kampagne geplant."
        case "activa":
          return "Kampagne aktiviert."
        case "pausada":
          return "Kampagne pausiert."
        case "finalizada":
          return "Kampagne beendet."
      }
    },
  },
  pulse: {
    sectionTitle: "Social-Puls",
    sectionHint: "letzte 7 Tage",
    channelsPendingNote: "Verbinde deine Netzwerke, um hier echte Daten zu sehen.",
  },
  upload: {
    title: "Fotos einer Arbeit hochladen",
    takePhoto: "Foto aufnehmen",
    fromGallery: "Aus der Galerie wählen",
    selectHint: "Du kannst mehrere Bilder auf einmal auswählen.",
    clientLabel: "Kundin/Kunde (optional)",
    clientPlaceholder: "Maria",
    serviceLabel: "Durchgeführter Service (optional)",
    servicePlaceholder: "Semipermanente Maniküre",
    styleLabel: "Stil oder Behandlung (optional)",
    stylePlaceholder: "Rose Nude Chrome",
    beforeAfterLabel: "Es ist ein Vorher-Nachher",
    notesLabel: "Notizen für Freya (optional)",
    notesPlaceholder: "Z. B.: den Glanz des Finishs hervorheben…",
    confirm: "Arbeit speichern",
    cancel: "Abbrechen",
    errorType: "Nur Bilder sind erlaubt.",
    errorEmpty: "Wähle mindestens ein Bild aus.",
    successToast: "Arbeit gespeichert. Du kannst jetzt ihren Beitrag vorbereiten.",
    defaultWorkTitle: "Neue Arbeit",
    removeImageAria: (name) => `${name} entfernen`,
  },
  editPost: {
    title: "Beitrag bearbeiten",
    titleLabel: "Titel oder Kontext",
    captionLabel: "Bildunterschrift",
    hashtagsLabel: "Hashtags",
    hashtagsHint: "Durch Kommas getrennt, ohne #.",
    channelLabel: "Kanal",
    kindLabel: "Inhaltstyp",
    goalLabel: "Ziel",
    ctaLabel: "Handlungsaufforderung",
    save: "Änderungen speichern",
    cancel: "Abbrechen",
    errorCaption: "Die Bildunterschrift darf nicht leer sein.",
    successToast: "Beitrag aktualisiert.",
  },
  schedule: {
    title: "Beitrag planen",
    dateLabel: "Datum",
    timeLabel: "Uhrzeit",
    channelLabel: "Kanal",
    confirm: "Planen",
    cancel: "Abbrechen",
    errorPast: "Wähle Datum und Uhrzeit in der Zukunft.",
    successToast: "Beitrag geplant.",
  },
  publish: {
    approvedToast: "Beitrag freigegeben. Er geht raus, sobald du den Kanal verbindest.",
    proposalNote: "Erster Vorschlag · passe ihn nach deinem Geschmack an",
  },
  errorState: {
    title: "Marketing konnte nicht geladen werden.",
    description: "Versuche es in ein paar Sekunden erneut.",
    retry: "Erneut versuchen",
  },
  a11y: {
    loadingMarketing: "Marketing wird geladen",
    workPhotoAlt: (title) => `Foto: ${title}`,
    workPhotoFallback: "Foto der Arbeit",
  },
  workStatusLabels: {
    nuevo: "Neu",
    sin_usar: "Unbenutzt",
    preparado: "Vorbereitet",
    programado: "Geplant",
    publicado: "Veröffentlicht",
  },
  postStatusLabels: {
    borrador: "Entwurf",
    preparada: "Bereit",
    aprobada: "Freigegeben",
    programada: "Geplant",
    publicada: "Veröffentlicht",
  },
  campaignStatusLabels: {
    sugerida: "Vorgeschlagen",
    aprobada: "Freigegeben",
    programada: "Geplant",
    activa: "Aktiv",
    pausada: "Pausiert",
    finalizada: "Beendet",
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
    carrusel: "Karussell",
  },
  agentLabels: { fiona: "Fiona", freya: "Freya" },
  draftTemplates: {
    fallbackSubject: "Arbeit",
    caption: ({ subject, clientName, beforeAfter }) =>
      `${subject}${clientName ? ` für ${clientName}` : ""}, frisch aus dem Studio ✨${
        beforeAfter ? " Echtes Vorher-Nachher, ohne Filter." : ""
      } Buchen wir deins? Diese Woche sind noch Termine frei 💅`,
    goal: "Neue Kundschaft gewinnen",
    cta: "Buche deinen Termin",
  },
  demo: {
    works: {
      w1: {
        title: "Rose Nude Chrome · María",
        clientName: "María",
        service: "Semipermanente Maniküre",
        style: "Rose Nude Chrome",
      },
      w2: {
        title: "Florale Nail-Art · Marta",
        clientName: "Marta",
        service: "Nail-Art",
        style: "Frühlingsblumen",
      },
      w3: {
        title: "Baby Boomer · Laura",
        clientName: "Laura",
        service: "Semipermanente Maniküre",
        style: "Baby Boomer",
      },
      w4: {
        title: "Roter Lack · Andrea",
        clientName: "Andrea",
        service: "Lackieren",
        style: "Klassisches Rot",
      },
      w5: {
        title: "Moderne French · Sara",
        clientName: "Sara",
        service: "Maniküre",
        style: "Moderne French",
      },
    },
    posts: {
      p1: {
        title: "Marías Rose Nude Chrome ist zum Herzeigen geworden.",
        caption:
          "Rose Nude mit Spiegel-Finish ✨ Der Ton, der das ganze Jahr passt. Buchen wir deins? Diese Woche sind noch Termine frei 💅",
        hashtags: ["RoseNude", "NägelMitStil", "Maniküre"],
        goal: "Neue Kundschaft gewinnen",
        bestTime: "Heute 19:00",
        cta: "Buche deinen Termin",
      },
      p2: {
        title: "Martas florale Nail-Art",
        caption:
          "Blumen, die länger halten als ein Strauß 🌸 Freihand-Nail-Art zum Saisonstart.",
        hashtags: ["nailart", "floral", "manikuere"],
        goal: "Aktuelle Arbeit zeigen",
        bestTime: null,
        cta: "Schreib uns für dein Design",
      },
      p3: {
        title: "Lauras Baby Boomer",
        caption:
          "Der Verlauf, der nie enttäuscht. Baby Boomer mit natürlichem Finish für jeden Tag ✨",
        hashtags: ["babyBoomer", "natuerlicheNaegel"],
        goal: "Reichweite",
        bestTime: null,
        cta: null,
      },
    },
    campaigns: {
      c1: {
        title: "„Sommer der Nägel“ läuft",
        reason: "3 geplante Beiträge · 480 Personen erreicht.",
        audienceLabel: "Personen erreicht",
      },
      c2: {
        title: "„Zurück zur Farbe“ für lange nicht gebuchte Kundschaft",
        reason: "14 Personen seit 2+ Monaten ohne Buchung · Freya hat die Inhalte schon vorbereitet.",
        audienceLabel: "Personen seit 2+ Monaten ohne Buchung",
      },
    },
    pulse: {
      periodLabel: "letzte 7 Tage",
      metrics: {
        followers: { label: "Follower", value: "1.240", delta: "+18 diesen Monat" },
        reach: { label: "Reichweite", value: "4,8k", delta: "+32 % ggü. Vorwoche" },
        saves: { label: "Gespeichert", value: "96", delta: "+11 heute" },
        inquiries: { label: "Anfragen", value: "12", delta: "+3 diese Woche" },
        newClients: { label: "Neukundschaft über Inhalte", value: "3", delta: "diese Woche" },
      },
      insight:
        "3 neue Personen haben diese Woche nach einem Beitrag geschrieben. Fanny kümmert sich schon um sie.",
    },
    freyaMessage:
      "Marías Rose Nude ist bereit zur Veröffentlichung und aus Lauras Baby Boomer gibt es eine Reel-Idee. Veröffentliche heute vor 19:00 für mehr Reichweite.",
  },
} satisfies BeautyMarketingMessages
