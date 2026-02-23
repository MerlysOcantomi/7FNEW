import { z } from "zod"

export const createProyectoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  customId: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  estado: z.enum(["planificacion", "en_progreso", "revision", "completado", "cancelado"]).default("planificacion"),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  progreso: z.number().int().min(0).max(100).default(0),
  presupuesto: z.number().optional().nullable(),
  fechaInicio: z.string().datetime().optional().nullable(),
  fechaFin: z.string().datetime().optional().nullable(),
  estimatedDelivery: z.string().datetime().optional().nullable(),
  actualDelivery: z.string().datetime().optional().nullable(),
  tags: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "custom"]).optional().default("public"),
  allowedUsers: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
})

export const updateProyectoSchema = createProyectoSchema.partial()

export const queryProyectoSchema = z.object({
  estado: z.string().optional(),
  prioridad: z.string().optional(),
  clienteId: z.string().optional(),
  customId: z.string().optional(),
  assignedTo: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["nombre", "createdAt", "fechaFin", "prioridad", "estado", "progreso"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})
