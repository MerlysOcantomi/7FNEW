import { askMotorIA } from "@engines/ai"
import { db } from "@core/db"
import {
  resolveWorkspaceContext,
  buildWorkspaceContextBlock,
  getWorkspaceWithResolvedConfig,
} from "@core/workspace"
import { FANNY_SYSTEM_PROMPT } from "@/agents/fanny/system-prompt"
import { DEFAULT_LOCALE, type SupportedLocale } from "@core/i18n"
import { getOperatorUiStrings, operatorLocalePromptName } from "@/lib/inbox-operator-i18n"
import type {
  ConversationIntelligenceOutput,
  EventHint,
  InboxClassification,
} from "./types"
import { transitionConversationStatus } from "./state"

const PIPELINE_VERSION = "5"
const PROMPT_VERSION = "fanny-v1.2"
const MODEL_NAME = "operativo"
const ACTION_SOURCE = "ai"
const ALLOWED_ACTION_TYPES = new Set([
  "create_client",
  "create_project",
  "create_task",
  "schedule_followup",
  "assign_operator",
  "generate_proposal",
  "create_event",
])
/**
 * Floor to surface Add to calendar in the right panel. Below this confidence we still persist
 * the eventHint on the action data (operators can debug it) but the panel will hide the CTA so
 * we don't badger the user with weak detections (e.g. "next week sometime").
 */
const EVENT_HINT_MIN_CONFIDENCE = 0.55

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function parseJsonResponse<T>(response: string): T | null {
  try {
    const cleaned = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

/**
 * Resolve a sane workspace timezone hint. We never pull from the host (server might be UTC); we
 * read `Workspace.config.locale.timeZone` if present, else fall back to UTC. The model uses this
 * to anchor relative phrases like "tomorrow at 8".
 */
function pickWorkspaceTimezone(config: unknown): string {
  if (!config || typeof config !== "object") return "UTC"
  const cfg = config as Record<string, unknown>
  const direct = typeof cfg.timeZone === "string" ? cfg.timeZone.trim() : ""
  if (direct) return direct
  const localeBlock = cfg.locale
  if (localeBlock && typeof localeBlock === "object") {
    const tz = (localeBlock as Record<string, unknown>).timeZone
    if (typeof tz === "string" && tz.trim()) return tz.trim()
  }
  return "UTC"
}

/**
 * Validate and sanitize the model's eventHint output. Returns null when:
 *   - hint is missing/non-object
 *   - title is empty/non-string
 *   - both startISO is invalid AND allDay is false (we accept date-only when allDay=true)
 * We never trust dates earlier than 1970 or further than 5y in the future to avoid garbage like
 * "0001-01-01" leaking into the UI.
 */
function sanitizeEventHint(input: unknown, fallbackSourceMessageId: string | null): EventHint | null {
  if (!input || typeof input !== "object") return null
  const raw = input as Record<string, unknown>

  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  if (!title) return null

  const allDay = raw.allDay === true
  const startRaw = typeof raw.startISO === "string" ? raw.startISO.trim() : ""
  const endRaw = typeof raw.endISO === "string" ? raw.endISO.trim() : ""

  let startISO: string | null = null
  if (startRaw) {
    const parsed = new Date(startRaw)
    if (!Number.isNaN(parsed.getTime())) {
      const yr = parsed.getUTCFullYear()
      if (yr >= 1970 && yr <= new Date().getUTCFullYear() + 5) {
        startISO = parsed.toISOString()
      }
    }
  }

  /** All-day events are valid even without a time component, but we still need a valid date. */
  if (!startISO && !allDay) return null

  let endISO: string | null = null
  if (endRaw) {
    const parsedEnd = new Date(endRaw)
    if (!Number.isNaN(parsedEnd.getTime())) {
      endISO = parsedEnd.toISOString()
      if (startISO && endISO < startISO) endISO = null
    }
  }

  const location = typeof raw.location === "string" && raw.location.trim() ? raw.location.trim() : null
  const purpose = typeof raw.purpose === "string" && raw.purpose.trim() ? raw.purpose.trim() : null
  const confidence = clampNumber(raw.confidence, 0, 1, 0.6)

  const sourceMessageId =
    typeof raw.sourceMessageId === "string" && raw.sourceMessageId.trim()
      ? raw.sourceMessageId.trim()
      : fallbackSourceMessageId

  return {
    title: title.slice(0, 200),
    startISO,
    endISO,
    allDay,
    location: location?.slice(0, 200) ?? null,
    purpose: purpose?.slice(0, 500) ?? null,
    sourceMessageId,
    confidence,
  }
}

export async function generateConversationIntelligence(input: {
  conversationId: string
  channel: string
  status: string
  subject?: string | null
  clienteId?: string | null
  proyectoId?: string | null
  assignedTo?: string | null
  contact: {
    nombre?: string | null
    email?: string | null
    telefono?: string | null
    empresa?: string | null
    tipo?: string | null
  }
  previousSummary?: string | null
  previousIntent?: string | null
  workspaceContextBlock?: string | null
  operatorLocale: SupportedLocale
  /**
   * Phase 1 calendar detection — both deterministic anchors. `nowISO` lets the model resolve
   * "tomorrow at 8" without guessing a date; `workspaceTimeZone` is the IANA tz the workspace
   * runs in. Optional so existing callers don't break — defaults are computed locally.
   */
  nowISO?: string
  workspaceTimeZone?: string
  messages: Array<{
    id?: string
    role: string
    direction: string
    content: string
    isInternal?: boolean
    createdAt?: string
  }>
}): Promise<ConversationIntelligenceOutput> {
  const S = getOperatorUiStrings(input.operatorLocale)
  const opLangName = operatorLocalePromptName(input.operatorLocale)

  const nowISO = input.nowISO ?? new Date().toISOString()
  const tz = input.workspaceTimeZone ?? "UTC"

  /**
   * Latest inbound non-internal message — used as the deterministic anchor for eventHint.
   * The model is told to hang the hint off this id; we never let it invent ids on its own.
   */
  const latestInboundMessage = [...input.messages]
    .reverse()
    .find((m) => m.direction === "inbound" && !m.isInternal)
  const latestInboundId = latestInboundMessage?.id ?? null

  const transcript = input.messages
    .slice(-12)
    .map((message, index) => {
      const stamp = message.createdAt ? ` (${message.createdAt})` : ""
      const visibility = message.isInternal ? " [internal]" : ""
      const idTag = message.id ? ` <id:${message.id}>` : ""
      return `${index + 1}. [${message.direction}/${message.role}]${idTag}${stamp}${visibility}: ${message.content}`
    })
    .join("\n")

  const prompt = `${FANNY_SYSTEM_PROMPT}

OPERATOR_UI_LANGUAGE: ${opLangName}
All operator-facing string values in the JSON must be written in ${opLangName}.
The only exception is draft.content: that field must be in the CUSTOMER's language (inbound messages), not ${opLangName}.

Analyze the conversation and respond with ONLY valid JSON.
${input.workspaceContextBlock ? `\n${input.workspaceContextBlock}\n` : ""}
CONVERSATION:
- conversationId: ${input.conversationId}
- channel: ${input.channel}
- currentStatus: ${input.status}
- nowISO: ${nowISO}
- workspaceTimeZone: ${tz}
${latestInboundId ? `- latestInboundMessageId: ${latestInboundId}` : ""}
${input.subject ? `- subject: ${input.subject}` : ""}
${input.clienteId ? `- linkedClientId: ${input.clienteId}` : ""}
${input.proyectoId ? `- linkedProjectId: ${input.proyectoId}` : ""}
${input.assignedTo ? `- assignee: ${input.assignedTo}` : ""}
${input.contact.nombre ? `- contactName: ${input.contact.nombre}` : ""}
${input.contact.email ? `- email: ${input.contact.email}` : ""}
${input.contact.telefono ? `- phone: ${input.contact.telefono}` : ""}
${input.contact.empresa ? `- company: ${input.contact.empresa}` : ""}
${input.contact.tipo ? `- contactType: ${input.contact.tipo}` : ""}
${input.previousSummary ? `- previousSummary: ${input.previousSummary}` : ""}
${input.previousIntent ? `- previousIntent: ${input.previousIntent}` : ""}

RECENT MESSAGES (each line is prefixed with its <id:...> when available):
${transcript || "No messages"}

Return this JSON shape (field names MUST match exactly):
{
  "tipo": "lead" | "ticket" | "consulta" | "proyecto" | "factura",
  "categoria": "short operational category (${opLangName})",
  "urgencia": "baja" | "media" | "alta" | "critica",
  "intencion": "short intent phrase (${opLangName})",
  "resumen": "updated conversation summary (${opLangName})",
  "leadScore": 0,
  "scoreReasoning": "brief (${opLangName})",
  "sentiment": "positivo|neutral|negativo|mixto",
  "sector": "detected sector or empty",
  "confidence": 0.0,
  "detectedLanguage": "es|en|fr|de|pt|it|other — primary language of inbound customer messages",
  "datosCliente": { "nombre": "", "email": "", "telefono": "", "empresa": "" },
  "datosProyecto": { "nombre": "", "descripcion": "", "presupuesto": "" },
  "notas": " (${opLangName})",
  "tags": [],
  "facts": [],
  "pendingItems": [],
  "risks": [],
  "nextBestAction": { "type": "follow_up | clarify_scope | assign_operator | prepare_quote | wait_human", "description": " (${opLangName})" },
  "suggestedActions": [
    { "type": "create_client | create_project | create_task | schedule_followup | assign_operator | generate_proposal", "title": " (${opLangName})", "description": " (${opLangName})", "confidence": 0.0 }
  ],
  "eventHint": {
    "title": "concise human-readable title (${opLangName})",
    "startISO": "ISO 8601 datetime resolved against nowISO + workspaceTimeZone (e.g. 2026-05-02T08:00:00). Empty string if only date is known and allDay=true.",
    "endISO": "optional ISO 8601 datetime if explicitly mentioned, otherwise empty",
    "allDay": false,
    "location": "place name or address as written, otherwise empty",
    "purpose": "short reason / topic of the event (${opLangName}), otherwise empty",
    "sourceMessageId": "id of the inbound message that triggered this hint",
    "confidence": 0.0
  },
  "handoff": {
    "headline": " (${opLangName})",
    "summary": " (${opLangName})",
    "facts": [],
    "decisions": [],
    "pendingItems": [],
    "risks": [],
    "nextRecommendedAction": " (${opLangName})",
    "confidence": 0.0
  },
  "draft": {
    "shouldCreate": true,
    "title": " (${opLangName})",
    "content": "ONLY customer language — suggested reply body",
    "tone": "consultivo|amable|directo|profesional",
    "targetChannel": "${input.channel}",
    "reason": " (${opLangName})"
  }
}

RULES:
- Keep facts, pendingItems, risks, decisions brief and grounded in the thread.
- Do not invent private data or unsupported claims.
- suggestedActions: only genuinely useful actions; avoid duplicates.
- If no draft is appropriate: draft.shouldCreate=false, draft.content empty.
- detectedLanguage: predominant inbound customer language; if unclear use "en".
- handoff must be actionable for a human operator.
- Lines tagged [internal] are PRIVATE operator notes the customer never sees. Use them as
  context to enrich facts, pendingItems, risks, decisions, and nextBestAction/handoff. NEVER
  copy their text into draft.content (the customer reads draft.content) and never quote them
  to the customer.
- draft.content rules for [internal] facts: you MAY let those facts shape the wording, but
  (a) do NOT attribute them to the customer ("as you mentioned…", "you said…") if the
  customer never wrote them, (b) do NOT include phrases like "according to the internal
  note", "as per the internal note", or any reference revealing that internal notes exist,
  and (c) prefer paraphrasing the fact or turning it into a question to the customer.
- eventHint:
  * Set eventHint to null UNLESS the latest INBOUND non-internal message clearly mentions a
    meeting, visit, deadline, appointment, delivery, or scheduled event WITH a real date or
    date+time (relative phrases like "tomorrow", "next Monday", "in 2 days" count when nowISO
    is known).
  * Resolve relative dates against nowISO interpreted in workspaceTimeZone. Output startISO
    as ISO 8601 in that local timezone WITHOUT a "Z" suffix when possible (e.g.
    "2026-05-02T08:00:00"); the system will normalize it.
  * If only a date is given (no time) → startISO can be the date midnight local and allDay=true.
  * sourceMessageId MUST equal the <id:...> of the inbound message that contains the event.
  * Internal lines ([internal]) MUST NEVER trigger an eventHint.
  * Do NOT invent dates the customer did not state. Vague phrases like "soon", "next week
    sometime" are NOT enough — return eventHint=null.
- Output compact valid JSON only.`

  // DeepSeek uses NEUTRAL_TASK_SYSTEM_PROMPT (engines/ai/deepseek.ts) — no Spanish-forced layer under this prompt.
  const response = await askMotorIA(prompt, "operativo")
  const parsed = parseJsonResponse<Partial<ConversationIntelligenceOutput>>(response)

  if (parsed) {
    return {
      tipo: parsed.tipo ?? "consulta",
      categoria: parsed.categoria ?? "seguimiento",
      urgencia: parsed.urgencia ?? "media",
      intencion: parsed.intencion ?? input.previousIntent ?? S.requiresFollowUp,
      resumen:
        parsed.resumen ?? input.previousSummary ?? input.messages.at(-1)?.content?.slice(0, 200) ?? S.noSummary,
      leadScore: clampNumber(parsed.leadScore, 0, 100, 40),
      scoreReasoning: parsed.scoreReasoning ?? S.scoringFromContext,
      sentiment: parsed.sentiment ?? "neutral",
      sector: parsed.sector ?? "",
      confidence: clampNumber(parsed.confidence, 0, 1, 0.62),
      detectedLanguage:
        typeof parsed.detectedLanguage === "string" && parsed.detectedLanguage.trim()
          ? parsed.detectedLanguage.trim().toLowerCase()
          : "en",
      datosCliente: parsed.datosCliente ?? {},
      datosProyecto: parsed.datosProyecto ?? {},
      notas: parsed.notas ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      pendingItems: Array.isArray(parsed.pendingItems) ? parsed.pendingItems : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      nextBestAction: parsed.nextBestAction
        ? {
            type: parsed.nextBestAction.type ?? "wait_human",
            description: parsed.nextBestAction.description ?? S.humanReviewRecommendedDesc,
          }
        : null,
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions
          .filter((action): action is NonNullable<ConversationIntelligenceOutput["suggestedActions"]>[number] =>
            typeof action?.type === "string"
            && typeof action?.title === "string"
            && typeof action?.description === "string",
          )
          .map((action) => ({
            type: action.type,
            title: action.title,
            description: action.description,
            confidence: clampNumber(action.confidence, 0, 1, 0.6),
            ...(action.data && typeof action.data === "object" ? { data: action.data } : {}),
          }))
        : [],
      eventHint: sanitizeEventHint(
        (parsed as { eventHint?: unknown }).eventHint,
        latestInboundId,
      ),
      handoff: {
        headline: parsed.handoff?.headline ?? S.operationalContextReady,
        summary: parsed.handoff?.summary ?? parsed.resumen ?? input.previousSummary ?? S.noGeneratedContext,
        facts: Array.isArray(parsed.handoff?.facts) ? parsed.handoff.facts : [],
        decisions: Array.isArray(parsed.handoff?.decisions) ? parsed.handoff.decisions : [],
        pendingItems: Array.isArray(parsed.handoff?.pendingItems) ? parsed.handoff.pendingItems : [],
        risks: Array.isArray(parsed.handoff?.risks) ? parsed.handoff.risks : [],
        nextRecommendedAction:
          parsed.handoff?.nextRecommendedAction ?? parsed.nextBestAction?.description ?? S.humanReviewNext,
        confidence: clampNumber(parsed.handoff?.confidence, 0, 1, 0.62),
      },
      draft: parsed.draft
        ? {
            shouldCreate: Boolean(parsed.draft.shouldCreate),
            title: parsed.draft.title ?? S.draftReplyTitle,
            content: parsed.draft.content ?? "",
            tone: parsed.draft.tone ?? "profesional",
            targetChannel: parsed.draft.targetChannel ?? input.channel,
            reason: parsed.draft.reason ?? "",
          }
        : null,
    }
  }

  const fallbackSummary = input.previousSummary ?? input.messages.at(-1)?.content?.slice(0, 200) ?? S.noSummary

  return {
    tipo: "consulta",
    categoria: "seguimiento",
    urgencia: "media",
    intencion: input.previousIntent ?? S.requiresHumanReview,
    resumen: fallbackSummary,
    leadScore: 35,
    scoreReasoning: S.scoreReasoningParseFallback,
    sentiment: "neutral",
    sector: "",
    confidence: 0.35,
    detectedLanguage: "en",
    datosCliente: {
      nombre: input.contact.nombre ?? undefined,
      email: input.contact.email ?? undefined,
      telefono: input.contact.telefono ?? undefined,
      empresa: input.contact.empresa ?? undefined,
    },
    datosProyecto: {},
    notas: S.fallbackNotes,
    tags: [S.manualReviewTag],
    facts: [],
    pendingItems: [],
    risks: [S.parseWarningRisk],
    nextBestAction: {
      type: "wait_human",
      description: S.humanReviewRecommendedDesc,
    },
    suggestedActions: [],
    eventHint: null,
    handoff: {
      headline: S.revisedSummary,
      summary: fallbackSummary,
      facts: [],
      decisions: [],
      pendingItems: [],
      risks: [S.parseWarningRisk],
      nextRecommendedAction: S.humanReviewNext,
      confidence: 0.35,
    },
    draft: null,
  }
}

function parseJson<T>(value?: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? null)
}

function deriveConversationStatus(currentStatus: string, leadScore: number) {
  if (currentStatus === "new" || currentStatus === "triaged" || currentStatus === "lead_detected") {
    return leadScore >= 60
      ? transitionConversationStatus(currentStatus, "lead_detected")
      : transitionConversationStatus(currentStatus, "triaged")
  }
  return currentStatus
}

function shouldSuggestAction(input: {
  type: string
  conversation: {
    clienteId?: string | null
    proyectoId?: string | null
    assignedTo?: string | null
    channel: string
  }
}) {
  switch (input.type) {
    case "create_client":
      return !input.conversation.clienteId
    case "create_project":
      return !input.conversation.proyectoId
    case "assign_operator":
      return !input.conversation.assignedTo
    case "schedule_followup":
      return input.conversation.channel !== "manual"
    default:
      return true
  }
}

type NormalizedSuggestedAction = {
  type: string
  title: string
  description: string
  confidence: number
  data?: Record<string, unknown>
}

function normalizeSuggestedActions(
  input: {
    suggestedActions: Array<{
      type: string
      title: string
      description: string
      confidence: number
      data?: Record<string, unknown>
    }>
    nextBestAction: { type: string; description: string } | null
    /** Phase 1: structured calendar hint synthesized into a `create_event` action when usable. */
    eventHint: EventHint | null
    /** Latest INBOUND non-internal message id — required to anchor the create_event action. */
    latestInboundMessageId: string | null
    conversation: {
      clienteId?: string | null
      proyectoId?: string | null
      assignedTo?: string | null
      channel: string
    }
  },
  assignOperatorTitle: string,
  addToCalendarTitle: string,
) {
  const raw: NormalizedSuggestedAction[] = [...input.suggestedActions]

  if (input.nextBestAction?.type === "assign_operator") {
    raw.push({
      type: "assign_operator",
      title: assignOperatorTitle,
      description: input.nextBestAction.description,
      confidence: 0.72,
    })
  }

  /**
   * Synthesize a `create_event` action from the structured eventHint when it is anchored to a
   * real inbound message AND its confidence is at or above the floor (avoids surfacing weak
   * detections like "next week sometime" as a Smart action). We carry the full hint inside
   * `data` so the panel can pre-fill the preview form without re-querying the model. We do NOT
   * trust a hint without a sourceMessageId (avoids dangling actions); the model is told to set
   * this id, but we also fall back to the latest inbound message id if it omitted it.
   */
  if (input.eventHint) {
    const confidence = input.eventHint.confidence ?? 0.6
    const sourceMessageId = input.eventHint.sourceMessageId ?? input.latestInboundMessageId
    if (sourceMessageId && confidence >= EVENT_HINT_MIN_CONFIDENCE) {
      raw.push({
        type: "create_event",
        title: addToCalendarTitle,
        description: input.eventHint.purpose ?? input.eventHint.title,
        confidence,
        data: { ...input.eventHint, sourceMessageId },
      })
    }
  }

  const normalized = new Map<string, NormalizedSuggestedAction>()
  for (const action of raw) {
    if (!ALLOWED_ACTION_TYPES.has(action.type)) continue
    if (!shouldSuggestAction({ type: action.type, conversation: input.conversation })) continue

    const existing = normalized.get(action.type)
    if (!existing || existing.confidence < action.confidence) {
      normalized.set(action.type, action)
    }
  }

  return Array.from(normalized.values())
}

function shouldGenerateDraft(input: {
  latestMessageId: string | null
  latestDirection: string | null
  isInternal: boolean
  aiSuggested: boolean
}) {
  return Boolean(
    input.latestMessageId
    && input.latestDirection === "inbound"
    && !input.isInternal
    && input.aiSuggested,
  )
}

export async function runConversationIntelligence(input: {
  workspaceId: string
  conversationId: string
  trigger: "inbox_post" | "message_post" | "manual"
}) {
  const conversation = await db.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    include: {
      contact: true,
      classification: true,
      handoff: true,
      actions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      drafts: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 20,
      },
    },
  })

  if (!conversation) return null

  /**
   * Soft-trashed messages must be invisible to the intelligence pipeline. They live in
   * `Message.metadata.trashedAt` (set by the More menu's "Trash this message" action) and the
   * operator's intent is that Fanny never quotes, summarizes, or anchors decisions on them.
   * We strip them once here so every downstream derivation (latestMessage, transcript,
   * latestInboundMessage, action anchoring) shares the same visibility model.
   */
  const visibleMessages = conversation.messages.filter((message) => {
    if (typeof message.metadata !== "string" || message.metadata.length === 0) return true
    try {
      const parsed = JSON.parse(message.metadata) as { trashedAt?: unknown } | null
      return !(parsed && typeof parsed.trashedAt === "string" && parsed.trashedAt.length > 0)
    } catch {
      /** Corrupted metadata can't claim a trash flag, so we keep the message visible. */
      return true
    }
  })

  const latestMessage = visibleMessages.at(-1) ?? null

  const wsResolved = await getWorkspaceWithResolvedConfig(input.workspaceId)
  const operatorLocale = wsResolved?.locale ?? DEFAULT_LOCALE
  const S = getOperatorUiStrings(operatorLocale)

  const wsContext = await resolveWorkspaceContext(input.workspaceId)
  const workspaceContextBlock = wsContext ? buildWorkspaceContextBlock(wsContext, operatorLocale) : null

  /** Phase 1 calendar prompt anchors. We resolve tz once here so the prompt is deterministic. */
  const workspaceTimeZone = pickWorkspaceTimezone(wsResolved?.config ?? null)
  const nowISO = new Date().toISOString()

  const intelligence = await generateConversationIntelligence({
    conversationId: conversation.id,
    channel: conversation.channel,
    status: conversation.status,
    subject: conversation.subject,
    clienteId: conversation.clienteId,
    proyectoId: conversation.proyectoId,
    assignedTo: conversation.assignedTo,
    contact: {
      nombre: conversation.contact.nombre,
      email: conversation.contact.email,
      telefono: conversation.contact.telefono,
      empresa: conversation.contact.empresa,
      tipo: conversation.contact.tipo,
    },
    previousSummary: conversation.summary ?? conversation.classification?.summary,
    previousIntent: conversation.intent ?? conversation.classification?.intent,
    workspaceContextBlock,
    operatorLocale,
    nowISO,
    workspaceTimeZone,
    messages: visibleMessages.map((message) => ({
      id: message.id,
      role: message.role,
      direction: message.direction,
      content: message.content,
      isInternal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
    })),
  })

  /**
   * Latest INBOUND non-internal, non-trashed message anchors `create_event` actions. Outbound,
   * internal, and trashed messages can never produce a calendar suggestion (the trash filter
   * already happened above; this just documents the contract for future readers).
   */
  const latestInboundMessage = [...visibleMessages]
    .reverse()
    .find((m) => m.direction === "inbound" && !m.isInternal)

  const nextStatus = deriveConversationStatus(conversation.status, intelligence.leadScore)
  const normalizedSuggestedActions = normalizeSuggestedActions(
    {
      suggestedActions: intelligence.suggestedActions,
      nextBestAction: intelligence.nextBestAction,
      eventHint: intelligence.eventHint,
      latestInboundMessageId: latestInboundMessage?.id ?? null,
      conversation: {
        clienteId: conversation.clienteId,
        proyectoId: conversation.proyectoId,
        assignedTo: conversation.assignedTo,
        channel: conversation.channel,
      },
    },
    S.assignOperatorTitle,
    S.addToCalendarTitle,
  )

  const result = await db.$transaction(async (tx) => {
    const classification = await tx.aIClassification.upsert({
      where: { conversationId: conversation.id },
      create: {
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        intent: intelligence.intencion,
        sector: intelligence.sector || null,
        urgency: intelligence.urgencia,
        leadScore: intelligence.leadScore,
        sentiment: intelligence.sentiment || null,
        summary: intelligence.resumen,
        suggestedTags: stringifyJson(intelligence.tags),
        briefData: stringifyJson(intelligence.datosProyecto),
        facts: stringifyJson(intelligence.facts),
        pendingItems: stringifyJson(intelligence.pendingItems),
        risks: stringifyJson(intelligence.risks),
        nextBestAction: stringifyJson(intelligence.nextBestAction),
        confidence: intelligence.confidence,
        model: MODEL_NAME,
        promptVersion: PROMPT_VERSION,
        pipelineVersion: PIPELINE_VERSION,
        scoreReasoning: intelligence.scoreReasoning,
        lastProcessedMessageId: latestMessage?.id ?? null,
        lastProcessedAt: new Date(),
        sourceConversationId: conversation.id,
      },
      update: {
        intent: intelligence.intencion,
        sector: intelligence.sector || null,
        urgency: intelligence.urgencia,
        leadScore: intelligence.leadScore,
        sentiment: intelligence.sentiment || null,
        summary: intelligence.resumen,
        suggestedTags: stringifyJson(intelligence.tags),
        briefData: stringifyJson(intelligence.datosProyecto),
        facts: stringifyJson(intelligence.facts),
        pendingItems: stringifyJson(intelligence.pendingItems),
        risks: stringifyJson(intelligence.risks),
        nextBestAction: stringifyJson(intelligence.nextBestAction),
        confidence: intelligence.confidence,
        model: MODEL_NAME,
        promptVersion: PROMPT_VERSION,
        pipelineVersion: PIPELINE_VERSION,
        scoreReasoning: intelligence.scoreReasoning,
        lastProcessedMessageId: latestMessage?.id ?? null,
        lastProcessedAt: new Date(),
        sourceConversationId: conversation.id,
      },
    })

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        summary: intelligence.resumen,
        intent: intelligence.intencion,
        sector: intelligence.sector || null,
        leadScore: intelligence.leadScore,
        urgency: intelligence.urgencia,
        sentiment: intelligence.sentiment || null,
        detectedLanguage: intelligence.detectedLanguage || null,
        status: nextStatus,
      },
    })

    const existingHandoff = conversation.handoff
    const handoffSourceChanged =
      existingHandoff?.sourceMessageId
      && latestMessage?.id
      && existingHandoff.sourceMessageId !== latestMessage.id

    if (existingHandoff?.status === "reviewed" && handoffSourceChanged) {
      await tx.conversationHandoff.update({
        where: { conversationId: conversation.id },
        data: {
          status: "stale",
          sourceMessageId: latestMessage?.id ?? existingHandoff.sourceMessageId,
          model: MODEL_NAME,
          promptVersion: PROMPT_VERSION,
          confidence: intelligence.handoff.confidence,
        },
      })
    } else {
      await tx.conversationHandoff.upsert({
        where: { conversationId: conversation.id },
        create: {
          workspaceId: input.workspaceId,
          conversationId: conversation.id,
          status: "generated",
          headline: intelligence.handoff.headline,
          summary: intelligence.handoff.summary,
          facts: stringifyJson(intelligence.handoff.facts),
          decisions: stringifyJson(intelligence.handoff.decisions),
          pendingItems: stringifyJson(intelligence.handoff.pendingItems),
          risks: stringifyJson(intelligence.handoff.risks),
          nextRecommendedAction: intelligence.handoff.nextRecommendedAction,
          sourceMessageId: latestMessage?.id ?? null,
          confidence: intelligence.handoff.confidence,
          model: MODEL_NAME,
          promptVersion: PROMPT_VERSION,
        },
        update: {
          status: "generated",
          headline: intelligence.handoff.headline,
          summary: intelligence.handoff.summary,
          facts: stringifyJson(intelligence.handoff.facts),
          decisions: stringifyJson(intelligence.handoff.decisions),
          pendingItems: stringifyJson(intelligence.handoff.pendingItems),
          risks: stringifyJson(intelligence.handoff.risks),
          nextRecommendedAction: intelligence.handoff.nextRecommendedAction,
          sourceMessageId: latestMessage?.id ?? null,
          confidence: intelligence.handoff.confidence,
          model: MODEL_NAME,
          promptVersion: PROMPT_VERSION,
          reviewedBy: null,
          reviewedAt: null,
        },
      })
    }

    const canGenerateDraft = shouldGenerateDraft({
      latestMessageId: latestMessage?.id ?? null,
      latestDirection: latestMessage?.direction ?? null,
      isInternal: latestMessage?.isInternal ?? false,
      aiSuggested: intelligence.draft?.shouldCreate ?? false,
    })

    if (canGenerateDraft && intelligence.draft?.content?.trim()) {
      const currentDraft = await tx.conversationDraft.findFirst({
        where: {
          workspaceId: input.workspaceId,
          conversationId: conversation.id,
          type: "ghost_reply",
          sourceMessageId: latestMessage?.id ?? null,
        },
        orderBy: { createdAt: "desc" },
      })

      if (!currentDraft) {
        await tx.conversationDraft.updateMany({
          where: {
            workspaceId: input.workspaceId,
            conversationId: conversation.id,
            type: "ghost_reply",
            status: "draft",
          },
          data: { status: "superseded" },
        })

        await tx.conversationDraft.create({
          data: {
            workspaceId: input.workspaceId,
            conversationId: conversation.id,
            type: "ghost_reply",
            status: "draft",
            title: intelligence.draft.title || S.draftReplyTitle,
            content: intelligence.draft.content.trim(),
            tone: intelligence.draft.tone || "profesional",
            targetChannel: intelligence.draft.targetChannel || conversation.channel,
            sourceMessageId: latestMessage?.id ?? null,
            generatedFrom: stringifyJson({
              trigger: input.trigger,
              nextBestAction: intelligence.nextBestAction,
              reason: intelligence.draft.reason,
            }),
            model: MODEL_NAME,
            promptVersion: PROMPT_VERSION,
          },
        })
      }
    }

    for (const action of normalizedSuggestedActions) {
      const latestActionOfType = conversation.actions.find((item) =>
        item.type === action.type
        && item.source === ACTION_SOURCE
      )

      /**
       * `create_event` actions are anchored to the inbound message that mentions the event,
       * not to the conversation's latest message (which is often the operator's own reply).
       * For every other action type we keep the legacy behavior (anchor to latest message).
       */
      const anchorMessageId = action.type === "create_event"
        ? (latestInboundMessage?.id ?? null)
        : (latestMessage?.id ?? null)

      if (
        latestActionOfType?.sourceMessageId
        && latestMessage?.id
        && latestActionOfType.sourceMessageId === latestMessage.id
        && (latestActionOfType.status === "dismissed" || latestActionOfType.status === "failed")
      ) {
        continue
      }

      if (latestActionOfType?.status === "executed" || latestActionOfType?.status === "approved") {
        continue
      }

      /**
       * For `create_event`, the structured EventHint is the meaningful payload; we merge it
       * into `data` so the panel can pre-fill the preview without re-running the model. For
       * every other action type the payload stays the same lightweight shape.
       */
      const payload: Record<string, unknown> = {
        title: action.title,
        description: action.description,
        pipelineVersion: PIPELINE_VERSION,
        trigger: input.trigger,
      }
      if (action.data && typeof action.data === "object") {
        payload.data = action.data
      }

      if (latestActionOfType?.status === "suggested") {
        await tx.conversationAction.update({
          where: { id: latestActionOfType.id },
          data: {
            source: ACTION_SOURCE,
            status: "suggested",
            confidence: action.confidence,
            sourceMessageId: anchorMessageId ?? latestActionOfType.sourceMessageId,
            data: stringifyJson(payload),
            dismissedAt: null,
            errorMessage: null,
          },
        })
      } else {
        await tx.conversationAction.create({
          data: {
            workspaceId: input.workspaceId,
            conversationId: conversation.id,
            type: action.type,
            status: "suggested",
            source: ACTION_SOURCE,
            confidence: action.confidence,
            sourceMessageId: anchorMessageId,
            data: stringifyJson(payload),
          },
        })
      }
    }

    return classification
  })

  return {
    conversationId: conversation.id,
    latestMessageId: latestMessage?.id ?? null,
    classificationId: result.id,
  }
}
