import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  tipo?: string
  clienteId?: string
  proyectoId?: string
  desde?: string
  hasta?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, tipo, clienteId, proyectoId, desde, hasta, search, workspaceId } = params

  const where: Prisma.EventoWhereInput = {
    workspaceId,
    ...(tipo && { tipo }),
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(search && {
      titulo: { contains: search },
    }),
    ...((desde || hasta) && {
      fechaInicio: {
        ...(desde && { gte: new Date(desde) }),
        ...(hasta && { lte: new Date(hasta) }),
      },
    }),
  }

  const [data, total] = await Promise.all([
    db.evento.findMany({
      where,
      skip,
      take,
      include: { cliente: true, proyecto: true },
      orderBy: { fechaInicio: "asc" },
    }),
    db.evento.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  return db.evento.findFirst({
    where: { id, workspaceId },
    include: { cliente: true, proyecto: true },
  })
}

export async function create(data: Prisma.EventoUncheckedCreateInput, workspaceId: string) {
  return db.evento.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.EventoUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.evento.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.evento.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.evento.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.evento.delete({ where: { id } })
}
