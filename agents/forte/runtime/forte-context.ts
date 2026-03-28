import type { ForteContext, ForteContextInput } from "./types"

const FORBIDDEN_WORKSPACE_IDS = new Set(["ws_default"])

function assertNonEmpty(value: string, field: keyof ForteContextInput | "requestId") {
  if (!value || value.trim().length === 0) {
    throw new Error(`ForteContext invalido: ${field} es obligatorio`)
  }
}

export function createForteContext(input: ForteContextInput): ForteContext {
  assertNonEmpty(input.tenantId, "tenantId")
  assertNonEmpty(input.workspaceId, "workspaceId")
  assertNonEmpty(input.userId, "userId")
  assertNonEmpty(input.wsRole, "wsRole")

  if (FORBIDDEN_WORKSPACE_IDS.has(input.workspaceId)) {
    throw new Error("ForteContext invalido: workspace por defecto no permitido")
  }

  const requestId = input.requestId ?? crypto.randomUUID()
  assertNonEmpty(requestId, "requestId")

  return {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    wsRole: input.wsRole,
    surface: input.surface,
    requestId,
  }
}

export function assertForteContext(ctx: ForteContext): ForteContext {
  return createForteContext(ctx)
}

export function tryCreateForteContext(input: ForteContextInput) {
  try {
    return {
      ok: true as const,
      context: createForteContext(input),
    }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Contexto Forte invalido",
    }
  }
}

export function getForteContextKey(ctx: ForteContext) {
  return `${ctx.tenantId}:${ctx.workspaceId}:${ctx.userId}:${ctx.surface}`
}
