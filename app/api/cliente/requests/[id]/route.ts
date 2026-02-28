import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  const existing = await db.clientRequest.findFirst({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      clienteId: ctx.clienteId,
    },
  })

  if (!existing) {
    return NextResponse.json(
      { error: "Solicitud no encontrada" },
      { status: 404 }
    )
  }

  try {
    const body = await request.json()
    const { status } = body as { status?: string }

    if (status && status !== "DONE") {
      return NextResponse.json(
        { error: "Solo puedes marcar la solicitud como completada (DONE)" },
        { status: 400 }
      )
    }

    const updated = await db.clientRequest.update({
      where: { id },
      data: { status: "DONE" },
      include: {
        proyecto: { select: { id: true, nombre: true } },
        assets: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Client request update error:", error)
    return NextResponse.json(
      { error: "Error al actualizar solicitud" },
      { status: 500 }
    )
  }
}
