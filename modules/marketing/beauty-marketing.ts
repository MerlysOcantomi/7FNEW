/**
 * Beauty "Marketing" — the Spanish, Finesse-branded configuration the Marketing
 * surface uses when a workspace is Beauty.
 *
 * Mirrors `modules/today/beauty-today.ts`: pure and DB-free, resolves entirely
 * from `verticalKey` (covering aliases salon/nails/… via the business type) and
 * returns `null` for any non-beauty vertical, so `/contenido` keeps its generic
 * core page untouched for everyone else. All UI strings live here (Spanish,
 * España) — nothing user-facing is hardcoded inside the components.
 *
 * DATA HONESTY: no Marketing backend exists yet (no photo storage, no Freya
 * generation, no channel integrations). The surface therefore runs on the
 * isolated demo adapter (`demo-data.ts`) and ALWAYS shows the
 * "Vista previa · datos de ejemplo" chip; publish actions never simulate a real
 * publication — they move content to an honest "aprobada · canal pendiente"
 * state (see `modules/marketing/state.ts#approvePost`).
 */

import { mapVerticalKeyToBusinessType } from "@core/personalization"
import type { CampaignStatus, PostChannel, PostKind, PostStatus, WorkStatus } from "./types"

export interface BeautyMarketingConfig {
  /** "Finesse · by Sevenef" brand chip. */
  brandChip: string
  /** "Vista previa · datos de ejemplo" — always visible while demo data drives the page. */
  previewChip: string
  header: {
    title: string
    description: string
    uploadCta: string
    weekLabel: string
    mobileTagline: string
  }
  featured: {
    sectionTitle: string
    sectionHint: string
    freyaPrepared: string
    goalLabel: string
    bestTimeLabel: string
    publishNow: string
    schedule: string
    edit: string
    channelPendingNote: string
    approvedState: string
    scheduledState: string
    empty: { title: string; description: string; action: string }
  }
  gallery: {
    sectionTitle: string
    sectionHint: string
    uploadTile: string
    viewAll: string
    preparePost: string
    empty: { title: string; description: string; action: string }
  }
  calendar: {
    sectionTitle: string
    sectionHint: string
    mobileToggle: string
    empty: string
  }
  freya: {
    name: string
    role: string
    readySuffixOne: string
    readySuffix: string
    empty: string
  }
  campaigns: {
    sectionTitle: string
    approve: string
    view: string
    pause: string
    resume: string
    detail: string
    empty: { title: string; description: string }
    audiencePrefix: string
  }
  pulse: {
    sectionTitle: string
    sectionHint: string
    channelsPendingNote: string
  }
  upload: {
    title: string
    takePhoto: string
    fromGallery: string
    selectHint: string
    clientLabel: string
    serviceLabel: string
    styleLabel: string
    beforeAfterLabel: string
    notesLabel: string
    notesPlaceholder: string
    confirm: string
    cancel: string
    errorType: string
    errorEmpty: string
    successToast: string
  }
  editPost: {
    title: string
    titleLabel: string
    captionLabel: string
    hashtagsLabel: string
    hashtagsHint: string
    channelLabel: string
    kindLabel: string
    goalLabel: string
    ctaLabel: string
    save: string
    cancel: string
    errorCaption: string
    successToast: string
  }
  schedule: {
    title: string
    dateLabel: string
    timeLabel: string
    channelLabel: string
    confirm: string
    cancel: string
    errorPast: string
    successToast: string
  }
  publish: {
    approvedToast: string
    proposalNote: string
  }
  errorState: { title: string; description: string; retry: string }
  workStatusLabels: Record<WorkStatus, string>
  postStatusLabels: Record<PostStatus, string>
  campaignStatusLabels: Record<CampaignStatus, string>
  channelLabels: Record<PostChannel, string>
  kindLabels: Record<PostKind, string>
  agentLabels: Record<"fiona" | "freya", string>
}

const BEAUTY_MARKETING_CONFIG: BeautyMarketingConfig = {
  brandChip: "Finesse · by Sevenef",
  previewChip: "Vista previa · datos de ejemplo",
  header: {
    title: "Marketing",
    description: "Convierte tus trabajos en publicaciones. Freya prepara el contenido, tú solo apruebas.",
    uploadCta: "Subir fotos",
    weekLabel: "Esta semana",
    mobileTagline: "Tus fotos, listas por Freya",
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
  },
  freya: {
    name: "Freya",
    role: "creative studio",
    readySuffixOne: "lista",
    readySuffix: "listas",
    empty: "Sube una foto de tu último trabajo y te preparo una propuesta de publicación.",
  },
  campaigns: {
    sectionTitle: "Campañas simples",
    approve: "Aprobar",
    view: "Ver",
    pause: "Pausar",
    resume: "Reanudar",
    detail: "Ver detalle",
    empty: {
      title: "No hay campañas por ahora.",
      description: "Fiona te sugerirá campañas sencillas cuando vea una oportunidad.",
    },
    audiencePrefix: "clientas",
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
    clientLabel: "Clienta (opcional)",
    serviceLabel: "Servicio realizado (opcional)",
    styleLabel: "Estilo o tratamiento (opcional)",
    beforeAfterLabel: "Es un antes y después",
    notesLabel: "Notas para Freya (opcional)",
    notesPlaceholder: "Ej.: destaca el brillo del acabado…",
    confirm: "Guardar trabajo",
    cancel: "Cancelar",
    errorType: "Solo se admiten imágenes.",
    errorEmpty: "Selecciona al menos una imagen.",
    successToast: "Trabajo guardado. Ya puedes preparar su publicación.",
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
}

/**
 * Resolve the Beauty Marketing config for a vertical, or `null` when it is not
 * a beauty workspace (covers aliases salon/nails/… via business type).
 *
 * Activation note: unlike the appointment Today (whose demo layout is gated to
 * explicit previews because it REPLACES real bookings), the Finesse Marketing
 * surface activates for real Beauty workspaces — it is the designed Marketing
 * home for the vertical, its demo layer is always labeled with the preview
 * chip, and no action ever simulates a real external publication.
 */
export function resolveBeautyMarketingConfig(
  verticalKey: string | null | undefined,
): BeautyMarketingConfig | null {
  if (!verticalKey) return null
  return mapVerticalKeyToBusinessType(verticalKey) === "beauty" ? BEAUTY_MARKETING_CONFIG : null
}
