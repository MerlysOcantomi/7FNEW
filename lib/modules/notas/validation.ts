import { z } from "zod"

export const createNotaSchema = z.object({
  titulo: z.string().min(1, "El título es requerido"),
  contenido: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
})

export const updateNotaSchema = createNotaSchema.partial()

export const queryNotaSchema = z.object({
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  search: z.string().optional(),
})
