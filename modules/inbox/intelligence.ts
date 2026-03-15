import { db } from "@/lib/db"
import { generateConversationIntelligence } from "@/lib/inbox"
import { transitionConversationStatus } from "./state"

const PIPELINE_VERSION = "2b"
const PROMPT_VERSION = "conversation-v2"
const MODEL_NAME = "operativo"
const ACTION_SOURCE = "ai"
const ALLOWED_ACTION_TYPES = new Set([
  "create_client",
  "create_project",
  "create_task",
  "schedule_followup",
  "assign_operator",
  "generate_proposal",
])

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

function normalizeSuggestedActions(input: {
  suggestedActions: Array<{
    type: string
    title: string
    description: string
    confidence: number
  }>
  nextBestAction: { type: string; description: string } | null
  conversation: {
    clienteId?: string | null
    proyectoId?: string | null
    assignedTo?: string | null
    channel: string
  }
}) {
  const raw = [...input.suggestedActions]

  if (input.nextBestAction?.type === "assign_operator") {
    raw.push({
      type: "assign_operator",
      title: "Asignar operador",
      description: input.nextBestAction.description,
      confidence: 0.72,
    })
  }

  const normalized = new Map<string, { type: string; title: string; description: string; confidence: number }>()
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
  sourceInboxEntryId?: string | null
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
      inboxEntries: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  })

  if (!conversation) return null

  const latestMessage = conversation.messages.at(-1) ?? null
  const latestLegacyEntry = conversation.inboxEntries[0] ?? null

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
    latestLegacySnapshot: latestLegacyEntry
      ? {
          resumen: latestLegacyEntry.resumen,
          intencion: latestLegacyEntry.intencion,
          urgencia: latestLegacyEntry.urgencia,
          tags: parseJson<string[]>(latestLegacyEntry.tags),
        }
      : null,
    messages: conversation.messages.map((message) => ({
      role: message.role,
      direction: message.direction,
      content: message.content,
      isInternal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
    })),
  })

  const nextStatus = deriveConversationStatus(conversation.status, intelligence.leadScore)
  const normalizedSuggestedActions = normalizeSuggestedActions({
    suggestedActions: intelligence.suggestedActions,
    nextBestAction: intelligence.nextBestAction,
    conversation: {
      clienteId: conversation.clienteId,
      proyectoId: conversation.proyectoId,
      assignedTo: conversation.assignedTo,
      channel: conversation.channel,
    },
  })

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
            title: intelligence.draft.title || "Borrador de respuesta",
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

      const payload = {
        title: action.title,
        description: action.description,
        pipelineVersion: PIPELINE_VERSION,
        trigger: input.trigger,
      }

      if (latestActionOfType?.status === "suggested") {
        await tx.conversationAction.update({
          where: { id: latestActionOfType.id },
          data: {
            source: ACTION_SOURCE,
            status: "suggested",
            confidence: action.confidence,
            sourceMessageId: latestMessage?.id ?? latestActionOfType.sourceMessageId,
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
            sourceMessageId: latestMessage?.id ?? null,
            data: stringifyJson(payload),
          },
        })
      }
    }

    if (input.sourceInboxEntryId) {
      await tx.inboxEntry.update({
        where: { id: input.sourceInboxEntryId },
        data: {
          tipo: intelligence.tipo,
          categoria: intelligence.categoria,
          urgencia: intelligence.urgencia,
          intencion: intelligence.intencion,
          resumen: intelligence.resumen,
          datosCliente: stringifyJson(intelligence.datosCliente),
          datosProyecto: stringifyJson(intelligence.datosProyecto),
          notas: intelligence.notas,
          tags: stringifyJson(intelligence.tags),
          aiRaw: stringifyJson(intelligence),
          estado: "clasificado",
          conversationId: conversation.id,
          contactId: conversation.contactId,
        },
      })
    }

    return classification
  })

  return {
    conversationId: conversation.id,
    latestMessageId: latestMessage?.id ?? null,
    classificationId: result.id,
  }
}
