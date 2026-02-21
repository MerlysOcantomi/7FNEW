import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  tipo?: string
  clienteId?: string
  proyectoId?: string
  search?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, tipo, clienteId, proyectoId, search } = params

  const where: Prisma.DocumentoWhereInput = {
    ...(tipo && { tipo }),
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(search && {
      nombre: { contains: search },
    }),
  }

  const [data, total] = await Promise.all([
    db.documento.findMany({
      where,
      skip,
      take,
      include: { cliente: true, proyecto: true },
      orderBy: { createdAt: "desc" },
    }),
    db.documento.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.documento.findUnique({
    where: { id },
    include: { cliente: true, proyecto: true },
  })
}

export async function create(data: Prisma.DocumentoUncheckedCreateInput) {
  return db.documento.create({ data })
}

export async function update(id: string, data: Prisma.DocumentoUncheckedUpdateInput) {
  return db.documento.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.documento.delete({ where: { id } })
}
