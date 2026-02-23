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

  const conditions: Prisma.ProyectoWhereInput[] = []

  if (estado) conditions.push({ estado })
  if (prioridad) conditions.push({ prioridad })
  if (clienteId) conditions.push({ clienteId })
  if (customId) conditions.push({ customId: { contains: customId } })
  if (assignedTo) conditions.push({ assignedTo: { contains: assignedTo } })
  if (tag) conditions.push({ tags: { contains: tag } })

  if (search) {
    conditions.push({
      OR: [
        { nombre: { contains: search } },
        { descripcion: { contains: search } },
        { customId: { contains: search } },
        { tags: { contains: search } },
        { assignedTo: { contains: search } },
        { cliente: { nombre: { contains: search } } },
        { cliente: { empresa: { contains: search } } },
      ],
    })
  }

  if (userId && userRole !== "admin") {
    conditions.push({
      OR: [
        { visibility: "public" },
        { createdBy: userId },
        { allowedUsers: { contains: userId } },
      ],
    })
  }

  const where: Prisma.ProyectoWhereInput = conditions.length > 0 ? { AND: conditions } : {}

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
