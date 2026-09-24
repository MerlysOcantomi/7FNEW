import type { ToolRiskClass } from "@core/platform/vocabulary"

/**
 * Fanny action/autonomy catalog.
 *
 * This is NOT a second platform tool catalog. The canonical tool contract stays
 * in core/platform/tool-definition.ts. This file is the Inbox product policy
 * layer: it says how Fanny may surface/execute operations that already exist,
 * and which future Finesse actions must stay visibly unavailable until they
 * have a real executor.
 *
 * Hard rule: workspace/user preferences can make an action stricter, but can
 * never widen past allowedModes or availability.
 */

export const FANNY_AUTONOMY_MODES = ["auto", "confirm", "suggest"] as const
export type FannyAutonomyMode = (typeof FANNY_AUTONOMY_MODES)[number]

export const FANNY_ACTION_AVAILABILITY = ["executable", "preparable", "planned"] as const
export type FannyActionAvailability = (typeof FANNY_ACTION_AVAILABILITY)[number]

export const FANNY_ACTION_GROUPS = [
  "intelligence",
  "communication",
  "agenda",
  "client",
  "workflow",
  "commercial",
  "finance",
] as const
export type FannyActionGroup = (typeof FANNY_ACTION_GROUPS)[number]

export const FANNY_CONVERSATION_ACTION_TYPES = [
  "create_client",
  "create_project",
  "create_task",
  "assign_operator",
  "create_event",
  "create_appointment",
  "mark_resolved",
  "set_waiting",
  "add_internal_note",
  "schedule_followup",
  "generate_proposal",
] as const
export type FannyConversationActionType = (typeof FANNY_CONVERSATION_ACTION_TYPES)[number]

export const FANNY_OPERATION_IDS = [
  "classify_conversation",
  "summarize_conversation",
  "draft_reply",
  ...FANNY_CONVERSATION_ACTION_TYPES,
  "send_reply",
  "send_business_location",
  "send_service_info",
  "send_price",
  "send_booking_link",
  "request_google_review",
  "send_appointment_confirmation",
  "send_reminder",
  "reschedule_appointment",
  "cancel_appointment",
  "create_invoice",
  "record_payment",
  "issue_refund",
] as const
export type FannyOperationId = (typeof FANNY_OPERATION_IDS)[number]

export interface FannyActionDefinition {
  readonly id: FannyOperationId
  readonly group: FannyActionGroup
  readonly availability: FannyActionAvailability
  readonly riskClass: ToolRiskClass
  readonly configurable: boolean
  readonly defaultMode: FannyAutonomyMode
  readonly allowedModes: readonly FannyAutonomyMode[]
  /** Confidence floor is an ADDITIONAL gate; a user rule may only raise it. */
  readonly minAutoConfidence?: number
  /** True only when runConversationIntelligence may persist this as ConversationAction. */
  readonly intelligenceAction: boolean
  /** Params that must be fixed by a rule before auto mode can ever be effective. */
  readonly autoRequiresParams?: readonly string[]
}

const AUTO_ONLY = ["auto"] as const
const SAFE_CONFIGURABLE = ["auto", "confirm", "suggest"] as const
const CONFIRM_OR_SUGGEST = ["confirm", "suggest"] as const
const SUGGEST_ONLY = ["suggest"] as const

export const FANNY_ACTION_CATALOG: Readonly<Record<FannyOperationId, FannyActionDefinition>> = {
  classify_conversation: {
    id: "classify_conversation",
    group: "intelligence",
    availability: "executable",
    riskClass: "read",
    configurable: false,
    defaultMode: "auto",
    allowedModes: AUTO_ONLY,
    intelligenceAction: false,
  },
  summarize_conversation: {
    id: "summarize_conversation",
    group: "intelligence",
    availability: "executable",
    riskClass: "read",
    configurable: false,
    defaultMode: "auto",
    allowedModes: AUTO_ONLY,
    intelligenceAction: false,
  },
  draft_reply: {
    id: "draft_reply",
    group: "communication",
    availability: "executable",
    riskClass: "read",
    configurable: false,
    defaultMode: "auto",
    allowedModes: AUTO_ONLY,
    intelligenceAction: false,
  },

  create_task: {
    id: "create_task",
    group: "workflow",
    availability: "executable",
    riskClass: "write",
    configurable: true,
    defaultMode: "auto",
    allowedModes: SAFE_CONFIGURABLE,
    minAutoConfidence: 0.85,
    intelligenceAction: true,
  },
  create_client: {
    id: "create_client",
    group: "client",
    availability: "executable",
    riskClass: "write",
    configurable: true,
    defaultMode: "confirm",
    allowedModes: SAFE_CONFIGURABLE,
    minAutoConfidence: 0.95,
    intelligenceAction: true,
  },
  create_project: {
    id: "create_project",
    group: "workflow",
    availability: "executable",
    riskClass: "write",
    configurable: true,
    defaultMode: "confirm",
    allowedModes: SAFE_CONFIGURABLE,
    minAutoConfidence: 0.97,
    intelligenceAction: true,
  },
  assign_operator: {
    id: "assign_operator",
    group: "workflow",
    availability: "executable",
    riskClass: "write",
    configurable: true,
    defaultMode: "confirm",
    allowedModes: SAFE_CONFIGURABLE,
    minAutoConfidence: 0.95,
    intelligenceAction: true,
    autoRequiresParams: ["assigneeId"],
  },
  create_event: {
    id: "create_event",
    group: "agenda",
    availability: "executable",
    riskClass: "write",
    configurable: true,
    defaultMode: "confirm",
    allowedModes: SAFE_CONFIGURABLE,
    minAutoConfidence: 0.95,
    intelligenceAction: true,
  },
  create_appointment: {
    id: "create_appointment",
    group: "agenda",
    availability: "planned",
    riskClass: "write",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    minAutoConfidence: 0.95,
    intelligenceAction: true,
  },
  mark_resolved: {
    id: "mark_resolved",
    group: "workflow",
    availability: "planned",
    riskClass: "write",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    minAutoConfidence: 0.97,
    intelligenceAction: true,
  },
  set_waiting: {
    id: "set_waiting",
    group: "workflow",
    availability: "planned",
    riskClass: "write",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    minAutoConfidence: 0.9,
    intelligenceAction: true,
  },
  add_internal_note: {
    id: "add_internal_note",
    group: "workflow",
    availability: "planned",
    riskClass: "write",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    minAutoConfidence: 0.85,
    intelligenceAction: true,
  },

  /**
   * These two legacy ConversationAction types currently only record an
   * execution note. They are kept honestly as "preparable": Fanny may suggest
   * the next step, but no rule may pretend a follow-up/proposal was really
   * scheduled/generated.
   */
  schedule_followup: {
    id: "schedule_followup",
    group: "workflow",
    availability: "preparable",
    riskClass: "external_side_effect",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: true,
  },
  generate_proposal: {
    id: "generate_proposal",
    group: "commercial",
    availability: "preparable",
    riskClass: "external_side_effect",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: true,
  },

  /**
   * Customer-facing communication is a hard confirmation boundary in this
   * first autonomy release. The outbound transport is real, but the canonical
   * send_reply tool is not yet bound to Fanny's action executor. Until that
   * trusted path exists these remain planned/suggest-only, never fake "sent".
   */
  send_reply: {
    id: "send_reply",
    group: "communication",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  send_business_location: {
    id: "send_business_location",
    group: "communication",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  send_service_info: {
    id: "send_service_info",
    group: "communication",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  send_price: {
    id: "send_price",
    group: "commercial",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  send_booking_link: {
    id: "send_booking_link",
    group: "agenda",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  request_google_review: {
    id: "request_google_review",
    group: "communication",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  send_appointment_confirmation: {
    id: "send_appointment_confirmation",
    group: "agenda",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  send_reminder: {
    id: "send_reminder",
    group: "agenda",
    availability: "planned",
    riskClass: "communication",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },

  /** Real calendar mutation exists, but Inbox still lacks deterministic target
   * resolution (which exact cita) in the intelligence/action contract. */
  reschedule_appointment: {
    id: "reschedule_appointment",
    group: "agenda",
    availability: "planned",
    riskClass: "external_side_effect",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  cancel_appointment: {
    id: "cancel_appointment",
    group: "agenda",
    availability: "planned",
    riskClass: "external_side_effect",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },

  /** Finance belongs behind a separate financial approval boundary (Felix). */
  create_invoice: {
    id: "create_invoice",
    group: "finance",
    availability: "planned",
    riskClass: "financial",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  record_payment: {
    id: "record_payment",
    group: "finance",
    availability: "planned",
    riskClass: "financial",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
  issue_refund: {
    id: "issue_refund",
    group: "finance",
    availability: "planned",
    riskClass: "financial",
    configurable: false,
    defaultMode: "suggest",
    allowedModes: SUGGEST_ONLY,
    intelligenceAction: false,
  },
}

export function isFannyOperationId(value: unknown): value is FannyOperationId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FANNY_ACTION_CATALOG, value)
}

export function isFannyConversationActionType(value: unknown): value is FannyConversationActionType {
  return typeof value === "string"
    && (FANNY_CONVERSATION_ACTION_TYPES as readonly string[]).includes(value)
}

export function clampFannyMode(
  actionId: FannyOperationId,
  requested: FannyAutonomyMode,
): FannyAutonomyMode {
  const def = FANNY_ACTION_CATALOG[actionId]
  return def.allowedModes.includes(requested) ? requested : def.defaultMode
}

export function isModeAtLeastAsStrict(
  actionId: FannyOperationId,
  candidate: FannyAutonomyMode,
  baseline: FannyAutonomyMode,
): boolean {
  const def = FANNY_ACTION_CATALOG[actionId]
  const order: Readonly<Record<FannyAutonomyMode, number>> = {
    auto: 0,
    confirm: 1,
    suggest: 2,
  }
  return def.allowedModes.includes(candidate) && order[candidate] >= order[baseline]
}
