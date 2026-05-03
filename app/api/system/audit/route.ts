import { NextRequest } from "next/server"
import { successResponse, handleError } from "@/lib/api"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { listPlatformAuditLogs } from "@core/system/audit"

/**
 * Read-only listing of the platform audit trail.
 *
 * Anyone holding a platform role can read this — the trail is operator
 * metadata and inspecting it does NOT cross any tenant boundary. Mutations
 * (create/update/delete on `PlatformAuditLog`) are NOT exposed: the model
 * is append-only by design and rows are written exclusively by the
 * `logPlatformAudit` helper.
 *
 * Optional `?limit=` query parameter caps how many rows are returned.
 * Defaults to 100, hard cap 500 (enforced by the accessor).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAnyPlatformRole()

    const url = new URL(request.url)
    const rawLimit = url.searchParams.get("limit")
    const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : undefined
    const limit = parsed && Number.isFinite(parsed) ? parsed : undefined

    const logs = await listPlatformAuditLogs({ limit })
    return successResponse({ logs, total: logs.length })
  } catch (error) {
    return handleError(error, "PlatformAudit")
  }
}
