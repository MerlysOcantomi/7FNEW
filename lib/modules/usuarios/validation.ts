import { z } from "zod"

export const createUsuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  rol: z.enum(["admin", "gerente", "miembro"]).default("miembro"),
  departamento: z.string().optional().nullable(),
  estado: z.enum(["activo", "inactivo"]).default("activo"),
})

export const updateUsuarioSchema = createUsuarioSchema.partial()

export const queryUsuarioSchema = z.object({
  rol: z.string().optional(),
  departamento: z.string().optional(),
  estado: z.string().optional(),
  search: z.string().optional(),
})
