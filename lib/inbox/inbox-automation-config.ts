/**
 * Policy shape for future inbox automation (Smart Inbox Phase 5+).
 * Lives under merged workspace config: `resolvedConfig.inboxAutomation`.
 */

export interface InboxAutomationConfig {
  enabled: boolean
  requireApproval: boolean
  autoCreateClient: boolean
  autoCreateProject: boolean
  autoSendRequirementRequests: boolean
  autoGenerateInvoice: boolean
  autoGenerateReport: boolean
  autoGeneratePriceGuidance: boolean
  autoAssignOperator: boolean
  autoScheduleFollowup: boolean
  allowAgentOrchestration: boolean
}

const DEFAULT_INBOX_AUTOMATION: InboxAutomationConfig = {
  enabled: false,
  requireApproval: true,
  autoCreateClient: false,
  autoCreateProject: false,
  autoSendRequirementRequests: false,
  autoGenerateInvoice: false,
  autoGenerateReport: false,
  autoGeneratePriceGuidance: false,
  autoAssignOperator: false,
  autoScheduleFollowup: false,
  allowAgentOrchestration: false,
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v)
}

/**
 * Reads `inboxAutomation` from merged workspace config with safe defaults.
 */
export function getInboxAutomationConfig(resolvedConfig: unknown): InboxAutomationConfig {
  if (!isRecord(resolvedConfig)) return { ...DEFAULT_INBOX_AUTOMATION }
  const raw = resolvedConfig.inboxAutomation
  if (!isRecord(raw)) return { ...DEFAULT_INBOX_AUTOMATION }

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_INBOX_AUTOMATION.enabled,
    requireApproval:
      typeof raw.requireApproval === "boolean" ? raw.requireApproval : DEFAULT_INBOX_AUTOMATION.requireApproval,
    autoCreateClient:
      typeof raw.autoCreateClient === "boolean" ? raw.autoCreateClient : DEFAULT_INBOX_AUTOMATION.autoCreateClient,
    autoCreateProject:
      typeof raw.autoCreateProject === "boolean" ? raw.autoCreateProject : DEFAULT_INBOX_AUTOMATION.autoCreateProject,
    autoSendRequirementRequests:
      typeof raw.autoSendRequirementRequests === "boolean"
        ? raw.autoSendRequirementRequests
        : DEFAULT_INBOX_AUTOMATION.autoSendRequirementRequests,
    autoGenerateInvoice:
      typeof raw.autoGenerateInvoice === "boolean"
        ? raw.autoGenerateInvoice
        : DEFAULT_INBOX_AUTOMATION.autoGenerateInvoice,
    autoGenerateReport:
      typeof raw.autoGenerateReport === "boolean"
        ? raw.autoGenerateReport
        : DEFAULT_INBOX_AUTOMATION.autoGenerateReport,
    autoGeneratePriceGuidance:
      typeof raw.autoGeneratePriceGuidance === "boolean"
        ? raw.autoGeneratePriceGuidance
        : DEFAULT_INBOX_AUTOMATION.autoGeneratePriceGuidance,
    autoAssignOperator:
      typeof raw.autoAssignOperator === "boolean"
        ? raw.autoAssignOperator
        : DEFAULT_INBOX_AUTOMATION.autoAssignOperator,
    autoScheduleFollowup:
      typeof raw.autoScheduleFollowup === "boolean"
        ? raw.autoScheduleFollowup
        : DEFAULT_INBOX_AUTOMATION.autoScheduleFollowup,
    allowAgentOrchestration:
      typeof raw.allowAgentOrchestration === "boolean"
        ? raw.allowAgentOrchestration
        : DEFAULT_INBOX_AUTOMATION.allowAgentOrchestration,
  }
}

/**
 * Whether this movement type could auto-execute when inbox automation is enabled and flags match.
 * Does not grant approval — pairing with `requireApproval` happens in movement derivation.
 */
export function canAutoExecuteMovement(type: string, cfg: InboxAutomationConfig): boolean {
  if (!cfg.enabled) return false

  switch (type) {
    case "create_client":
      return cfg.autoCreateClient
    case "create_project":
      return cfg.autoCreateProject
    case "request_missing_requirements":
      return cfg.autoSendRequirementRequests
    case "generate_invoice":
      return cfg.autoGenerateInvoice
    case "generate_report":
      return cfg.autoGenerateReport
    case "generate_price_guidance":
      return cfg.autoGeneratePriceGuidance
    case "assign_operator":
      return cfg.autoAssignOperator
    case "schedule_followup":
      return cfg.autoScheduleFollowup
    case "orchestrate_freya":
    case "orchestrate_mr_forte":
      return cfg.allowAgentOrchestration
    case "no_action_required":
    case "review_required":
    case "reply":
      return false
    default:
      return false
  }
}
