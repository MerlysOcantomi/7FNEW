import type { BeautyMarketingMessages } from "./types"

/** French catalog for Finesse Marketing. */
export const fr = {
  locale: "fr",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Aperçu · données d’exemple",
    tooltip:
      "Données d’exemple : les modifications ne sont pas enregistrées et rien n’est encore publié sur tes réseaux — les connexions réelles arriveront plus tard.",
  },
  header: {
    title: "Marketing",
    description:
      "Transforme tes réalisations en publications. Freya prépare le contenu, tu ne fais qu’approuver.",
    uploadCta: "Importer des photos",
    weekLabel: "Cette semaine",
    mobileTagline: "Tes photos, préparées par Freya",
    readyPhotos: (count) => (count === 1 ? "1 photo prête" : `${count} photos prêtes`),
    scheduledPosts: (count) => (count === 1 ? "1 programmée" : `${count} programmées`),
    activeCampaigns: (count) =>
      count === 1 ? "1 campagne active" : `${count} campagnes actives`,
  },
  featured: {
    sectionTitle: "Publication du jour",
    sectionHint: "préparée par Freya",
    freyaPrepared: "a préparé la légende",
    goalLabel: "Objectif",
    bestTimeLabel: "Meilleur créneau",
    publishNow: "Publier maintenant",
    schedule: "Programmer",
    edit: "Modifier",
    channelPendingNote:
      "La connexion au canal est encore en attente. Une fois approuvée, la publication est prête à partir dès que tu connectes ton compte.",
    approvedState: "Approuvée · connexion du canal en attente",
    scheduledState: "Programmée",
    empty: {
      title: "Tu n’as pas encore de réalisation prête à publier.",
      description: "Importe une photo et Freya créera une proposition pour toi.",
      action: "Importer ma première réalisation",
    },
  },
  gallery: {
    sectionTitle: "Tes réalisations",
    sectionHint: "photos récentes",
    uploadTile: "Importer des photos",
    viewAll: "Voir toute la galerie →",
    preparePost: "Préparer la publication",
    preparePostAria: (title) => `Préparer la publication : ${title}`,
    empty: {
      title: "Pas encore de photos de tes réalisations.",
      description: "Importe ta première réalisation pour que Freya commence à préparer du contenu.",
      action: "Importer ma première réalisation",
    },
  },
  calendar: {
    sectionTitle: "Calendrier de contenu",
    sectionHint: "7 prochains jours",
    mobileToggle: "Voir le calendrier de contenu",
    empty: "Aucune publication programmée ces jours-ci.",
    itemKindLabels: {
      post: "Post",
      reel: "Reel",
      story: "Story",
      "campaña": "Campagne",
    },
  },
  freya: {
    name: "Freya",
    role: "studio créatif",
    readyForReview: (count) => (count === 1 ? "1 prête" : `${count} prêtes`),
    empty:
      "Importe une photo de ta dernière réalisation et je te prépare une proposition de publication.",
  },
  campaigns: {
    sectionTitle: "Campagnes simples",
    activeCountHint: (count) => (count === 1 ? "1 active" : `${count} actives`),
    approve: "Approuver",
    view: "Voir",
    pause: "Mettre en pause",
    resume: "Reprendre",
    detail: "Voir le détail",
    empty: {
      title: "Aucune campagne pour le moment.",
      description: "Fiona te proposera des campagnes simples dès qu’elle verra une opportunité.",
    },
    audienceFallback: "personnes",
    transitionToast: (status) => {
      switch (status) {
        case "sugerida":
          return "Campagne suggérée."
        case "aprobada":
          return "Campagne approuvée."
        case "programada":
          return "Campagne programmée."
        case "activa":
          return "Campagne activée."
        case "pausada":
          return "Campagne mise en pause."
        case "finalizada":
          return "Campagne terminée."
      }
    },
  },
  pulse: {
    sectionTitle: "Pouls social",
    sectionHint: "7 derniers jours",
    channelsPendingNote: "Connecte tes réseaux pour voir de vraies données ici.",
  },
  upload: {
    title: "Importer les photos d’une réalisation",
    takePhoto: "Prendre une photo",
    fromGallery: "Choisir dans la galerie",
    selectHint: "Tu peux sélectionner plusieurs images à la fois.",
    clientLabel: "Client·e (optionnel)",
    clientPlaceholder: "Maria",
    serviceLabel: "Service réalisé (optionnel)",
    servicePlaceholder: "Manucure semi-permanente",
    styleLabel: "Style ou soin (optionnel)",
    stylePlaceholder: "Rose nude chrome",
    beforeAfterLabel: "C’est un avant-après",
    notesLabel: "Notes pour Freya (optionnel)",
    notesPlaceholder: "Ex. : mets en avant la brillance de la finition…",
    confirm: "Enregistrer la réalisation",
    cancel: "Annuler",
    errorType: "Seules les images sont acceptées.",
    errorEmpty: "Sélectionne au moins une image.",
    successToast: "Réalisation enregistrée. Tu peux maintenant préparer sa publication.",
    defaultWorkTitle: "Nouvelle réalisation",
    removeImageAria: (name) => `Retirer ${name}`,
  },
  editPost: {
    title: "Modifier la publication",
    titleLabel: "Titre ou contexte",
    captionLabel: "Légende",
    hashtagsLabel: "Hashtags",
    hashtagsHint: "Séparés par des virgules, sans #.",
    channelLabel: "Canal",
    kindLabel: "Type de contenu",
    goalLabel: "Objectif",
    ctaLabel: "Appel à l’action",
    save: "Enregistrer les modifications",
    cancel: "Annuler",
    errorCaption: "La légende ne peut pas rester vide.",
    successToast: "Publication mise à jour.",
  },
  schedule: {
    title: "Programmer la publication",
    dateLabel: "Date",
    timeLabel: "Heure",
    channelLabel: "Canal",
    confirm: "Programmer",
    cancel: "Annuler",
    errorPast: "Choisis une date et une heure futures.",
    successToast: "Publication programmée.",
  },
  publish: {
    approvedToast: "Publication approuvée. Elle partira dès que tu connecteras le canal.",
    proposalNote: "Proposition initiale · modifie-la à ton goût",
  },
  errorState: {
    title: "Impossible de charger Marketing.",
    description: "Réessaie dans quelques secondes.",
    retry: "Réessayer",
  },
  a11y: {
    loadingMarketing: "Chargement de Marketing",
    workPhotoAlt: (title) => `Photo : ${title}`,
    workPhotoFallback: "Photo de la réalisation",
  },
  workStatusLabels: {
    nuevo: "Nouvelle",
    sin_usar: "Non utilisée",
    preparado: "Préparée",
    programado: "Programmée",
    publicado: "Publiée",
  },
  postStatusLabels: {
    borrador: "Brouillon",
    preparada: "Prête",
    aprobada: "Approuvée",
    programada: "Programmée",
    publicada: "Publiée",
  },
  campaignStatusLabels: {
    sugerida: "Suggérée",
    aprobada: "Approuvée",
    programada: "Programmée",
    activa: "Active",
    pausada: "En pause",
    finalizada: "Terminée",
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
    carrusel: "Carrousel",
  },
  agentLabels: { fiona: "Fiona", freya: "Freya" },
  draftTemplates: {
    fallbackSubject: "réalisation",
    caption: ({ subject, clientName, beforeAfter }) =>
      `${subject}${clientName ? ` pour ${clientName}` : ""}, tout juste sorti du studio ✨${
        beforeAfter ? " Avant-après réel, sans filtre." : ""
      } On réserve le tien ? Il reste des créneaux cette semaine 💅`,
    goal: "Attirer de nouveaux clients",
    cta: "Réserve ton rendez-vous",
  },
  demo: {
    works: {
      w1: {
        title: "Rose Nude Chrome · María",
        clientName: "María",
        service: "Manucure semi-permanente",
        style: "Rose nude chrome",
      },
      w2: {
        title: "Nail art floral · Marta",
        clientName: "Marta",
        service: "Nail art",
        style: "Floral printemps",
      },
      w3: {
        title: "Baby boomer · Laura",
        clientName: "Laura",
        service: "Manucure semi-permanente",
        style: "Baby boomer",
      },
      w4: {
        title: "Vernis rouge · Andrea",
        clientName: "Andrea",
        service: "Pose de vernis",
        style: "Rouge classique",
      },
      w5: {
        title: "French moderne · Sara",
        clientName: "Sara",
        service: "Manucure",
        style: "French moderne",
      },
    },
    posts: {
      p1: {
        title: "Le Rose Nude Chrome de María est à montrer.",
        caption:
          "Rose nude avec finition miroir ✨ La teinte qui va bien toute l’année. On réserve le tien ? Il reste des créneaux cette semaine 💅",
        hashtags: ["RoseNude", "onglesAvecStyle", "manucure"],
        goal: "Attirer de nouveaux clients",
        bestTime: "Aujourd’hui 19:00",
        cta: "Réserve ton rendez-vous",
      },
      p2: {
        title: "Le nail art floral de Marta",
        caption:
          "Des fleurs qui durent plus longtemps qu’un bouquet 🌸 Nail art à main levée pour ouvrir la saison.",
        hashtags: ["nailart", "floral", "manucure"],
        goal: "Montrer un travail récent",
        bestTime: null,
        cta: "Écris-nous pour ton design",
      },
      p3: {
        title: "Le baby boomer de Laura",
        caption:
          "Le dégradé qui ne déçoit jamais. Baby boomer avec finition naturelle pour tous les jours ✨",
        hashtags: ["babyBoomer", "onglesNaturels"],
        goal: "Portée",
        bestTime: null,
        cta: null,
      },
    },
    campaigns: {
      c1: {
        title: "« L’été des ongles » en cours",
        reason: "3 publications programmées · 480 personnes touchées.",
        audienceLabel: "personnes touchées",
      },
      c2: {
        title: "« Retour à la couleur » pour la clientèle sans réservation récente",
        reason: "14 personnes sans réservation depuis 2 mois ou plus · Freya a déjà préparé les visuels.",
        audienceLabel: "personnes sans réservation depuis 2 mois ou plus",
      },
    },
    pulse: {
      periodLabel: "7 derniers jours",
      metrics: {
        followers: { label: "Abonnés", value: "1 240", delta: "+18 ce mois-ci" },
        reach: { label: "Portée", value: "4,8 k", delta: "+32 % vs semaine dernière" },
        saves: { label: "Enregistrements", value: "96", delta: "+11 aujourd’hui" },
        inquiries: { label: "Demandes", value: "12", delta: "+3 cette semaine" },
        newClients: { label: "Clients via le contenu", value: "3", delta: "cette semaine" },
      },
      insight:
        "3 nouveaux clients ont écrit cette semaine après avoir vu une publication. Fanny s’occupe déjà d’eux.",
    },
    freyaMessage:
      "Le Rose Nude de María est prêt à publier et il y a une idée de reel avec le baby boomer de Laura. Publie aujourd’hui avant 19:00 pour plus de portée.",
  },
} satisfies BeautyMarketingMessages
