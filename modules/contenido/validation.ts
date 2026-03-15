import { z } from "zod"

export const createContentPieceSchema = z.object({
  titulo: z.string().min(1, "El titulo es requerido"),
  copy: z.string().optional().nullable(),
  plataforma: z.enum(["instagram", "tiktok", "facebook", "linkedin", "youtube", "twitter", "pinterest", "blog", "newsletter", "web", "otro"]).default("instagram"),
  tipo: z.enum(["post", "reel", "carrusel", "story", "video", "blog", "newsletter", "guion", "documento", "pieza-creativa", "fotografia", "otro"]).default("post"),
  estado: z.enum(["idea", "borrador", "en-progreso", "revision", "programado", "publicado", "cancelado"]).default("idea"),
  fechaProgramada: z.string().datetime().optional().nullable(),
  fechaPublicada: z.string().datetime().optional().nullable(),
  hashtags: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  enlace: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  responsable: z.string().optional().nullable(),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  campaignId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "custom"]).optional().default("public"),
  createdBy: z.string().optional().nullable(),
})

export const updateContentPieceSchema = createContentPieceSchema.partial()

export const queryContentPieceSchema = z.object({
  estado: z.string().optional(),
  plataforma: z.string().optional(),
  tipo: z.string().optional(),
  campaignId: z.string().optional(),
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  responsable: z.string().optional(),
  prioridad: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["titulo", "createdAt", "fechaProgramada", "estado", "plataforma", "prioridad"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

export const createContentIdeaSchema = z.object({
  titulo: z.string().min(1, "El titulo es requerido"),
  descripcion: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  plataforma: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  estado: z.enum(["nueva", "evaluando", "aprobada", "rechazada", "convertida"]).default("nueva"),
  fuente: z.enum(["manual", "ia", "equipo", "cliente"]).default("manual"),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
})

export const updateContentIdeaSchema = createContentIdeaSchema.partial()
