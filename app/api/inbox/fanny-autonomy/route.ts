import { NextRequest } from "next/server"
import { z } from "zod"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireAdminAccess, requireReadAccess } from "@/lib/auth/workspace-auth"
import {
  FANNY_ACTION_CATALOG,
  FANNY_AUTONOMY_MODES,
  isFannyOperationId,
  type FannyOperationId,
} from "@modules/inbox/fanny-action-catalog"
import {
  listFannyAutonomyRules,
  upsertFannyAutonomyRule,
} from "@modules/inbox/fanny-autonomy"

const updateSchema = z.object({
  actionId: z.string().min(1),
  mode: z.enum(FANNY_AUTONOMY_MODES),
  channels: z.array(z.string().min(1).max(80)).max(20).optional(),
  urgency: z.array(z.enum(["baja", "media", "alta", "critica"])).max(4).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  params: z.record(z.unknown()).optional(),
}).strict()

function serializeCatalog() {
  return Object.values(FANNY_ACTION_CATALOG).map((definition) => ({
    id: definition.id,
    group: definition.group,
    availability: definition.availability,
    riskClass: definition.riskClass,
    configurable: definition.configurable,
    defaultMode: definition.defaultMode,
    allowedModes: [...definition.allowedModes],
    minAutoConfidence: definition.minAutoConfidence ?? null,
    autoRequiresParams: definition.autoRequiresParams
      ? [...definition.autoRequiresParams]
      : [],
  }))
}

/**
 * GET — readable by every workspace member so the UI can explain what Fanny
 * may do. Rules contain no secrets; they are product policy metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId, wsRole } = await requireReadAccess(request)
    const rules = await listFannyAutonomyRules(workspaceId)
    return successResponse({
      catalog: serializeCatalog(),
      rules,
      canEdit: wsRole === "OWNER" || wsRole === "ADMIN",
    })
  } catch (error) {
    return handleError(error, "FannyAutonomy")
  }
}

/**
 * PUT — ADMIN/OWNER only. A workspace member can use Fanny but cannot silently
 * widen the business's automation policy.
 */
export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess(request)
    const body = updateSchema.parse(await request.json())
    if (!isFannyOperationId(body.actionId)) {
      return errorResponse("VALIDATION_ERROR", "Acción de Fanny no reconocida", 400)
    }

    const definition = FANNY_ACTION_CATALOG[body.actionId]
    if (!definition.configurable) {
      return errorResponse(
        "VALIDATION_ERROR",
        definition.availability === "executable"
          ? "Esta acción usa una política fija"
          : "Esta acción aún no admite automatización",
        400,
      )
    }

    if (!definition.allowedModes.includes(body.mode)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "El modo solicitado no está permitido para esta acción",
        400,
      )
    }

    const record = await upsertFannyAutonomyRule({
      workspaceId,
      actionId: body.actionId as FannyOperationId,
      mode: body.mode,
      channels: body.channels,
      urgency: body.urgency,
      minConfidence: body.minConfidence,
      params: body.params,
    })

    const rules = await listFannyAutonomyRules(workspaceId)
    return successResponse({ recordId: record.id, rules })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        "VALIDATION_ERROR",
        error.issues.map((issue) => issue.message).join("; "),
        400,
      )
    }
    return handleError(error, "FannyAutonomy")
  }
}
