import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  tipo?: string
  clienteId?: string
  proyectoId?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, tipo, clienteId, proyectoId, search, workspaceId } = params

  const where: Prisma.DocumentoWhereInput = {
    workspaceId,
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

export async function getById(id: string, workspaceId: string) {
  return db.documento.findFirst({
    where: { id, workspaceId },
    include: { cliente: true, proyecto: true },
  })
}

export async function create(data: Prisma.DocumentoUncheckedCreateInput, workspaceId: string) {
  return db.documento.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.DocumentoUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.documento.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.documento.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.documento.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.documento.delete({ where: { id } })
}
