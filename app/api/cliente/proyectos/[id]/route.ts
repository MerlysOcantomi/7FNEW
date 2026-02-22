import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const proyecto = await db.proyecto.findFirst({
    where: { id, clienteId: session.clienteId },
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
