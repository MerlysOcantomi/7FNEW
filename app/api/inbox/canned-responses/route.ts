import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { parseJsonConfig } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"

interface CannedResponse {
  id: string
  label: string
  content: string
}

const MAX_ITEMS = 50
const MAX_LABEL_LENGTH = 80
const MAX_CONTENT_LENGTH = 2000

function isValidCannedResponse(item: unknown): item is CannedResponse {
  if (!item || typeof item !== "object") return false
  const r = item as Record<string, unknown>
  return (
    typeof r.id === "string" &&
    typeof r.label === "string" &&
    typeof r.content === "string" &&
    r.id.trim().length > 0 &&
    r.label.trim().length > 0 &&
    r.content.trim().length > 0 &&
    r.label.length <= MAX_LABEL_LENGTH &&
    r.content.length <= MAX_CONTENT_LENGTH
  )
}

function readCannedResponses(configJson: string | null): CannedResponse[] {
  const config = parseJsonConfig(configJson)
  const inbox = (config as Record<string, unknown>).inbox as Record<string, unknown> | undefined
  const list = inbox?.cannedResponses
  if (!Array.isArray(list)) return []
  return list.filter(isValidCannedResponse)
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true },
    })
    return successResponse(readCannedResponses(ws?.config ?? null))
  } catch (error) {
    return handleError(error, "CannedResponses")
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess(request)

    const body = await request.json()
    if (!Array.isArray(body)) {
      return errorResponse("VALIDATION_ERROR", "Body must be an array of canned responses")
    }

    if (body.length > MAX_ITEMS) {
      return errorResponse("VALIDATION_ERROR", `Maximum ${MAX_ITEMS} canned responses allowed`)
    }

    const invalid = body.findIndex((item) => !isValidCannedResponse(item))
    if (invalid !== -1) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Item at index ${invalid} is invalid. Each item needs id, label (max ${MAX_LABEL_LENGTH} chars), and content (max ${MAX_CONTENT_LENGTH} chars), all non-empty strings.`,
      )
    }

    const clean: CannedResponse[] = body.map((item) => ({
      id: (item as CannedResponse).id.trim(),
      label: (item as CannedResponse).label.trim(),
      content: (item as CannedResponse).content.trim(),
    }))

    await updateWorkspaceConfig(workspaceId, {
      inbox: { cannedResponses: clean },
      modules: {},
      ui: { labels: {} },
    } as never)

    return successResponse(clean)
  } catch (error) {
    return handleError(error, "CannedResponses")
  }
}
