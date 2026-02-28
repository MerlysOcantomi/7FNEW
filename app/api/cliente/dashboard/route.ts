import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function GET() {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const wsAndClient = {
    workspaceId: ctx.workspaceId,
    clienteId: ctx.clienteId,
  }

  const [proyectos, facturas, tareas, documentos, solicitudesAbiertas, ultimosAssets] =
    await Promise.all([
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
      db.clientRequest.count({
        where: { ...wsAndClient, status: { not: "DONE" } },
      }),
      db.clientAsset.findMany({
        where: wsAndClient,
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ])

  const stats = {
    totalProyectos: await db.proyecto.count({ where: wsAndClient }),
    proyectosActivos: await db.proyecto.count({
      where: { ...wsAndClient, estado: { not: "completado" } },
    }),
    totalFacturas: await db.factura.count({ where: wsAndClient }),
    facturasPendientes: await db.factura.count({
      where: {
        ...wsAndClient,
        estado: { in: ["pendiente", "enviada"] },
      },
    }),
    tareasAbiertas: await db.tarea.count({
      where: { ...wsAndClient, estado: { not: "completada" } },
    }),
    totalDocumentos: documentos,
    solicitudesAbiertas,
    totalAssets: await db.clientAsset.count({ where: wsAndClient }),
  }

  return NextResponse.json({
    stats,
    proyectosRecientes: proyectos,
    facturasRecientes: facturas,
    tareasAbiertas: tareas,
    ultimosAssets,
  })
}
