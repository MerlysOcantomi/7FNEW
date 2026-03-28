import { getForteContextKey } from "./forte-context"
import type {
  ForteContext,
  ForteDecision,
  FortePlan,
  FortePlanStep,
} from "./types"

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired"
export type ApprovalExecutionStatus =
  | "not_started"
  | "running"
  | "completed"
  | "failed"
export type ApprovalContextKey = string
export type ApprovalFingerprint = string

export interface ApprovalSerializableContext {
  tenantId: string
  workspaceId: string
  userId: string
  wsRole: string
  surface: ForteContext["surface"]
}

export interface ApprovalSnapshot {
  plan: FortePlan
  decision: ForteDecision
  context: ApprovalSerializableContext
  steps: {
    all: FortePlanStep[]
    allowed: FortePlanStep[]
    blocked: ForteDecision["blockedSteps"]
    approvalRequired: FortePlanStep[]
  }
}

export interface ApprovalRequest {
  planId: string
  status: ApprovalStatus
  approvalRequired: boolean
  approvedSteps: string[]
  fingerprint: ApprovalFingerprint
  contextKey: ApprovalContextKey
  snapshot: ApprovalSnapshot
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
  executionStatus: ApprovalExecutionStatus
  executedAt?: string | null
  executionError?: string | null
  metadata?: Record<string, unknown>
}

export interface CreateApprovalRequestInput {
  plan: FortePlan
  decision: ForteDecision
  context: ForteContext
  planId?: string
  approvedSteps?: string[]
  expiresAt?: string | Date | null
  metadata?: Record<string, unknown>
}

export interface ApprovePlanInput {
  request: ApprovalRequest
  approvedSteps?: string[]
  metadata?: Record<string, unknown>
}

export interface RejectPlanInput {
  request: ApprovalRequest
  reason?: string
  metadata?: Record<string, unknown>
}

export interface RehydrateApprovedPlanInput {
  request: ApprovalRequest
  context?: ForteContext
}

export interface RehydrateApprovedPlanResult {
  ok: boolean
  reason?: string
  request: ApprovalRequest
  plan?: FortePlan
  decision?: ForteDecision
  context?: ApprovalSerializableContext
}

async function sha256(input: string) {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function toIsoString(value?: string | Date | null) {
  if (!value) return null
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

export function serializeApprovalContext(
  context: ForteContext,
): ApprovalSerializableContext {
  return {
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    userId: context.userId,
    wsRole: context.wsRole,
    surface: context.surface,
  }
}

export function buildApprovalSnapshot(
  plan: FortePlan,
  decision: ForteDecision,
  context: ForteContext,
): ApprovalSnapshot {
  const approvalRequiredSteps = plan.steps.filter((step) => step.requiresApproval)
  return {
    plan,
    decision,
    context: serializeApprovalContext(context),
    steps: {
      all: plan.steps,
      allowed: decision.allowedSteps,
      blocked: decision.blockedSteps,
      approvalRequired: approvalRequiredSteps,
    },
  }
}

export async function createApprovalFingerprint(
  snapshot: ApprovalSnapshot,
): Promise<ApprovalFingerprint> {
  return sha256(JSON.stringify(snapshot))
}

export function isApprovalExpired(
  request: ApprovalRequest,
  now = new Date(),
) {
  if (!request.expiresAt) return false
  return new Date(request.expiresAt).getTime() <= now.getTime()
}

export async function createApprovalRequest(
  input: CreateApprovalRequestInput,
): Promise<ApprovalRequest> {
  const snapshot = buildApprovalSnapshot(input.plan, input.decision, input.context)
  const fingerprint = await createApprovalFingerprint(snapshot)
  const now = new Date().toISOString()

  return {
    planId: input.planId ?? `plan:${input.context.requestId}`,
    status: "pending",
    approvalRequired: input.decision.mode === "execute_after_approval",
    approvedSteps: input.approvedSteps ?? [],
    fingerprint,
    contextKey: getForteContextKey(input.context),
    snapshot,
    createdAt: now,
    updatedAt: now,
    expiresAt: toIsoString(input.expiresAt),
    executionStatus: "not_started",
    executedAt: null,
    executionError: null,
    metadata: input.metadata,
  }
}

export async function buildForteApprovalDraft(
  plan: FortePlan,
  decision: ForteDecision,
  context: ForteContext,
) {
  const request = await createApprovalRequest({ plan, decision, context })
  return {
    planId: request.planId,
    approvedSteps: request.approvedSteps,
    approvalRequired: request.approvalRequired,
    fingerprint: request.fingerprint,
    contextKey: request.contextKey,
  }
}

export function approvePlan(input: ApprovePlanInput): ApprovalRequest {
  const allowedStepIds = new Set(
    input.request.snapshot.steps.approvalRequired.map((step) => step.id),
  )
  const approvedSteps = (input.approvedSteps ?? Array.from(allowedStepIds)).filter((stepId) =>
    allowedStepIds.has(stepId),
  )

  return {
    ...input.request,
    status: "approved",
    approvedSteps,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...input.request.metadata,
      ...input.metadata,
    },
  }
}

export function rejectPlan(input: RejectPlanInput): ApprovalRequest {
  return {
    ...input.request,
    status: "rejected",
    updatedAt: new Date().toISOString(),
    metadata: {
      ...input.request.metadata,
      ...input.metadata,
      rejectionReason: input.reason,
    },
  }
}

export async function rehydrateApprovedPlan(
  input: RehydrateApprovedPlanInput,
): Promise<RehydrateApprovedPlanResult> {
  const { request } = input

  if (request.status !== "approved") {
    return {
      ok: false,
      reason: `El plan no esta aprobado (status=${request.status})`,
      request,
    }
  }

  if (isApprovalExpired(request)) {
    return {
      ok: false,
      reason: "La aprobacion expiro",
      request: { ...request, status: "expired" },
    }
  }

  const recalculatedFingerprint = await createApprovalFingerprint(request.snapshot)
  if (recalculatedFingerprint !== request.fingerprint) {
    return {
      ok: false,
      reason: "El fingerprint no coincide con el snapshot almacenado",
      request,
    }
  }

  if (input.context) {
    const currentContextKey = getForteContextKey(input.context)
    if (currentContextKey !== request.contextKey) {
      return {
        ok: false,
        reason: "El contexto actual no coincide con el contexto aprobado",
        request,
      }
    }

    const storedContext = request.snapshot.context
    if (
      storedContext.wsRole !== input.context.wsRole ||
      storedContext.tenantId !== input.context.tenantId ||
      storedContext.workspaceId !== input.context.workspaceId ||
      storedContext.userId !== input.context.userId ||
      storedContext.surface !== input.context.surface
    ) {
      return {
        ok: false,
        reason: "El contexto serializado del approval cambio",
        request,
      }
    }
  }

  return {
    ok: true,
    request,
    plan: request.snapshot.plan,
    decision: request.snapshot.decision,
    context: request.snapshot.context,
  }
}
