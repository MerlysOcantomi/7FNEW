import { z } from "zod"

export const createClienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  customId: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  telefono: z.string().optional().nullable(),
  empresa: z.string().optional().nullable(),
  preferredPaymentMethod: z.enum(["cash", "bank_transfer", "card"]).optional().nullable(),
  currency: z.string().trim().min(3, "La moneda es requerida").max(3, "Moneda inválida").optional().nullable(),
  tipo: z.enum(["empresa", "freelancer", "startup"]).default("empresa"),
  estado: z.enum(["activo", "inactivo", "prospecto"]).default("activo"),
  notas: z.string().optional().nullable(),
})

export const updateClienteSchema = createClienteSchema.partial()

export const queryClienteSchema = z.object({
  estado: z.string().optional(),
  tipo: z.string().optional(),
  search: z.string().optional(),
})
