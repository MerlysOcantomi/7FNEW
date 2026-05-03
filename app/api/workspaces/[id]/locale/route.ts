import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminInWorkspace } from "@/lib/auth/workspace-auth"
import { getWorkspaceWithResolvedConfig, updateWorkspaceConfig } from "@/lib/workspace"
import { SUPPORTED_LOCALES, isValidLocale, type SupportedLocale } from "@core/i18n"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await requireAdminInWorkspace(id)

    const ws = await getWorkspaceWithResolvedConfig(id)
    if (!ws) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)

    return successResponse({
      locale: ws.locale,
      supported: SUPPORTED_LOCALES,
    })
  } catch (error) {
    return handleError(error, "Workspace")
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await requireAdminInWorkspace(id)

    const body = await request.json()
    const { locale } = body as { locale?: string }

    if (!locale || typeof locale !== "string") {
      return errorResponse("VALIDATION_ERROR", "locale es requerido")
    }

    if (!isValidLocale(locale)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Locale "${locale}" no soportado. Opciones: ${SUPPORTED_LOCALES.join(", ")}`,
      )
    }

    await updateWorkspaceConfig(id, {
      locale: locale as SupportedLocale,
      modules: {},
      ui: { labels: {} },
    })

    const ws = await getWorkspaceWithResolvedConfig(id)
    if (!ws) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)

    return successResponse({ locale: ws.locale })
  } catch (error) {
    return handleError(error, "Workspace")
  }
}
