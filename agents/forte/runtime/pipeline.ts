import { executeForteDecision } from "./action-runtime"
import { createApprovalRequest } from "./approval"
import { resolveForteCapabilities } from "./capability-resolver"
import { buildFortePlan } from "./decision-engine"
import { tryCreateForteContext } from "./forte-context"
import { evaluateFortePlan } from "./policy-guard"
import type { FortePipelineInput, FortePipelineResult } from "./types"

export async function runFortePipeline(
  input: FortePipelineInput,
): Promise<FortePipelineResult> {
  const contextResult = tryCreateForteContext(input.context)

  if (!contextResult.ok) {
    return {
      decision: {
        mode: "deny",
        allowedSteps: [],
        blockedSteps: [{ stepId: "context", reason: contextResult.error }],
        explanation: contextResult.error,
      },
    }
  }

  const context = contextResult.context
  const capabilities = await resolveForteCapabilities({ context })
  const plan = buildFortePlan({
    context,
    intent: input.intent,
    summary: input.summary,
    capabilities,
    actionId: input.actionId,
    moduleId: input.moduleId,
    engineId: input.engineId,
    inputs: input.inputs,
    reason: input.reason,
  })
  const decision = evaluateFortePlan(plan, context)
  let approval: Awaited<ReturnType<typeof createApprovalRequest>> | undefined
  if (decision.mode === "execute_after_approval") {
    approval = await createApprovalRequest({ plan, decision, context })
    if (input.store) {
      await input.store.create(approval)
    }
  }
  const execution =
    decision.mode === "execute_now"
      ? await executeForteDecision(decision, context)
      : undefined

  return {
    context,
    capabilities,
    plan,
    decision,
    execution,
    approval,
  }
}
