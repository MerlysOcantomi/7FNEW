import { resolveForteCapabilities } from "./capability-resolver"
import { createForteContext } from "./forte-context"
import { executeForteDecision } from "./action-runtime"
import { buildFortePlan } from "./decision-engine"
import { evaluateFortePlan } from "./policy-guard"
import type { ForteActionHandler, ForteContext, ForteSurface } from "./types"
import type { ToolDefinition } from "../tools"
import { getForteActionHandler, listForteActionHandlers } from "./handlers"

interface LegacyToolBridge {
  legacyName: string
  actionId: string
  description: string
  parameters: Record<string, unknown>
}

const LEGACY_TOOL_BRIDGES: LegacyToolBridge[] = [
  {
    legacyName: "buscar_clientes",
    actionId: "clientes.list",
    description: "Buscar clientes por nombre, email o empresa dentro del workspace activo.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Texto de busqueda (nombre, email o empresa)" },
      },
      required: ["search"],
    },
  },
  {
    legacyName: "detalle_cliente",
    actionId: "clientes.get",
    description: "Obtener detalle completo de un cliente por su ID dentro del workspace activo.",
    parameters: {
      type: "object",
      properties: {
        clienteId: { type: "string", description: "ID del cliente" },
      },
      required: ["clienteId"],
    },
  },
  {
    legacyName: "detalle_proyecto",
    actionId: "proyectos.get",
    description: "Obtener detalle completo de un proyecto por su ID dentro del workspace activo.",
    parameters: {
      type: "object",
      properties: {
        proyectoId: { type: "string", description: "ID del proyecto" },
      },
      required: ["proyectoId"],
    },
  },
  {
    legacyName: "buscar_tareas",
    actionId: "tareas.list",
    description: "Buscar tareas del workspace activo con filtros operativos.",
    parameters: {
      type: "object",
      properties: {
        estado: { type: "string", description: "Estado de la tarea" },
        prioridad: { type: "string", description: "Prioridad de la tarea" },
        proyectoId: { type: "string", description: "Proyecto asociado" },
        clienteId: { type: "string", description: "Cliente asociado" },
        usuarioId: { type: "string", description: "Usuario asignado" },
        search: { type: "string", description: "Texto de busqueda" },
      },
    },
  },
]

export function buildAssistantForteContext(input: {
  tenantId?: string
  workspaceId: string
  userId: string
  wsRole: string
  requestId?: string
  surface?: ForteSurface
}): ForteContext {
  return createForteContext({
    tenantId: input.tenantId ?? input.workspaceId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    wsRole: input.wsRole,
    requestId: input.requestId,
    surface: input.surface ?? "assistant",
  })
}

export async function getAgentToolsForForteContext(
  context: ForteContext,
  legacyTools: ToolDefinition[],
): Promise<ToolDefinition[]> {
  const effective = await resolveForteCapabilities({ context })
  const allowedReadActionIds = new Set(
    effective.actions.read
      .filter((capability) => capability.allowed)
      .map((capability) => capability.capabilityId),
  )

  const bridgedTools = LEGACY_TOOL_BRIDGES
    .filter((bridge) => allowedReadActionIds.has(bridge.actionId))
    .map<ToolDefinition>((bridge) => ({
      type: "function",
      function: {
        name: bridge.legacyName,
        description: bridge.description,
        parameters: bridge.parameters,
      },
    }))

  const bridgedNames = new Set(bridgedTools.map((tool) => tool.function.name))
  const remainingLegacy = legacyTools.filter((tool) => !bridgedNames.has(tool.function.name))

  return [...bridgedTools, ...remainingLegacy]
}

function toForteInputs(legacyName: string, args: Record<string, unknown>) {
  switch (legacyName) {
    case "detalle_cliente":
      return { id: args.clienteId }
    case "detalle_proyecto":
      return { id: args.proyectoId }
    default:
      return args
  }
}

export function getBridgedHandlerByLegacyToolName(legacyName: string): ForteActionHandler | undefined {
  const bridge = LEGACY_TOOL_BRIDGES.find((item) => item.legacyName === legacyName)
  if (!bridge) return undefined
  return getForteActionHandler(bridge.actionId)
}

export function listLegacyToolBridges() {
  const actionIds = new Set(listForteActionHandlers().map((handler) => handler.actionId))
  return LEGACY_TOOL_BRIDGES.filter((bridge) => actionIds.has(bridge.actionId))
}

export async function executeBridgedLegacyTool(
  legacyName: string,
  args: Record<string, unknown>,
  context: ForteContext,
) {
  const bridge = LEGACY_TOOL_BRIDGES.find((item) => item.legacyName === legacyName)
  if (!bridge) return null

  const capabilities = await resolveForteCapabilities({ context })
  const plan = buildFortePlan({
    context,
    intent: "query",
    summary: `Bridge temporal para ${legacyName}`,
    capabilities,
    actionId: bridge.actionId,
    inputs: toForteInputs(legacyName, args),
    reason: `Legacy tool bridge: ${legacyName} -> ${bridge.actionId}`,
  })
  const decision = evaluateFortePlan(plan, context)
  const execution = await executeForteDecision(decision, context)
  const first = execution.executed[0]

  if (!first) {
    return { success: false, error: decision.explanation }
  }

  return {
    success: first.ok,
    data: first.data,
    error: first.ok ? undefined : first.message,
  }
}
