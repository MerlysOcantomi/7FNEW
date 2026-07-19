import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import type { BeautyOverviewMessages } from "./types"

/** Spanish catalog for the Finesse "Mi salón" overview. */
export const es = {
  locale: "es",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Vista previa · datos de ejemplo",
    tooltip: "Datos de ejemplo mientras conectamos tus citas, cobros y clientes reales.",
  },
  header: {
    title: "Mi salón",
    description:
      "Así va tu salón este periodo: lo que ganaste, los servicios que más gustaron y quién vuelve a reservar.",
    exportLabel: "Exportar",
    periodLabels: {
      week: "Semana",
      month: "Mes",
      quarter: "Trimestre",
      year: "Año",
    },
  },
  exportCsv: {
    filenamePrefix: "mi-salon",
    columns: {
      service: "Servicio",
      visits: "Visitas",
      revenue: "Ingresos",
      visitShare: "% visitas",
    },
  },
  periodCard: {
    eyebrow: "Periodo",
    noComparisonNote: "Primer periodo · sin comparativa",
  },
  brief: {
    agentName: BEAUTY_SPECIALIST_AGENT.name,
    tagline: "beauty intelligence",
    earningsUp: (pct, topService) =>
      `Buen periodo — ganaste un ${pct} más${topService ? `, sobre todo gracias a ${topService.toLowerCase()}` : ""}.`,
    earningsDown: (pct) => `Un periodo más tranquilo — ganaste un ${pct} menos que el anterior.`,
    earningsFlat: "Un periodo estable — tus ingresos se mantienen.",
    topServiceOnly: (service) => `Tus clientes están pidiendo sobre todo ${service.toLowerCase()}.`,
    peakNearlyFull: "Tus días punta están casi completos.",
    returningRate: (pct) => `Y el ${pct} de tus clientes volvió a reservar.`,
  },
  kpis: {
    earnings: "Ingresos",
    visits: "Visitas",
    newClients: "Clientes nuevos",
    returningRate: "Volvieron a reservar",
    comparisonSuffix: {
      week: "que la semana pasada",
      month: "que el mes pasado",
      quarter: "que el trimestre anterior",
      year: "que el año pasado",
    },
    noComparison: "Sin comparativa aún",
    noData: "Sin datos todavía",
    sparkAria: "Evolución reciente",
    srTones: { more: "más", less: "menos", same: "igual" },
  },
  revenue: {
    title: "Lo que ganaste",
    subtitle: {
      day: "Día a día",
      week: "Semana a semana",
      month: "Mes a mes",
    },
    moreSuffix: "más que el periodo anterior",
    lessSuffix: "menos que el periodo anterior",
    sameNote: "Igual que el periodo anterior",
    empty: {
      title: "Aún no hay ingresos registrados.",
      description: "Cuando registres cobros, verás aquí su evolución.",
    },
    weekPrefix: "Sem.",
  },
  drivers: {
    titleUp: "Por qué ganaste más",
    titleDown: "Por qué ganaste menos",
    subtitle: "Finesse analizó qué cambió",
    sourceLabels: {
      services: "Tus servicios estrella se pidieron más",
      bookings: "Hubo menos reservas que el periodo anterior",
      "new-clients": "Clientes nuevos te encontraron por {detail}",
      rebooking: "Más clientes repitieron cita",
      cancellations: "Hubo más cancelaciones de última hora",
      "walk-ins": "Menos visitas sin cita",
      campaign: "Tu campaña atrajo reservas",
      schedule: "Ampliaste tu horario",
      weather: "El tiempo influyó en las visitas sin cita",
    },
    confidenceLabels: {
      confirmed: "Dato confirmado",
      correlation: "Según datos de reserva",
      inference: "Posible influencia",
    },
    detailFallback: "redes sociales",
    empty: "Sin cambios que explicar este periodo.",
  },
  lookingAhead: {
    lead: "Mirando adelante:",
    texts: {
      "quiet-period":
        "Se acerca una época más tranquila — muchos clientes viajan. Una pequeña promo ahora puede mantener tu agenda llena.",
      "peak-nearly-full":
        "Tus días punta están casi completos. Un par de huecos extra por la tarde te dejarían atender a más clientes.",
      "service-growing": "Un servicio está creciendo con fuerza. Puede ser buen momento para destacarlo.",
      "rebooking-falling": "Las re-reservas están bajando un poco. Un recordatorio amable puede ayudar.",
    },
    actions: {
      "quiet-period": "Crear campaña",
      "peak-nearly-full": "Revisar agenda",
      "service-growing": "Ver servicios",
      "rebooking-falling": "Contactar clientes",
    },
  },
  services: {
    title: "Lo que más aman tus clientes",
    hintPrefix: "De",
    hintSuffix: "visitas este periodo",
    empty: {
      title: "Aún no hay datos de servicios.",
      description: "Cuando registres citas con servicios, verás aquí los favoritos.",
    },
    archivedLabel: "Archivado",
  },
  demand: {
    title: "Tus días más ocupados",
    hint: "visitas por día",
    weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    weekdaysLong: [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábados",
      "domingos",
    ],
    peakLead: "Tus horas punta:",
    peakJoiner: " y ",
    empty: "Aún no hay suficientes citas para ver un patrón.",
    actionLabel: "Ver agenda",
  },
  clientMix: {
    title: "Clientes nuevos y habituales",
    returning: "Habituales",
    newLabel: "Nuevos",
    centerLabel: "clientes",
    empty: "Aún no hay clientes registrados este periodo.",
  },
  topClients: {
    title: "Tus clientes más fieles",
    hint: "quienes más te visitan",
    visitsSuffix: "visitas",
    vipLabel: "VIP",
    empty: "Cuando tengas visitas registradas verás aquí a tus clientes más habituales.",
    restrictedSpend: "—",
  },
  sources: {
    title: "Cómo te encuentran",
    labels: {
      instagram: "Instagram",
      whatsapp: "WhatsApp",
      google: "Google",
      website: "Tu web",
      direct: "Reserva directa",
      "walk-in": "Sin cita",
      referral: "Recomendación",
      phone: "Teléfono",
      unknown: "Sin identificar",
    },
    empty: "Aún no hay datos de origen de reservas.",
  },
  recommendations: {
    title: "Ideas de Finesse",
    agentLabels: {
      fiona: "Fiona",
      felix: "Felix",
      fanny: "Fanny",
      finesse: "Finesse",
    },
    actionLabels: {
      reactivation: "Crear campaña de reactivación",
      "pending-payments": "Revisar cobros",
      availability: "Revisar agenda",
      "quiet-period": "Crear campaña",
    },
    texts: {
      reactivation: (count) =>
        `${count} clientes llevan tiempo sin venir — una nota de "te echamos de menos" puede hacer que vuelvan.`,
      pendingPayments: (amount) =>
        `Aún tienes ${amount} por cobrar de visitas ya completadas.`,
      availability: (percent) =>
        `Tus días punta están al ${percent}% — un par de huecos extra por la tarde te dejarían atender a más clientes.`,
      quietPeriod:
        "Se acerca una época más tranquila. Una campaña sencilla ahora puede mantener tu agenda llena.",
    },
    emptyPositive: "Todo en orden — nada pendiente que Finesse quiera destacar hoy. ✨",
  },
  salonProfile: {
    title: "Perfil del salón",
    regionLabel: "Zona",
    hoursLabel: "Horario",
    servicesLabel: "Servicios activos",
    completeness: (pct) => `Perfil completo al ${pct}`,
    editCta: "Editar perfil",
    empty: "Tu perfil del salón está vacío. Complétalo para que tus clientes y Finesse conozcan tu negocio.",
  },
  todayOps: {
    title: "Hoy en el salón",
    appointmentsTitle: "Citas de hoy",
    appointmentsEmpty: "No hay citas programadas para hoy.",
    pendingConversations: (count) =>
      count === 1 ? "1 mensaje sin responder" : `${count} mensajes sin responder`,
    priorityTasks: (count) =>
      count === 1 ? "1 tarea prioritaria para hoy" : `${count} tareas prioritarias para hoy`,
    activeClients: (count) => (count === 1 ? "1 cliente activo" : `${count} clientes activos`),
    pendingInvoices: (count, amount) =>
      count === 1 ? `1 factura pendiente de cobro (${amount})` : `${count} facturas pendientes de cobro (${amount})`,
    overdueInvoices: (count, amount) =>
      count === 1 ? `1 factura vencida (${amount})` : `${count} facturas vencidas (${amount})`,
    openInbox: "Abrir inbox",
    openToday: "Ver tareas",
    openBilling: "Ver cobros",
    openAgenda: "Abrir agenda",
  },
  states: {
    loading: "Cargando Mi salón",
    error: {
      title: "No hemos podido cargar Mi salón.",
      description: "Vuelve a intentarlo en unos segundos.",
      retry: "Reintentar",
    },
    emptyPage: {
      title: "Tu salón está listo para empezar.",
      description:
        "Cuando tengas citas, cobros y clientes registrados, Finesse te mostrará aquí cómo va tu negocio y qué puedes mejorar.",
      cta: "Ver mi agenda",
    },
    sectionNoData: "Sin datos en este periodo.",
    noFinance: "Los datos de ingresos no están disponibles.",
  },
  demo: {
    serviceNames: {
      cutStyle: "Corte y peinado",
      fullColor: "Color completo",
      balayage: "Mechas y balayage",
      treatment: "Tratamiento y brillo",
      eventStyle: "Peinado de evento",
    },
  },
} satisfies BeautyOverviewMessages
