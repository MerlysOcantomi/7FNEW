import { PublicApiError } from "@core/errors"
import { createEnvironmentPolicySource } from "./env-provider"
import { decideOperation } from "./policy"
import { getOperation } from "./registry"
import type { OperationDecision, PolicySource, PrivilegedOperationId } from "./types"

export type { OperationDecision, OperationDefinition, OperationMode, PolicyResolution, PolicySource, PrivilegedOperationId } from "./types"
export { OPERATION_MODES } from "./types"
export { getOperation, isPrivilegedOperationId, listOperations } from "./registry"
export { decideOperation } from "./policy"
export { OPERATION_MODE_ENV, createEnvironmentPolicySource, parseOperationMode } from "./env-provider"

/**
 * Raised when a privileged operation is refused. A `PublicApiError`, so
 * `core/api.ts#handleError` publishes it as-is: HTTP 503 with a stable code
 * and a message that carries no runtime values.
 */
export class PrivilegedOperationDeniedError extends PublicApiError {
  readonly operation: PrivilegedOperationId
  readonly decision: OperationDecision

  constructor(decision: OperationDecision) {
    super(
      "OPERATION_FROZEN",
      decision.mode === "invalid"
        ? "Privileged operations are temporarily unavailable"
        : "Writes are temporarily frozen for maintenance; reads remain available",
      503,
    )
    this.name = "PrivilegedOperationDeniedError"
    this.operation = decision.operation
    this.decision = decision
  }
}

/**
 * The active policy source. Defaults to runtime configuration; a different
 * source (tests today, Mission Control later) is installed with
 * `setPolicySource` and removed with `resetPolicySource`. Callers never see
 * the source — they name the operation.
 */
let activeSource: PolicySource = createEnvironmentPolicySource()
const DEFAULT_SOURCE = activeSource

export function setPolicySource(source: PolicySource): void {
  activeSource = source
}

export function resetPolicySource(): void {
  activeSource = DEFAULT_SOURCE
}

export function currentPolicySource(): PolicySource {
  return activeSource
}

/** Decide without throwing. */
export function checkOperation(id: PrivilegedOperationId, source: PolicySource = activeSource): OperationDecision {
  return decideOperation(getOperation(id), source.resolve())
}

/** Decide and refuse with a `PrivilegedOperationDeniedError` when not allowed. */
export function assertOperationAllowed(id: PrivilegedOperationId, source: PolicySource = activeSource): OperationDecision {
  const decision = checkOperation(id, source)
  if (!decision.allowed) throw new PrivilegedOperationDeniedError(decision)
  return decision
}

export function isPrivilegedOperationDenied(error: unknown): error is PrivilegedOperationDeniedError {
  return error instanceof PrivilegedOperationDeniedError
}
