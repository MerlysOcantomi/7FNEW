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
  quick: {
    subtitle: "Resumen diario · todo el workspace",
    needsCount: (count) =>
      count === 1 ? "1 asunto te necesita hoy" : `${count} asuntos te necesitan hoy`,
    moreInToday: (count) => `+${count} más en Hoy`,
    aiChip: "IA",
    sources: { inbox: "Mensajes", calendar: "Calendario", task: "Tarea" },
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
  startHere: {
    eyebrow: "Empieza aquí · ahora",
    ariaLabel: "Empieza aquí",
    allClearTitle: "Estás al día",
    allClearBody:
      "Ahora mismo no hay nada que te necesite. El trabajo nuevo y las propuestas de la IA aparecerán aquí a medida que avance el día.",
    openTask: "Abrir tarea",
    sendToAI: "Enviar a la IA",
    badges: { overdue: "Atrasada", today: "Para hoy", waiting: "En espera", undated: "Sin fecha" },
    source: {
      inbox: "De mensajes · asignada a ti",
      projectFallback: "De un proyecto",
      fromProject: (name) => `De ${name}`,
      manual: "Tarea",
      calendar: "Del calendario",
    },
    why: {
      overdue: (since) => `Atrasada${since} — resolverla reordena tu panel y pone el día en marcha.`,
      today: (at) => `Para hoy${at}. Ahora mismo es la victoria más clara del panel.`,
      waiting: "A la espera de otra persona. Un recordatorio rápido evita que frene el día.",
      undated: "Todavía sin fecha límite — una buena para cerrar mientras el día está despejado.",
    },
    sinceDate: (formatted) => ` desde el ${formatted}`,
    atTime: (formatted) => ` a las ${formatted}`,
  },
  briefing: {
    ariaLabel: "Resumen diario",
    eyebrow: {
      morning: "resumen de la mañana",
      afternoon: "resumen de la tarde",
      evening: "resumen de la noche",
    },
    greeting: { morning: "Buenos días.", afternoon: "Buenas tardes.", evening: "Buenas noches." },
    meetings: (count) => `${count} ${count === 1 ? "evento" : "eventos"} en el calendario`,
    noMeetings: "ninguna reunión hoy",
    bodyOverdue: (overdue, meetings) =>
      `Tienes ${overdue} ${overdue === 1 ? "elemento atrasado" : "elementos atrasados"} y ${meetings}. Yo ${
        overdue === 1 ? "lo resolvería primero" : "resolvería primero lo atrasado"
      } — es lo que arrastra el día.`,
    bodyDueToday: (dueToday, meetings) =>
      `${dueToday} ${dueToday === 1 ? "elemento vence" : "elementos vencen"} hoy y ${meetings}. Empieza por lo que vence y el panel se mantiene al día.`,
    bodyWaiting: (waiting, meetings) =>
      `Nada atrasado ni para hoy, y ${meetings}. ${waiting} ${
        waiting === 1 ? "elemento está" : "elementos están"
      } a la espera de otros — un buen momento para hacer seguimiento.`,
    bodySchedule: (meetings) => `Sin trabajo atrasado ni para hoy — solo ${meetings}. Tu cola está despejada.`,
    bodyAllClear: "Nada atrasado, para hoy ni en espera, y ninguna reunión. Estás al día.",
    aiTail: (ai) => ` 7F está con ${ai} ${ai === 1 ? "elemento" : "elementos"} junto a ti.`,
  },
}
