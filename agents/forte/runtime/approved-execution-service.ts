import type { ForteApprovalStore } from "./approval-store"
import { executeApprovedRequest } from "./approved-execution"
import type { ApprovedExecutionResult, ForteContext } from "./types"

export interface ExecuteApprovedPlanInput {
  planId: string
  context: ForteContext
}

export async function executeApprovedPlan(
  input: ExecuteApprovedPlanInput,
  store: ForteApprovalStore,
): Promise<ApprovedExecutionResult> {
  const { planId, context } = input

  const request = await store.getById(planId)
  if (!request) {
    return {
      ok: false,
      planId,
      executedSteps: [],
      executionStartedAt: new Date().toISOString(),
      executionFinishedAt: new Date().toISOString(),
      message: `ApprovalRequest no encontrada: ${planId}`,
    }
  }

  const running = {
    ...request,
    executionStatus: "running" as const,
    updatedAt: new Date().toISOString(),
  }
  await store.update(running)

  let result: ApprovedExecutionResult

  try {
    result = await executeApprovedRequest(request, context)
  } catch (error) {
    const failed = {
      ...running,
      executionStatus: "failed" as const,
      executionError: error instanceof Error ? error.message : "Error inesperado",
      updatedAt: new Date().toISOString(),
    }
    await store.update(failed)

    return {
      ok: false,
      planId,
      executedSteps: [],
      executionStartedAt: running.updatedAt,
      executionFinishedAt: new Date().toISOString(),
      message: failed.executionError,
    }
  }

  const finalStatus = result.ok ? "completed" : "failed"
  const finished = {
    ...running,
    executionStatus: finalStatus as "completed" | "failed",
    executedAt: new Date().toISOString(),
    executionError: result.ok ? null : (result.message ?? null),
    updatedAt: new Date().toISOString(),
  }
  await store.update(finished)

  return result
}
