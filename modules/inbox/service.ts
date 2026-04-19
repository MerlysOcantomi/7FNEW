import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"
import {
  canTransitionConversationStatus,
  CONVERSATION_ACTIVE_STATUSES,
  getReopenStatusFrom,
  transitionConversationStatus,
} from "./state"
import { getShortIntentFromMetadataRecord, parseMessageMetadataRecord } from "@/lib/inbox/parse-message-metadata"
import { persistShortIntentForMessage, shouldPersistMessageShortIntent } from "./message-short-intent"

interface ListConversationsParams {
  workspaceId: string
  skip?: number
  take?: number
  status?: string
  channel?: string
  urgency?: string
  q?: string
  assignedTo?: string
}

interface CreateConversationFromInboxEntryInput {
  inboxEntryId: string
  workspaceId: string
  nombre?: string | null
  email?: string | null
  telefono?: string | null
  empresa?: string | null
  mensaje: string
  fuente?: string | null
}

interface ResolveContactInput {
  workspaceId: string
  nombre?: string | null
  email?: string | null
  telefono?: string | null
  empresa?: string | null
  channel: string
}

interface AddMessageInput {
  workspaceId: string
  conversationId: string
  role: string
  content: string
  direction?: string
  contentType?: string
  isInternal?: boolean
  metadata?: Record<string, unknown> | null
  sourceMessageId?: string | null
  connectionId?: string | null
}

interface ConvertConversationInput {
  workspaceId: string
  conversationId: string
  action: "cliente" | "proyecto" | "tarea" | "todo"
  reviewedBy?: {
    userId: string
    userName?: string | null
    userEmail?: string | null
  }
  actionRecordId?: string | null
  executionNotes?: string | null
}

interface ConversationConversionResult {
  cliente: Record<string, unknown> | null
  proyecto: Record<string, unknown> | null
  tarea: Record<string, unknown> | null
  created: {
    cliente: boolean
    proyecto: boolean
    tarea: boolean
  }
  ids: {
    clienteId: string | null
    proyectoId: string | null
    tareaId: string | null
  }
}

const ACTIVE_REUSE_WINDOW_MS = 1000 * 60 * 60 * 24 * 7
const TERMINAL_REOPEN_WINDOW_MS = 1000 * 60 * 60 * 24 * 2

function safeTrim(value?: string | null) {
  return value?.trim() || null
}

function parseJson<T>(value?: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function mapSourceToChannel(source?: string | null) {
  switch ((source ?? "").toLowerCase()) {
    case "web":
    case "chat_web":
      return "web_chat"
    case "portal":
      return "portal"
    case "whatsapp":
      return "whatsapp"
    case "email":
      return "email"
    default:
      return "manual"
  }
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = getStringValue(value)
    if (normalized) return normalized
  }
  return null
}

function getObjectStringValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!record) return null
  for (const key of keys) {
    const value = getStringValue(record[key])
    if (value) return value
  }
  return null
}

function inferInitialRole(channel: string) {
  return channel === "portal" ? "client" : "visitor"
}

function buildSubject(message: string, fallback?: string | null) {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (normalized.length === 0) return fallback ?? "Nueva conversación"
  if (normalized.length <= 72) return normalized
  return `${normalized.slice(0, 69)}...`
}


function getInboundConversationStatus(currentStatus?: string | null) {
  if (currentStatus === "awaiting_response") {
    return transitionConversationStatus(currentStatus, "assigned")
  }
  return currentStatus ?? "new"
}

async function resolveContact(input: ResolveContactInput) {
  const email = safeTrim(input.email)?.toLowerCase() ?? null
  const telefono = safeTrim(input.telefono)

  const identifiers: Prisma.ContactWhereInput[] = []
  if (email) identifiers.push({ email })
  if (telefono) identifiers.push({ telefono })

  const existingContact = identifiers.length > 0
    ? await db.contact.findFirst({
        where: {
          workspaceId: input.workspaceId,
          OR: identifiers,
        },
        orderBy: { updatedAt: "desc" },
      })
    : null

  if (existingContact) {
    return db.contact.update({
      where: { id: existingContact.id },
      data: {
        nombre: safeTrim(input.nombre) ?? existingContact.nombre,
        email: email ?? existingContact.email,
        telefono: telefono ?? existingContact.telefono,
        empresa: safeTrim(input.empresa) ?? existingContact.empresa,
        canal: input.channel,
        lastSeenAt: new Date(),
      },
    })
  }

  return db.contact.create({
    data: {
      nombre: safeTrim(input.nombre),
      email,
      telefono,
      empresa: safeTrim(input.empresa),
      canal: input.channel,
      tipo: input.channel === "portal" ? "cliente" : "visitante",
      workspaceId: input.workspaceId,
    },
  })
}

async function findReusableConversation(input: {
  workspaceId: string
  contactId: string
  channel: string
  clienteId?: string | null
  isPublic: boolean
}) {
  const now = Date.now()
  const activeCutoff = new Date(now - ACTIVE_REUSE_WINDOW_MS)
  const terminalCutoff = new Date(now - TERMINAL_REOPEN_WINDOW_MS)

  const contextFilter: Prisma.ConversationWhereInput = {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    channel: input.channel,
    isPublic: input.isPublic,
    ...(input.clienteId
      ? {
          OR: [
            { clienteId: input.clienteId },
            { clienteId: null },
          ],
        }
      : {}),
  }

  const activeConversation = await db.conversation.findFirst({
    where: {
      ...contextFilter,
      status: { in: [...CONVERSATION_ACTIVE_STATUSES] },
      lastMessageAt: { gte: activeCutoff },
    },
    orderBy: { lastMessageAt: "desc" },
  })

  if (activeConversation) {
    return { conversation: activeConversation, mode: "reuse" as const }
  }

  const terminalConversation = await db.conversation.findFirst({
    where: {
      ...contextFilter,
      status: { in: ["closed", "archived"] },
      lastMessageAt: { gte: terminalCutoff },
    },
    orderBy: { lastMessageAt: "desc" },
  })

  if (terminalConversation) {
    return { conversation: terminalConversation, mode: "reopen" as const }
  }

  return { conversation: null, mode: "new" as const }
}

export async function createConversationFromInboxEntry(input: CreateConversationFromInboxEntryInput) {
  const channel = mapSourceToChannel(input.fuente)
  const contact = await resolveContact({
    workspaceId: input.workspaceId,
    nombre: input.nombre,
    email: input.email,
    telefono: input.telefono,
    empresa: input.empresa,
    channel,
  })

  const reusable = await findReusableConversation({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    channel,
    clienteId: contact.clienteId ?? null,
    isPublic: channel !== "portal",
  })

  let conversation

  if (reusable.conversation) {
    const inboundStatus = reusable.mode === "reopen"
      ? getReopenStatusFrom(reusable.conversation.status)
      : getInboundConversationStatus(reusable.conversation.status)

    await addMessage({
      workspaceId: input.workspaceId,
      conversationId: reusable.conversation.id,
      role: inferInitialRole(channel),
      direction: "inbound",
      content: input.mensaje.trim(),
      contentType: "text",
    })

    conversation = await db.conversation.update({
      where: { id: reusable.conversation.id },
      data: {
        source: input.fuente ?? reusable.conversation.source ?? "manual",
        subject: reusable.conversation.subject ?? buildSubject(input.mensaje, contact.nombre),
        status: inboundStatus,
        closedAt: reusable.mode === "reopen" ? null : reusable.conversation.closedAt,
      },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    })
  } else {
    conversation = await db.conversation.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: contact.id,
        channel,
        source: input.fuente ?? "manual",
        status: "new",
        subject: buildSubject(input.mensaje, contact.nombre),
        isPublic: channel !== "portal",
        clienteId: contact.clienteId ?? null,
        lastMessageAt: new Date(),
        messageCount: 1,
        messages: {
          create: {
            workspaceId: input.workspaceId,
            role: inferInitialRole(channel),
            direction: "inbound",
            content: input.mensaje.trim(),
            contentType: "text",
          },
        },
      },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    })
  }

  await db.inboxEntry.update({
    where: { id: input.inboxEntryId },
    data: {
      contactId: contact.id,
      conversationId: conversation.id,
    },
  })

  return {
    contact,
    conversation,
    reused: reusable.mode === "reuse",
    reopened: reusable.mode === "reopen",
  }
}

function parseConversationClassification(classification?: {
  suggestedTags?: string | null
  briefData?: string | null
  summary?: string | null
  intent?: string | null
  leadScore?: number | null
  urgency?: string | null
  sector?: string | null
} | null) {
  return {
    summary: classification?.summary ?? null,
    intent: classification?.intent ?? null,
    leadScore: classification?.leadScore ?? null,
    urgency: classification?.urgency ?? null,
    sector: classification?.sector ?? null,
    suggestedTags: parseJson<string[]>(classification?.suggestedTags),
    briefData: parseJson<Record<string, unknown>>(classification?.briefData),
  }
}

export async function listConversations(params: ListConversationsParams) {
  const { workspaceId, skip = 0, take = 20, status, channel, urgency, q, assignedTo } = params

  const assignedToFilter: Prisma.ConversationWhereInput =
    assignedTo === "unassigned"
      ? { assignedTo: null }
      : assignedTo
        ? { assignedTo }
        : {}

  const where: Prisma.ConversationWhereInput = {
    workspaceId,
    ...assignedToFilter,
    ...(status && status !== "todos"
      ? { status: status.includes(",") ? { in: status.split(",") } : status }
      : {}),
    ...(channel && channel !== "todos" ? { channel } : {}),
    ...(urgency && urgency !== "todos"
      ? { urgency: urgency.includes(",") ? { in: urgency.split(",") } : urgency }
      : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q } },
            { summary: { contains: q } },
            { intent: { contains: q } },
            { contact: { nombre: { contains: q } } },
            { contact: { email: { contains: q } } },
            { contact: { empresa: { contains: q } } },
            { contact: { telefono: { contains: q } } },
            { messages: { some: { content: { contains: q } } } },
          ],
        }
      : {}),
  }

  const [data, total, leads, urgent] = await Promise.all([
    db.conversation.findMany({
      where,
      skip,
      take,
      orderBy: { lastMessageAt: "desc" },
      include: {
        contact: true,
        classification: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.conversation.count({ where }),
    db.conversation.count({ where: { ...where, status: "lead_detected" } }),
    db.conversation.count({
      where: { ...where, urgency: { in: ["alta", "critica"] } },
    }),
  ])

  return { data, total, leads, urgent }
}

export async function listConversationActions(conversationId: string, workspaceId: string) {
  return db.conversationAction.findMany({
    where: { conversationId, workspaceId },
    orderBy: { createdAt: "desc" },
  })
}

/** Solo `id` + `shortIntent` desde metadata (sin contenido del mensaje). Orden cronológico. */
export async function listMessageShortIntents(conversationId: string, workspaceId: string) {
  const rows = await db.message.findMany({
    where: { conversationId, workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, metadata: true },
  })
  const result: { id: string; shortIntent: string }[] = []
  for (const row of rows) {
    const meta = parseMessageMetadataRecord(row.metadata)
    const si = getShortIntentFromMetadataRecord(meta)
    if (si) result.push({ id: row.id, shortIntent: si })
  }
  return result
}

export async function getConversationById(id: string, workspaceId: string) {
  return db.conversation.findFirst({
    where: { id, workspaceId },
    include: {
      contact: true,
      cliente: { select: { id: true, nombre: true, email: true, empresa: true } },
      proyecto: { select: { id: true, nombre: true, estado: true } },
      classification: true,
      handoff: true,
      drafts: { orderBy: { createdAt: "desc" }, take: 10 },
      messages: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "desc" } },
    },
  })
}

export async function addMessage(input: AddMessageInput) {
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null

  const message = await db.$transaction(async (tx) => {
    const existing = await tx.conversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      select: { id: true, messageCount: true, status: true },
    })

    if (!existing) return null

    const created = await tx.message.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        role: input.role,
        direction: input.direction ?? "outbound",
        content: input.content.trim(),
        contentType: input.contentType ?? "text",
        isInternal: input.isInternal ?? false,
        metadata,
        sourceMessageId: input.sourceMessageId ?? null,
        connectionId: input.connectionId ?? null,
      },
    })

    const nextStatus = input.isInternal
      ? existing.status
      : input.direction === "inbound"
        ? getInboundConversationStatus(existing.status)
        : transitionConversationStatus(existing.status, "awaiting_response")

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: {
        lastMessageAt: created.createdAt,
        messageCount: existing.messageCount + 1,
        status: nextStatus,
        closedAt: nextStatus === "closed" || nextStatus === "archived" ? new Date() : null,
      },
    })

    return created
  })

  if (message && shouldPersistMessageShortIntent({ content: message.content, role: input.role })) {
    void persistShortIntentForMessage({
      messageId: message.id,
      workspaceId: input.workspaceId,
      content: message.content,
    }).catch((err) => console.error(`[inbox] shortIntent persist failed msg=${message.id}:`, err))
  }

  return message
}

export async function transitionConversation(input: {
  workspaceId: string
  conversationId: string
  requestedStatus?: string | null
  data?: Record<string, unknown>
}) {
  const existing = await db.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
  })

  if (!existing) return null

  const patch: Record<string, unknown> = { ...(input.data ?? {}) }

  if (input.requestedStatus) {
    const nextStatus = input.requestedStatus
    if (!canTransitionConversationStatus(existing.status, nextStatus)) {
      throw new Error(`Transición inválida de ${existing.status} a ${nextStatus}`)
    }
    patch.status = nextStatus
    patch.closedAt = nextStatus === "closed" || nextStatus === "archived" ? new Date() : null
  }

  return db.conversation.update({
    where: { id: input.conversationId },
    data: patch,
    include: {
      contact: true,
      classification: true,
      handoff: true,
      drafts: { orderBy: { createdAt: "desc" }, take: 10 },
      messages: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "desc" } },
    },
  })
}

export async function updateConversationHandoff(input: {
  workspaceId: string
  conversationId: string
  reviewedBy?: string | null
  data: {
    status?: string
    headline?: string | null
    summary?: string | null
    facts?: string[] | null
    decisions?: string[] | null
    pendingItems?: string[] | null
    risks?: string[] | null
    nextRecommendedAction?: string | null
  }
}) {
  const existing = await db.conversationHandoff.findFirst({
    where: { conversationId: input.conversationId, workspaceId: input.workspaceId },
  })

  if (!existing) return null

  return db.conversationHandoff.update({
    where: { conversationId: input.conversationId },
    data: {
      status: input.data.status ?? "reviewed",
      headline: input.data.headline ?? existing.headline,
      summary: input.data.summary ?? existing.summary,
      facts: input.data.facts ? JSON.stringify(input.data.facts) : existing.facts,
      decisions: input.data.decisions ? JSON.stringify(input.data.decisions) : existing.decisions,
      pendingItems: input.data.pendingItems ? JSON.stringify(input.data.pendingItems) : existing.pendingItems,
      risks: input.data.risks ? JSON.stringify(input.data.risks) : existing.risks,
      nextRecommendedAction: input.data.nextRecommendedAction ?? existing.nextRecommendedAction,
      reviewedBy: input.reviewedBy ?? existing.reviewedBy,
      reviewedAt: input.reviewedBy ? new Date() : existing.reviewedAt,
    },
  })
}

export async function updateConversationDraft(input: {
  workspaceId: string
  conversationId: string
  draftId: string
  reviewedBy?: string | null
  data: {
    status?: string
    title?: string | null
    content?: string | null
    tone?: string | null
    targetChannel?: string | null
  }
}) {
  const allowedEditableStatuses = new Set(["draft", "edited", "approved", "discarded"])
  const existing = await db.conversationDraft.findFirst({
    where: {
      id: input.draftId,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
    },
  })

  if (!existing) return null

  const requestedStatus =
    input.data.status && allowedEditableStatuses.has(input.data.status)
      ? input.data.status
      : undefined

  const nextStatus =
    requestedStatus
    ?? (input.data.content !== undefined || input.data.title !== undefined || input.data.tone !== undefined ? "edited" : existing.status)

  return db.conversationDraft.update({
    where: { id: input.draftId },
    data: {
      status: nextStatus,
      title: input.data.title ?? existing.title,
      content: input.data.content ?? existing.content,
      tone: input.data.tone ?? existing.tone,
      targetChannel: input.data.targetChannel ?? existing.targetChannel,
      reviewedBy: input.reviewedBy ?? existing.reviewedBy,
      reviewedAt: input.reviewedBy ? new Date() : existing.reviewedAt,
    },
  })
}

export async function createConversationAction(input: {
  workspaceId: string
  conversationId: string
  type: string
  status?: string
  source?: string
  confidence?: number | null
  sourceMessageId?: string | null
  data?: Record<string, unknown> | null
  resultId?: string | null
  resultModule?: string | null
  approvedBy?: string | null
  approvedAt?: Date | null
  dismissedAt?: Date | null
  executionNotes?: string | null
  errorMessage?: string | null
  reviewedBy?: string | null
}) {
  return db.conversationAction.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      type: input.type,
      status: input.status ?? "executed",
      source: input.source ?? "system",
      confidence: input.confidence ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      data: input.data ? JSON.stringify(input.data) : null,
      resultId: input.resultId ?? null,
      resultModule: input.resultModule ?? null,
      approvedBy: input.approvedBy ?? null,
      approvedAt: input.approvedAt ?? null,
      dismissedAt: input.dismissedAt ?? null,
      executionNotes: input.executionNotes ?? null,
      errorMessage: input.errorMessage ?? null,
      reviewedBy: input.reviewedBy ?? null,
      reviewedAt: input.reviewedBy ? new Date() : null,
    },
  })
}

export async function approveConversationAction(input: {
  workspaceId: string
  conversationId: string
  actionId: string
  approvedBy: string
}) {
  const existing = await db.conversationAction.findFirst({
    where: {
      id: input.actionId,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
    },
  })

  if (!existing) return null

  if (!["suggested", "approved"].includes(existing.status)) {
    throw new Error("La acción no puede aprobarse en su estado actual")
  }

  return db.conversationAction.update({
    where: { id: input.actionId },
    data: {
      status: "approved",
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
      dismissedAt: null,
      errorMessage: null,
    },
  })
}

export async function dismissConversationAction(input: {
  workspaceId: string
  conversationId: string
  actionId: string
  dismissedBy: string
  executionNotes?: string | null
}) {
  const existing = await db.conversationAction.findFirst({
    where: {
      id: input.actionId,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
    },
  })

  if (!existing) return null

  if (["executed", "dismissed"].includes(existing.status)) {
    throw new Error("La acción no puede descartarse en su estado actual")
  }

  return db.conversationAction.update({
    where: { id: input.actionId },
    data: {
      status: "dismissed",
      dismissedAt: new Date(),
      reviewedBy: input.dismissedBy,
      reviewedAt: new Date(),
      executionNotes: input.executionNotes ?? existing.executionNotes,
    },
  })
}

export async function getConversationAction(input: {
  workspaceId: string
  conversationId: string
  actionId: string
}) {
  return db.conversationAction.findFirst({
    where: {
      id: input.actionId,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
    },
  })
}

export async function executeConversationAction(input: {
  workspaceId: string
  conversationId: string
  actionId: string
  executedBy: {
    userId: string
    userName?: string | null
    userEmail?: string | null
  }
  payload?: Record<string, unknown>
}) {
  const action = await getConversationAction({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    actionId: input.actionId,
  })

  if (!action) return null

  if (action.status !== "approved") {
    throw new Error("La acción debe estar aprobada antes de ejecutarse")
  }

  const executionNotes =
    typeof input.payload?.executionNotes === "string" ? input.payload.executionNotes : null

  try {
    if (action.type === "create_client" || action.type === "create_project" || action.type === "create_task") {
      const results = await convertConversationToRecords({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        action:
          action.type === "create_client"
            ? "cliente"
            : action.type === "create_project"
              ? "proyecto"
              : "tarea",
        reviewedBy: input.executedBy,
        actionRecordId: action.id,
        executionNotes,
      })

      return {
        action: await db.conversationAction.findFirst({ where: { id: action.id } }),
        results,
      }
    }

    if (action.type === "assign_operator") {
      const assignedTo =
        typeof input.payload?.assignedTo === "string" ? input.payload.assignedTo.trim() : ""
      if (!assignedTo) {
        throw new Error("assignedTo es requerido para ejecutar assign_operator")
      }

      await db.$transaction(async (tx) => {
        const conversation = await tx.conversation.findFirst({
          where: {
            id: input.conversationId,
            workspaceId: input.workspaceId,
          },
          select: { status: true },
        })

        if (!conversation) {
          throw new Error("Conversación no encontrada")
        }

        await tx.conversation.update({
          where: { id: input.conversationId },
          data: {
            assignedTo,
            status: transitionConversationStatus(conversation.status, "assigned"),
          },
        })

        await tx.conversationAction.update({
          where: { id: action.id },
          data: {
            status: "executed",
            resultId: input.conversationId,
            resultModule: "conversations",
            executionNotes: executionNotes ?? `Asignado a ${assignedTo}`,
            reviewedBy: input.executedBy.userId,
            reviewedAt: new Date(),
            errorMessage: null,
          },
        })
      })

      return {
        action: await db.conversationAction.findFirst({ where: { id: action.id } }),
        results: { assignedTo },
      }
    }

    if (action.type === "schedule_followup" || action.type === "generate_proposal") {
      if (!executionNotes) {
        throw new Error("executionNotes es requerido para registrar esta ejecución supervisada")
      }

      await db.conversationAction.update({
        where: { id: action.id },
        data: {
          status: "executed",
          resultId: input.conversationId,
          resultModule: "conversations",
          executionNotes,
          reviewedBy: input.executedBy.userId,
          reviewedAt: new Date(),
          errorMessage: null,
        },
      })

      return {
        action: await db.conversationAction.findFirst({ where: { id: action.id } }),
        results: { executionNotes },
      }
    }

    throw new Error("Tipo de acción no soportado")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error ejecutando acción"
    await db.conversationAction.update({
      where: { id: action.id },
      data: {
        status: "failed",
        errorMessage: message,
        reviewedBy: input.executedBy.userId,
        reviewedAt: new Date(),
      },
    }).catch(() => null)
    throw error
  }
}

export async function convertConversationToRecords(
  input: ConvertConversationInput,
): Promise<ConversationConversionResult & { conversationId: string }> {
  const conversation = await db.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    include: {
      contact: true,
      classification: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!conversation) {
    throw new Error("Conversación no encontrada")
  }

  const classification = parseConversationClassification(conversation.classification)
  const firstInboundMessage =
    conversation.messages.find((message) => message.direction === "inbound" && !message.isInternal)
    ?? conversation.messages[0]
    ?? null
  const latestInboundMessage =
    [...conversation.messages].reverse().find((message) => message.direction === "inbound" && !message.isInternal)
    ?? null

  const sourceText =
    pickFirstString(
      firstInboundMessage?.content,
      latestInboundMessage?.content,
    )
    ?? ""
  const briefData = classification.briefData ?? null
  const contactName = pickFirstString(
    conversation.contact.nombre,
    getObjectStringValue(briefData, ["nombreCliente", "clientName", "customerName", "contactName", "nombreContacto"]),
  )
  const contactEmail = pickFirstString(
    conversation.contact.email,
    getObjectStringValue(briefData, ["emailCliente", "clientEmail", "customerEmail", "email"]),
  )
  const contactPhone = pickFirstString(
    conversation.contact.telefono,
    getObjectStringValue(briefData, ["telefonoCliente", "clientPhone", "customerPhone", "telefono"]),
  )
  const contactCompany = pickFirstString(
    conversation.contact.empresa,
    getObjectStringValue(briefData, ["empresaCliente", "clientCompany", "customerCompany", "businessName", "empresa"]),
  )
  const projectName = pickFirstString(
    getObjectStringValue(briefData, ["nombre", "projectName", "nombreProyecto"]),
    conversation.summary,
    conversation.intent,
    conversation.subject,
  )
  const projectDescription = pickFirstString(
    getObjectStringValue(briefData, ["descripcion", "projectDescription", "alcance"]),
    conversation.summary,
    classification.summary,
    sourceText.slice(0, 500),
  )
  const projectBudget = pickFirstString(
    getObjectStringValue(briefData, ["presupuesto", "budget"]),
  )
  const conversationSummary = pickFirstString(
    classification.summary,
    conversation.summary,
    conversation.intent,
    classification.sector,
    conversation.sector,
    sourceText.slice(0, 200),
  )

  const results = await db.$transaction(async (tx) => {
    const output: ConversationConversionResult = {
      cliente: null,
      proyecto: null,
      tarea: null,
      created: {
        cliente: false,
        proyecto: false,
        tarea: false,
      },
      ids: {
        clienteId: conversation.clienteId ?? null,
        proyectoId: conversation.proyectoId ?? null,
        tareaId: null,
      },
    }

    if (input.action === "cliente" || input.action === "todo") {
      if (output.ids.clienteId) {
        output.cliente = await tx.cliente.findFirst({
          where: { id: output.ids.clienteId, workspaceId: input.workspaceId },
        })
      } else {
        const cliente = await tx.cliente.create({
          data: {
            nombre:
              contactName
              || "Cliente desde Inbox",
            email:
              contactEmail
              || null,
            telefono:
              contactPhone
              || null,
            empresa:
              contactCompany
              || null,
            notas: `Origen: Inbox (${conversation.channel})\n${conversationSummary || sourceText.slice(0, 200)}`,
            estado: "activo",
            workspaceId: input.workspaceId,
          },
        })
        output.ids.clienteId = cliente.id
        output.cliente = cliente
        output.created.cliente = true
      }
    }

    if (input.action === "proyecto" || input.action === "todo") {
      if (output.ids.proyectoId) {
        output.proyecto = await tx.proyecto.findFirst({
          where: { id: output.ids.proyectoId, workspaceId: input.workspaceId },
        })
      } else {
        const proyecto = await tx.proyecto.create({
          data: {
            nombre:
              projectName
              || "Proyecto desde Inbox",
            descripcion:
              projectDescription
              || sourceText.slice(0, 500),
            estado: "planificacion",
            prioridad:
              conversation.urgency === "critica" ? "alta" : conversation.urgency || "media",
            presupuesto: projectBudget ? Number(projectBudget.replace(/[^\d.,-]/g, "").replace(",", ".")) || undefined : undefined,
            clienteId: output.ids.clienteId,
            workspaceId: input.workspaceId,
          },
        })
        output.ids.proyectoId = proyecto.id
        output.proyecto = proyecto
        output.created.proyecto = true
      }
    }

    if (input.action === "tarea" || input.action === "todo") {
      if (output.ids.tareaId) {
        output.tarea = await tx.tarea.findFirst({
          where: { id: output.ids.tareaId, workspaceId: input.workspaceId },
        })
      } else {
        const tarea = await tx.tarea.create({
          data: {
            titulo:
              classification.intent
              || conversation.intent
              || conversationSummary
              || "Tarea desde Inbox",
            descripcion: sourceText.slice(0, 1000),
            estado: "pendiente",
            prioridad:
              conversation.urgency === "critica" ? "urgente" : conversation.urgency || "media",
            clienteId: output.ids.clienteId,
            proyectoId: output.ids.proyectoId,
            workspaceId: input.workspaceId,
          },
        })
        output.ids.tareaId = tarea.id
        output.tarea = tarea
        output.created.tarea = true
      }
    }

    if (output.ids.clienteId) {
      await tx.contact.update({
        where: { id: conversation.contactId },
        data: {
          clienteId: output.ids.clienteId,
          tipo: "cliente",
        },
      })
    }

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: {
        clienteId: output.ids.clienteId,
        proyectoId: output.ids.proyectoId,
        status: transitionConversationStatus(conversation.status, "converted"),
      },
    })

    const actionMap = [
      output.created.cliente && output.ids.clienteId ? { type: "create_client", resultId: output.ids.clienteId, resultModule: "clientes" } : null,
      output.created.proyecto && output.ids.proyectoId ? { type: "create_project", resultId: output.ids.proyectoId, resultModule: "proyectos" } : null,
      output.created.tarea && output.ids.tareaId ? { type: "create_task", resultId: output.ids.tareaId, resultModule: "tareas" } : null,
    ].filter(Boolean) as { type: string; resultId: string; resultModule: string }[]

    if (input.actionRecordId) {
      const primaryResult =
        input.action === "cliente"
          ? { resultId: output.ids.clienteId, resultModule: "clientes" }
          : input.action === "proyecto"
            ? { resultId: output.ids.proyectoId, resultModule: "proyectos" }
            : input.action === "tarea"
              ? { resultId: output.ids.tareaId, resultModule: "tareas" }
              : { resultId: null, resultModule: null }

      await tx.conversationAction.update({
        where: { id: input.actionRecordId },
        data: {
          status: "executed",
          resultId: primaryResult.resultId,
          resultModule: primaryResult.resultModule,
          executionNotes: input.executionNotes ?? null,
          reviewedBy: input.reviewedBy?.userId ?? null,
          reviewedAt: input.reviewedBy?.userId ? new Date() : null,
          errorMessage: null,
        },
      })
    } else {
      await Promise.all(actionMap.map((item) =>
        tx.conversationAction.create({
          data: {
            workspaceId: input.workspaceId,
            conversationId: input.conversationId,
            type: item.type,
            status: "executed",
            source: "system",
            resultId: item.resultId,
            resultModule: item.resultModule,
            reviewedBy: input.reviewedBy?.userId ?? null,
            reviewedAt: input.reviewedBy?.userId ? new Date() : null,
            data: JSON.stringify({
              action: input.action,
              sourceConversationId: input.conversationId,
            }),
          },
        })
      ))
    }

    return output
  })

  return {
    ...results,
    conversationId: input.conversationId,
  }
}

export function parseConversationJsonFields<T extends Record<string, unknown>>(record: T) {
  return {
    ...record,
    classification:
      record.classification && typeof record.classification === "object"
        ? {
            ...record.classification,
            suggestedTags: parseJson<string[]>((record.classification as { suggestedTags?: string | null }).suggestedTags),
            briefData: parseJson<Record<string, unknown>>((record.classification as { briefData?: string | null }).briefData),
            facts: parseJson<string[]>((record.classification as { facts?: string | null }).facts),
            pendingItems: parseJson<string[]>((record.classification as { pendingItems?: string | null }).pendingItems),
            risks: parseJson<string[]>((record.classification as { risks?: string | null }).risks),
            nextBestAction: parseJson<Record<string, unknown>>((record.classification as { nextBestAction?: string | null }).nextBestAction),
          }
        : record.classification,
    handoff:
      record.handoff && typeof record.handoff === "object"
        ? {
            ...record.handoff,
            facts: parseJson<string[]>((record.handoff as { facts?: string | null }).facts),
            decisions: parseJson<string[]>((record.handoff as { decisions?: string | null }).decisions),
            pendingItems: parseJson<string[]>((record.handoff as { pendingItems?: string | null }).pendingItems),
            risks: parseJson<string[]>((record.handoff as { risks?: string | null }).risks),
          }
        : record.handoff,
    drafts: Array.isArray(record.drafts)
      ? record.drafts.map((draft) => ({
          ...draft,
          generatedFrom: parseJson<Record<string, unknown>>((draft as { generatedFrom?: string | null }).generatedFrom),
        }))
      : record.drafts,
    messages: Array.isArray(record.messages)
      ? record.messages.map((message) => ({
          ...message,
          metadata: parseJson<Record<string, unknown>>((message as { metadata?: string | null }).metadata),
        }))
      : record.messages,
    actions: Array.isArray(record.actions)
      ? record.actions.map((action) => ({
          ...action,
          data: parseJson<Record<string, unknown>>((action as { data?: string | null }).data),
        }))
      : record.actions,
  }
}
