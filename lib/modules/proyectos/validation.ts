import { z } from "zod"

export const createProyectoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  estado: z.enum(["planificacion", "en_progreso", "revision", "completado", "cancelado"]).default("planificacion"),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  progreso: z.number().int().min(0).max(100).default(0),
  presupuesto: z.number().optional().nullable(),
  fechaInicio: z.string().datetime().optional().nullable(),
  fechaFin: z.string().datetime().optional().nullable(),
  clienteId: z.string().optional().nullable(),
})

export const updateProyectoSchema = createProyectoSchema.partial()

export const queryProyectoSchema = z.object({
  estado: z.string().optional(),
  prioridad: z.string().optional(),
  clienteId: z.string().optional(),
  search: z.string().optional(),
})
