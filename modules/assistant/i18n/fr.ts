/** Ask Finesse — French catalog (informal tu, matching the Marketing catalogs). */

import type { FinesseAssistantMessages } from "./types"

export const fr = {
  locale: "fr",
  launcherLabel: "Demander à Finesse",
  launcherAria: "Demander à Finesse, ton assistante business",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "Tu es dans",
  pageLabels: {
    "my-salon": "Mon salon",
    today: "Aujourd’hui",
    agenda: "Agenda",
    clients: "Clientèle",
    messages: "Messages",
    catalog: "Prestations",
    marketing: "Marketing",
    billing: "Paiements",
    team: "Équipe",
    settings: "Réglages",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "Je peux t’expliquer comment va ton salon sur cette période et ce que tu peux améliorer.",
    today: "Je peux t’aider à organiser ta journée et à décider quoi faire en premier.",
    agenda: "Je peux t’aider avec tes rendez-vous, tes créneaux libres et tes heures de pointe.",
    clients: "Je peux t’aider à prendre soin de ta clientèle et à repérer qui a besoin d’attention.",
    messages: "Je peux t’aider à mettre de l’ordre dans tes conversations.",
    catalog: "Je peux t’aider à comprendre quelles prestations marchent le mieux.",
    marketing: "Je peux te donner des idées pour tes contenus et tes campagnes.",
    billing: "Je peux t’aider avec tes paiements et factures en attente.",
    team: "Je peux t’aider à organiser le travail de ton équipe.",
    settings: "Je peux t’aider à configurer ton espace de travail.",
    other: "Demande-moi ce que tu veux sur ton activité.",
  },
  suggestionsTitle: "Suggestions",
  composerPlaceholder: "Écris ta question…",
  send: "Envoyer",
  close: "Fermer",
  thinking: "Finesse réfléchit…",
  unavailable: {
    title: "Finesse n’est pas encore connectée.",
    description:
      "L’assistante sera disponible dès que le service d’IA sera connecté. Tout le reste de ton espace continue de fonctionner normalement.",
  },
  error: {
    title: "Je n’ai pas pu répondre pour l’instant.",
    retry: "Réessaie dans quelques secondes.",
  },
  honestyNote:
    "Finesse répond avec les informations visibles dans ton espace. Elle n’exécute pas encore d’actions à ta place.",
  emptyConversation: "Choisis une suggestion ou écris ta question.",
  staticSuggestions: {
    "my-salon": [
      "Explique-moi cette période",
      "Pourquoi mes revenus ont-ils changé ?",
      "Qui devrait revenir ?",
      "Comment améliorer le mois prochain ?",
    ],
    today: ["Que faire en premier ?", "Résume ma journée", "Qu’est-ce qui demande mon attention ?"],
    agenda: [
      "Cherche un créneau libre demain",
      "Quelles sont mes heures de pointe ?",
      "Où caser deux rendez-vous de plus ?",
    ],
    clients: [
      "Qui devrais-je recontacter ?",
      "Qui n’est pas revenu ?",
      "Montre-moi ma clientèle la plus fidèle",
    ],
    messages: [
      "Résume les conversations en attente",
      "Quels messages attendent une réponse ?",
    ],
    catalog: ["Quelle prestation marche le mieux ?", "Que devrais-je promouvoir ?"],
    marketing: [
      "Crée une publication",
      "Propose-moi une campagne",
      "Utilise ma dernière réalisation",
      "Aide-moi à remplir les créneaux libres",
    ],
    billing: ["Quels paiements sont en attente ?", "Résume mes revenus de la période"],
    team: ["Comment avance le travail de l’équipe ?"],
    settings: ["Que me reste-t-il à configurer ?"],
    other: ["Comment va mon activité ?", "Qu’est-ce qui demande mon attention aujourd’hui ?"],
  },
  dynamicSuggestions: {
    overview: {
      firstPeriod: {
        label: "Que surveiller mon premier mois ?",
        prompt:
          "C’est ma première période avec des données, sans comparaison antérieure. Quels signaux devrais-je surveiller pendant mon premier mois ?",
      },
      earningsDrop: {
        label: "Pourquoi mes revenus ont-ils baissé ?",
        prompt:
          "Mes revenus ont baissé par rapport à la période précédente. Qu’est-ce qui a pu causer cette baisse et que puis-je faire ?",
      },
      earningsGrowth: {
        label: "Qu’est-ce qui a porté la croissance ?",
        prompt:
          "Mes revenus ont augmenté par rapport à la période précédente. Qu’est-ce qui a porté cette croissance et comment la maintenir ?",
      },
      weakRebooking: {
        label: "Qui devrait revenir ?",
        prompt:
          "Mon taux de re-réservation est faible. Qui devrait revenir bientôt et comment les contacter ?",
      },
      pendingPayments: {
        label: "Quels paiements demandent attention ?",
        prompt:
          "J’ai des paiements en attente pour des visites déjà terminées. Lesquels traiter en premier ?",
      },
      peakAvailability: {
        label: "Comment libérer ma journée de pointe ?",
        prompt:
          "Ma journée la plus chargée est presque complète. Comment créer plus de disponibilité sans perdre de clientèle ?",
      },
    },
    today: {
      fillGaps: {
        label: "Comment remplir les créneaux d’aujourd’hui ?",
        prompt: (count) =>
          `J’ai aujourd’hui ${count} créneau(x) libre(s) dans l’agenda. Comment puis-je les remplir ?`,
      },
      firstMove: {
        label: "Que faire en premier ?",
        prompt: (count) =>
          `J’ai ${count} rendez-vous aujourd’hui. Que devrais-je faire en premier pour que la journée se passe bien ?`,
      },
      summary: {
        label: "Résume ma journée",
        prompt: "Résume ma journée : rendez-vous, créneaux libres et ce qui demande mon attention.",
      },
    },
    agenda: {
      fillTomorrow: {
        label: "Comment remplir les créneaux de demain ?",
        prompt: (count) => `Demain j’ai ${count} créneau(x) libre(s). Comment puis-je les remplir ?`,
      },
      pendingConfirmation: {
        label: "Quels rendez-vous restent à confirmer ?",
        prompt: (count) =>
          `J’ai ${count} rendez-vous non confirmé(s). Lesquels confirmer en premier ?`,
      },
      cancelledSlot: {
        label: "Que faire du créneau annulé ?",
        prompt: "Un rendez-vous a été annulé aujourd’hui. Que puis-je faire de ce créneau ?",
      },
      fitUrgent: {
        label: "Où caser un rendez-vous urgent ?",
        prompt:
          "Ma journée est presque complète. Où pourrais-je caser un rendez-vous urgent sans désorganiser l’agenda ?",
      },
    },
    clients: {
      selectedSummary: {
        label: "Résume son historique récent",
        prompt:
          "Résume l’historique récent de cette personne : visites, prestations et tout signal à surveiller.",
      },
      selectedContact: {
        label: "Devrais-je la recontacter ?",
        prompt: "Devrais-je recontacter cette personne ? Quand, et avec quel message ?",
      },
      overdueRebooking: {
        label: "Qui contacter cette semaine ?",
        prompt: (count) =>
          `${count} personnes ne sont pas revenues depuis un moment. Qui devrais-je contacter cette semaine et comment ?`,
      },
    },
    messages: {
      selectedSummary: {
        label: "Résume cette conversation",
        prompt: "Résume cette conversation et dis-moi s’il reste quelque chose à répondre.",
      },
      needReply: {
        label: "Quels messages répondre en premier ?",
        prompt: (count) =>
          `J’ai ${count} message(s) sans réponse. Auxquels devrais-je répondre en premier ?`,
      },
    },
    marketing: {
      postLatestWork: {
        label: "Crée un post avec ma dernière réalisation",
        prompt:
          "J’ai des photos de réalisations récentes non utilisées. Comment préparer une publication avec la dernière ?",
      },
      noMedia: {
        label: "Quel contenu créer aujourd’hui ?",
        prompt:
          "Je n’ai pas encore importé de photos. Quel contenu devrais-je créer aujourd’hui pour mon salon ?",
      },
      reviewReady: {
        label: "Que publier en premier ?",
        prompt: (count) =>
          `J’ai ${count} publication(s) préparée(s). Laquelle relire et publier en premier ?`,
      },
    },
    billing: {
      followUp: {
        label: "Quels paiements relancer en premier ?",
        prompt: "J’ai des paiements en attente. Lesquels relancer en premier et comment ?",
      },
      collectionHealth: {
        label: "Comment vont mes encaissements ?",
        prompt:
          "Je n’ai aucun paiement en retard pour l’instant. Comment va mon rythme d’encaissement en général ?",
      },
      revenueChange: {
        label: "Explique les revenus de la période",
        prompt:
          "Mes revenus ont changé par rapport à la période précédente. Explique-moi ce changement.",
      },
    },
  },
} satisfies FinesseAssistantMessages
