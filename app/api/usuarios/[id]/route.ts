import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateUsuarioSchema } from "@modules/usuarios/validation"
import * as service from "@modules/usuarios/service"
import { requireAdminAccess, requireReadAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

/**
 * Usuario item endpoints (CORE-01).
 *
 * The tenant comes EXCLUSIVELY from the guard; the `[id]` path param is
 * treated as an untrusted lookup key, never as proof of ownership.
 *
 * The service returns `null` for anything this workspace cannot prove it owns
 * — a foreign id, an orphan row, or a row shared with another workspace — and
 * every one of those cases is answered with the SAME 404 as a genuinely
 * missing record. That symmetry is deliberate: a caller must not be able to
 * tell "exists in another tenant" apart from "does not exist".
 */

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Usuario no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Usuario")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireAdminAccess(request)
    const { id } = await params
    const body = await request.json()
    const data = updateUsuarioSchema.parse(body)
    const record = await service.update(id, data, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Usuario no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Usuario")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireAdminAccess(request)
    const { id } = await params
    const removed = await service.remove(id, workspaceId)
    if (!removed) return errorResponse("NOT_FOUND", "Usuario no encontrado", 404)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Usuario")
  }
}
