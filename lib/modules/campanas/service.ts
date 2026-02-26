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
  workspaceId?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 50, estado, marca, clienteId, proyectoId, search, workspaceId } = params

  const where: Prisma.CampaignWhereInput = {
    ...(workspaceId && { workspaceId }),
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

export async function getById(id: string) {
  return db.campaign.findUnique({
    where: { id },
    include: {
      cliente: true,
      proyecto: true,
      piezas: { orderBy: { fechaProgramada: "asc" } },
    },
  })
}

export async function create(data: Prisma.CampaignUncheckedCreateInput) {
  return db.campaign.create({ data })
}

export async function update(id: string, data: Prisma.CampaignUncheckedUpdateInput) {
  return db.campaign.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.campaign.delete({ where: { id } })
}
