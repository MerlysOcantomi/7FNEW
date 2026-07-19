import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { loadSalonOverview } from "@modules/overview/service"
import type { OverviewPeriodPreset } from "@modules/overview/types"

/**
 * GET /api/overview
 *
 * Read-only aggregation for "Mi salón" (the Finesse business overview).
 * Composes existing workspace-scoped sources (`Evento`, `Factura`, `Cliente`,
 * `Conversation`, `WorkspaceTask`, `Workspace.config`) into the
 * `SalonOverviewPayload` contract. No writes, no schema changes.
 *
 * Authentication mirrors `/api/today`: any authenticated member with VIEWER
 * or higher (`requireReadAccess`). Anonymous → 401, non-member → 403,
 * cross-tenant header attempts → 403.
 *
 * Query params:
 *   - `preset`: week | month | quarter | year (default month)
 *   - `tz`: viewer's IANA timezone (default UTC; invalid values fall back)
 */

const VALID_PRESETS = new Set<OverviewPeriodPreset>(["week", "month", "quarter", "year"])

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const url = new URL(request.url)

    const presetParam = url.searchParams.get("preset") ?? "month"
    const preset: OverviewPeriodPreset = VALID_PRESETS.has(presetParam as OverviewPeriodPreset)
      ? (presetParam as OverviewPeriodPreset)
      : "month"
    const tz = url.searchParams.get("tz") ?? "UTC"

    const payload = await loadSalonOverview(workspaceId, preset, tz)
    if (!payload) {
      return errorResponse("NOT_FOUND", "Workspace not found", 404)
    }

    return successResponse(payload)
  } catch (error) {
    return handleError(error, "Overview")
  }
}
