/**
 * CORE-VOICE-0A — Voice routing (pure).
 *
 * Decides, without any I/O, which path handles a turn or a tool:
 *   - `routeIntent`         → Realtime (speech-to-speech) vs controlled pipeline.
 *   - `resolveToolExecution`→ execution policy for a tool `effect`.
 *   - `routeToolExecution`  → transport route for an execution policy.
 *
 * The user never picks the mode; 7F routes internally. Nothing here understands
 * language — semantic scope evaluation is the injectable `ScopeEvaluator` in
 * `scope-policy.ts`, deliberately NOT a word-based function.
 */

import type { ToolEffect, ToolExecutionPolicy, VoiceRoute } from "./contracts"

/** Signals that push a turn onto the controlled pipeline instead of Realtime. */
export interface IntentRoutingInput {
  /** The turn triggers an action with side effects. */
  hasEffect: boolean
  /** Sensitive/privileged operation (billing, data export, permissions…). */
  sensitive: boolean
  /** A durable, auditable transcript of this turn is required. */
  needsDurableTranscript: boolean
  /** Deterministic logic is required (no free-form model latitude). */
  deterministic: boolean
}

export interface RoutingDecision {
  route: VoiceRoute
  reason: string
}

/**
 * Realtime for natural, low-latency, effect-free conversation (briefing,
 * questions, navigation, queries). Controlled for anything with effects,
 * sensitivity, durable-transcript or deterministic-logic needs. First matching
 * reason wins so the `reason` string is meaningful.
 */
export function routeIntent(input: IntentRoutingInput): RoutingDecision {
  if (input.hasEffect) return { route: "controlled", reason: "action has side effects" }
  if (input.sensitive) return { route: "controlled", reason: "sensitive operation" }
  if (input.needsDurableTranscript) {
    return { route: "controlled", reason: "durable transcript required" }
  }
  if (input.deterministic) return { route: "controlled", reason: "deterministic logic required" }
  return { route: "realtime", reason: "conversational query without effects" }
}

/**
 * Execution policy per tool effect (adjustment 3):
 *   - read / navigate      → immediate (may run inline)
 *   - draft / propose      → controlled (goes through the controlled pipeline)
 *   - write                → confirmation_required (confirm + server-side exec)
 */
export function resolveToolExecution(effect: ToolEffect): ToolExecutionPolicy {
  switch (effect) {
    case "read":
    case "navigate":
      return "immediate"
    case "draft":
    case "propose":
      return "controlled"
    case "write":
      return "confirmation_required"
  }
}

/** Transport route for a given execution policy. Only `immediate` may be Realtime. */
export function routeToolExecution(policy: ToolExecutionPolicy): VoiceRoute {
  return policy === "immediate" ? "realtime" : "controlled"
}

/** Convenience: resolve both the policy and the transport route for a tool effect. */
export function routeTool(effect: ToolEffect): {
  policy: ToolExecutionPolicy
  route: VoiceRoute
} {
  const policy = resolveToolExecution(effect)
  return { policy, route: routeToolExecution(policy) }
}
