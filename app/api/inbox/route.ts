import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError, getPaginationParams } from "@/lib/api"
import { classifyInboxEntry } from "@/lib/inbox"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)

    const estado = searchParams.get("estado")
    const tipo = searchParams.get("tipo")
    const urgencia = searchParams.get("urgencia")
    const fuente = searchParams.get("fuente")
    const q = searchParams.get("q")

    const where: Record<string, unknown> = {}

    if (estado && estado !== "todos") {
      where.estado = estado
    }
    if (tipo && tipo !== "todos") {
      where.tipo = tipo
    }
    if (urgencia && urgencia !== "todos") {
      where.urgencia = urgencia
    }
    if (fuente && fuente !== "todos") {
      where.fuente = fuente
    }
    if (q) {
      where.OR = [
        { nombre: { contains: q } },
        { email: { contains: q } },
        { mensaje: { contains: q } },
        { resumen: { contains: q } },
      ]
    }

    const [entries, total] = await Promise.all([
      db.inboxEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.inboxEntry.count({ where }),
    ])

    return successResponse(entries, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, email, telefono, mensaje, fuente = "manual" } = body

    if (!mensaje || typeof mensaje !== "string" || mensaje.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El mensaje es requerido")
    }

    const entry = await db.inboxEntry.create({
      data: {
        nombre: nombre || null,
        email: email || null,
        telefono: telefono || null,
        mensaje: mensaje.trim(),
        fuente,
        estado: "nuevo",
      },
    })

    classifyInBackground(entry.id, {
      nombre,
      email,
      telefono,
      mensaje: mensaje.trim(),
      fuente,
    })

    return successResponse(entry)
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}

function classifyInBackground(
  entryId: string,
  input: { nombre?: string; email?: string; telefono?: string; mensaje: string; fuente: string },
) {
  ;(async () => {
    try {
      console.log("[7F Inbox] Clasificando en background:", entryId)
      const classification = await classifyInboxEntry(input)

      await db.inboxEntry.update({
        where: { id: entryId },
        data: {
          tipo: classification.tipo,
          categoria: classification.categoria,
          urgencia: classification.urgencia,
          intencion: classification.intencion,
          resumen: classification.resumen,
          datosCliente: JSON.stringify(classification.datosCliente),
          datosProyecto: JSON.stringify(classification.datosProyecto),
          notas: classification.notas,
          tags: JSON.stringify(classification.tags),
          aiRaw: JSON.stringify(classification),
          estado: "clasificado",
        },
      })
      console.log("[7F Inbox] Clasificacion completada:", entryId)
    } catch (err) {
      console.error("[7F Inbox] Error clasificando:", err)
      await db.inboxEntry.update({
        where: { id: entryId },
        data: {
          estado: "error",
          notas: `Error de clasificacion: ${err instanceof Error ? err.message : "desconocido"}`,
        },
      }).catch(() => {})
    }
  })()
}
