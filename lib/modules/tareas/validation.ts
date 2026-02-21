import { z } from "zod"

export const createTareaSchema = z.object({
  titulo: z.string().min(1, "El título es requerido"),
  descripcion: z.string().optional().nullable(),
  estado: z.enum(["pendiente", "en_progreso", "revision", "completada", "cancelada"]).default("pendiente"),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
  fechaLimite: z.string().datetime().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  usuarioId: z.string().optional().nullable(),
})

export const updateTareaSchema = createTareaSchema.partial()

export const queryTareaSchema = z.object({
  estado: z.string().optional(),
  prioridad: z.string().optional(),
  proyectoId: z.string().optional(),
  clienteId: z.string().optional(),
  usuarioId: z.string().optional(),
  search: z.string().optional(),
})
