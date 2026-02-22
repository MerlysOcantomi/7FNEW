import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"

export async function GET() {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [proyectos, facturas, tareas, documentos] = await Promise.all([
    db.proyecto.findMany({
      where: { clienteId: session.clienteId },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.factura.findMany({
      where: { clienteId: session.clienteId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.tarea.findMany({
      where: { clienteId: session.clienteId, estado: { not: "completada" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.documento.count({ where: { clienteId: session.clienteId } }),
  ])

  const stats = {
    totalProyectos: await db.proyecto.count({ where: { clienteId: session.clienteId } }),
    proyectosActivos: await db.proyecto.count({ where: { clienteId: session.clienteId, estado: { not: "completado" } } }),
    totalFacturas: await db.factura.count({ where: { clienteId: session.clienteId } }),
    facturasPendientes: await db.factura.count({ where: { clienteId: session.clienteId, estado: { in: ["pendiente", "enviada"] } } }),
    tareasAbiertas: await db.tarea.count({ where: { clienteId: session.clienteId, estado: { not: "completada" } } }),
    totalDocumentos: documentos,
  }

  return NextResponse.json({
    stats,
    proyectosRecientes: proyectos,
    facturasRecientes: facturas,
    tareasAbiertas: tareas,
  })
}
