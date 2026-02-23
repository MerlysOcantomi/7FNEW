import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"

export async function GET() {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [documentos, attachments] = await Promise.all([
    db.documento.findMany({
      where: { clienteId: session.clienteId },
      orderBy: { createdAt: "desc" },
    }),
    db.attachment.findMany({
      where: { module: "clientes", recordId: session.clienteId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({ documentos, attachments })
}

export async function POST(request: NextRequest) {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { nombre, url, tipo, tamano, proyectoId } = body

    if (!nombre || !url || !tipo) {
      return NextResponse.json(
        { error: "nombre, url y tipo son requeridos" },
        { status: 400 }
      )
    }

    if (proyectoId) {
      const proyecto = await db.proyecto.findFirst({
        where: { id: proyectoId, clienteId: session.clienteId },
      })
      if (!proyecto) {
        return NextResponse.json(
          { error: "Proyecto no encontrado o no pertenece a tu cuenta" },
          { status: 403 }
        )
      }
    }

    const documento = await db.documento.create({
      data: {
        nombre,
        url,
        tipo,
        tamano: tamano ? Number(tamano) : null,
        clienteId: session.clienteId,
        proyectoId: proyectoId || null,
      },
    })

    return NextResponse.json(documento, { status: 201 })
  } catch (error) {
    console.error("Client file upload error:", error)
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 })
  }
}
