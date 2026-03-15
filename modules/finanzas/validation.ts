import { z } from "zod"

export const createTransaccionSchema = z.object({
  tipo: z.enum(["ingreso", "gasto"]),
  monto: z.number().positive("El monto debe ser positivo"),
  descripcion: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  fecha: z.string().datetime().optional(),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
})

export const updateTransaccionSchema = createTransaccionSchema.partial()

export const queryTransaccionSchema = z.object({
  tipo: z.string().optional(),
  categoria: z.string().optional(),
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  search: z.string().optional(),
})
