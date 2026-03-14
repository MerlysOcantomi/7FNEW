import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function GET() {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const proyectos = await db.proyecto.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: ctx.clienteId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      tareas: { select: { id: true, titulo: true, estado: true, prioridad: true } },
    },
  })

  return NextResponse.json(proyectos)
}
