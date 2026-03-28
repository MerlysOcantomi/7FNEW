import { assertForteContext } from "./forte-context"
import { runStepWithHandler } from "./run-step"
import type { ForteContext, ForteDecision, ForteRuntimeExecution } from "./types"

export async function executeForteDecision(
  decision: ForteDecision,
  ctx: ForteContext,
): Promise<ForteRuntimeExecution> {
  const context = assertForteContext(ctx)
  const execution: ForteRuntimeExecution = {
    executed: [],
    skipped: [],
  }

  if (decision.mode !== "execute_now") {
    execution.skipped.push({
      actionId: "decision",
      reason: `El modo ${decision.mode} no permite ejecucion directa`,
    })
    return execution
  }

  for (const step of decision.allowedSteps) {
    if (step.kind !== "read") {
      execution.skipped.push({
        actionId: step.actionId,
        reason: "En esta fase el runtime solo ejecuta acciones read",
      })
      continue
    }

    const result = await runStepWithHandler(step, context)
    if (result.skipped) {
      execution.skipped.push(result.skipped)
    }
    if (result.executed) {
      execution.executed.push(result.executed)
    }
  }

  return execution
}
