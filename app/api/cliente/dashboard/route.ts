import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace"

export async function GET() {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: { workspaceId: true },
  })
  const workspaceId = cliente?.workspaceId ?? DEFAULT_WORKSPACE_ID
  const wsAndClient = { clienteId: session.clienteId, workspaceId }

  const [proyectos, facturas, tareas, documentos] = await Promise.all([
    db.proyecto.findMany({
      where: wsAndClient,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.factura.findMany({
      where: wsAndClient,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.tarea.findMany({
      where: { ...wsAndClient, estado: { not: "completada" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.documento.count({ where: wsAndClient }),
  ])

  const stats = {
    totalProyectos: await db.proyecto.count({ where: wsAndClient }),
    proyectosActivos: await db.proyecto.count({ where: { ...wsAndClient, estado: { not: "completado" } } }),
    totalFacturas: await db.factura.count({ where: wsAndClient }),
    facturasPendientes: await db.factura.count({ where: { ...wsAndClient, estado: { in: ["pendiente", "enviada"] } } }),
    tareasAbiertas: await db.tarea.count({ where: { ...wsAndClient, estado: { not: "completada" } } }),
    totalDocumentos: documentos,
  }

  return NextResponse.json({
    stats,
    proyectosRecientes: proyectos,
    facturasRecientes: facturas,
    tareasAbiertas: tareas,
  })
}
