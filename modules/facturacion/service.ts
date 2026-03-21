import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

interface ListParams {
  skip?: number
  take?: number
  estado?: string
  clienteId?: string
  proyectoId?: string
  search?: string
  workspaceId: string
}

export async function list(params: ListParams) {
  const { skip = 0, take = 20, estado, clienteId, proyectoId, search, workspaceId } = params

  const where: Prisma.FacturaWhereInput = {
    workspaceId,
    ...(estado && { estado }),
    ...(clienteId && { clienteId }),
    ...(proyectoId && { proyectoId }),
    ...(search && {
      numero: { contains: search },
    }),
  }

  const [data, total] = await Promise.all([
    db.factura.findMany({
      where,
      skip,
      take,
      include: { cliente: true, proyecto: true },
      orderBy: { fechaEmision: "desc" },
    }),
    db.factura.count({ where }),
  ])

  const parsed = data.map((f) => ({ ...f, items: JSON.parse(f.items) }))
  return { data: parsed, total }
}

export async function getById(id: string, workspaceId: string) {
  const factura = await db.factura.findFirst({
    where: { id, workspaceId },
    include: { cliente: true, proyecto: true },
  })
  if (!factura) return null
  return { ...factura, items: JSON.parse(factura.items) }
}

export async function create(input: Record<string, unknown>, workspaceId: string) {
  const { items, ...rest } = input
  const data = {
    ...rest,
    items: JSON.stringify(items),
    workspaceId,
  } as Prisma.FacturaUncheckedCreateInput
  const factura = await db.factura.create({ data })
  return { ...factura, items: JSON.parse(factura.items) }
}

export async function update(id: string, input: Record<string, unknown>, workspaceId: string) {
  const existing = await db.factura.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  const data = { ...input } as Record<string, unknown>
  if (data.items) {
    data.items = JSON.stringify(data.items)
  }
  const factura = await db.factura.update({
    where: { id },
    data: data as Prisma.FacturaUncheckedUpdateInput,
  })
  return { ...factura, items: JSON.parse(factura.items) }
}

export async function remove(id: string, workspaceId: string) {
  const existing = await db.factura.findFirst({ where: { id, workspaceId } })
  if (!existing) return null
  return db.factura.delete({ where: { id } })
}
