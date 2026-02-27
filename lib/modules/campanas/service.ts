import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  marca?: string
  clienteId?: string
  proyectoId?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 50, estado, marca, clienteId, proyectoId, search, workspaceId } = params

  const where: Prisma.CampaignWhereInput = {
    workspaceId,
    ...(estado && { estado }),
    ...(marca && { marca }),
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(search && {
      OR: [
        { nombre: { contains: search } },
        { descripcion: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.campaign.findMany({
      where, skip, take,
      include: {
        cliente: true,
        proyecto: true,
        _count: { select: { piezas: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.campaign.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  return db.campaign.findFirst({
    where: { id, workspaceId },
    include: {
      cliente: true,
      proyecto: true,
      piezas: { orderBy: { fechaProgramada: "asc" } },
    },
  })
}

export async function create(data: Prisma.CampaignUncheckedCreateInput, workspaceId: string) {
  return db.campaign.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.CampaignUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.campaign.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.campaign.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.campaign.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.campaign.delete({ where: { id } })
}
