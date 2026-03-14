import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function GET() {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const cliente = await db.cliente.findUnique({
    where: { id: ctx.clienteId },
    include: {
      _count: {
        select: {
          proyectos: true,
          facturas: true,
          documentos: true,
          tareas: true,
        },
      },
    },
  })

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
  }

  return NextResponse.json(cliente)
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json()
  const allowed = ["telefono", "empresa", "notas"]
  const data: Record<string, string> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  const cliente = await db.cliente.update({
    where: { id: ctx.clienteId },
    data,
  })

  return NextResponse.json(cliente)
}
