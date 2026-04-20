/**
 * Smart Inbox — message-level next movement (Phase 5+).
 *
 * READ PRECEDENCE (message-level movement; transitional persistence):
 * 1. MessageIntent.nextSmartMovementType/Data (Prisma — future source of truth)
 * 2. Message.metadata persisted movement (`nextSmartMovement` JSON or legacy split keys)
 * 3. Derived signals (structured intent → content heuristics → inbound reply fallback)
 * 4. Legacy AIClassification.nextBestAction mapped conservatively
 *
 * Persisted `"none"` normalizes to `no_action_required` everywhere.
 */

import { z } from "zod"
import {
  canAutoExecuteMovement,
  type InboxAutomationConfig,
  getInboxAutomationConfig,
} from "@/lib/inbox/inbox-automation-config"
import {
  getIntentOperationalStatusFromMetadata,
  getShortIntentFromMetadataRecord,
  type IntentOperationalStatus,
  parseMessageMetadataRecord,
} from "@/lib/inbox/parse-message-metadata"

// ── Types ───────────────────────────────────────────────────────────────────

/** Legacy persisted label — normalized to `no_action_required`. */
export const LEGACY_MOVEMENT_NONE = "none" as const

export const NEXT_SMART_MOVEMENT_TYPES = [
  "request_missing_requirements",
  "create_client",
  "create_project",
  "generate_invoice",
  "generate_report",
  "generate_price_guidance",
  "orchestrate_freya",
  "orchestrate_mr_forte",
  "assign_operator",
  "schedule_followup",
  "reply",
  "review_required",
  "no_action_required",
] as const

export type NextSmartMovementType = (typeof NEXT_SMART_MOVEMENT_TYPES)[number]

export type NextSmartMovementSource = "message" | "conversation" | "legacy-mapped" | "manual"

export type NextSmartMovementPriority = "high" | "medium" | "low"

export type NextSmartMovementExecutor = "fanny" | "freya" | "forte" | "felix" | null

export interface NextSmartMovementExecution {
  /** Workspace policy + type allow hands-off execution (still may require approval separately). */
  canAutoExecute: boolean
  requiresApproval: boolean
  executor: NextSmartMovementExecutor
}

/** Draft before normalization (no priority / execution / isActionable). */
export type MovementDraft = {
  type: NextSmartMovementType
  title?: string
  rationale?: string
  confidence?: number | null
  source: NextSmartMovementSource
  sourceMessageId?: string | null
  payload?: Record<string, unknown> | null
  requiresApproval?: boolean
}

export interface NextSmartMovement extends MovementDraft {
  requiresApproval: boolean
  isActionable: boolean
  priority: NextSmartMovementPriority
  execution: NextSmartMovementExecution
}

const movementSourceSchema = z.enum(["message", "conversation", "legacy-mapped", "manual"])

function zEnumMovementType() {
  return z.preprocess((v) => {
    if (v === LEGACY_MOVEMENT_NONE || v === "null") return "no_action_required"
    return v
  }, z.enum(NEXT_SMART_MOVEMENT_TYPES as unknown as [NextSmartMovementType, ...NextSmartMovementType[]]))
}

export const nextSmartMovementSchema = z.object({
  type: zEnumMovementType(),
  title: z.string().optional(),
  rationale: z.string().optional(),
  confidence: z.number().nullable().optional(),
  requiresApproval: z.boolean().optional(),
  source: movementSourceSchema,
  sourceMessageId: z.string().nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
})

export type NextSmartMovementParsed = z.infer<typeof nextSmartMovementSchema>

/** Payload row from Prisma `MessageIntent` (movement fields only). */
export type MessageIntentMovementRow = {
  nextSmartMovementType: string | null
  nextSmartMovementData: string | null
}

/** Subset for APIs / list rows. */
export interface NextSmartMovementSummary {
  type: NextSmartMovementType
  title?: string
  rationale?: string
  confidence?: number | null
  requiresApproval: boolean
  source: NextSmartMovementSource
  isActionable: boolean
  priority: NextSmartMovementPriority
  execution: NextSmartMovementExecution
}

// ── Type normalization ────────────────────────────────────────────────────────

/** Maps legacy `none` and unknown strings to canonical types (conservative on unknown). */
export function normalizeMovementTypeString(raw: string | null | undefined): NextSmartMovementType {
  const t = (raw ?? "").trim()
  if (!t || t === LEGACY_MOVEMENT_NONE) return "no_action_required"
  if ((NEXT_SMART_MOVEMENT_TYPES as readonly string[]).includes(t)) return t as NextSmartMovementType
  return "review_required"
}

export function movementDraftFromParsed(parsed: NextSmartMovementParsed): MovementDraft {
  return {
    type: parsed.type,
    title: parsed.title,
    rationale: parsed.rationale,
    confidence: parsed.confidence ?? null,
    source: parsed.source,
    sourceMessageId: parsed.sourceMessageId ?? null,
    payload: parsed.payload ?? null,
    requiresApproval: parsed.requiresApproval,
  }
}

// ── Execution routing (central; no runtime orchestration yet) ─────────────────

export function resolveExecutorForMovementType(type: NextSmartMovementType): NextSmartMovementExecutor {
  switch (type) {
    case "request_missing_requirements":
    case "reply":
    case "schedule_followup":
    case "assign_operator":
    case "generate_price_guidance":
      return "fanny"
    case "generate_invoice":
    case "generate_report":
    case "create_client":
    case "create_project":
      return "felix"
    case "orchestrate_freya":
      return "freya"
    case "orchestrate_mr_forte":
      return "forte"
    case "review_required":
    case "no_action_required":
    default:
      return null
  }
}

/**
 * Operational vs informational — centralized (do not scatter in UI).
 * `reply`: actionable (composer / send path), not automatic execution.
 */
export function computeIsActionable(type: NextSmartMovementType): boolean {
  switch (type) {
    case "no_action_required":
    case "review_required":
      return false
    case "reply":
      return true
    default:
      return true
  }
}

/** Conservative priority — does not pretend precision. */
export function computeNextSmartMovementPriority(
  type: NextSmartMovementType,
  opts: { isActionable: boolean; conversationUrgency?: string | null },
): NextSmartMovementPriority {
  const u = (opts.conversationUrgency ?? "").toLowerCase()
  const urgent = u === "critica" || u === "alta"

  if (!opts.isActionable) {
    if (urgent) return "medium"
    return "low"
  }

  if (urgent && ["generate_invoice", "assign_operator", "request_missing_requirements", "create_client"].includes(type)) {
    return "high"
  }
  if (urgent) return "high"

  if (["generate_invoice", "orchestrate_freya", "orchestrate_mr_forte", "create_project"].includes(type)) return "high"
  if (["reply", "schedule_followup", "generate_price_guidance"].includes(type)) return "medium"
  return "medium"
}

export interface FinalizeMovementContext {
  conversationUrgency?: string | null
  messageId?: string | null
}

/**
 * Single normalization path for persisted, derived, or mapped drafts.
 * Applies automation policy + execution descriptor together.
 */
export function finalizeNextSmartMovement(
  draft: MovementDraft,
  cfg: InboxAutomationConfig,
  ctx: FinalizeMovementContext = {},
): NextSmartMovement {
  const type = normalizeMovementTypeString(String(draft.type))
  const merged: MovementDraft = {
    ...draft,
    type,
    sourceMessageId: draft.sourceMessageId ?? ctx.messageId ?? null,
  }

  const autoEligible = cfg.enabled && canAutoExecuteMovement(merged.type, cfg)
  const requiresApproval =
    cfg.requireApproval ||
    !autoEligible ||
    merged.requiresApproval === true ||
    merged.type === "review_required" ||
    merged.type === "no_action_required"

  const executor = resolveExecutorForMovementType(merged.type)
  const isActionable = computeIsActionable(merged.type)

  const priority = computeNextSmartMovementPriority(merged.type, {
    isActionable,
    conversationUrgency: ctx.conversationUrgency,
  })

  const execution: NextSmartMovementExecution = {
    canAutoExecute: autoEligible && merged.type !== "review_required" && merged.type !== "no_action_required",
    requiresApproval,
    executor,
  }

  return {
    ...merged,
    type: merged.type,
    requiresApproval,
    isActionable,
    priority,
    execution,
  }
}

// ── Layer: persisted MessageIntent (DB) ──────────────────────────────────────

export function deriveFromPersistedMessageIntent(row: MessageIntentMovementRow | null | undefined): MovementDraft | null {
  if (!row?.nextSmartMovementType?.trim()) return null

  const type = normalizeMovementTypeString(row.nextSmartMovementType.trim())
  let payload: Record<string, unknown> | null = null
  if (row.nextSmartMovementData) {
    try {
      const p = JSON.parse(row.nextSmartMovementData) as unknown
      if (p && typeof p === "object" && !Array.isArray(p)) payload = p as Record<string, unknown>
    } catch {
      payload = null
    }
  }

  const candidate: MovementDraft = {
    type,
    source: "manual",
    sourceMessageId: typeof payload?.sourceMessageId === "string" ? payload.sourceMessageId : null,
    payload,
    title: typeof payload?.title === "string" ? payload.title : undefined,
    rationale: typeof payload?.rationale === "string" ? payload.rationale : undefined,
    confidence: typeof payload?.confidence === "number" ? payload.confidence : null,
    requiresApproval: typeof payload?.requiresApproval === "boolean" ? payload.requiresApproval : undefined,
  }

  const parsed = nextSmartMovementSchema.safeParse({
    ...candidate,
    type: candidate.type,
    source: "manual",
  })
  if (parsed.success) return movementDraftFromParsed(parsed.data)
  return candidate
}

// ── Layer: persisted Message.metadata ────────────────────────────────────────

export function deriveFromPersistedMessageMetadata(meta: Record<string, unknown> | null): MovementDraft | null {
  return parsePersistedMetadataMovementDraft(meta)
}

function parsePersistedMetadataMovementDraft(rawMeta: Record<string, unknown> | null): MovementDraft | null {
  if (!rawMeta) return null

  const nested = rawMeta.nextSmartMovement ?? rawMeta.next_smart_movement
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const parsed = nextSmartMovementSchema.safeParse(nested)
    if (parsed.success) return movementDraftFromParsed(parsed.data)
  }

  const legacyType = rawMeta.nextSmartMovementType ?? rawMeta.next_smart_movement_type
  const legacyData = rawMeta.nextSmartMovementData ?? rawMeta.next_smart_movement_data
  if (typeof legacyType === "string") {
    const normalized = normalizeMovementTypeString(legacyType)
    let payload: Record<string, unknown> | null = null
    if (legacyData && typeof legacyData === "object" && !Array.isArray(legacyData)) {
      payload = legacyData as Record<string, unknown>
    }
    const candidate = {
      type: normalized,
      source: "manual" as const,
      sourceMessageId: typeof rawMeta.sourceMessageId === "string" ? rawMeta.sourceMessageId : null,
      payload,
      title: typeof payload?.title === "string" ? payload.title : undefined,
      rationale: typeof payload?.rationale === "string" ? payload.rationale : undefined,
    }
    const parsed = nextSmartMovementSchema.safeParse(candidate)
    if (parsed.success) return movementDraftFromParsed(parsed.data)
  }

  return null
}

/** @deprecated Use `deriveFromPersistedMessageMetadata` + `finalizeNextSmartMovement`. Kept for callers. */
export function parsePersistedNextSmartMovement(rawMeta: Record<string, unknown> | null): NextSmartMovement | null {
  const d = parsePersistedMetadataMovementDraft(rawMeta)
  if (!d) return null
  return finalizeNextSmartMovement(d, getInboxAutomationConfig({}))
}

// ── Layer: structured short intent (phrase-level heuristics) ──────────────────

export function deriveFromStructuredIntent(shortIntent: string | null): MovementDraft | null {
  if (!shortIntent?.trim()) return null
  const s = shortIntent.toLowerCase()
  if (/\bfreya\b/i.test(s)) {
    return {
      type: "orchestrate_freya",
      title: movementTitle("orchestrate_freya"),
      rationale: "Structured intent references Freya (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (/\bforte\b/i.test(s) || /\bmr\.?\s*forte\b/i.test(s)) {
    return {
      type: "orchestrate_mr_forte",
      title: movementTitle("orchestrate_mr_forte"),
      rationale: "Structured intent references Forte (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  return null
}

// ── Layer: message body / direction heuristics ──────────────────────────────

export function deriveFromMessageContent(params: {
  shortIntent: string | null
  content: string
  direction: string
  isInternal: boolean
}): MovementDraft {
  const { shortIntent, content, direction, isInternal } = params
  const text = `${shortIntent ?? ""} ${content ?? ""}`.toLowerCase()
  const match = (...patterns: RegExp[]) => patterns.some((p) => p.test(text))

  if (isInternal) {
    return {
      type: "review_required",
      title: movementTitle("review_required"),
      rationale: "Internal note — operational automation is usually not inferred here.",
      confidence: null,
      source: "message",
    }
  }

  if (/\bfreya\b/i.test(shortIntent ?? "") || /\bfreya\b/i.test(content)) {
    return {
      type: "orchestrate_freya",
      title: movementTitle("orchestrate_freya"),
      rationale: "Keyword hint toward Freya orchestration (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (/\bforte\b/i.test(shortIntent ?? "") || /\bmr\.?\s*forte\b/i.test(text)) {
    return {
      type: "orchestrate_mr_forte",
      title: movementTitle("orchestrate_mr_forte"),
      rationale: "Keyword hint toward Forte orchestration (heuristic).",
      confidence: null,
      source: "message",
    }
  }

  if (match(/\binvoice\b/, /\bfactura\b/, /\bfacturación\b/, /\bbilling\b/)) {
    return {
      type: "generate_invoice",
      title: movementTitle("generate_invoice"),
      rationale: "Invoice / billing wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\bquote\b/, /\bpresupuesto\b/, /\bcotizaci[oó]n\b/, /\bpricing\b/, /\bprecio\b/)) {
    return {
      type: "generate_price_guidance",
      title: movementTitle("generate_price_guidance"),
      rationale: "Pricing / quote wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\breport\b/, /\binforme\b/)) {
    return {
      type: "generate_report",
      title: movementTitle("generate_report"),
      rationale: "Report wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\bproject\b/, /\bproyecto\b/)) {
    return {
      type: "create_project",
      title: movementTitle("create_project"),
      rationale: "Project wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\bnew client\b/, /\bnuevo cliente\b/, /\b alta\b/, /\bonboarding\b/)) {
    return {
      type: "create_client",
      title: movementTitle("create_client"),
      rationale: "New client / onboarding wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\bfollow[\s-]?up\b/, /\bseguimiento\b/, /\bcallback\b/, /\bill call\b/)) {
    return {
      type: "schedule_followup",
      title: movementTitle("schedule_followup"),
      rationale: "Follow-up wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\bassign\b/, /\basignar\b/, /\bowner\b/, /\boperator\b/)) {
    return {
      type: "assign_operator",
      title: movementTitle("assign_operator"),
      rationale: "Assignment wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }
  if (match(/\brequirement\b/, /\brequisito\b/, /\bmissing\b/, /\bfalta\b/, /\bclarif/)) {
    return {
      type: "request_missing_requirements",
      title: movementTitle("request_missing_requirements"),
      rationale: "Requirements / clarification wording detected (heuristic).",
      confidence: null,
      source: "message",
    }
  }

  if (direction === "inbound") {
    return {
      type: "reply",
      title: movementTitle("reply"),
      rationale: "No stronger operational pattern matched — suggest responding to the contact.",
      confidence: null,
      source: "message",
    }
  }

  return buildSafeFallbackMovement("message")
}

/** Combines structured intent hints then body heuristics (derived layer). */
export function deriveFromMessageSignals(params: {
  shortIntent: string | null
  content: string
  direction: string
  isInternal: boolean
}): MovementDraft {
  const structured = deriveFromStructuredIntent(params.shortIntent)
  if (structured) return structured
  return deriveFromMessageContent(params)
}

// ── Layer: legacy classification ───────────────────────────────────────────────

export function mapFromLegacyNextBestAction(input: Record<string, unknown> | null | undefined): MovementDraft {
  const rawType = typeof input?.type === "string" ? input.type.trim().toLowerCase() : ""
  const description =
    typeof input?.description === "string" && input.description.trim()
      ? input.description.trim()
      : typeof input?.label === "string" && input.label.trim()
        ? input.label.trim()
        : ""

  switch (rawType) {
    case "follow_up":
      return {
        type: "schedule_followup",
        title: movementTitle("schedule_followup"),
        rationale: description || "Mapped from legacy follow_up recommendation.",
        confidence: null,
        source: "legacy-mapped",
      }
    case "clarify_scope":
      return {
        type: "request_missing_requirements",
        title: movementTitle("request_missing_requirements"),
        rationale: description || "Mapped from legacy clarify_scope recommendation.",
        confidence: null,
        source: "legacy-mapped",
      }
    case "prepare_quote":
      return {
        type: "generate_price_guidance",
        title: movementTitle("generate_price_guidance"),
        rationale:
          description ||
          "Mapped from legacy prepare_quote — confirm scope before heavy automation.",
        confidence: null,
        source: "legacy-mapped",
      }
    case "assign_operator":
      return {
        type: "assign_operator",
        title: movementTitle("assign_operator"),
        rationale: description || "Mapped from legacy assign_operator recommendation.",
        confidence: null,
        source: "legacy-mapped",
      }
    case "wait_human":
      return {
        type: "review_required",
        title: movementTitle("review_required"),
        rationale: description || "Mapped from legacy wait_human — human judgment expected.",
        confidence: null,
        source: "legacy-mapped",
      }
    default:
      return {
        type: rawType.length > 0 ? "review_required" : "no_action_required",
        title:
          rawType.length > 0 ? movementTitle("review_required") : movementTitle("no_action_required"),
        rationale:
          description ||
          (rawType.length > 0
            ? `Unrecognized legacy action "${rawType}" — defaulting to manual review.`
            : "No legacy next-best-action available."),
        confidence: null,
        source: "legacy-mapped",
      }
  }
}

/** @deprecated Prefer `mapFromLegacyNextBestAction`. */
export const mapNextBestActionToSmartMovement = mapFromLegacyNextBestAction

export function buildSafeFallbackMovement(source: NextSmartMovementSource): MovementDraft {
  return {
    type: "no_action_required",
    title: movementTitle("no_action_required"),
    rationale: "No operational inference available — safe idle state.",
    confidence: null,
    source,
  }
}

// ── Titles ──────────────────────────────────────────────────────────────────

export function nextSmartMovementTypeTitle(type: NextSmartMovementType): string {
  const labels: Record<NextSmartMovementType, string> = {
    request_missing_requirements: "Request missing requirements",
    create_client: "Create client record",
    create_project: "Create project",
    generate_invoice: "Generate invoice",
    generate_report: "Generate report",
    generate_price_guidance: "Price guidance",
    orchestrate_freya: "Orchestrate Freya agent",
    orchestrate_mr_forte: "Orchestrate Mr. Forte agent",
    assign_operator: "Assign operator",
    schedule_followup: "Schedule follow-up",
    reply: "Draft / send reply",
    review_required: "Human review",
    no_action_required: "No action required",
  }
  return labels[type] ?? type
}

function movementTitle(type: NextSmartMovementType): string {
  return nextSmartMovementTypeTitle(type)
}

export function toNextSmartMovementSummary(m: NextSmartMovement): NextSmartMovementSummary {
  return {
    type: m.type,
    title: m.title,
    rationale: m.rationale,
    confidence: m.confidence ?? null,
    requiresApproval: m.requiresApproval,
    source: m.source,
    isActionable: m.isActionable,
    priority: m.priority,
    execution: m.execution,
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface DeriveMessageNextSmartMovementInput {
  message: {
    id: string
    content: string
    direction: string
    role: string
    isInternal: boolean
  }
  messageMetadata: Record<string, unknown> | null
  classification: { nextBestAction?: Record<string, unknown> | null } | null
  workspaceAutomation: InboxAutomationConfig
  /** Future source of truth row — wins over metadata when movement type set. */
  messageIntent?: MessageIntentMovementRow | null
  conversationUrgency?: string | null
}

export function deriveMessageNextSmartMovement(input: DeriveMessageNextSmartMovementInput): NextSmartMovement {
  const { message, messageMetadata, classification, workspaceAutomation, messageIntent, conversationUrgency } = input

  const ctx: FinalizeMovementContext = {
    conversationUrgency,
    messageId: message.id,
  }

  const fromIntent = deriveFromPersistedMessageIntent(messageIntent ?? null)
  const fromMeta = deriveFromPersistedMessageMetadata(messageMetadata)

  let draft: MovementDraft | null = fromIntent ?? fromMeta ?? null

  if (!draft) {
    const signals = deriveFromMessageSignals({
      shortIntent: getShortIntentFromMetadataRecord(messageMetadata),
      content: message.content,
      direction: message.direction,
      isInternal: message.isInternal,
    })
    if (signals.type !== "no_action_required") {
      draft = { ...signals, sourceMessageId: message.id }
    } else {
      const legacy = mapFromLegacyNextBestAction(classification?.nextBestAction ?? null)
      draft = {
        ...legacy,
        sourceMessageId: message.id,
        rationale:
          legacy.rationale ??
          "Derived from conversation-level classification as a fallback for this message.",
      }
    }
  } else {
    draft = { ...draft, sourceMessageId: draft.sourceMessageId ?? message.id }
  }

  return finalizeNextSmartMovement(draft, workspaceAutomation, ctx)
}

export const getMessageNextSmartMovement = deriveMessageNextSmartMovement

export function deriveMessageNextSmartMovementFromRawMetadata(
  input: Omit<DeriveMessageNextSmartMovementInput, "messageMetadata"> & {
    metadata: string | Record<string, unknown> | null | undefined
  },
): NextSmartMovement {
  const metaRecord =
    input.metadata == null
      ? null
      : typeof input.metadata === "string"
        ? parseMessageMetadataRecord(input.metadata)
        : typeof input.metadata === "object" && !Array.isArray(input.metadata)
          ? (input.metadata as Record<string, unknown>)
          : null
  return deriveMessageNextSmartMovement({
    ...input,
    messageMetadata: metaRecord,
  })
}

// ── Message intent API rows ───────────────────────────────────────────────────

export interface MessageIntentOperationalRow {
  id: string
  messageId: string
  shortIntent: string
  status: IntentOperationalStatus
  nextSmartMovement: NextSmartMovementSummary | null
}

export function buildMessageIntentRowsForApi(params: {
  messages: Array<{
    id: string
    metadata: string | null
    content: string
    direction: string
    role: string
    isInternal: boolean
  }>
  classification: { nextBestAction?: Record<string, unknown> | null } | null
  workspaceConfig: unknown
  /** Optional MessageIntent rows keyed by message id — wins over metadata for movement reads. */
  messageIntentByMessageId?: Record<string, MessageIntentMovementRow | undefined>
  conversationUrgency?: string | null
}): MessageIntentOperationalRow[] {
  const automation = getInboxAutomationConfig(params.workspaceConfig)
  const intentMap = params.messageIntentByMessageId ?? {}
  const result: MessageIntentOperationalRow[] = []

  for (const m of params.messages) {
    const meta = parseMessageMetadataRecord(m.metadata)
    const si = getShortIntentFromMetadataRecord(meta)
    if (!si) continue

    const movement = deriveMessageNextSmartMovement({
      message: {
        id: m.id,
        content: m.content,
        direction: m.direction,
        role: m.role,
        isInternal: m.isInternal,
      },
      messageMetadata: meta,
      classification: params.classification,
      workspaceAutomation: automation,
      messageIntent: intentMap[m.id] ?? null,
      conversationUrgency: params.conversationUrgency ?? null,
    })

    result.push({
      id: m.id,
      messageId: m.id,
      shortIntent: si,
      status: getIntentOperationalStatusFromMetadata(meta),
      nextSmartMovement: movement.type === "no_action_required" ? null : toNextSmartMovementSummary(movement),
    })
  }

  return result
}
