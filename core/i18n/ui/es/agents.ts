import type { AgentsMessages } from "../types"

/**
 * Spanish source for the `agents` UI namespace (quick view + full page).
 * Agent proper names (Francis, Fanny, …) are never translated (see AGENTS.md);
 * activity item titles come from the API as content and stay verbatim.
 */
export const agents: AgentsMessages = {
  subtitle: "Qué están haciendo tus agentes de IA · todo el workspace",
  openFull: "Abrir Agentes completo",
  closePanel: "Cerrar el panel de Agentes",
  closeDrawer: "Cerrar Agentes",
  loadingAria: "Cargando la actividad de los agentes",
  loadErrorNote: "No se pudo cargar la actividad de los agentes.",
  empty: {
    title: "Aún no hay actividad de agentes",
    body: "Cuando Fanny automatice trabajo, proponga una tarea o ejecute una acción, aparecerá aquí — agrupado por lo que requiere revisión, lo que se automatizó y lo que necesita tu atención.",
  },
  lanes: {
    needsReview: { title: "Requiere tu revisión", empty: "No hay propuestas en espera." },
    automated: { title: "Gestionado recientemente", empty: "Aún no se ha gestionado nada." },
    attention: { title: "Atención", empty: "Nada necesita atención." },
  },
  moreOnFullPage: (count) => `+${count} más en la página completa de Agentes`,
  fromInbox: "De mensajes",
  states: {
    working: "Trabajando",
    waiting: "A la espera de ti",
    idle: "Inactivo",
    comingOnline: "Activándose",
  },
  autonomyLabels: { auto: "Auto", suggests: "Sugiere" },
  time: {
    now: "ahora",
    minutesAgo: (n) => `hace ${n} min`,
    hoursAgo: (n) => `hace ${n} h`,
  },
  page: {
    live: "En vivo",
    loadingAria: "Cargando Agentes",
    loadError: "No se pudieron cargar los Agentes.",
    summary: {
      agentsCount: (n) => `${n} agentes`,
      workingNow: (n) => `${n} trabajando ahora`,
      awaitingYou: (n) => `${n} esperándote`,
    },
    kpis: {
      workingNow: "Trabajando ahora",
      needsReview: "Requiere revisión",
      automatedToday: "Automatizado hoy",
      attention: "Atención",
    },
    hero: {
      leadRoleSuffix: "CEO",
      leadsTeam: "Lidera el equipo",
      briefingWorking: "Fanny está en tu bandeja",
      briefingCalm: "tu bandeja está tranquila",
      needsProposals: (n) => (n === 1 ? "1 propuesta en espera" : `${n} propuestas en espera`),
      needsAttention: (n) => (n === 1 ? "1 requiere atención" : `${n} requieren atención`),
      needsJoiner: "y",
      briefingWithNeeds: (opening, needs) =>
        `Ahora mismo: ${opening} — ${needs} para ti. El resto de tu equipo se está activando.`,
      briefingNoNeeds: (opening) =>
        `Ahora mismo: ${opening} — no hay nada esperándote. El resto de tu equipo se está activando.`,
      reviewProposals: (n) => (n === 1 ? "Revisar 1 propuesta" : `Revisar ${n} propuestas`),
      noProposals: "No hay propuestas que revisar",
      adjustAutonomy: "Ajustar autonomía",
      adjustAutonomyTitle: "Los ajustes de autonomía llegarán pronto",
    },
    roster: {
      heading: "Tus agentes · en vivo",
      defaultTagline: "6 especialistas + Francis",
      review: "Revisar →",
      handledToday: (n) => (n === 1 ? "1 hecho hoy" : `${n} hechos hoy`),
      watching: "Vigilando",
      comingOnline: "Activándose",
      upToDate: "Al día — atento a nuevo trabajo.",
      readyInRegistry: "Listo en tu registro — activándose.",
      openDetailsSuffix: "Abrir detalles",
    },
    liveActivity: {
      title: "Actividad en vivo",
      executedToday: (n) => `Ejecutado hoy · ${n}`,
      empty: "Todavía no se ha ejecutado ninguna acción hoy.",
    },
    rail: {
      needsReview: "Requiere tu revisión",
      attention: "Atención",
      needsReviewEmpty: "No hay propuestas esperándote.",
      attentionEmpty: "Nada necesita tu atención.",
      proposes: "propone",
      approve: "Aprobar",
      dismiss: "Descartar",
      approveTitle: "Aprobar y descartar desde Agentes llegará pronto",
      viewContext: "Ver contexto",
      view: "Ver",
    },
    autonomy: {
      title: "Autonomía",
      auto: "Auto",
      suggests: "Sugiere",
      approval: "Aprobación",
      autoText: "Ejecuta por su cuenta el trabajo de bajo riesgo",
      suggestsText: "Propone y espera tu visto bueno",
      approvalText: "Nunca actúa sin tu aprobación",
    },
  },
  detail: {
    doingNow: "Haciendo ahora",
    today: "Hoy",
    todayEmpty: "Todavía no hay actividad hoy.",
    worksWithTeam: "Trabaja con el equipo",
    watching: "Vigilando",
    recentlyHandled: "Gestionado recientemente",
    openInPrefix: "Abrir en",
    sectionComingOnline: "Sección activándose",
    sectionComingOnlineTitle: "La sección de este agente se está activando",
    close: "Cerrar",
    closeDetailsAria: "Cerrar los detalles del agente",
    detailsAria: (name) => `Detalles de ${name}`,
  },
  roster: {
    francis: {
      role: "CEO · Operaciones y coordinación",
      watching: [
        "Toda la operación",
        "Equipo, roles y capacidad",
        "Lo que necesita tu decisión",
        "Bloqueos y prioridades",
        "Salud del negocio",
      ],
      collaborationNote:
        "Francis dirige al equipo — deriva el trabajo al agente adecuado, coordina a las personas y saca a la luz solo lo que te necesita.",
    },
    forte: {
      role: "Arquitectura · Módulos · Lab",
      watching: ["Módulos que faltan", "Encaje vertical", "Patrones reutilizables", "Lógica de backend y producto"],
      collaborationNote:
        "Mr. Forte construye los sistemas que Freya viste visualmente y Fiona usa comercialmente; escucha las tendencias de Fathom.",
    },
    fanny: {
      role: "Conversaciones · Bandeja",
      watching: ["Respuestas de clientes sin leer", "Conversaciones en espera", "Seguimientos de hoy", "Mensajes urgentes"],
      collaborationNote:
        "Cuando un mensaje pide una factura, Fanny se la pasa a Felix; los contactos nuevos se sincronizan con Fiona.",
    },
    freya: {
      role: "Estudio creativo · Visual",
      watching: ["Contenido y recursos visuales", "Diseño e interfaces", "Piezas creativas para crecimiento y módulos"],
      collaborationNote:
        "Freya produce los visuales que Fiona necesita para crecer y las interfaces que visten los módulos de Mr. Forte.",
    },
    fiona: {
      role: "Crecimiento 7F · Marketing",
      watching: [
        "Campañas y embudos",
        "CRM y relaciones",
        "Audiencias y segmentación",
        "Visibilidad SEO / AEO",
        "Oportunidades de reactivación",
      ],
      collaborationNote:
        "Fiona convierte los contactos nuevos de Fanny y los visuales de Freya en campañas, reactivaciones y crecimiento.",
    },
    felix: {
      role: "Finanzas · Facturas",
      watching: ["Facturas sin pagar", "Anticipos", "Pagos vencidos", "Riesgo financiero"],
      collaborationNote: "Felix prepara las facturas a partir de las solicitudes que le pasa Fanny.",
    },
    fathom: {
      role: "Investigación · Tendencias verticales",
      watching: ["Tendencias del mercado", "Oportunidades verticales", "Señales de competencia y producto"],
      collaborationNote:
        "Fathom lleva tendencias verticales a Mr. Forte, señales SEO/AEO y de mercado a Fiona, y ángulos de contenido a Freya.",
    },
    finesse: {
      role: "Especialista Beauty",
      watching: ["El día del negocio", "Qué necesita tu atención", "Coordinación con el equipo"],
      collaborationNote:
        "Lidera la experiencia de 7F Beauty: interpreta el contexto del negocio, coordina el día y presenta las acciones. Trabaja sobre los agentes core (Fanny, Freya, Fiona, Felix, Mr. Forte, Fathom) sin reemplazarlos.",
    },
  },
}
