/**
 * CORE-VOICE-0A — Conversational scope policy (contract only).
 *
 * 7F is not a general chatbot. Scope is governed by LAYERS (domain instructions,
 * active vertical, allowed tools, permissions, off-topic redirection) plus a
 * CONTEXTUAL, semantic evaluation of intent and business goal.
 *
 * Adjustment 2 (mandatory): do NOT ship a fake word-based classifier that
 * pretends to tell "háblame de elefantes" (off-topic) from "crea una campaña de
 * nails inspirada en elefantes" (allowed by business goal). That real semantic
 * evaluation belongs to a later, model-backed phase. 0A defines ONLY:
 *   - `ScopeEvaluationInput`
 *   - `ScopeDecision`
 *   - `ScopeEvaluator` (injectable, async)
 * plus PURE policy-composition helpers (build the input, apply the decision —
 * no semantics). Tests use a fake evaluator.
 */

export type ScopeVerdict = "in_scope" | "contextual" | "off_topic"

/**
 * The layered policy an evaluator receives. Intentionally NO word lists and NO
 * baked-in semantics — just the composed context the semantic evaluator weighs.
 */
export interface ScopePolicyLayers {
  /** Business-domain framing/instructions for the vertical. */
  domainInstructions: string
  /** Active vertical (e.g. "beauty") or `null` for a generic workspace. */
  activeVertical: string | null
  /** Tool names the operator/plan is allowed to use. */
  allowedTools: string[]
  /** Permission scopes (role/plan) available this turn. */
  permissions: string[]
  /** Brief limit + redirection line used when a turn is off-topic. */
  offTopicResponse: string
}

export interface ScopeEvaluationInput {
  /** The user's turn text (or an intent summary). */
  turnText: string
  /** The composed policy layers. */
  layers: ScopePolicyLayers
  /** Optional prior turns / business context the evaluator may weigh. */
  context?: string[]
}

export interface ScopeDecision {
  verdict: ScopeVerdict
  /** Human-readable rationale (for logs/evals). */
  reason: string
  /** Populated for `off_topic`: the brief limit + redirection line. */
  redirect?: string
  /** Tools this turn may use given the decision (a subset of allowedTools). */
  allowedTools: string[]
}

/**
 * Injectable, async scope evaluator. The REAL semantic understanding is a later
 * phase / model-backed implementation. 0A ships only this interface; the
 * guardrail is always-on internal routing (never a model-invoked tool).
 */
export interface ScopeEvaluator {
  evaluate(input: ScopeEvaluationInput): Promise<ScopeDecision>
}

/**
 * Pure: compose the evaluation input from policy layers + the turn. This is the
 * only "understanding" 0A does — assembling context, NOT judging meaning.
 */
export function buildScopeEvaluationInput(
  layers: ScopePolicyLayers,
  turnText: string,
  context?: string[],
): ScopeEvaluationInput {
  return { turnText, layers, context }
}

/**
 * Pure: intersect the tools an evaluator REQUESTED with the tools the workspace
 * has ALREADY AUTHORIZED. Returns only tools present in both, in the requested
 * order, de-duplicated. It can never add a capability — the evaluator cannot
 * escalate permissions. `authorized` is the source of truth for what is allowed.
 */
export function intersectAllowedTools(
  requestedTools: readonly string[],
  authorizedTools: readonly string[],
): string[] {
  const authorized = new Set(authorizedTools)
  const seen = new Set<string>()
  const out: string[] = []
  for (const tool of requestedTools) {
    if (authorized.has(tool) && !seen.has(tool)) {
      seen.add(tool)
      out.push(tool)
    }
  }
  return out
}

/**
 * Pure: turn a verdict + the evaluator's REQUESTED tools into a `ScopeDecision`,
 * applying the policy — `off_topic` gets the redirection line and NO tools;
 * `in_scope`/`contextual` get the intersection of what the evaluator requested
 * and what the workspace already authorized (`layers.allowedTools`). The
 * evaluator can only narrow, never escalate. Policy COMPOSITION, not semantic
 * classification: the verdict must come from a `ScopeEvaluator`.
 */
export function applyScopePolicy(
  layers: ScopePolicyLayers,
  verdict: ScopeVerdict,
  reason: string,
  requestedTools: readonly string[] = [],
): ScopeDecision {
  if (verdict === "off_topic") {
    return { verdict, reason, redirect: layers.offTopicResponse, allowedTools: [] }
  }
  return {
    verdict,
    reason,
    allowedTools: intersectAllowedTools(requestedTools, layers.allowedTools),
  }
}
