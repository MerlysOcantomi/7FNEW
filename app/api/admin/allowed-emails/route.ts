import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

function ensurePlatformAdmin(role: string) {
  if (role !== "admin") {
    return errorResponse(
      "FORBIDDEN",
      "Se requiere rol global admin para operar sobre recursos globales",
      403
    )
  }

  return null
}

export async function GET() {
  try {
    const { session } = await requireAdminAccess()
    const forbidden = ensurePlatformAdmin(session.role)
    if (forbidden) return forbidden

    const emails = await db.allowedEmail.findMany({
      orderBy: { createdAt: "desc" },
    })

    return successResponse(emails)
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAdminAccess()
    const forbidden = ensurePlatformAdmin(session.role)
    if (forbidden) return forbidden

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
    return handleError(error, "AllowedEmail")
  }
}
