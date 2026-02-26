import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  trigger?: string
  search?: string
  workspaceId?: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, trigger, search, workspaceId } = params

  const where: Prisma.AutomatizacionWhereInput = {
    ...(workspaceId && { workspaceId }),
    ...(estado && { estado }),
    ...(trigger && { trigger }),
    ...(search && {
      nombre: { contains: search },
    }),
  }

  const [data, total] = await Promise.all([
    db.automatizacion.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.automatizacion.count({ where }),
  ])

  const parsed = data.map((a) => ({
    ...a,
    condiciones: a.condiciones ? JSON.parse(a.condiciones) : null,
    acciones: JSON.parse(a.acciones),
  }))

  return { data: parsed, total }
}

export async function getById(id: string) {
  const record = await db.automatizacion.findUnique({ where: { id } })
  if (!record) return null
  return {
    ...record,
    condiciones: record.condiciones ? JSON.parse(record.condiciones) : null,
    acciones: JSON.parse(record.acciones),
  }
}

export async function create(input: Record<string, unknown>) {
  const data = {
    ...input,
    condiciones: input.condiciones ? JSON.stringify(input.condiciones) : null,
    acciones: JSON.stringify(input.acciones),
  } as Prisma.AutomatizacionCreateInput
  const record = await db.automatizacion.create({ data })
  return {
    ...record,
    condiciones: record.condiciones ? JSON.parse(record.condiciones) : null,
    acciones: JSON.parse(record.acciones),
  }
}

export async function update(id: string, input: Record<string, unknown>) {
  const data = { ...input } as Record<string, unknown>
  if (data.condiciones !== undefined) {
    data.condiciones = data.condiciones ? JSON.stringify(data.condiciones) : null
  }
  if (data.acciones !== undefined) {
    data.acciones = JSON.stringify(data.acciones)
  }
  const record = await db.automatizacion.update({
    where: { id },
    data: data as Prisma.AutomatizacionUpdateInput,
  })
  return {
    ...record,
    condiciones: record.condiciones ? JSON.parse(record.condiciones) : null,
    acciones: JSON.parse(record.acciones),
  }
}

export async function remove(id: string) {
  return db.automatizacion.delete({ where: { id } })
}
