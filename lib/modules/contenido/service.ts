import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  plataforma?: string
  tipo?: string
  campaignId?: string
  clienteId?: string
  proyectoId?: string
  responsable?: string
  prioridad?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: string
  workspaceId?: string
}

export async function list(params: ListParams) {
  const {
    skip = 0, take = 50,
    estado, plataforma, tipo, campaignId, clienteId, proyectoId,
    responsable, prioridad, search, dateFrom, dateTo, sortBy, sortOrder, workspaceId,
  } = params

  const where: Prisma.ContentPieceWhereInput = {
    ...(workspaceId && { workspaceId }),
    ...(estado && { estado }),
    ...(plataforma && { plataforma }),
    ...(tipo && { tipo }),
    ...(campaignId && { campaignId }),
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(responsable && { responsable: { contains: responsable } }),
    ...(prioridad && { prioridad }),
    ...(search && {
      OR: [
        { titulo: { contains: search } },
        { copy: { contains: search } },
        { hashtags: { contains: search } },
        { notas: { contains: search } },
      ],
    }),
  }

  if (dateFrom || dateTo) {
    where.fechaProgramada = {}
    if (dateFrom) (where.fechaProgramada as Prisma.DateTimeNullableFilter).gte = new Date(dateFrom)
    if (dateTo) (where.fechaProgramada as Prisma.DateTimeNullableFilter).lte = new Date(dateTo)
  }

  let orderBy: Prisma.ContentPieceOrderByWithRelationInput = { createdAt: "desc" }
  if (sortBy) {
    const dir = (sortOrder ?? "desc") as "asc" | "desc"
    orderBy = { [sortBy]: dir }
  }

  const [data, total] = await Promise.all([
    db.contentPiece.findMany({
      where, skip, take,
      include: { campaign: true },
      orderBy,
    }),
    db.contentPiece.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.contentPiece.findUnique({
    where: { id },
    include: { campaign: true },
  })
}

export async function create(data: Prisma.ContentPieceUncheckedCreateInput) {
  return db.contentPiece.create({ data })
}

export async function update(id: string, data: Prisma.ContentPieceUncheckedUpdateInput) {
  return db.contentPiece.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.contentPiece.delete({ where: { id } })
}

// Ideas
export async function listIdeas(params: { skip?: number; take?: number; estado?: string; categoria?: string; search?: string }) {
  const { skip = 0, take = 50, estado, categoria, search } = params
  const where: Prisma.ContentIdeaWhereInput = {
    ...(estado && { estado }),
    ...(categoria && { categoria }),
    ...(search && {
      OR: [
        { titulo: { contains: search } },
        { descripcion: { contains: search } },
        { tags: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.contentIdea.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.contentIdea.count({ where }),
  ])
  return { data, total }
}

export async function createIdea(data: Prisma.ContentIdeaUncheckedCreateInput) {
  return db.contentIdea.create({ data })
}

export async function updateIdea(id: string, data: Prisma.ContentIdeaUncheckedUpdateInput) {
  return db.contentIdea.update({ where: { id }, data })
}

export async function removeIdea(id: string) {
  return db.contentIdea.delete({ where: { id } })
}
