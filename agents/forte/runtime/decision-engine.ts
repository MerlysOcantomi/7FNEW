import { assertForteContext } from "./forte-context"
import { resolveDomainStates } from "./business/domain-resolver"
import { mapIntentToDomains } from "./business/domain-mapper"
import { resolveSignals } from "./business/signals"
import type { DomainState } from "./business/domain-types"
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

const DOMAIN_AWARE_INTENTS: Set<ForteIntent> = new Set([
  "recommendation",
  "analysis",
])

function resolveDomainContext(input: BuildFortePlanInput): DomainState[] | undefined {
  if (!DOMAIN_AWARE_INTENTS.has(input.intent)) return undefined
  if (!input.capabilities) return undefined

  const activeModuleIds = input.capabilities.modules.map((m) => ({
    id: m.id,
    provides: m.provides ?? m.models ?? [],
  }))

  const signals = resolveSignals(
    Object.fromEntries(
      input.capabilities.capabilities.map((cap) => [cap, true]),
    ),
  )

  const states = resolveDomainStates({ signals, activeModules: activeModuleIds })

  const intentDomains = mapIntentToDomains(input.summary)
  if (intentDomains.length > 0) {
    return states.filter(
      (s) => s.level !== "none" || intentDomains.includes(s.domain),
    )
  }

  return states.filter((s) => s.level !== "none")
}

export function buildFortePlan(input: BuildFortePlanInput): FortePlan {
  assertForteContext(input.context)

  const domainContext = resolveDomainContext(input)

  if (input.intent === "recommendation" && !input.actionId) {
    return {
      intent: input.intent,
      summary: input.summary,
      steps: [],
      domainContext,
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
      domainContext,
    }
  }

  return {
    intent: input.intent,
    summary: input.summary,
    steps: [buildStep(input, capability)],
    domainContext,
  }
}
