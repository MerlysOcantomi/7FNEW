import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import { BEAUTY_SERVICE_CATALOG_SEED } from "@core/vertical-packs/beauty"
import type { BeautyTodayMessages } from "./types"

/** Spanish catalog for the Finesse "Hoy" (Beauty Today). */
export const es = {
  locale: "es",
  brandTitle: "7F Beauty",
  eyebrow: BEAUTY_SPECIALIST_AGENT.voice.intelligence,
  brandLine: BEAUTY_SPECIALIST_AGENT.tagline,
  previewChip: "Vista previa · datos de ejemplo",
  previewTooltip: "Datos de ejemplo mientras conectamos las citas reales.",
  statusLabels: {
    confirmed: "Confirmada",
    pending: "Pendiente de confirmar",
    arrived: "Ha llegado",
    no_show: "No asistió",
    cancelled: "Cancelada",
  },
  ui: {
    railTitle: "Flujo de Finesse",
    pills: { appointments: "Citas", unconfirmed: "Sin confirmar", openGaps: "Huecos", booked: "Ingresos" },
    now: "Ahora",
    openGap: "Libre",
    nothingHere: "Nada por aquí.",
    groups: {
      unconfirmed: "Sin confirmar",
      openGaps: "Huecos libres",
      followUps: "Seguimientos",
      messages: "Mensajes pendientes",
      care: "Clientes a cuidar",
      content: "Idea de contenido",
    },
    actions: { remind: "Enviar recordatorio", waitlist: "Ofrecer hueco", message: "Preparar mensaje" },
  },
  studio: {
    headerTitle: (studio) => `Hoy en ${studio}`,
    bySevenef: "· by Sevenef",
    intro: "Finesse tiene lista tu agenda, tus decisiones y una oportunidad visual para hoy.",
    signals: {
      appointments: (count) => (count === 1 ? "1 cita" : `${count} citas`),
      openGaps: (count) => (count === 1 ? "1 hueco libre" : `${count} huecos libres`),
      bookedValue: (amount) => `${amount} previstos`,
    },
    agendaTitle: "Agenda de hoy",
    agendaHint: (appointments, gaps) => `${appointments} citas · ${gaps} huecos`,
    upToDate: "al día",
    gapRow: {
      title: (start, end) => `Hueco libre · ${start} – ${end}`,
      note: "Finesse puede ofrecerlo a tus clientes frecuentes",
    },
    decisionsTitle: "Necesita tu decisión",
    later: "Después",
    careCountHint: (count) => `${count} hoy`,
    momentoTitle: "Momento Beauty",
    momentoHint: "idea visual de hoy",
    uploadPhoto: "Sube la foto de hoy",
    disabledHints: {
      connectAppointments: "Disponible al conectar las citas reales",
      connectAssistant: "Disponible al conectar el asistente",
      connectMarketing: "Disponible al conectar Marketing",
    },
  },
  real: {
    signals: {
      appointments: (count) => (count === 1 ? "1 cita" : `${count} citas`),
      remaining: (count) => (count === 1 ? "1 por delante" : `${count} por delante`),
      gaps: (count) => (count === 1 ? "1 hueco libre" : `${count} huecos libres`),
    },
    nextTitle: "Próxima cita",
    nextNone: "No quedan más citas hoy.",
    phaseCurrent: "En curso",
    agendaEmpty: "No hay citas programadas para hoy.",
    openCalendar: "Abrir agenda",
    openClient: "Ver cliente",
    gapRow: {
      title: (start, end) => `Hueco libre · ${start} – ${end}`,
      minutes: (minutes) => `${minutes} min`,
    },
    urgentTitle: "Para hoy",
    suggestedTitle: "Finesse sugiere",
    basisPrefix: "Basado en:",
    proposedLabel: "Propuesta",
    waitingLabel: "En espera",
    overdueLabel: "Atrasada",
    dueAtLabel: (time) => `Para las ${time}`,
    open: "Abrir",
    messagesRow: (count) =>
      count === 1 ? "1 mensaje sin responder" : `${count} mensajes sin responder`,
    openInbox: "Abrir inbox",
    overdueInvoicesRow: (count, amount) =>
      count === 1 ? `1 factura vencida (${amount})` : `${count} facturas vencidas (${amount})`,
    pendingInvoicesRow: (count, amount) =>
      count === 1
        ? `1 factura pendiente de cobro (${amount})`
        : `${count} facturas pendientes de cobro (${amount})`,
    openBilling: "Ver cobros",
    otherTasksRow: (count) =>
      count === 1 ? "1 tarea más en tu tablero" : `${count} tareas más en tu tablero`,
    openWorkboard: "Abrir el tablero de trabajo",
    allClear: "Todo en orden — nada urgente ahora mismo. ✨",
    emptyDay: {
      title: "Tu día está libre",
      description:
        "Todavía no hay citas, tareas ni mensajes pendientes. La agenda es el lugar para añadir la primera reserva.",
      cta: "Abrir agenda",
    },
    error: {
      title: "No pudimos cargar tu día",
      description: "Algo falló al cargar los datos de hoy.",
      retry: "Reintentar",
    },
    loading: "Cargando tu día…",
  },
  demo: {
    assistantNote:
      "Vas bien de día. Antes de la tarde, protege el color VIP de las 16:30 y ofrece el hueco libre a un cliente frecuente.",
    decisions: [
      {
        id: "d1",
        agent: "Francis",
        kind: "fidelidad VIP",
        title: "Ofrecer fidelidad 15 % a Camila antes de su color VIP",
        why: "Cliente VIP · 22 visitas. La mantiene reservando cada mes.",
        primary: "Confirmar",
      },
      {
        id: "d2",
        agent: "Fiona",
        kind: "campaña",
        title: "Aprobar la campaña de verano para clientes inactivos",
        why: "14 clientes sin reservar · Freya ya preparó las imágenes.",
        primary: "Aprobar",
      },
    ],
    care: [
      { name: "Camila Ruiz", ini: "CR", tag: "VIP", tone: "vip", note: "Color hoy 16:30 · 22 visitas", action: "Fidelidad" },
      { name: "Daniela Prats", ini: "DP", tag: "Inactiva", tone: "warn", note: "Sin reservar hace 3 meses", action: "Reactivar" },
      { name: "Valentina Mora", ini: "VM", tag: "Nueva", tone: "new", note: "1ª visita · dejó 5★", action: "Bienvenida" },
    ],
    momento: {
      channel: "Instagram · antes/después",
      title: "El Rose Nude Chrome de María quedó para enseñar.",
      note: "Finesse vio un trabajo perfecto para publicar hoy. Freya ya preparó un pie de foto.",
      primary: "Preparar publicación",
      secondary: "Otra idea",
      link: "Subir más fotos · ver todo en Marketing",
    },
    services: [
      "Manicura semipermanente",
      "Retirada de esmalte",
      "Nail art",
      "Limpieza facial",
      "Depilación de cejas",
      "Lifting de pestañas",
      "Pedicura",
      "Relleno de uñas",
    ],
  },
  extras: {
    recentClients: ["Marina Velasco", "Nora Díaz", "Sofía Cano", "Laura Méndez"],
    featuredServices: BEAUTY_SERVICE_CATALOG_SEED.slice(0, 4).map((s) => s.name),
    recommendedActions: [
      { title: "Confirmar 2 citas de hoy", meta: "Marina (10:00) · Carla (12:30)" },
      { title: "Llenar el hueco de las 13:30", meta: "Ofrécelo a clientes frecuentes" },
      { title: "Publicar la foto de ayer", meta: "Nail art · rojo intenso" },
    ],
    pendingMessages: [
      { name: "Claudia", text: "¿Tienes hueco el viernes por la tarde?" },
      { name: "Ana", text: "¿Puedo cambiar mi cita a las 17:00?" },
    ],
    clientsToCare: [
      { name: "Elena Soto", meta: "No viene hace 6 semanas · rebooking" },
      { name: "Paula Gil", meta: "Cumpleaños esta semana 🎂" },
    ],
    postIdea: {
      title: "Antes/después de manicura semipermanente",
      meta: "Freya puede preparar el post · tú apruebas",
    },
  },
} satisfies BeautyTodayMessages
