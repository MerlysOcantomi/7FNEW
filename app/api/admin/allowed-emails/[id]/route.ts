import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAccess()

    const { id } = await params
    const body = await request.json()
    const { role } = body as { role?: string }

    if (!role || !["admin", "editor", "viewer"].includes(role)) {
      return errorResponse("VALIDATION_ERROR", "Role debe ser: admin, editor, viewer")
    }

    const record = await db.allowedEmail.update({
      where: { id },
      data: { role },
    })

    const user = await db.user.findUnique({ where: { email: record.email } })
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { role } })
    }

    return successResponse(record)
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()

    const { id } = await params
    const record = await db.allowedEmail.findUnique({ where: { id } })

    if (!record) {
      return errorResponse("NOT_FOUND", "Email no encontrado", 404)
    }

    if (record.email === session.email) {
      return errorResponse("FORBIDDEN", "No puedes eliminar tu propio acceso", 403)
    }

    await db.allowedEmail.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}
