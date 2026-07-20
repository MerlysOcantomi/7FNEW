import type { TodayMessages } from "../types"

/** French source for the `today` UI namespace (chrome + daily workboard). */
export const today: TodayMessages = {
  title: "Aujourd'hui",
  empty: {
    title: "Rien pour aujourd'hui pour l'instant",
    body: "Les nouveaux éléments apparaîtront ici au fur et à mesure.",
  },
  chrome: {
    openFull: "Ouvrir Aujourd'hui en entier",
    close: "Fermer Aujourd'hui",
  },
  quick: {
    subtitle: "Aperçu du jour · sur tout le workspace",
    needsCount: (count) =>
      count === 1
        ? "1 chose a besoin de vous aujourd'hui"
        : `${count} choses ont besoin de vous aujourd'hui`,
    moreInToday: (count) => `+${count} de plus dans Aujourd'hui`,
    aiChip: "IA",
    sources: { inbox: "Boîte de réception", calendar: "Calendrier", task: "Tâche" },
  },
  workboard: {
    loadingAria: "Chargement d'Aujourd'hui",
    errorNote: "Impossible de charger Aujourd'hui.",
    toasts: {
      sendToAiFailed: "Impossible de confier à l'IA",
      takeOverFailed: "Impossible de reprendre la tâche",
      tryAgain: "Réessayez dans un instant.",
    },
    summary: {
      overdue: (count) => (count === 1 ? "1 en retard" : `${count} en retard`),
      dueToday: (count) => (count === 1 ? "1 pour aujourd'hui" : `${count} pour aujourd'hui`),
      waiting: (count) => (count > 0 ? `${count} en attente` : "rien en attente"),
      caption: "votre tableau de travail quotidien",
    },
    pills: {
      myWork: "Mon travail",
      aiWork: "Travail IA",
      schedule: "Agenda",
      waiting: "En attente",
    },
    lanes: {
      myWork: {
        title: "Mon travail",
        subtitle: "Le vôtre, celui de votre équipe et tout ce qui n'a pas encore été confié à l'IA",
        emptyTitle: "Pas de travail pour vous aujourd'hui",
        emptyDescription: "Les tâches que vous créez ou reprenez arriveront ici.",
      },
      aiWork: {
        title: "Travail IA",
        subtitle: "Propositions de Fanny et tout ce que vous avez confié à l'IA",
        emptyTitle: "Pas encore de travail IA",
        emptyDescription:
          "Le travail IA apparaît quand Fanny propose quelque chose ou quand vous confiez une tâche avec « Confier à l'IA » depuis Mon travail.",
        emptyActionLabel: "Voir les Agents",
      },
      schedule: {
        title: "Agenda",
        subtitle: "Événements du calendrier ancrés à aujourd'hui",
        emptyTitle: "Aucun événement aujourd'hui",
        emptyDescription: "Les éléments planifiés apparaîtront ici.",
      },
    },
    sections: {
      overdue: "En retard",
      dueToday: "Pour aujourd'hui",
      waitingBlocked: "En attente / Bloquées",
      noDate: "Sans date",
    },
    briefingAria: "Briefing du jour",
    emptyState: {
      title: "Rien en attente. Parfait.",
      body: "Tout ce qui demande votre attention apparaîtra ici.",
      inboxCta: "Ou consultez votre boîte de réception →",
    },
    row: {
      sendToAi: "Confier à l'IA",
      takeOver: "Reprendre",
      proposed: "Proposée",
      proposedByAi: "Proposée par l'IA",
      assignedToMe: "Assignée à moi",
      taskChip: "Tâche",
      fromInbox: "Depuis la boîte",
      fromProject: (name) => `Depuis ${name}`,
      projectFallback: "Projet",
      fromCalendar: "Depuis le calendrier",
      eventAria: "Événement",
      atTime: (time) => `à ${time}`,
      priorities: {
        critical: "Urgent",
        high: "Haute",
        low: "Basse",
        normal: "Normale",
      },
      due: {
        todayAt: (time) => `Aujourd'hui ${time}`,
        yesterday: "Hier",
        tomorrow: "Demain",
        daysAgo: (days) => `il y a ${days} j`,
      },
      a11y: {
        task: "Tâche",
        priorityPrefix: "priorité",
        duePrefix: "échéance",
        noDueDate: "sans date d'échéance",
        inMyLane: "dans ma file",
        inAiLane: "dans la file IA",
        fromInbox: "depuis la boîte de réception",
        fromProject: (name) => `depuis le projet ${name}`,
        manualTask: "tâche manuelle",
      },
    },
  },
}
