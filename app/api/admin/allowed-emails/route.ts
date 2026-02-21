import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { getSessionFromCookies } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { db } from "@/lib/db"

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session || !isAdmin(session.role)) {
    return errorResponse("FORBIDDEN", "Acceso denegado. Solo administradores.", 403)
  }

  const emails = await db.allowedEmail.findMany({
    orderBy: { createdAt: "desc" },
  })

  return successResponse(emails)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || !isAdmin(session.role)) {
    return errorResponse("FORBIDDEN", "Acceso denegado. Solo administradores.", 403)
  }

  try {
    const body = await request.json()
    const { email, role } = body as { email?: string; role?: string }

    if (!email || typeof email !== "string") {
      return errorResponse("VALIDATION_ERROR", "Email es obligatorio")
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return errorResponse("VALIDATION_ERROR", "Formato de email invalido")
    }

    const validRole = role && ["admin", "editor", "viewer"].includes(role) ? role : "viewer"

    const existing = await db.allowedEmail.findUnique({
      where: { email: normalizedEmail },
    })
    if (existing) {
      return errorResponse("CONFLICT", "Este email ya esta en la lista blanca", 409)
    }

    const record = await db.allowedEmail.create({
      data: { email: normalizedEmail, role: validRole },
    })

    return successResponse(record)
  } catch (error) {
    console.error("[7F Admin] Add allowed email error:", error)
    return errorResponse("INTERNAL_ERROR", "Error al agregar email", 500)
  }
}
