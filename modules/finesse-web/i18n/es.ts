import type { FinesseLandingMessages } from "./types"

/** Spanish (España) — first market, complete. */
export const es: FinesseLandingMessages = {
  locale: "es",
  meta: {
    title: "Finesse — Software para profesionales y pequeños negocios de belleza",
    description:
      "Finesse reúne tu agenda, tus clientes, tus mensajes y la presencia de tu negocio de belleza en una sola app pensada para tu día a día.",
    ogTitle: "Finesse — Tu negocio de belleza, organizado en un solo lugar",
    ogDescription:
      "Agenda, clientes, mensajes y presencia para peluquerías, uñas, estética, barberías y profesionales independientes.",
  },
  brand: "Finesse",
  nav: {
    features: "Funciones",
    forWho: "Para quién",
    cta: "Entrar en Finesse",
    skipToContent: "Ir al contenido",
    menuLabel: "Navegación principal",
  },
  hero: {
    title: "Tu negocio de belleza, organizado en un solo lugar.",
    subtitle:
      "Agenda, clientes, mensajes y la presencia de tu negocio, en una sola app pensada para tu día a día. Sin sentir que llevas otro trabajo de oficina.",
    cta: "Entrar en Finesse",
    secondary: "Ver cómo funciona",
    previewCaption: "Así se ve tu día en Finesse.",
  },
  day: {
    eyebrow: "Tu día",
    title: "Sabe qué viene ahora y qué necesita tu atención.",
    description:
      "Al abrir Finesse ves lo importante de hoy, sin buscar entre menús: la siguiente persona, lo que debes preparar y lo que no puede esperar.",
    items: [
      {
        title: "Siguiente cliente",
        description: "Hora, servicio y las notas que necesitas para prepararte, con un toque para llamar o ver su ficha.",
      },
      {
        title: "Lo que necesita atención",
        description: "Solo lo relevante: una cita por confirmar, un mensaje sin responder, un cobro pendiente.",
      },
      {
        title: "Mi inspiración",
        description: "Tus trabajos a mano para recordar ideas y enseñarlos durante una cita.",
      },
    ],
  },
  agenda: {
    eyebrow: "Tu agenda",
    title: "Tus citas y tu día, en un mismo lugar.",
    description:
      "Citas, servicios y quién viene después, ordenados como transcurre tu jornada. Abre la agenda completa cuando la necesites.",
    points: ["Citas con servicio y cliente", "Siguiente cliente siempre visible", "Acceso sencillo a toda la agenda"],
  },
  messages: {
    eyebrow: "Tus mensajes",
    title: "Los mensajes de tus clientes, con contexto.",
    description:
      "Cada conversación llega con lo que necesitas para responder: quién escribe, sobre qué y qué hacer a continuación. Tus conversaciones, incluido el email, en un mismo lugar.",
    points: ["Sabes de qué trata cada mensaje", "Respuestas preparadas que tú revisas y envías", "Sin cambiar de app para ver la cita"],
    previewLabel: "Vista previa · los canales disponibles dependen de tu configuración",
  },
  presence: {
    eyebrow: "Tu presencia",
    title: "Completa la información de tu negocio una vez y úsala para construir tu presencia.",
    description:
      "Nombre, servicios, horarios, ubicación y contacto: la base de tu presencia online, lista para crecer con tu negocio.",
    points: ["Tu negocio y tus servicios", "Imágenes de tus trabajos", "Ubicación y contacto"],
  },
  forWho: {
    eyebrow: "Para quién",
    title: "Hecho para quien trabaja con las manos y con personas.",
    description: "Finesse está pensado para profesionales independientes y pequeños salones, no para grandes cadenas.",
    audiences: ["Peluquería", "Uñas y manicura", "Estética", "Barbería", "Profesionales independientes", "Pequeños salones"],
  },
  why: {
    title: "Tu negocio no debería sentirse como otro trabajo administrativo.",
    description:
      "Finesse reúne agenda, clientes, mensajes, presencia y tu trabajo diario en una sola app, para que dediques tu tiempo a lo que haces mejor.",
    pillars: ["Agenda", "Clientes", "Mensajes", "Presencia", "Trabajo diario"],
  },
  finalCta: {
    title: "Empieza con Finesse",
    description: "Tu día, tus clientes y tus mensajes, en un solo lugar.",
    cta: "Entrar en Finesse",
  },
  footer: {
    login: "Entrar",
    poweredBy: "Powered by SevenF",
    tagline: "Software para profesionales y pequeños negocios de belleza.",
  },
  preview: {
    today: {
      date: "Jueves, 3 de septiembre · 4 citas",
      studio: "Estudio Alma",
      nowTitle: "Ahora mismo",
      inProgress: "En curso",
      time: "11:30",
      until: "hasta las 12:30",
      client: "Marta Sánchez",
      service: "Manicura semipermanente",
      noteLabel: "Nota de la cita",
      note: "Trae foto de referencia · quiere francesa invertida",
      call: "Llamar",
      viewClient: "Ver cliente",
      nextLabel: "Después",
      nextTime: "13:00",
      nextClient: "Lucía Romero",
      viewAgenda: "Ver toda la agenda",
      attentionTitle: "Lo que necesita atención",
      attention: ["Confirmar la cita de Lucía", "2 mensajes sin responder", "1 cobro pendiente"],
      inspirationTitle: "Mi inspiración",
      inspirationCount: "12 trabajos",
      nav: { salon: "Mi salón", today: "Hoy", assistant: "Finesse", messages: "Mensajes", more: "Más" },
    },
    agenda: {
      title: "Hoy",
      rows: [
        { time: "10:00", client: "Carmen Vidal", service: "Pedicura" },
        { time: "11:30", client: "Marta Sánchez", service: "Manicura semipermanente" },
        { time: "13:00", client: "Lucía Romero", service: "Lifting de pestañas" },
      ],
      free: "Hueco libre · 14:00 – 16:00",
    },
    inbox: {
      name: "María López",
      intent: "Cambio de cita",
      channel: "WhatsApp",
      time: "10:42",
      message: "¿Puedes cambiarme la cita del sábado para el lunes?",
      viewAppointment: "Ver cita",
      prepareReply: "Preparar respuesta",
      composerPlaceholder: "Escribe un mensaje…",
    },
    presence: {
      businessName: "Estudio Alma",
      tagline: "Uñas y estética en el centro de Valencia",
      servicesLabel: "Servicios",
      services: ["Manicura semipermanente", "Pedicura", "Lifting de pestañas", "Nail art"],
      hoursLabel: "Horario",
      hours: "Lun–Sáb · 10:00–19:00",
      locationLabel: "Dónde",
      location: "Calle de la Paz 12, Valencia",
      contactLabel: "Contacto",
      contact: "+34 600 000 000",
      webLabel: "Tu presencia online",
    },
  },
}
