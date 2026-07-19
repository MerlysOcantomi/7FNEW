import { NextRequest } from "next/server"
import { handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { loadBeautyToday } from "@modules/today/beauty-aggregator"

/**
 * GET /api/today/beauty
 *
 * Read-only aggregation for the appointment-first Beauty "Hoy". Composes the
 * SAME task reality as `/api/today` (via `aggregateToday`) with today's real
 * citas (`Evento` + `Cliente`), pending conversations and urgent collections
 * into the `BeautyTodayPayload` contract. No writes, no schema changes.
 *
 * Authentication mirrors `/api/today`: any authenticated member with VIEWER
 * or higher (`requireReadAccess`). Anonymous → 401, non-member → 403,
 * cross-tenant header attempts → 403.
 *
 * `?tz=` carries the viewer's IANA timezone (default UTC, validated with
 * fallback) — same convention as `/api/today`.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId, session } = await requireReadAccess(request)
    const url = new URL(request.url)
    const tz = url.searchParams.get("tz") ?? "UTC"

    const payload = await loadBeautyToday({
      workspaceId,
      userId: session.userId,
      timezone: tz,
    })

    return successResponse(payload)
  } catch (error) {
    return handleError(error, "BeautyToday")
  }
}
