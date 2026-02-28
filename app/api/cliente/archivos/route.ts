import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getRequiredPortalContext } from "@/lib/auth/portal-context"

const VALID_TYPES = ["DOCUMENT", "IMAGE", "LOGO", "VIDEO", "OTHER"]

function inferType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("video/")) return "VIDEO"
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("text/")
  )
    return "DOCUMENT"
  return "OTHER"
}

export async function GET(request: NextRequest) {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const typeFilter = request.nextUrl.searchParams.get("type")
  const search = request.nextUrl.searchParams.get("q")?.trim()

  const where: Record<string, unknown> = {
    workspaceId: ctx.workspaceId,
    clienteId: ctx.clienteId,
  }

  if (typeFilter && VALID_TYPES.includes(typeFilter)) {
    where.type = typeFilter
  }

  if (search && search.length >= 2) {
    where.filename = { contains: search }
  }

  const assets = await db.clientAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  const documentos = await db.documento.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clienteId: ctx.clienteId,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ assets, documentos })
}

export async function POST(request: NextRequest) {
  const ctx = await getRequiredPortalContext()
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { filename, url, mimeType, sizeBytes, type, projectId } = body as {
      filename?: string
      url?: string
      mimeType?: string
      sizeBytes?: number
      type?: string
      projectId?: string
    }

    if (!filename || !url || !mimeType) {
      return NextResponse.json(
        { error: "filename, url y mimeType son requeridos" },
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

    const resolvedType =
      type && VALID_TYPES.includes(type) ? type : inferType(mimeType)

    const asset = await db.clientAsset.create({
      data: {
        workspaceId: ctx.workspaceId,
        clienteId: ctx.clienteId,
        projectId: projectId || null,
        type: resolvedType,
        filename,
        mimeType,
        sizeBytes: sizeBytes ? Number(sizeBytes) : 0,
        url,
        createdByPortalUserId: ctx.portalUserId,
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error("Client asset upload error:", error)
    return NextResponse.json(
      { error: "Error al subir archivo" },
      { status: 500 }
    )
  }
}
