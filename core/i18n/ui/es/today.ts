import type { TodayMessages } from "../types"

/**
 * Spanish source for the `today` UI namespace — chrome + the daily workboard,
 * fully translated (P4.FINESSE-ENES).
 */
export const today: TodayMessages = {
  title: "Hoy",
  empty: {
    title: "Nada para hoy todavía",
    body: "Los nuevos elementos aparecerán aquí a medida que lleguen.",
  },
  chrome: {
    openFull: "Abrir Hoy completo",
    close: "Cerrar Hoy",
  },
  workboard: {
    loadingAria: "Cargando Hoy",
    errorNote: "No se pudo cargar Hoy.",
    toasts: {
      sendToAiFailed: "No se pudo enviar a la IA",
      takeOverFailed: "No se pudo retomar la tarea",
      tryAgain: "Inténtalo de nuevo en un momento.",
    },
    summary: {
      overdue: (count) => (count === 1 ? "1 atrasada" : `${count} atrasadas`),
      dueToday: (count) => (count === 1 ? "1 para hoy" : `${count} para hoy`),
      waiting: (count) => (count > 0 ? `${count} en espera` : "nada en espera"),
      caption: "tu panel de trabajo diario",
    },
    pills: {
      myWork: "Mi trabajo",
      aiWork: "Trabajo IA",
      schedule: "Agenda",
      waiting: "En espera",
    },
    lanes: {
      myWork: {
        title: "Mi trabajo",
        subtitle: "Lo tuyo, lo de tu equipo y lo que aún no pasaste a la IA",
        emptyTitle: "Sin trabajo para ti hoy",
        emptyDescription: "Las tareas que crees o retomes aparecerán aquí.",
      },
      aiWork: {
        title: "Trabajo IA",
        subtitle: "Propuestas de Fanny y lo que delegaste en la IA",
        emptyTitle: "Sin trabajo de IA todavía",
        emptyDescription:
          "El trabajo de IA aparece cuando Fanny propone algo o cuando delegas una tarea con “Enviar a la IA” desde Mi trabajo.",
        emptyActionLabel: "Revisar agentes",
      },
      schedule: {
        title: "Agenda",
        subtitle: "Eventos del calendario anclados a hoy",
        emptyTitle: "Sin eventos hoy",
        emptyDescription: "Los elementos programados aparecerán aquí.",
      },
    },
    sections: {
      overdue: "Atrasadas",
      dueToday: "Para hoy",
      waitingBlocked: "En espera / Bloqueadas",
      noDate: "Sin fecha",
    },
    briefingAria: "Resumen de hoy",
    emptyState: {
      title: "Nada pendiente. Genial.",
      body: "Todo lo que necesite tu atención aparecerá aquí.",
      inboxCta: "O revisa tus mensajes →",
    },
    row: {
      sendToAi: "Enviar a la IA",
      takeOver: "Retomar",
      proposed: "Propuesta",
      proposedByAi: "Propuesta por la IA",
      assignedToMe: "Asignada a mí",
      taskChip: "Tarea",
      fromInbox: "De mensajes",
      fromProject: (name) => `De ${name}`,
      projectFallback: "Proyecto",
      fromCalendar: "Del calendario",
      eventAria: "Evento",
      atTime: (time) => `a las ${time}`,
      priorities: {
        critical: "Urgente",
        high: "Alta",
        low: "Baja",
        normal: "Normal",
      },
      due: {
        todayAt: (time) => `Hoy ${time}`,
        yesterday: "Ayer",
        tomorrow: "Mañana",
        daysAgo: (days) => `hace ${days} d`,
      },
      a11y: {
        task: "Tarea",
        priorityPrefix: "prioridad",
        duePrefix: "vence",
        noDueDate: "sin fecha límite",
        inMyLane: "en mi carril",
        inAiLane: "en el carril de la IA",
        fromInbox: "de mensajes",
        fromProject: (name) => `del proyecto ${name}`,
        manualTask: "tarea manual",
      },
    },
  },
}
