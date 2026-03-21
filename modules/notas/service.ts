import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  clienteId?: string
  proyectoId?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, clienteId, proyectoId, search, workspaceId } = params

  const where: Prisma.NotaWhereInput = {
    workspaceId,
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

export async function getById(id: string, workspaceId: string) {
  return db.nota.findFirst({
    where: { id, workspaceId },
    include: { cliente: true, proyecto: true },
  })
}

export async function create(data: Prisma.NotaUncheckedCreateInput, workspaceId: string) {
  return db.nota.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.NotaUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.nota.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.nota.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.nota.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.nota.delete({ where: { id } })
}
