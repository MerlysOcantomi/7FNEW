import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  rol?: string
  departamento?: string
  estado?: string
  search?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, rol, departamento, estado, search } = params

  const where: Prisma.UsuarioWhereInput = {
    ...(rol && { rol }),
    ...(departamento && { departamento }),
    ...(estado && { estado }),
    ...(search && {
      OR: [
        { nombre: { contains: search } },
        { email: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.usuario.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.usuario.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.usuario.findUnique({
    where: { id },
    include: { tareas: true },
  })
}

export async function create(data: Prisma.UsuarioCreateInput) {
  return db.usuario.create({ data })
}

export async function update(id: string, data: Prisma.UsuarioUpdateInput) {
  return db.usuario.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.usuario.delete({ where: { id } })
}
