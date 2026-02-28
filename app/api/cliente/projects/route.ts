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
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      nombre: true,
      estado: true,
    },
  })

  return NextResponse.json(proyectos)
}
