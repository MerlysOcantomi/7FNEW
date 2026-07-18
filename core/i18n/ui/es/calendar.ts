import type { CalendarMessages } from "../types"

/**
 * Spanish source for the `calendar` UI namespace — the full /calendario
 * surface, fully translated (tú form). "Agenda" is the surface's own name;
 * `timeIntelligence` stays as product branding on purpose.
 */
export const calendar: CalendarMessages = {
  title: "Agenda",
  timeIntelligence: "Time Intelligence",
  today: "Hoy",
  views: { day: "Día", week: "Semana", month: "Mes" },
  subtitles: {
    day: "Tu día, hora a hora",
    week: "Tu semana, día a día",
    month: "Tu mes de un vistazo",
  },
  nav: {
    openNavigatorAria: "Abrir el navegador",
    navigatorTitle: "Navegador de la agenda",
    previousAria: "Anterior",
    nextAria: "Siguiente",
  },
  ledger: {
    scope: "Ámbito",
    scheduled: "Programado",
    timeRisks: (count) => (count === 1 ? "Riesgo de tiempo" : "Riesgos de tiempo"),
    thisMonth: "Este mes",
    weekScope: (week) => `Semana ${week}`,
    thisDay: "Este día",
  },
  lenses: {
    heading: "Lentes",
    comingSoon: "Próximamente",
    notTracked: "Aún sin datos",
    clearAria: "Quitar la lente",
    shown: (count) => (count === 1 ? "1 visible" : `${count} visibles`),
    labels: {
      thisDay: "Este día",
      nextDays: "Próximos días",
      planningHorizon: "Horizonte de planificación",
      timeConflicts: "Conflictos de horario",
      pastEvents: "Eventos pasados",
      campaignCycles: "Ciclos de campaña",
      followUpMoments: "Momentos de seguimiento",
      prepWindows: "Ventanas de preparación",
    },
  },
  panel: {
    emptyTitle: "Selecciona un evento",
    emptyBody: "Mira su momento, su contexto y la siguiente acción — sin salir de la agenda.",
    openTimeHint: "Tiempo libre — un bloque limpio para planificar con calma.",
    dayCountHint: (count) =>
      count === 1
        ? "1 programado — selecciónalo para revisar su momento."
        : `${count} programados — elige uno para revisar su momento.`,
    lensHint: (label, count) =>
      count === 1 ? `Lente: ${label} · 1 visible` : `Lente: ${label} · ${count} visibles`,
    analyzing: "Analizando…",
    timingInsight: "Análisis de tiempo",
    aiError: "No se pudo cargar el análisis de tiempo.",
    clearSelectionAria: "Quitar la selección",
    showDetails: "Mostrar detalles",
  },
  dna: {
    client: "Cliente",
    project: "Proyecto",
    amount: "Importe",
    context: "Contexto",
    when: "Cuándo",
    allDay: "Todo el día",
    meaning: {
      today: "Hoy",
      tomorrow: "Mañana",
      yesterday: "Ayer",
      inDays: (days) => `En ${days} días`,
      agoDays: (days) => `Hace ${days} días`,
      inWeeks: (weeks) => (weeks === 1 ? "En 1 semana" : `En ${weeks} semanas`),
      agoWeeks: (weeks) => (weeks === 1 ? "Hace 1 semana" : `Hace ${weeks} semanas`),
    },
    risks: {
      overdue: "Atrasado",
      daysPastDue: (days) => (days === 1 ? "1 día de retraso" : `${days} días de retraso`),
      conflict: "Conflicto de horario",
      overlaps: "Se solapa con otro evento",
      happeningToday: "Sucede hoy",
      dueToday: "Vence hoy",
      onTrack: "Al día",
    },
    cta: {
      goToDate: "Ir a la fecha",
      viewConflict: "Ver el conflicto",
      openInToday: "Abrir en Hoy",
      openInTasks: "Abrir en Tareas",
      openInFinance: "Abrir en Finanzas",
    },
  },
  dayView: {
    emptyTitle: "Sin eventos este día",
    emptyBody: "Tu día está libre — un bloque limpio de tiempo para planificar con calma.",
    viewWeek: "Ver la semana",
    openTasks: "Abrir Tareas",
    allDayDeadlines: "Todo el día · vencimientos",
  },
  weekView: { empty: "Sin eventos" },
  monthView: { plusMore: (count) => `+${count} más` },
  miniMonth: { wk: "Sem", prevMonthAria: "Mes anterior", nextMonthAria: "Mes siguiente" },
  panelModes: {
    heading: "Disposición del panel",
    ariaLabel: (label) => `Disposición del panel: ${label}`,
    labels: {
      docked: "Anclado",
      compact: "Compacto",
      overlay: "Superpuesto",
      expanded: "Ampliado",
      collapsed: "Oculto",
    },
    titles: {
      docked: "Anclado — todo el contexto junto a tu agenda.",
      compact: "Compacto — lo esencial en una columna estrecha.",
      overlay: "Superpuesto — el contexto flota sobre la agenda.",
      expanded: "Ampliado — atención plena a este momento.",
      collapsed: "Oculto — esconde el panel y maximiza la agenda.",
    },
  },
  types: { tarea: "Tarea", proyecto: "Proyecto", factura: "Factura", evento: "Evento" },
  eventTypes: {
    reunion: "Reunión",
    entrega: "Entrega",
    llamada: "Llamada",
    cita: "Cita",
    evento: "Evento",
  },
  invoiceTitle: (numero) => `Factura ${numero}`,
}
