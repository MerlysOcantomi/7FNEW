/**
 * Fanny auto-create task policy (PR 12).
 *
 * Conservative gate that decides whether a `create_task` suggestion
 * coming out of `runConversationIntelligence` is safe to materialise
 * directly as a `WorkspaceTask(status="open")` — bypassing the
 * "Pending decisions" lane (PR 7 / PR 9 / PR 10) — or whether it must
 * remain a proposed decision for the operator.
 *
 * Pure function. No DB access. No I/O. Deterministic given its inputs.
 * Must stay this way: the gate is the *only* place this PR introduces
 * automation, so its surface has to be auditable.
 *
 * Lanes (mirror the product principle):
 *   - **auto**: low-risk, obvious internal work. Returns `{ auto: true }`.
 *     Caller writes `WorkspaceTask(status="open", sourceType="fanny_auto")`
 *     and marks the linked ConversationAction `"executed"`.
 *   - **review**: ambiguous or medium-risk. Returns `{ auto: false }`.
 *     Caller falls through to the existing PR 7 path:
 *     `WorkspaceTask(status="proposed", sourceType="fanny_suggestion")`.
 *
 * Conservative bias: when in doubt, return `auto: false`. A false
 * negative (operator approves a task they could have skipped) is
 * cheap; a false positive (a customer-facing or legally-binding task
 * runs without review) is expensive. Every threshold and pattern
 * here is tuned to favour the proposed lane.
 *
 * Out of scope:
 *   - sending replies (we never auto-send anything from this gate)
 *   - creating calendar events (handled by `create_event`; mutually exclusive)
 *   - assigning humans (`assignee*` stays unset on auto rows)
 *   - billing / refunds / contracts (always rejected)
 */

/** Minimum confidence required to consider auto-creation. The
 *  upstream classifier already clamps to [0,1] with a default of 0.6
 *  for `create_task` actions, so the bar is intentionally well above
 *  the typical AI output. */
export const AUTO_CREATE_MIN_CONFIDENCE = 0.85

/** Title length bounds. The lower bound rejects placeholder titles
 *  Fanny sometimes emits ("nota", "pendiente", "task"); the upper
 *  bound mirrors the WorkspaceTask DB column cap so we never auto
 *  store a row that the schema would silently truncate. */
export const AUTO_CREATE_MIN_TITLE_LENGTH = 6
export const AUTO_CREATE_MAX_TITLE_LENGTH = 200

/**
 * Risky vocabulary that disqualifies auto-creation outright. Matched
 * case-insensitively as substrings against the action's `title` and
 * (when present) `description`. Patterns are split into themed groups
 * so future tuning is auditable.
 *
 * The list is deliberately broad: this is a deny-list, not an
 * allow-list, and a few false negatives are acceptable. Spanish and
 * English variants are included because both languages flow through
 * the same Fanny prompt depending on the customer's locale.
 */
export const AUTO_CREATE_DENY_PATTERNS: readonly string[] = [
  /** External communication — never auto-create work that *implies*
   *  the operator (or anyone) will reach out to a customer. The
   *  proposed lane keeps the human in the loop. */
  "send email",
  "send the email",
  "send a message",
  "send an email",
  "email the",
  "email to",
  "reply to",
  "respond to",
  "respond back",
  "follow up with",
  "follow-up with",
  "follow up call",
  "call the",
  "call back",
  "phone the",
  "contact the",
  "contact customer",
  "contact client",
  "reach out",
  "responder a",
  "responder al",
  "enviar correo",
  "enviar email",
  "enviar mensaje",
  "llamar al cliente",
  "llamar a",
  "contactar a",
  "contactar al cliente",
  "contactar al",

  /** Promises / commitments — anything that hints at a customer-facing
   *  obligation must stay reviewable. */
  "promise",
  "promised",
  "committed",
  "commit to",
  "guarantee",
  "deadline by",
  "deadline of",
  "compromiso",
  "garantía",
  "garantia",
  "fecha límite",
  "fecha limite",
  "prometer",
  "prometido",

  /** Billing / refunds / payments — high financial impact, always
   *  defer to human. */
  "invoice",
  "billing",
  "bill the",
  "charge the",
  "refund",
  "payment",
  "factura",
  "facturar",
  "cobrar",
  "reembolso",
  "pago al",
  "pagar a",

  /** Legal / contracts — high risk, always defer. */
  "contract",
  "legal",
  "lawyer",
  "lawsuit",
  "contrato",
  "abogado",
  "demanda",

  /** Calendar / meetings — auto-task must not double up with the
   *  separate `create_event` lane. The gate also rejects calendar
   *  vocabulary in the action body itself, even when the run did
   *  not emit a `create_event` (the model sometimes proposes a task
   *  that *describes* a meeting instead of using create_event). */
  "schedule meeting",
  "schedule a meeting",
  "schedule call",
  "schedule a call",
  "book a meeting",
  "book meeting",
  "book a call",
  "agendar reunión",
  "agendar reunion",
  "agendar llamada",
  "reservar reunión",
  "reservar reunion",
  "reunión con el cliente",
  "reunion con el cliente",

  /** Sensitive customer signals — anything that smells like cancellation,
   *  escalation, or churn must be reviewed by a human. */
  "cancel account",
  "cancel subscription",
  "escalate",
  "escalation",
  "complaint",
  "cancelar cuenta",
  "cancelar suscripción",
  "cancelar suscripcion",
  "escalar",
  "queja",
] as const

/** Conversation `tipo` values that always block auto-create. `factura`
 *  (invoicing) is the obvious one; future high-risk types should be
 *  added here rather than scattered through the gate. */
export const AUTO_CREATE_BLOCKED_CONVERSATION_TYPES: ReadonlySet<string> = new Set([
  "factura",
])

/** Conversation `urgency` values that always block auto-create. Critical
 *  urgency means the human should see the work item before it goes live. */
export const AUTO_CREATE_BLOCKED_URGENCY_VALUES: ReadonlySet<string> = new Set([
  "critica",
])

/** Action types that are always considered to have external impact
 *  when present in the same intelligence run as the candidate
 *  `create_task`. If any of these appears in the run we defer the
 *  task to operator review (avoids any chance the auto-task assumes
 *  the external action already happened). */
export const AUTO_CREATE_EXTERNAL_IMPACT_ACTION_TYPES: ReadonlySet<string> = new Set([
  "create_event",
  "schedule_followup",
  "generate_proposal",
  "assign_operator",
])

export interface AutoCreatePolicyAction {
  /** ConversationAction.type. Only `"create_task"` is ever evaluated. */
  type: string
  title: string
  description: string | null | undefined
  /** Fanny's self-reported confidence on this suggestion ([0,1]). */
  confidence: number | null | undefined
}

export interface AutoCreatePolicyConversationContext {
  workspaceId: string
  conversationId: string
  /** AIClassification urgency vocabulary: `baja|media|alta|critica`. */
  urgency: string | null | undefined
  /** AIClassification tipo vocabulary: `lead|ticket|consulta|proyecto|factura`. */
  tipo: string | null | undefined
}

export interface AutoCreatePolicyInput {
  action: AutoCreatePolicyAction
  conversation: AutoCreatePolicyConversationContext
  /** Other action types Fanny is emitting in the same run. The gate
   *  cross-references this to prevent auto-creating a task when an
   *  external-impact action (calendar, follow-up) is also queued for
   *  operator review on the same conversation. */
  otherActionTypesInRun: readonly string[]
}

export type AutoCreatePolicyDecision =
  | {
      auto: true
      /** Short, human-readable reason persisted in
       *  `WorkspaceTask.metadata.automationReason` for audit. */
      reason: string
    }
  | {
      auto: false
      /** Same shape; mirrors the rejection reason for tracing. The
       *  proposed lane uses this to enrich the audit log only — the
       *  operator never sees it directly. */
      reason: string
    }

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase()
}

function matchesDenyPattern(haystack: string): string | null {
  if (!haystack) return null
  for (const pattern of AUTO_CREATE_DENY_PATTERNS) {
    if (haystack.includes(pattern)) return pattern
  }
  return null
}

/**
 * Evaluate the policy. Pure; deterministic. The order of checks is
 * intentional — cheaper / more decisive checks run first so the
 * common rejection paths short-circuit before we run substring
 * scans.
 */
export function evaluateAutoCreatePolicy(
  input: AutoCreatePolicyInput,
): AutoCreatePolicyDecision {
  const { action, conversation, otherActionTypesInRun } = input

  if (action.type !== "create_task") {
    return { auto: false, reason: "action_type_not_create_task" }
  }

  if (!conversation.workspaceId.trim() || !conversation.conversationId.trim()) {
    return { auto: false, reason: "missing_workspace_or_conversation_id" }
  }

  const title = (action.title ?? "").trim()
  if (title.length < AUTO_CREATE_MIN_TITLE_LENGTH) {
    return { auto: false, reason: "title_too_short_or_empty" }
  }
  if (title.length > AUTO_CREATE_MAX_TITLE_LENGTH) {
    return { auto: false, reason: "title_too_long" }
  }

  if (typeof action.confidence !== "number") {
    return { auto: false, reason: "missing_confidence" }
  }
  if (action.confidence < AUTO_CREATE_MIN_CONFIDENCE) {
    return { auto: false, reason: "confidence_below_threshold" }
  }

  const urgency = normalize(conversation.urgency)
  if (urgency && AUTO_CREATE_BLOCKED_URGENCY_VALUES.has(urgency)) {
    return { auto: false, reason: `blocked_urgency:${urgency}` }
  }

  const tipo = normalize(conversation.tipo)
  if (tipo && AUTO_CREATE_BLOCKED_CONVERSATION_TYPES.has(tipo)) {
    return { auto: false, reason: `blocked_conversation_type:${tipo}` }
  }

  for (const type of otherActionTypesInRun) {
    if (AUTO_CREATE_EXTERNAL_IMPACT_ACTION_TYPES.has(type)) {
      return { auto: false, reason: `external_impact_action_in_run:${type}` }
    }
  }

  /**
   * Substring deny scan over title + description. Lowercased once
   * for efficiency. We don't tokenize / fuzzy-match: the deny list
   * is intentionally simple so the policy stays auditable.
   */
  const haystack = `${title} ${(action.description ?? "").trim()}`.toLowerCase()
  const denyHit = matchesDenyPattern(haystack)
  if (denyHit) {
    return { auto: false, reason: `deny_pattern:${denyHit}` }
  }

  return {
    auto: true,
    reason: `low_risk_internal_followup:confidence=${action.confidence.toFixed(2)}`,
  }
}
