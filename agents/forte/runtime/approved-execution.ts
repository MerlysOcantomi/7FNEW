import {
  createApprovalFingerprint,
  isApprovalExpired,
  rehydrateApprovedPlan,
} from "./approval"
import type { ApprovalRequest } from "./approval"
import { assertForteContext, getForteContextKey } from "./forte-context"
import { runStepWithHandler } from "./run-step"
import type {
  ApprovedExecutionResult,
  ApprovedExecutionStepResult,
  ForteContext,
} from "./types"

const SUPPORTED_WRITE_ACTIONS = new Set(["tareas.create"])

export function addSupportedWriteAction(actionId: string): void {
  SUPPORTED_WRITE_ACTIONS.add(actionId)
}

export function isSupportedWriteAction(actionId: string): boolean {
  return SUPPORTED_WRITE_ACTIONS.has(actionId)
}

export async function executeApprovedRequest(
  request: ApprovalRequest,
  ctx: ForteContext,
): Promise<ApprovedExecutionResult> {
  const startedAt = new Date().toISOString()
  const context = assertForteContext(ctx)

  if (request.status !== "approved") {
    return blocked(request.planId, startedAt, `Request no aprobada (status=${request.status})`)
  }

  if (request.executionStatus !== "not_started") {
    return blocked(
      request.planId,
      startedAt,
      `Ejecucion no permitida (executionStatus=${request.executionStatus})`,
    )
  }

  if (isApprovalExpired(request)) {
    return blocked(request.planId, startedAt, "La aprobacion ha expirado")
  }

  const recalculatedFingerprint = await createApprovalFingerprint(request.snapshot)
  if (recalculatedFingerprint !== request.fingerprint) {
    return blocked(request.planId, startedAt, "El fingerprint no coincide con el snapshot")
  }

  const currentContextKey = getForteContextKey(context)
  if (currentContextKey !== request.contextKey) {
    return blocked(request.planId, startedAt, "El contexto actual no coincide con el aprobado")
  }

  const rehydrated = await rehydrateApprovedPlan({ request, context })
  if (!rehydrated.ok) {
    return blocked(request.planId, startedAt, rehydrated.reason ?? "Error al rehidratar plan")
  }

  const plan = rehydrated.plan!
  const approvedStepIds = new Set(request.approvedSteps)

  const stepsToExecute = plan.steps.filter((step) => approvedStepIds.has(step.id))
  const skippedSteps = plan.steps
    .filter((step) => !approvedStepIds.has(step.id))
    .map((step) => ({ stepId: step.id, reason: "Step no incluido en approvedSteps" }))

  const executedSteps: ApprovedExecutionStepResult[] = []
  const blockedSteps = [...skippedSteps]

  for (const step of stepsToExecute) {
    if (step.kind === "write" && !SUPPORTED_WRITE_ACTIONS.has(step.actionId)) {
      blockedSteps.push({
        stepId: step.id,
        reason: `Accion write no soportada en esta fase: ${step.actionId}`,
      })
      continue
    }

    const result = await runStepWithHandler(step, context)
    if (result.skipped) {
      blockedSteps.push({ stepId: step.id, reason: result.skipped.reason })
    }
    if (result.executed) {
      executedSteps.push({
        stepId: step.id,
        actionId: result.executed.actionId,
        ok: result.executed.ok,
        data: result.executed.data,
        message: result.executed.message,
      })
    }
  }

  const allOk = executedSteps.length > 0 && executedSteps.every((s) => s.ok)

  return {
    ok: allOk,
    planId: request.planId,
    executedSteps,
    blockedSteps: blockedSteps.length > 0 ? blockedSteps : undefined,
    executionStartedAt: startedAt,
    executionFinishedAt: new Date().toISOString(),
  }
}

function blocked(
  planId: string,
  startedAt: string,
  message: string,
): ApprovedExecutionResult {
  return {
    ok: false,
    planId,
    executedSteps: [],
    executionStartedAt: startedAt,
    executionFinishedAt: new Date().toISOString(),
    message,
  }
}
