import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"

export async function GET() {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const proyectos = await db.proyecto.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { createdAt: "desc" },
    include: {
      tareas: { select: { id: true, titulo: true, estado: true, prioridad: true } },
    },
  })

  return NextResponse.json(proyectos)
}
