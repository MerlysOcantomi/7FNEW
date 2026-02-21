import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  prioridad?: string
  clienteId?: string
  search?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, prioridad, clienteId, search } = params

  const where: Prisma.ProyectoWhereInput = {
    ...(estado && { estado }),
    ...(prioridad && { prioridad }),
    ...(clienteId && { clienteId }),
    ...(search && {
      OR: [
        { nombre: { contains: search } },
        { descripcion: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.proyecto.findMany({
      where,
      skip,
      take,
      include: { cliente: true },
      orderBy: { createdAt: "desc" },
    }),
    db.proyecto.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.proyecto.findUnique({
    where: { id },
    include: { cliente: true, tareas: true },
  })
}

export async function create(data: Prisma.ProyectoUncheckedCreateInput) {
  return db.proyecto.create({ data })
}

export async function update(id: string, data: Prisma.ProyectoUncheckedUpdateInput) {
  return db.proyecto.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.proyecto.delete({ where: { id } })
}
