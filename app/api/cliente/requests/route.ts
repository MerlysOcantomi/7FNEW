import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

export async function GET() {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const requests = await db.clientRequest.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: ctx.clienteId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      assets: true,
    },
  })

  return NextResponse.json(requests)
}

export async function POST(request: NextRequest) {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description, projectId, assets } = body as {
      title?: string
      description?: string
      projectId?: string
      assets?: { url: string; name: string }[]
    }

    if (!title || title.trim().length < 3) {
      return NextResponse.json(
        { error: "El título debe tener al menos 3 caracteres" },
        { status: 400 }
      )
    }

    if (projectId) {
      const proyecto = await db.proyecto.findFirst({
        where: {
          id: projectId,
          workspaceId: ctx.workspaceId,
          clienteId: ctx.clienteId,
        },
      })
      if (!proyecto) {
        return NextResponse.json(
          { error: "Proyecto no encontrado o no pertenece a tu cuenta" },
          { status: 403 }
        )
      }
    }

    const created = await db.clientRequest.create({
      data: {
        workspaceId: ctx.workspaceId,
        clienteId: ctx.clienteId,
        proyectoId: projectId || null,
        title: title.trim(),
        description: description?.trim() || null,
        status: "OPEN",
        priority: "MEDIUM",
        createdByPortalUserId: ctx.portalUserId,
        assets:
          assets && assets.length > 0
            ? {
                create: assets.map((a) => ({
                  assetUrl: a.url,
                  assetName: a.name,
                })),
              }
            : undefined,
      },
      include: {
        proyecto: { select: { id: true, nombre: true } },
        assets: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Client request creation error:", error)
    return NextResponse.json(
      { error: "Error al crear solicitud" },
      { status: 500 }
    )
  }
}
