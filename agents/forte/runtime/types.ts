import type {
  AgentToolDefinition,
  EngineManifest,
  ModuleManifest,
  ToolManifest,
} from "@core/registry"
import type { ApprovalRequest } from "./approval"

export type ForteSurface =
  | "recommend"
  | "assistant"
  | "automation"
  | "inbox"

export type ForteIntent =
  | "query"
  | "recommendation"
  | "analysis"
  | "create"
  | "update"
  | "automation"
  | "coordination"

export type ForteActionKind =
  | "read"
  | "write"
  | "generate"
  | "multi_step"

export type ForteDecisionMode =
  | "answer_only"
  | "recommend_only"
  | "execute_now"
  | "execute_after_approval"
  | "deny"

export type ForteRiskLevel = "low" | "medium" | "high"

export interface ForteContext {
  tenantId: string
  workspaceId: string
  userId: string
  wsRole: string
  surface: ForteSurface
  requestId: string
}

export interface ForteCapability {
  capabilityId: string
  moduleId?: string
  engineId?: string
  toolName?: string
  kind: ForteActionKind
  allowed: boolean
  requiresApproval: boolean
  reason?: string
  source: "manifest-tool" | "runtime-handler"
}

export interface FortePlanStep {
  id: string
  kind: ForteActionKind
  moduleId?: string
  engineId?: string
  actionId: string
  inputs: Record<string, unknown>
  riskLevel: ForteRiskLevel
  requiresApproval: boolean
  reason: string
}

export interface FortePlan {
  intent: ForteIntent
  summary: string
  steps: FortePlanStep[]
  domainContext?: import("./business/domain-types").DomainState[]
}

export interface ForteDecision {
  mode: ForteDecisionMode
  allowedSteps: FortePlanStep[]
  blockedSteps: Array<{
    stepId: string
    reason: string
  }>
  explanation: string
}

export interface ForteActionResult {
  ok: boolean
  actionId: string
  data?: unknown
  message?: string
}

export interface ForteActionHandler<TInput = unknown, TResult = unknown> {
  actionId: string
  moduleId?: string
  engineId?: string
  kind: ForteActionKind
  run(ctx: ForteContext, input: TInput): Promise<TResult>
}

export interface ForteContextInput {
  tenantId: string
  workspaceId: string
  userId: string
  wsRole: string
  surface: ForteSurface
  requestId?: string
}

export interface ForteCapabilityBuckets {
  read: ForteCapability[]
  write: ForteCapability[]
  generate: ForteCapability[]
}

export interface ForteEffectiveCapabilities {
  modules: ModuleManifest[]
  engines: EngineManifest[]
  registryTools: ToolManifest[]
  tools: AgentToolDefinition[]
  capabilities: string[]
  actions: ForteCapabilityBuckets
}

export interface ResolveForteCapabilitiesOptions {
  context: ForteContext
}

export interface BuildFortePlanInput {
  context: ForteContext
  intent: ForteIntent
  summary: string
  capabilities: ForteEffectiveCapabilities
  actionId?: string
  moduleId?: string
  engineId?: string
  inputs?: Record<string, unknown>
  reason?: string
}

export interface ForteRuntimeExecution {
  executed: ForteActionResult[]
  skipped: Array<{
    actionId: string
    reason: string
  }>
}

export interface ApprovedExecutionStepResult {
  stepId: string
  actionId: string
  ok: boolean
  data?: unknown
  message?: string
}

export interface ApprovedExecutionResult {
  ok: boolean
  planId: string
  executedSteps: ApprovedExecutionStepResult[]
  blockedSteps?: Array<{ stepId: string; reason: string }>
  executionStartedAt: string
  executionFinishedAt: string
  message?: string
}

export interface FortePipelineInput {
  context: ForteContextInput
  intent: ForteIntent
  summary: string
  actionId?: string
  moduleId?: string
  engineId?: string
  inputs?: Record<string, unknown>
  reason?: string
  store?: import("./approval-store").ForteApprovalStore
}

export interface FortePipelineResult {
  context?: ForteContext
  capabilities?: ForteEffectiveCapabilities
  plan?: FortePlan
  decision: ForteDecision
  execution?: ForteRuntimeExecution
  approval?: ApprovalRequest
}
