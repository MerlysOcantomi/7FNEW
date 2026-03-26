import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

const CLIENT_ID_CONFIG = {
  prefix: "CLIENT",
  separator: "-",
  padding: 4,
} as const

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

function buildClientCustomId(sequence: number) {
  return `${CLIENT_ID_CONFIG.prefix}${CLIENT_ID_CONFIG.separator}${String(sequence).padStart(CLIENT_ID_CONFIG.padding, "0")}`
}

async function generateNextClienteCustomId(workspaceId: string) {
  const expectedPrefix = `${CLIENT_ID_CONFIG.prefix}${CLIENT_ID_CONFIG.separator}`
  const existingIds = await db.cliente.findMany({
    where: {
      workspaceId,
      customId: {
        startsWith: expectedPrefix,
      },
    },
    select: { customId: true },
  })

  let maxSequence = 0
  for (const record of existingIds) {
    const value = record.customId?.trim()
    if (!value) continue
    const match = value.match(new RegExp(`^${expectedPrefix}(\\d+)$`))
    if (!match) continue
    const sequence = Number.parseInt(match[1], 10)
    if (Number.isFinite(sequence) && sequence > maxSequence) {
      maxSequence = sequence
    }
  }

  return buildClientCustomId(maxSequence + 1)
}

export async function create(data: Prisma.ClienteUncheckedCreateInput, workspaceId: string) {
  const customId =
    typeof data.customId === "string" && data.customId.trim().length > 0
      ? data.customId.trim()
      : await generateNextClienteCustomId(workspaceId)

  return db.cliente.create({
    data: {
      ...data,
      customId,
      workspaceId,
    },
  })
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
