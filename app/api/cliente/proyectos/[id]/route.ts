import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const proyecto = await db.proyecto.findFirst({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      clienteId: ctx.clienteId,
    },
    include: {
      tareas: { orderBy: { createdAt: "desc" } },
      documentos: { orderBy: { createdAt: "desc" } },
      facturas: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!proyecto) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
  }

  return NextResponse.json(proyecto)
}
