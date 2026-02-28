import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function GET() {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const facturas = await db.factura.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: ctx.clienteId,
    },
    orderBy: { fechaEmision: "desc" },
    include: {
      proyecto: { select: { id: true, nombre: true } },
    },
  })

  return NextResponse.json(facturas)
}
