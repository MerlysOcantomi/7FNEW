import { NextRequest } from "next/server"
import { handleError, successResponse, errorResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { runFortePipeline } from "@/agents/forte/runtime/pipeline"
import { getForteApprovalStore } from "@/agents/forte/runtime/store-provider"
import type { ForteIntent, ForteSurface } from "@/agents/forte/runtime"

export async function GET() {
  return successResponse({
    endpoint: "/api/forte/runtime-test",
    method: "POST",
    description: "Surface tecnica interna para validar el pipeline de Mr Forte sin UI y sin writes.",
    example: {
      tenantId: "same-as-workspace-for-now",
      surface: "assistant",
      intent: "query",
      summary: "Listar clientes del workspace activo",
      actionId: "clientes.list",
      inputs: { search: "acme" },
    },
    notes: [
      "workspaceId se resuelve desde auth/workspace context, nunca desde el modelo",
      "tenantId sigue siendo obligatorio a nivel de contrato del runtime",
      "esta surface solo ejecuta reads",
      "los approvals generados se persisten en el store compartido",
    ],
  })
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session, wsRole } = await requireReadAccess(request)
    const body = await request.json()
    const {
      tenantId,
      surface = "assistant",
      intent = "query",
      summary = "Prueba tecnica de runtime Forte",
      actionId = "clientes.list",
      moduleId,
      engineId,
      inputs = {},
    } = body as {
      tenantId?: string
      surface?: ForteSurface
      intent?: ForteIntent
      summary?: string
      actionId?: string
      moduleId?: string
      engineId?: string
      inputs?: Record<string, unknown>
    }

    if (!tenantId || typeof tenantId !== "string") {
      return errorResponse("VALIDATION", "tenantId es obligatorio para esta surface tecnica", 400)
    }

    const result = await runFortePipeline({
      context: {
        tenantId,
        workspaceId,
        userId: session.userId,
        wsRole,
        surface,
        requestId: request.headers.get("x-request-id") ?? undefined,
      },
      intent,
      summary,
      actionId,
      moduleId,
      engineId,
      inputs,
      store: getForteApprovalStore(),
    })

    return successResponse(result, {
      surface: "forte-runtime-test",
      workspaceId,
    })
  } catch (error) {
    return handleError(error, "Forte Runtime Test")
  }
}
