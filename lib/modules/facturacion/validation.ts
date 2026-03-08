import { z } from "zod"

const facturaItemSchema = z.object({
  descripcion: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  total: z.number(),
})

export const createFacturaSchema = z.object({
  numero: z.string().min(1, "El número de factura es requerido"),
  estado: z.enum(["borrador", "enviada", "pagada", "vencida", "cancelada"]).default("borrador"),
  subtotal: z.number(),
  impuesto: z.number().default(0),
  total: z.number(),
  items: z.array(facturaItemSchema).min(1, "Se requiere al menos un item"),
  fechaEmision: z.string().datetime().optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  proyectoId: z.string().optional().nullable(),
})

export const updateFacturaSchema = createFacturaSchema.partial()

export const queryFacturaSchema = z.object({
  estado: z.string().optional(),
  clienteId: z.string().optional(),
  proyectoId: z.string().optional(),
  search: z.string().optional(),
})
