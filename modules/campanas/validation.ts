import { z } from "zod"

export const createCampaignSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  estado: z.enum(["idea", "planificacion", "activa", "pausada", "completada", "cancelada"]).default("idea"),
  marca: z.enum(["skina", "7f", "cliente", "general"]).default("general"),
  fechaInicio: z.string().datetime().optional().nullable(),
  fechaFin: z.string().datetime().optional().nullable(),
  presupuesto: z.number().optional().nullable(),
  objetivos: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "custom"]).optional().default("public"),
  allowedUsers: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
})

export const updateCampaignSchema = createCampaignSchema.partial()

export const queryCampaignSchema = z.object({
  estado: z.string().optional(),
  marca: z.string().optional(),
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  search: z.string().optional(),
})
