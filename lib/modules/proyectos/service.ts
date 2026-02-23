import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  prioridad?: string
  clienteId?: string
  customId?: string
  assignedTo?: string
  tag?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: string
  userId?: string
  userRole?: string
}

const PRIORIDAD_ORDER: Record<string, number> = {
  urgente: 4,
  alta: 3,
  media: 2,
  baja: 1,
}

export async function list(params: ListParams) {
  const {
    skip = 0, take = 20,
    estado, prioridad, clienteId, customId, assignedTo, tag,
    search, dateFrom, dateTo, sortBy, sortOrder,
    userId, userRole,
  } = params

  const where: Prisma.ProyectoWhereInput = {
    ...(estado && { estado }),
    ...(prioridad && { prioridad }),
    ...(clienteId && { clienteId }),
    ...(customId && { customId: { contains: customId } }),
    ...(assignedTo && { assignedTo: { contains: assignedTo } }),
    ...(tag && { tags: { contains: tag } }),
    ...(search && {
      OR: [
        { nombre: { contains: search } },
        { descripcion: { contains: search } },
        { customId: { contains: search } },
        { tags: { contains: search } },
      ],
    }),
  }

  if (userId && userRole !== "admin") {
    where.OR = [
      ...(Array.isArray(where.OR) ? where.OR : []),
      { visibility: "public" },
      { createdBy: userId },
      { allowedUsers: { contains: userId } },
    ]
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dateTo)
  }

  let orderBy: Prisma.ProyectoOrderByWithRelationInput = { createdAt: "desc" }

  if (sortBy) {
    const direction = (sortOrder ?? "desc") as "asc" | "desc"
    if (sortBy === "prioridad") {
      orderBy = { prioridad: direction }
    } else if (sortBy === "nombre") {
      orderBy = { nombre: direction }
    } else if (sortBy === "fechaFin") {
      orderBy = { fechaFin: direction }
    } else if (sortBy === "estado") {
      orderBy = { estado: direction }
    } else if (sortBy === "progreso") {
      orderBy = { progreso: direction }
    } else {
      orderBy = { createdAt: direction }
    }
  }

  const [data, total] = await Promise.all([
    db.proyecto.findMany({
      where,
      skip,
      take,
      include: { cliente: true },
      orderBy,
    }),
    db.proyecto.count({ where }),
  ])

  return { data, total }
}

export async function getById(id: string) {
  return db.proyecto.findUnique({
    where: { id },
    include: { cliente: true, tareas: true },
  })
}

export async function create(data: Prisma.ProyectoUncheckedCreateInput) {
  return db.proyecto.create({ data })
}

export async function update(id: string, data: Prisma.ProyectoUncheckedUpdateInput) {
  return db.proyecto.update({ where: { id }, data })
}

export async function remove(id: string) {
  return db.proyecto.delete({ where: { id } })
}
