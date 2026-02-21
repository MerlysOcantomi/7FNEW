import { z } from "zod"

export const createAutomatizacionSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  trigger: z.string().min(1, "El trigger es requerido"),
  condiciones: z.unknown().optional().nullable(),
  acciones: z.unknown(),
  estado: z.enum(["activa", "pausada", "inactiva"]).default("activa"),
})

export const updateAutomatizacionSchema = createAutomatizacionSchema.partial()

export const queryAutomatizacionSchema = z.object({
  estado: z.string().optional(),
  trigger: z.string().optional(),
  search: z.string().optional(),
})
