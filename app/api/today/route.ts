import { NextRequest } from "next/server"
import { handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { aggregateToday } from "@modules/today/aggregator"

/**
 * GET /api/today
 *
 * Read-only aggregator for the unified Today view. Composes existing
 * workspace-scoped sources (`InboxTodo`, `Tarea`, `Evento`) into the
 * `TodayPayload` contract. No new persistence, no Fanny pipeline change, no
 * write side effects.
 *
 * Authentication: any authenticated workspace member with VIEWER or higher
 * (`requireReadAccess`). Anonymous traffic → 401, non-member sessions → 403,
 * cross-tenant header attempts → 403.
 *
 * Timezone resolution: the client passes its IANA timezone via the `?tz=`
 * query string (typically `Intl.DateTimeFormat().resolvedOptions().timeZone`).
 * Invalid or missing values fall back to `"UTC"`; the aggregator validates and
 * silently substitutes if the string isn't a real zone. `tz` is intentionally
 * a query param rather than a request header so it stays observable in logs
 * during early debugging of the bucket boundaries.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId, session } = await requireReadAccess(request)
    const url = new URL(request.url)
    const tz = url.searchParams.get("tz") ?? "UTC"

    const payload = await aggregateToday({
      workspaceId,
      userId: session.userId,
      timezone: tz,
    })

    return successResponse(payload)
  } catch (error) {
    return handleError(error, "Today")
  }
}
