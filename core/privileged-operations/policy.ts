import type { OperationDecision, OperationDefinition, PolicyResolution } from "./types"

/**
 * Pure decision. No I/O, no clock, no globals: the same inputs always give
 * the same decision, which is what makes it unit-testable and auditable.
 *
 * Fail closed: an `invalid` resolution denies every registered operation.
 */
export function decideOperation(definition: OperationDefinition, resolution: PolicyResolution): OperationDecision {
  if (resolution.kind === "invalid") {
    return {
      operation: definition.id,
      allowed: false,
      mode: "invalid",
      source: resolution.origin,
      reason: `policy source is invalid (${resolution.detail}); privileged operations are refused until it is fixed`,
    }
  }
  const denied = definition.deniedInModes.includes(resolution.mode)
  return {
    operation: definition.id,
    allowed: !denied,
    mode: resolution.mode,
    source: resolution.origin,
    reason: denied ? `${definition.id} is refused while the operating mode is ${resolution.mode}` : `${definition.id} is allowed in mode ${resolution.mode}`,
  }
}
