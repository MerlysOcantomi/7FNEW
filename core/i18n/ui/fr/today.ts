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
  startHere: {
    eyebrow: "Commencez ici · maintenant",
    ariaLabel: "Commencez ici",
    allClearTitle: "Vous êtes à jour",
    allClearBody:
      "Rien ne vous attend pour le moment. Le nouveau travail et les propositions de l'IA apparaîtront ici au fil de la journée.",
    openTask: "Ouvrir la tâche",
    sendToAI: "Confier à l'IA",
    badges: { overdue: "En retard", today: "Pour aujourd'hui", waiting: "En attente", undated: "Sans date" },
    source: {
      inbox: "Depuis la boîte · qui vous est assignée",
      projectFallback: "Depuis un projet",
      fromProject: (name) => `Depuis ${name}`,
      manual: "Tâche",
      calendar: "Depuis le calendrier",
    },
    why: {
      overdue: (since) => `En retard${since} — la traiter réorganise votre tableau et relance la journée.`,
      today: (at) => `Pour aujourd'hui${at}. La victoire la plus nette du tableau en ce moment.`,
      waiting: "En attente de quelqu'un d'autre. Une petite relance l'empêche de bloquer la journée.",
      undated: "Pas encore de date d'échéance — une bonne à clôturer tant que la journée est ouverte.",
    },
    sinceDate: (formatted) => ` depuis le ${formatted}`,
    atTime: (formatted) => ` à ${formatted}`,
  },
  briefing: {
    ariaLabel: "Briefing quotidien",
    eyebrow: { morning: "briefing du matin", afternoon: "briefing de l'après-midi", evening: "briefing du soir" },
    greeting: { morning: "Bonjour.", afternoon: "Bon après-midi.", evening: "Bonsoir." },
    meetings: (count) => `${count} ${count === 1 ? "événement" : "événements"} au calendrier`,
    noMeetings: "aucune réunion aujourd'hui",
    bodyOverdue: (overdue, meetings) =>
      `Vous avez ${overdue} ${overdue === 1 ? "élément en retard" : "éléments en retard"} et ${meetings}. Je ${
        overdue === 1 ? "le traiterais d'abord" : "traiterais d'abord le retard"
      } — c'est ce qui retient la journée.`,
    bodyDueToday: (dueToday, meetings) =>
      `${dueToday} ${dueToday === 1 ? "élément est à échéance" : "éléments sont à échéance"} aujourd'hui et ${meetings}. Commencez par ce qui est dû et le tableau garde une longueur d'avance.`,
    bodyWaiting: (waiting, meetings) =>
      `Rien en retard ni pour aujourd'hui, et ${meetings}. ${waiting} ${
        waiting === 1 ? "élément est en attente" : "éléments sont en attente"
      } d'autres personnes — un bon moment pour relancer.`,
    bodySchedule: (meetings) => `Aucun travail en retard ou pour aujourd'hui — juste ${meetings}. Votre file est vide.`,
    bodyAllClear: "Rien en retard, pour aujourd'hui ou en attente, et aucune réunion. Vous êtes à jour.",
    aiTail: (ai) => ` 7F s'occupe de ${ai} ${ai === 1 ? "élément" : "éléments"} à vos côtés.`,
  },
}
