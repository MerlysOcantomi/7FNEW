import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  prioridad?: string
  proyectoId?: string
  clienteId?: string
  usuarioId?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, prioridad, proyectoId, clienteId, usuarioId, search, workspaceId } = params

  const where: Prisma.TareaWhereInput = {
    workspaceId,
    ...(estado && { estado }),
    ...(prioridad && { prioridad }),
    ...(proyectoId && { proyectoId }),
    ...(clienteId && { clienteId }),
    ...(usuarioId && { usuarioId }),
    ...(search && {
      OR: [
        { titulo: { contains: search } },
        { descripcion: { contains: search } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.tarea.findMany({
      where,
      skip,
      take,
      include: { proyecto: true, cliente: true, usuario: true },
      orderBy: { createdAt: "desc" },
    }),
    db.tarea.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string, workspaceId: string) {
  return db.tarea.findFirst({
    where: { id, workspaceId },
    include: { proyecto: true, cliente: true, usuario: true },
  })
}

export async function create(data: Prisma.TareaUncheckedCreateInput, workspaceId: string) {
  return db.tarea.create({ data: { ...data, workspaceId } })
}

export async function update(id: string, data: Prisma.TareaUncheckedUpdateInput, workspaceId: string) {
  const existing = await db.tarea.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.tarea.update({ where: { id }, data })
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.tarea.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.tarea.delete({ where: { id } })
}
