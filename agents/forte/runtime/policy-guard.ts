import { hasForteActionHandler } from "./handlers"
import { assertForteContext } from "./forte-context"
import type { ForteContext, ForteDecision, FortePlan, FortePlanStep } from "./types"

function isNonPersistentGenerateStep(step: FortePlanStep) {
  return step.inputs.persist !== true && step.inputs.persistChanges !== true
}

function buildExplanation(
  mode: ForteDecision["mode"],
  allowedSteps: FortePlanStep[],
  blockedSteps: ForteDecision["blockedSteps"],
) {
  if (mode === "deny") {
    return blockedSteps.length > 0
      ? `Plan denegado: ${blockedSteps.map((step) => step.reason).join("; ")}`
      : "Plan denegado por policy"
  }

  if (mode === "execute_after_approval") {
    return `Plan requiere aprobacion antes de ejecutar ${allowedSteps.length} paso(s)`
  }

  if (mode === "execute_now") {
    return `Plan aprobado para ejecucion inmediata de ${allowedSteps.length} paso(s)`
  }

  if (mode === "recommend_only") {
    return "Plan de recomendacion sin ejecucion directa"
  }

  return "Plan informativo sin ejecucion"
}

export function evaluateFortePlan(plan: FortePlan, ctx: ForteContext): ForteDecision {
  const context = assertForteContext(ctx)

  if (!context?.workspaceId) {
    return {
      mode: "deny",
      allowedSteps: [],
      blockedSteps: [{ stepId: "context", reason: "workspaceId es obligatorio" }],
      explanation: "Plan denegado: workspaceId es obligatorio",
    }
  }

  const executableNow: FortePlanStep[] = []
  const requiresApproval: FortePlanStep[] = []
  const blockedSteps: ForteDecision["blockedSteps"] = []

  for (const step of plan.steps) {
    if (!step.moduleId && !step.engineId) {
      blockedSteps.push({
        stepId: step.id,
        reason: "La accion no esta asociada a un modulo o engine conocido",
      })
      continue
    }

    if (!hasForteActionHandler(step.actionId)) {
      blockedSteps.push({
        stepId: step.id,
        reason: `No existe handler registrado para ${step.actionId}`,
      })
      continue
    }

    if (step.kind === "read") {
      executableNow.push(step)
      continue
    }

    if (step.kind === "generate") {
      if (isNonPersistentGenerateStep(step)) {
        executableNow.push(step)
      } else {
        blockedSteps.push({
          stepId: step.id,
          reason: "Las acciones generate persistentes no estan permitidas",
        })
      }
      continue
    }

    if (step.kind === "write" || step.kind === "multi_step") {
      requiresApproval.push(step)
      continue
    }

    blockedSteps.push({
      stepId: step.id,
      reason: `Tipo de paso no soportado por policy: ${step.kind}`,
    })
  }

  let mode: ForteDecision["mode"] = "answer_only"
  let allowedSteps: FortePlanStep[] = []

  if (requiresApproval.length > 0) {
    mode = "execute_after_approval"
    allowedSteps = [...executableNow, ...requiresApproval]
  } else if (executableNow.length > 0) {
    mode = "execute_now"
    allowedSteps = executableNow
  } else if (plan.intent === "recommendation") {
    mode = "recommend_only"
  } else if (blockedSteps.length > 0 && plan.steps.length > 0) {
    mode = "deny"
  }

  return {
    mode,
    allowedSteps,
    blockedSteps,
    explanation: buildExplanation(mode, allowedSteps, blockedSteps),
  }
}
