import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  tipo?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, tipo, search, workspaceId } = params

  const where: Prisma.ClienteWhereInput = {
    workspaceId,
    ...(estado && { estado }),
    ...(tipo && { tipo }),
    ...(search && {
      OR: [
        { nombre: { contains: search } },
        { email: { contains: search } },
        { empresa: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.cliente.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { proyectos: true, facturas: true } } },
    }),
    db.cliente.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  return db.cliente.findFirst({
    where: { id, workspaceId },
    include: {
      proyectos: { orderBy: { updatedAt: "desc" } },
      facturas: { orderBy: { fechaEmision: "desc" } },
      notasProfesionales: { orderBy: { createdAt: "desc" } },
    },
  })
}

export async function create(data: Prisma.ClienteUncheckedCreateInput, workspaceId: string) {
  return db.cliente.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.ClienteUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.cliente.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.cliente.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.cliente.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.cliente.delete({ where: { id } })
}
