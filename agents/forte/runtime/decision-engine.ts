import { assertForteContext } from "./forte-context"
import type {
  BuildFortePlanInput,
  ForteActionKind,
  ForteCapability,
  ForteIntent,
  FortePlan,
  FortePlanStep,
  ForteRiskLevel,
} from "./types"

function inferKindFromIntent(intent: ForteIntent): ForteActionKind {
  switch (intent) {
    case "query":
    case "analysis":
    case "recommendation":
      return "read"
    case "create":
    case "update":
      return "write"
    case "automation":
    case "coordination":
      return "multi_step"
    default:
      return "read"
  }
}

function riskLevelForKind(kind: ForteActionKind): ForteRiskLevel {
  switch (kind) {
    case "read":
      return "low"
    case "generate":
      return "medium"
    case "write":
    case "multi_step":
      return "high"
    default:
      return "medium"
  }
}

function findCapability(input: BuildFortePlanInput): ForteCapability | undefined {
  const all = [
    ...input.capabilities.actions.read,
    ...input.capabilities.actions.write,
    ...input.capabilities.actions.generate,
  ]

  if (input.actionId) {
    const byId = all.find((capability) => capability.capabilityId === input.actionId)
    if (byId) return byId
  }

  if (input.moduleId) {
    const byModule = all.find((capability) => capability.moduleId === input.moduleId)
    if (byModule) return byModule
  }

  if (input.engineId) {
    const byEngine = all.find((capability) => capability.engineId === input.engineId)
    if (byEngine) return byEngine
  }

  return undefined
}

function buildStep(input: BuildFortePlanInput, capability?: ForteCapability): FortePlanStep {
  const kind = capability?.kind ?? inferKindFromIntent(input.intent)
  const actionId = input.actionId ?? capability?.capabilityId ?? "unresolved.action"

  return {
    id: `step-${actionId.replace(/[^a-zA-Z0-9_.-]/g, "-")}`,
    kind,
    moduleId: input.moduleId ?? capability?.moduleId,
    engineId: input.engineId ?? capability?.engineId,
    actionId,
    inputs: input.inputs ?? {},
    riskLevel: riskLevelForKind(kind),
    requiresApproval: capability?.requiresApproval ?? kind !== "read",
    reason:
      input.reason ??
      capability?.reason ??
      `Plan generado para la intencion ${input.intent}`,
  }
}

export function buildFortePlan(input: BuildFortePlanInput): FortePlan {
  assertForteContext(input.context)

  if (input.intent === "recommendation" && !input.actionId) {
    return {
      intent: input.intent,
      summary: input.summary,
      steps: [],
    }
  }

  const capability = findCapability(input)

  if (
    !capability &&
    !input.actionId &&
    (input.intent === "query" || input.intent === "analysis")
  ) {
    return {
      intent: input.intent,
      summary: input.summary,
      steps: [],
    }
  }

  return {
    intent: input.intent,
    summary: input.summary,
    steps: [buildStep(input, capability)],
  }
}
