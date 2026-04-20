import type { NextSmartMovement } from "@/lib/inbox/next-smart-movement"
import type { InboxAutomationConfig } from "@/lib/inbox/inbox-automation-config"
import { canAutoExecuteMovement, getInboxAutomationConfig } from "@/lib/inbox/inbox-automation-config"

export type ExecuteNextSmartMovementOutcome =
  | { status: "not_supported_yet"; movementType: string }
  | { status: "approval_required"; movementType: string }
  | { status: "executed"; movementType: string; detail?: string }
  | { status: "failed"; movementType: string; error: string }

export interface ExecuteNextSmartMovementInput {
  workspaceId: string
  conversationId: string
  sourceMessageId: string | null
  movement: NextSmartMovement
  /** Resolved workspace config blob (merged); optional — falls back to strict no-auto. */
  workspaceConfig?: unknown
  /** Reserved for approval / audit trails in later phases. */
  actor?: { userId: string }
}

/**
 * Phase 5 foundation: dispatcher only. Real executors plug in later.
 */
export async function executeNextSmartMovement(input: ExecuteNextSmartMovementInput): Promise<ExecuteNextSmartMovementOutcome> {
  const cfg: InboxAutomationConfig = getInboxAutomationConfig(input.workspaceConfig ?? {})
  const ex = input.movement.execution

  if (ex.requiresApproval) {
    return { status: "approval_required", movementType: input.movement.type }
  }
  if (!cfg.enabled || !canAutoExecuteMovement(input.movement.type, cfg)) {
    return { status: "not_supported_yet", movementType: input.movement.type }
  }
  if (!ex.canAutoExecute || ex.executor === null) {
    return { status: "not_supported_yet", movementType: input.movement.type }
  }

  return { status: "not_supported_yet", movementType: input.movement.type }
}
