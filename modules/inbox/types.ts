export interface InboxClassification {
  tipo: "lead" | "ticket" | "consulta" | "proyecto" | "factura"
  categoria: string
  urgencia: "baja" | "media" | "alta" | "critica"
  intencion: string
  resumen: string
  datosCliente: {
    nombre?: string
    email?: string
    telefono?: string
    empresa?: string
  }
  datosProyecto: {
    nombre?: string
    descripcion?: string
    presupuesto?: string
  }
  notas: string
  tags: string[]
}

export interface ConversationIntelligenceOutput {
  tipo: InboxClassification["tipo"]
  categoria: string
  urgencia: InboxClassification["urgencia"]
  intencion: string
  resumen: string
  leadScore: number
  scoreReasoning: string
  sentiment: string
  sector: string
  confidence: number
  detectedLanguage: string
  datosCliente: InboxClassification["datosCliente"]
  datosProyecto: InboxClassification["datosProyecto"]
  notas: string
  tags: string[]
  facts: string[]
  pendingItems: string[]
  risks: string[]
  nextBestAction: {
    type: string
    description: string
  } | null
  suggestedActions: Array<{
    type: "create_client" | "create_project" | "create_task" | "schedule_followup" | "assign_operator" | "generate_proposal" | "create_event"
    title: string
    description: string
    confidence: number
    /**
     * Phase 1 calendar suggestions. For `create_event` actions this carries the structured
     * EventHint extracted from the latest inbound message; ignored for other action types.
     * Persisted as JSON inside ConversationAction.data.
     */
    data?: Record<string, unknown>
  }>
  /**
   * Phase 1 — calendar event detection. Populated when the latest inbound, non-internal message
   * mentions a clear meeting/visit/deadline/appointment with date+time (or just date as allDay).
   * Null for vague text. Resolution of relative dates ("tomorrow at 8") relies on the `nowISO` +
   * timezone hint passed into the prompt.
   */
  eventHint: EventHint | null
  handoff: {
    headline: string
    summary: string
    facts: string[]
    decisions: string[]
    pendingItems: string[]
    risks: string[]
    nextRecommendedAction: string
    confidence: number
  }
  draft: {
    shouldCreate: boolean
    title: string
    content: string
    tone: string
    targetChannel: string
    reason: string
  } | null
}

// ---------------------------------------------------------------------------
// Fanny v1 — Supervised intelligence output
// ---------------------------------------------------------------------------

export type FannyActionType =
  | "create_client"
  | "create_project"
  | "create_task"
  | "schedule_followup"
  | "assign_operator"
  | "generate_proposal"
  | "create_event"

export interface FannySuggestedAction {
  type: FannyActionType
  title: string
  description: string
  confidence: number
  /** Optional structured payload — used by `create_event` to ferry EventHint data. */
  data?: Record<string, unknown>
}

/**
 * Structured calendar hint extracted from a single message. Always tied to a `sourceMessageId`
 * (the inbound message that triggered the detection). The composer never produces these — they
 * are output of the inbox intelligence pipeline only. When `startISO` is null the hint is too
 * weak to surface a Smart action; consumers MUST treat it as missing data.
 */
export interface EventHint {
  title: string
  startISO: string | null
  endISO?: string | null
  allDay?: boolean
  location?: string | null
  purpose?: string | null
  sourceMessageId?: string | null
  confidence?: number
}

export interface FannySuggestedReply {
  title: string
  content: string
  tone: string
  targetChannel: string
  reason: string
}

export interface FannyHandoff {
  headline: string
  summary: string
  facts: string[]
  decisions: string[]
  pendingItems: string[]
  risks: string[]
  nextRecommendedAction: string
  confidence: number
}

/**
 * Fanny v1 analysis result — the public contract for supervised inbox intelligence.
 *
 * This is derived from ConversationIntelligenceOutput but represents the
 * structured, agent-facing output that Fanny produces for each conversation.
 * All outputs are supervisable: drafts are editable, actions require approval.
 */
export interface FannyAnalysisResult {
  summary: string
  intent: string
  urgency: InboxClassification["urgencia"]
  sentiment: string
  confidence: number
  detectedLanguage: string
  leadScore: number

  needsHumanReview: boolean

  suggestedReply: FannySuggestedReply | null
  suggestedActions: FannySuggestedAction[]
  handoff: FannyHandoff

  facts: string[]
  pendingItems: string[]
  risks: string[]
  nextBestAction: { type: string; description: string } | null
  tags: string[]
}
