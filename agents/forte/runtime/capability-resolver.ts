import {
  ensurePilotManifestsRegistered,
  registry,
  type AgentToolDefinition,
  type EngineManifest,
  type ModuleManifest,
  type ToolManifest,
} from "@core/registry"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { listForteActionHandlers } from "./handlers"
import { assertForteContext } from "./forte-context"
import type {
  ForteActionKind,
  ForteCapability,
  ForteContext,
  ForteEffectiveCapabilities,
  ResolveForteCapabilitiesOptions,
} from "./types"

const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
}

const SURFACE_ACTIONS: Record<string, ForteActionKind[]> = {
  recommend: ["read", "generate"],
  assistant: ["read", "write", "generate"],
  automation: ["read", "write", "generate", "multi_step"],
  inbox: ["read", "write", "generate"],
}

function getRoleLevel(role: string) {
  return ROLE_LEVELS[role] ?? 0
}

function isSurfaceAllowed(surface: ForteContext["surface"], kind: ForteActionKind) {
  return (SURFACE_ACTIONS[surface] ?? []).includes(kind)
}

function isKindAllowedByRole(role: string, kind: ForteActionKind) {
  const level = getRoleLevel(role)
  if (kind === "read") return level >= ROLE_LEVELS.VIEWER
  if (kind === "generate") return level >= ROLE_LEVELS.VIEWER
  if (kind === "write") return level >= ROLE_LEVELS.MEMBER
  return level >= ROLE_LEVELS.ADMIN
}

function buildCapabilityReason(
  ctx: ForteContext,
  kind: ForteActionKind,
  source: "manifest-tool" | "runtime-handler",
) {
  const bits = [`source=${source}`, `surface=${ctx.surface}`, `role=${ctx.wsRole}`]
  if (kind !== "read") bits.push("approval=true")
  return bits.join(", ")
}

function isModuleEnabledByWorkspace(manifest: ModuleManifest, enabledMap: Record<string, boolean>) {
  const explicit = enabledMap[manifest.id]
  if (explicit === true) return true
  if (explicit === false) return false
  return manifest.optional === false
}

export function resolveEffectiveEngines(allEngines: EngineManifest[]) {
  return allEngines.filter((engine) => registry.validateDependencies(engine).length === 0)
}

export function resolveEffectiveRegistryTools(allTools: ToolManifest[], engineIds: Set<string>) {
  return allTools.filter((tool) =>
    tool.dependencies.every((dep) => {
      if (dep.startsWith("core/")) return true
      if (dep.startsWith("engines/")) return engineIds.has(dep.replace("engines/", ""))
      return true
    }),
  )
}

export function resolveEffectiveModules(
  allModules: ModuleManifest[],
  enabledMap: Record<string, boolean>,
  engineIds: Set<string>,
) {
  const active = new Set(
    allModules
      .filter((manifest) => isModuleEnabledByWorkspace(manifest, enabledMap))
      .map((manifest) => manifest.id),
  )

  let changed = true

  while (changed) {
    changed = false
    for (const manifest of allModules) {
      if (!active.has(manifest.id)) continue

      const dependenciesOk = manifest.dependencies.every((dep) => {
        if (dep.startsWith("core/")) return true
        if (dep.startsWith("engines/")) {
          return engineIds.has(dep.replace("engines/", ""))
        }
        return active.has(dep)
      })

      if (!dependenciesOk) {
        active.delete(manifest.id)
        changed = true
      }
    }
  }

  return allModules.filter((manifest) => active.has(manifest.id))
}

function capabilityFromManifestTool(
  ctx: ForteContext,
  moduleId: string,
  tool: AgentToolDefinition,
): ForteCapability {
  const allowed =
    isSurfaceAllowed(ctx.surface, tool.type) && isKindAllowedByRole(ctx.wsRole, tool.type)

  return {
    capabilityId: tool.name,
    moduleId,
    toolName: tool.name,
    kind: tool.type,
    allowed,
    requiresApproval: tool.type !== "read",
    reason: buildCapabilityReason(ctx, tool.type, "manifest-tool"),
    source: "manifest-tool",
  }
}

function capabilityFromRuntimeHandler(ctx: ForteContext, handler: ReturnType<typeof listForteActionHandlers>[number]): ForteCapability {
  const allowed =
    isSurfaceAllowed(ctx.surface, handler.kind) &&
    isKindAllowedByRole(ctx.wsRole, handler.kind)

  return {
    capabilityId: handler.actionId,
    moduleId: handler.moduleId,
    engineId: handler.engineId,
    toolName: handler.actionId,
    kind: handler.kind,
    allowed,
    requiresApproval: handler.kind !== "read",
    reason: buildCapabilityReason(ctx, handler.kind, "runtime-handler"),
    source: "runtime-handler",
  }
}

function dedupeCapabilities(capabilities: ForteCapability[]) {
  const byId = new Map<string, ForteCapability>()
  for (const capability of capabilities) {
    if (!byId.has(capability.capabilityId)) {
      byId.set(capability.capabilityId, capability)
    }
  }
  return Array.from(byId.values())
}

export async function resolveForteCapabilities(
  options: ResolveForteCapabilitiesOptions,
): Promise<ForteEffectiveCapabilities> {
  const context = assertForteContext(options.context)

  ensurePilotManifestsRegistered()

  const workspace = await getWorkspaceWithResolvedConfig(context.workspaceId)
  if (!workspace) {
    throw new Error("No se pudo resolver la configuracion del workspace para Forte")
  }

  const allModules = registry.getAllModules()
  const allEngines = registry.getAllEngines()
  const allRegistryTools = registry.getAllTools()

  const effectiveEngines = resolveEffectiveEngines(allEngines)
  const engineIds = new Set(effectiveEngines.map((engine) => engine.id))
  const effectiveModules = resolveEffectiveModules(
    allModules,
    workspace.resolvedConfig.modules,
    engineIds,
  )
  const activeModuleIds = new Set(effectiveModules.map((module) => module.id))
  const effectiveRegistryTools = resolveEffectiveRegistryTools(allRegistryTools, engineIds)

  const manifestTools = effectiveModules.flatMap((module) =>
    (module.tools ?? []).map((tool) => ({ moduleId: module.id, tool })),
  )

  const runtimeHandlers = listForteActionHandlers().filter((handler) => {
    if (handler.moduleId) return activeModuleIds.has(handler.moduleId)
    if (handler.engineId) return engineIds.has(handler.engineId)
    return false
  })

  const capabilities = dedupeCapabilities([
    ...manifestTools.map(({ moduleId, tool }) =>
      capabilityFromManifestTool(context, moduleId, tool),
    ),
    ...runtimeHandlers.map((handler) => capabilityFromRuntimeHandler(context, handler)),
  ])

  const availableCapabilities = Array.from(
    new Set([
      ...effectiveModules.flatMap((module) => module.provides ?? []),
      ...effectiveEngines.flatMap((engine) => engine.provides ?? []),
      ...effectiveRegistryTools.flatMap((tool) => tool.provides ?? []),
    ]),
  ).sort()

  return {
    modules: effectiveModules,
    engines: effectiveEngines,
    registryTools: effectiveRegistryTools,
    tools: manifestTools.map(({ tool }) => tool),
    capabilities: availableCapabilities,
    actions: {
      read: capabilities.filter((capability) => capability.kind === "read"),
      write: capabilities.filter((capability) => capability.kind === "write"),
      generate: capabilities.filter((capability) => capability.kind === "generate"),
    },
  }
}
