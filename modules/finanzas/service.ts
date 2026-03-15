import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  tipo?: string
  categoria?: string
  clienteId?: string
  proyectoId?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, tipo, categoria, clienteId, proyectoId, search, workspaceId } = params

  const where: Prisma.TransaccionWhereInput = {
    workspaceId,
    ...(tipo && { tipo }),
    ...(categoria && { categoria }),
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(search && {
      descripcion: { contains: search },
    }),
  }

  const [data, total] = await Promise.all([
    db.transaccion.findMany({
      where,
      skip,
      take,
      include: { cliente: true, proyecto: true },
      orderBy: { fecha: "desc" },
    }),
    db.transaccion.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  return db.transaccion.findFirst({
    where: { id, workspaceId },
    include: { cliente: true, proyecto: true },
  })
}

export async function create(data: Prisma.TransaccionUncheckedCreateInput, workspaceId: string) {
  return db.transaccion.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.TransaccionUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.transaccion.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.transaccion.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.transaccion.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.transaccion.delete({ where: { id } })
}
