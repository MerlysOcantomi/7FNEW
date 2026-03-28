import { getForteActionHandler } from "./handlers"
import type { ForteActionResult, ForteContext, FortePlanStep } from "./types"

export interface RunStepResult {
  executed?: ForteActionResult
  skipped?: { actionId: string; reason: string }
}

export async function runStepWithHandler(
  step: FortePlanStep,
  context: ForteContext,
): Promise<RunStepResult> {
  const handler = getForteActionHandler(step.actionId)
  if (!handler) {
    return {
      skipped: {
        actionId: step.actionId,
        reason: `No existe handler para ${step.actionId}`,
      },
    }
  }

  try {
    const data = await handler.run(context, step.inputs)
    return {
      executed: {
        ok: true,
        actionId: step.actionId,
        data,
      },
    }
  } catch (error) {
    return {
      executed: {
        ok: false,
        actionId: step.actionId,
        message: error instanceof Error ? error.message : "Error de ejecucion",
      },
    }
  }
}
