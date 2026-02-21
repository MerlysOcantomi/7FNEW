import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  tipo?: string
  search?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, tipo, search } = params

  const where: Prisma.ClienteWhereInput = {
    ...(estado && { estado }),
    ...(tipo && { tipo }),
    ...(search && {
      OR: [
        { nombre: { contains: search } },
        { email: { contains: search } },
        { empresa: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.cliente.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.cliente.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.cliente.findUnique({
    where: { id },
    include: { proyectos: true, tareas: true },
  })
}

export async function create(data: Prisma.ClienteCreateInput) {
  return db.cliente.create({ data })
}

export async function update(id: string, data: Prisma.ClienteUpdateInput) {
  return db.cliente.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.cliente.delete({ where: { id } })
}
