import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  clienteId?: string
  proyectoId?: string
  search?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, clienteId, proyectoId, search } = params

  const where: Prisma.NotaWhereInput = {
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(search && {
      OR: [
        { titulo: { contains: search } },
        { contenido: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.nota.findMany({
      where,
      skip,
      take,
      include: { cliente: true, proyecto: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.nota.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.nota.findUnique({
    where: { id },
    include: { cliente: true, proyecto: true },
  })
}

export async function create(data: Prisma.NotaUncheckedCreateInput) {
  return db.nota.create({ data })
}

export async function update(id: string, data: Prisma.NotaUncheckedUpdateInput) {
  return db.nota.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.nota.delete({ where: { id } })
}
