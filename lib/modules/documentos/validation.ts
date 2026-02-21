import { z } from "zod"

export const createDocumentoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  tipo: z.string().min(1, "El tipo es requerido"),
  url: z.string().url("URL inválida"),
  tamano: z.number().int().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
})

export const updateDocumentoSchema = createDocumentoSchema.partial()

export const queryDocumentoSchema = z.object({
  tipo: z.string().optional(),
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  search: z.string().optional(),
})
