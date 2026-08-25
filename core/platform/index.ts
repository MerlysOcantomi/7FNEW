/**
 * FOUND-01 — Shared capability & tool vocabulary (public surface).
 *
 * STATUS: IMPLEMENTED FOUNDATION — VOCABULARY AND TYPES ONLY.
 * No entitlement resolution, no enforcement, no AI gateway, no execution.
 * See docs/architecture/7F-FOUND-01-SHARED-VOCABULARY.md.
 */

export {
  TOOL_EFFECTS,
  TOOL_EXECUTION_POLICIES,
  TOOL_RISK_CLASSES,
  type ToolEffect,
  type ToolExecutionPolicy,
  type ToolRiskClass,
} from "./vocabulary"
export { PRODUCT_KEYS, PRODUCT_DEFINITIONS, type ProductKey, type ProductDefinition } from "./products"
export { CAPABILITY_KEYS, type CapabilityKey } from "./capabilities"
export { ACTIVITY_KEYS, type ActivityKey } from "./activities"
export {
  defineTool,
  parseToolInput,
  parseToolOutput,
  type PlatformToolDefinition,
  type ToolAvailability,
  type ToolExecutionContext,
  type ToolHandlerBinding,
  type ToolHandlerFor,
  type ToolInputOf,
  type ToolOutputOf,
  type ToolParseResult,
} from "./tool-definition"
export { TOOL_CATALOG, TOOL_KEYS, type ToolCatalog, type ToolKey } from "./tool-catalog"
export {
  ADDON_GRANTED_CAPABILITIES,
  PRODUCT_CAPABILITIES,
  getCapabilitiesForProduct,
  getToolsForCapability,
  validatePlatformFoundation,
  validateToolDefinition,
} from "./catalog"
export { getToolRequiredPermissions } from "./tool-definition"
export {
  WORKSPACE_ROLES,
  WORKSPACE_ROLE_LEVELS,
  isWorkspaceRole,
  parseWorkspaceRole,
  type WorkspaceRole,
} from "./roles"
export {
  getRolePermissions,
  roleMay,
  resolveEffectiveCapabilities,
} from "./role-policy"
export {
  PRESENCE_ADDON_CAPABILITIES,
  resolveWorkspaceCapabilitySnapshot,
  type InferredProduct,
  type WorkspaceCapabilitySnapshot,
  type WorkspaceCapabilitySources,
} from "./workspace-capabilities"
export {
  ACCESS_DECISION_REASONS,
  canUser,
  canWorkspace,
  type AccessDecision,
  type AccessDecisionReason,
  type MembershipEvidence,
} from "./access"
