import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    await requireAdminAccess()

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
    await requireAdminAccess()

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
