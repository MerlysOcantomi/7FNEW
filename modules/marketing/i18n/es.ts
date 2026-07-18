import type { BeautyMarketingMessages } from "./types"

/** Spanish catalog for Finesse Marketing. */
export const es = {
  locale: "es",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Vista previa · datos de ejemplo",
    tooltip:
      "Datos de ejemplo: los cambios no se guardan y nada se publica en tus redes todavía — las conexiones reales llegarán más adelante.",
  },
  header: {
    title: "Marketing",
    description:
      "Convierte tus trabajos en publicaciones. Freya prepara el contenido, tú solo apruebas.",
    uploadCta: "Subir fotos",
    weekLabel: "Esta semana",
    mobileTagline: "Tus fotos, listas por Freya",
    readyPhotos: (count) => (count === 1 ? "1 foto lista" : `${count} fotos listas`),
    scheduledPosts: (count) => (count === 1 ? "1 programada" : `${count} programadas`),
    activeCampaigns: (count) =>
      count === 1 ? "1 campaña activa" : `${count} campañas activas`,
  },
  featured: {
    sectionTitle: "Publicación de hoy",
    sectionHint: "preparada por Freya",
    freyaPrepared: "preparó el pie de foto",
    goalLabel: "Objetivo",
    bestTimeLabel: "Mejor hora",
    publishNow: "Publicar ahora",
    schedule: "Programar",
    edit: "Editar",
    channelPendingNote:
      "La conexión con el canal está pendiente. Al aprobar, la publicación queda lista para salir en cuanto conectes tu cuenta.",
    approvedState: "Aprobada · canal pendiente de conexión",
    scheduledState: "Programada",
    empty: {
      title: "Aún no tienes trabajos preparados para publicar.",
      description: "Sube una foto y Freya creará una propuesta para ti.",
      action: "Subir mi primer trabajo",
    },
  },
  gallery: {
    sectionTitle: "Tus trabajos",
    sectionHint: "fotos recientes",
    uploadTile: "Subir fotos",
    viewAll: "Ver galería completa →",
    preparePost: "Preparar publicación",
    preparePostAria: (title) => `Preparar publicación: ${title}`,
    empty: {
      title: "Todavía no hay fotos de tus trabajos.",
      description: "Sube tu primer trabajo para que Freya empiece a preparar contenido.",
      action: "Subir mi primer trabajo",
    },
  },
  calendar: {
    sectionTitle: "Calendario de contenido",
    sectionHint: "próximos 7 días",
    mobileToggle: "Ver calendario de contenido",
    empty: "Sin publicaciones programadas estos días.",
    itemKindLabels: {
      post: "Post",
      reel: "Reel",
      story: "Story",
      "campaña": "Campaña",
    },
  },
  freya: {
    name: "Freya",
    role: "estudio creativo",
    readyForReview: (count) => (count === 1 ? "1 lista" : `${count} listas`),
    empty: "Sube una foto de tu último trabajo y te preparo una propuesta de publicación.",
  },
  campaigns: {
    sectionTitle: "Campañas simples",
    activeCountHint: (count) => (count === 1 ? "1 activa" : `${count} activas`),
    approve: "Aprobar",
    view: "Ver",
    pause: "Pausar",
    resume: "Reanudar",
    detail: "Ver detalle",
    empty: {
      title: "No hay campañas por ahora.",
      description: "Fiona te sugerirá campañas sencillas cuando vea una oportunidad.",
    },
    audienceFallback: "personas",
    transitionToast: (status) => {
      switch (status) {
        case "sugerida":
          return "Campaña sugerida."
        case "aprobada":
          return "Campaña aprobada."
        case "programada":
          return "Campaña programada."
        case "activa":
          return "Campaña activada."
        case "pausada":
          return "Campaña pausada."
        case "finalizada":
          return "Campaña finalizada."
      }
    },
  },
  pulse: {
    sectionTitle: "Pulso social",
    sectionHint: "últimos 7 días",
    channelsPendingNote: "Conecta tus redes para ver datos reales aquí.",
  },
  upload: {
    title: "Subir fotos de un trabajo",
    takePhoto: "Hacer una foto",
    fromGallery: "Elegir de la galería",
    selectHint: "Puedes seleccionar varias imágenes a la vez.",
    clientLabel: "Cliente (opcional)",
    clientPlaceholder: "María",
    serviceLabel: "Servicio realizado (opcional)",
    servicePlaceholder: "Manicura semipermanente",
    styleLabel: "Estilo o tratamiento (opcional)",
    stylePlaceholder: "Rose nude chrome",
    beforeAfterLabel: "Es un antes y después",
    notesLabel: "Notas para Freya (opcional)",
    notesPlaceholder: "Ej.: destaca el brillo del acabado…",
    confirm: "Guardar trabajo",
    cancel: "Cancelar",
    errorType: "Solo se admiten imágenes.",
    errorEmpty: "Selecciona al menos una imagen.",
    successToast: "Trabajo guardado. Ya puedes preparar su publicación.",
    defaultWorkTitle: "Nuevo trabajo",
    removeImageAria: (name) => `Quitar ${name}`,
  },
  editPost: {
    title: "Editar publicación",
    titleLabel: "Título o contexto",
    captionLabel: "Pie de foto",
    hashtagsLabel: "Hashtags",
    hashtagsHint: "Separados por comas, sin necesidad de #.",
    channelLabel: "Canal",
    kindLabel: "Tipo de contenido",
    goalLabel: "Objetivo",
    ctaLabel: "Llamada a la acción",
    save: "Guardar cambios",
    cancel: "Cancelar",
    errorCaption: "El pie de foto no puede quedar vacío.",
    successToast: "Publicación actualizada.",
  },
  schedule: {
    title: "Programar publicación",
    dateLabel: "Fecha",
    timeLabel: "Hora",
    channelLabel: "Canal",
    confirm: "Programar",
    cancel: "Cancelar",
    errorPast: "Elige una fecha y hora futuras.",
    successToast: "Publicación programada.",
  },
  publish: {
    approvedToast: "Publicación aprobada. Saldrá en cuanto conectes el canal.",
    proposalNote: "Propuesta inicial · edítala a tu gusto",
  },
  errorState: {
    title: "No hemos podido cargar Marketing.",
    description: "Vuelve a intentarlo en unos segundos.",
    retry: "Reintentar",
  },
  a11y: {
    loadingMarketing: "Cargando Marketing",
    workPhotoAlt: (title) => `Foto: ${title}`,
    workPhotoFallback: "Foto del trabajo",
  },
  workStatusLabels: {
    nuevo: "Nuevo",
    sin_usar: "Sin usar",
    preparado: "Preparado",
    programado: "Programado",
    publicado: "Publicado",
  },
  postStatusLabels: {
    borrador: "Borrador",
    preparada: "Preparada",
    aprobada: "Aprobada",
    programada: "Programada",
    publicada: "Publicada",
  },
  campaignStatusLabels: {
    sugerida: "Sugerida",
    aprobada: "Aprobada",
    programada: "Programada",
    activa: "Activa",
    pausada: "Pausada",
    finalizada: "Finalizada",
  },
  channelLabels: {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
  },
  kindLabels: {
    post: "Post",
    reel: "Reel",
    story: "Story",
    carrusel: "Carrusel",
  },
  agentLabels: { fiona: "Fiona", freya: "Freya" },
  draftTemplates: {
    fallbackSubject: "trabajo",
    caption: ({ subject, clientName, beforeAfter }) =>
      `${subject}${clientName ? ` de ${clientName}` : ""} recién salido del estudio ✨${
        beforeAfter ? " Antes y después real, sin filtros." : ""
      } ¿Reservamos el tuyo? Quedan huecos esta semana 💅`,
    goal: "Atraer nuevos clientes",
    cta: "Reserva tu cita",
  },
  demo: {
    works: {
      w1: {
        title: "Rose Nude Chrome · María",
        clientName: "María",
        service: "Manicura semipermanente",
        style: "Rose nude chrome",
      },
      w2: {
        title: "Nail art floral · Marta",
        clientName: "Marta",
        service: "Nail art",
        style: "Floral primavera",
      },
      w3: {
        title: "Baby boomer · Laura",
        clientName: "Laura",
        service: "Manicura semipermanente",
        style: "Baby boomer",
      },
      w4: {
        title: "Esmaltado rojo · Andrea",
        clientName: "Andrea",
        service: "Esmaltado",
        style: "Rojo clásico",
      },
      w5: {
        title: "Francesa moderna · Sara",
        clientName: "Sara",
        service: "Manicura",
        style: "Francesa moderna",
      },
    },
    posts: {
      p1: {
        title: "El Rose Nude Chrome de María quedó para enseñar.",
        caption:
          "Rose nude con acabado espejo ✨ El tono que sienta bien todo el año. ¿Reservamos el tuyo? Quedan huecos esta semana 💅",
        hashtags: ["RoseNude", "uñasConEstilo", "manicura"],
        goal: "Atraer nuevos clientes",
        bestTime: "Hoy 19:00",
        cta: "Reserva tu cita",
      },
      p2: {
        title: "Nail art floral de Marta",
        caption:
          "Flores que duran más que un ramo 🌸 Nail art a mano alzada para estrenar la temporada.",
        hashtags: ["nailart", "floral", "manicura"],
        goal: "Enseñar trabajo reciente",
        bestTime: null,
        cta: "Escríbenos para tu diseño",
      },
      p3: {
        title: "Baby boomer de Laura",
        caption:
          "El degradado que nunca falla. Baby boomer con acabado natural para el día a día ✨",
        hashtags: ["babyBoomer", "uñasNaturales"],
        goal: "Alcance",
        bestTime: null,
        cta: null,
      },
    },
    campaigns: {
      c1: {
        title: "“Verano de uñas” en marcha",
        reason: "3 publicaciones programadas · 480 personas alcanzadas.",
        audienceLabel: "personas alcanzadas",
      },
      c2: {
        title: "“Vuelve al color” para quienes no reservan hace tiempo",
        reason: "14 clientes sin reservar hace 2+ meses · Freya ya preparó las piezas.",
        audienceLabel: "clientes sin reservar hace 2+ meses",
      },
    },
    pulse: {
      periodLabel: "últimos 7 días",
      metrics: {
        followers: { label: "Seguidores", value: "1.240", delta: "+18 este mes" },
        reach: { label: "Alcance", value: "4,8k", delta: "+32% vs. semana" },
        saves: { label: "Guardados", value: "96", delta: "+11 hoy" },
        inquiries: { label: "Consultas", value: "12", delta: "+3 esta semana" },
        newClients: { label: "Clientes por contenido", value: "3", delta: "esta semana" },
      },
      insight:
        "3 clientes nuevos escribieron esta semana después de ver una publicación. Fanny ya los está atendiendo.",
    },
    freyaMessage:
      "Tienes el Rose Nude de María listo para publicar y una idea de reel del baby boomer de Laura. Publica hoy antes de las 19:00 para conseguir más alcance.",
  },
} satisfies BeautyMarketingMessages
