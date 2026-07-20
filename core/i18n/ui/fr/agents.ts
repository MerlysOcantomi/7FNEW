import type { AgentsMessages } from "../types"

/**
 * French source for the `agents` UI namespace (quick view + full page).
 * "Fanny" and the other agent names are proper names — never translated
 * (see AGENTS.md). Activity item titles come from the API as content.
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
  states: {
    working: "Au travail",
    waiting: "En attente de vous",
    idle: "Inactif",
    comingOnline: "En cours d'activation",
  },
  autonomyLabels: { auto: "Auto", suggests: "Suggère" },
  time: {
    now: "à l'instant",
    minutesAgo: (n) => `il y a ${n} min`,
    hoursAgo: (n) => `il y a ${n} h`,
  },
  page: {
    live: "En direct",
    loadingAria: "Chargement des Agents",
    loadError: "Impossible de charger les Agents.",
    summary: {
      agentsCount: (n) => `${n} agents`,
      workingNow: (n) => `${n} au travail`,
      awaitingYou: (n) => `${n} en attente de vous`,
    },
    kpis: {
      workingNow: "Au travail",
      needsReview: "À valider",
      automatedToday: "Automatisé aujourd'hui",
      attention: "Attention",
    },
    hero: {
      leadRoleSuffix: "CEO",
      leadsTeam: "Dirige l'équipe",
      briefingWorking: "Fanny s'occupe de votre boîte de réception",
      briefingCalm: "votre boîte de réception est calme",
      needsProposals: (n) => (n === 1 ? "1 proposition en attente" : `${n} propositions en attente`),
      needsAttention: (n) => (n === 1 ? "1 requiert votre attention" : `${n} requièrent votre attention`),
      needsJoiner: "et",
      briefingWithNeeds: (opening, needs) =>
        `En ce moment : ${opening} — ${needs} pour vous. Le reste de votre équipe s'active.`,
      briefingNoNeeds: (opening) =>
        `En ce moment : ${opening} — rien ne vous attend. Le reste de votre équipe s'active.`,
      reviewProposals: (n) => (n === 1 ? "Examiner 1 proposition" : `Examiner ${n} propositions`),
      noProposals: "Aucune proposition à examiner",
      adjustAutonomy: "Ajuster l'autonomie",
      adjustAutonomyTitle: "Les réglages d'autonomie arrivent bientôt",
    },
    roster: {
      heading: "Vos agents · en direct",
      defaultTagline: "6 spécialistes + Francis",
      review: "Examiner →",
      handledToday: (n) => (n === 1 ? "1 fait aujourd'hui" : `${n} faits aujourd'hui`),
      watching: "Surveille",
      comingOnline: "En cours d'activation",
      upToDate: "À jour — à l'affût de nouveau travail.",
      readyInRegistry: "Prêt dans votre registre — en cours d'activation.",
      openDetailsSuffix: "Ouvrir les détails",
    },
    liveActivity: {
      title: "Activité en direct",
      executedToday: (n) => `Exécuté aujourd'hui · ${n}`,
      empty: "Aucune action n'a encore été exécutée aujourd'hui.",
    },
    rail: {
      needsReview: "À valider par vous",
      attention: "Attention",
      needsReviewEmpty: "Aucune proposition ne vous attend.",
      attentionEmpty: "Rien ne requiert votre attention.",
      proposes: "propose",
      approve: "Approuver",
      dismiss: "Rejeter",
      approveTitle: "Approuver et rejeter depuis Agents arrive bientôt",
      viewContext: "Voir le contexte",
      view: "Voir",
    },
    autonomy: {
      title: "Autonomie",
      auto: "Auto",
      suggests: "Suggère",
      approval: "Approbation",
      autoText: "Exécute seul le travail à faible risque",
      suggestsText: "Propose et attend votre feu vert",
      approvalText: "N'agit jamais sans votre approbation",
    },
  },
  detail: {
    doingNow: "En cours",
    today: "Aujourd'hui",
    todayEmpty: "Pas encore d'activité aujourd'hui.",
    worksWithTeam: "Travaille avec l'équipe",
    watching: "Surveille",
    recentlyHandled: "Traité récemment",
    openInPrefix: "Ouvrir dans",
    sectionComingOnline: "Section en cours d'activation",
    sectionComingOnlineTitle: "La section de cet agent est en cours d'activation",
    close: "Fermer",
    closeDetailsAria: "Fermer les détails de l'agent",
    detailsAria: (name) => `Détails de ${name}`,
  },
  roster: {
    francis: {
      role: "CEO · Opérations & Coordination",
      watching: [
        "Toute l'opération",
        "Équipe, rôles & capacité",
        "Ce qui demande votre décision",
        "Blocages & priorités",
        "Santé de l'entreprise",
      ],
      collaborationNote:
        "Francis dirige l'équipe — oriente le travail vers le bon agent, coordonne les personnes et ne fait remonter que ce qui vous concerne.",
    },
    forte: {
      role: "Architecture · Modules · Lab",
      watching: ["Modules manquants", "Adéquation métier", "Motifs réutilisables", "Logique backend & produit"],
      collaborationNote:
        "Mr. Forte construit les systèmes que Freya habille visuellement et que Fiona exploite commercialement ; il écoute les tendances de Fathom.",
    },
    fanny: {
      role: "Conversations · Boîte de réception",
      watching: ["Réponses clients non lues", "Conversations en attente", "Relances du jour", "Messages urgents"],
      collaborationNote:
        "Quand un message demande une facture, Fanny la transmet à Felix ; les nouveaux contacts sont synchronisés avec Fiona.",
    },
    freya: {
      role: "Studio créatif · Visuel",
      watching: ["Contenus & ressources visuels", "Design & interfaces", "Pièces créatives pour la croissance & les modules"],
      collaborationNote:
        "Freya produit les visuels dont Fiona a besoin pour la croissance et les interfaces qui habillent les modules de Mr. Forte.",
    },
    fiona: {
      role: "Croissance 7F · Marketing",
      watching: [
        "Campagnes & tunnels",
        "CRM & relations",
        "Audiences & segmentation",
        "Visibilité SEO / AEO",
        "Opportunités de réactivation",
      ],
      collaborationNote:
        "Fiona transforme les nouveaux contacts de Fanny et les visuels de Freya en campagnes, réactivations et croissance.",
    },
    felix: {
      role: "Finance · Factures",
      watching: ["Factures impayées", "Acomptes", "Paiements en retard", "Risque financier"],
      collaborationNote: "Felix prépare les factures à partir des demandes que Fanny lui transmet.",
    },
    fathom: {
      role: "Recherche · Tendances métier",
      watching: ["Tendances du marché", "Opportunités métier", "Signaux concurrents & produit"],
      collaborationNote:
        "Fathom fournit les tendances métier à Mr. Forte, les signaux SEO/AEO & marché à Fiona, et les angles de contenu à Freya.",
    },
    finesse: {
      role: "Spécialiste Beauty",
      watching: ["La journée de l'entreprise", "Ce qui requiert votre attention", "Coordination de l'équipe"],
      collaborationNote:
        "Dirige l'expérience 7F Beauty : lit le contexte de l'entreprise, coordonne la journée et présente les actions. Travaille par-dessus les agents cœur (Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom) sans les remplacer.",
    },
  },
}
