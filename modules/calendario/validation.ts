import { z } from "zod"

export const createEventoSchema = z.object({
  titulo: z.string().min(1, "El título es requerido"),
  descripcion: z.string().optional().nullable(),
  tipo: z.enum(["reunion", "entrega", "recordatorio", "otro"]).default("reunion"),
  fechaInicio: z.string().datetime({ message: "La fecha de inicio es requerida" }),
  fechaFin: z.string().datetime().optional().nullable(),
  todoElDia: z.boolean().default(false),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
})

export const updateEventoSchema = createEventoSchema.partial()

export const queryEventoSchema = z.object({
  tipo: z.string().optional(),
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  search: z.string().optional(),
})
