import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import type { InboxClassification } from "@/lib/inbox"
import {
  canTransitionConversationStatus,
  CONVERSATION_ACTIVE_STATUSES,
  getReopenStatusFrom,
  transitionConversationStatus,
} from "@/lib/modules/inbox/state"

interface ListConversationsParams {
  workspaceId: string
  skip?: number
  take?: number
  status?: string
  channel?: string
  urgency?: string
  q?: string
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

function inferInitialRole(channel: string) {
  return channel === "portal" ? "client" : "visitor"
}

function buildSubject(message: string, fallback?: string | null) {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (normalized.length === 0) return fallback ?? "Nueva conversación"
  if (normalized.length <= 72) return normalized
  return `${normalized.slice(0, 69)}...`
}

function computeLeadScore(classification: InboxClassification) {
  let score = 0
  if (classification.tipo === "lead" || classification.tipo === "proyecto") score += 35
  if (classification.urgencia === "critica") score += 20
  else if (classification.urgencia === "alta") score += 15
  else if (classification.urgencia === "media") score += 8
  if (classification.datosCliente?.nombre) score += 10
  if (classification.datosCliente?.email) score += 15
  if (classification.datosCliente?.empresa) score += 10
  if (classification.datosProyecto?.presupuesto) score += 10
  if ((classification.tags ?? []).length > 0) score += 5
  return Math.min(100, score)
}

function deriveConversationStatus(classification: InboxClassification, leadScore: number) {
  if (leadScore >= 60) return "lead_detected"
  if (classification.tipo === "ticket") return "triaged"
  return "triaged"
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

async function syncInboxEntryLegacySnapshot(
  inboxEntryId: string,
  classification: InboxClassification,
  status: string,
) {
  return db.inboxEntry.update({
    where: { id: inboxEntryId },
    data: {
      tipo: classification.tipo,
      categoria: classification.categoria,
      urgencia: classification.urgencia,
      intencion: classification.intencion,
      resumen: classification.resumen,
      datosCliente: JSON.stringify(classification.datosCliente),
      datosProyecto: JSON.stringify(classification.datosProyecto),
      notas: classification.notas,
      tags: JSON.stringify(classification.tags),
      aiRaw: JSON.stringify(classification),
      estado: status,
    },
  })
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

export async function applyClassificationToConversation(
  inboxEntryId: string,
  workspaceId: string,
  classification: InboxClassification,
) {
  const entry = await db.inboxEntry.findFirst({
    where: { id: inboxEntryId, workspaceId },
    select: {
      id: true,
      contactId: true,
      conversationId: true,
      clienteId: true,
      nombre: true,
      email: true,
      telefono: true,
      mensaje: true,
      fuente: true,
    },
  })

  if (!entry) return null

  let conversationId = entry.conversationId
  let contactId = entry.contactId

  if (!conversationId || !contactId) {
    const created = await createConversationFromInboxEntry({
      inboxEntryId,
      workspaceId,
      nombre: entry.nombre,
      email: entry.email,
      telefono: entry.telefono,
      mensaje: entry.mensaje,
      fuente: entry.fuente,
    })
    conversationId = created.conversation.id
    contactId = created.contact.id
  }

  const leadScore = computeLeadScore(classification)
  const nextStatus = deriveConversationStatus(classification, leadScore)

  const currentConversation = await db.conversation.findFirst({
    where: { id: conversationId!, workspaceId },
    select: {
      id: true,
      status: true,
      clienteId: true,
    },
  })

  if (!currentConversation) return null

  const status = transitionConversationStatus(currentConversation.status, nextStatus)

  const [contact, conversation] = await db.$transaction([
    db.contact.update({
      where: { id: contactId! },
      data: {
        nombre: classification.datosCliente?.nombre ?? undefined,
        email: classification.datosCliente?.email?.trim().toLowerCase() ?? undefined,
        telefono: classification.datosCliente?.telefono ?? undefined,
        empresa: classification.datosCliente?.empresa ?? undefined,
        tipo: leadScore >= 60 ? "lead" : undefined,
        leadScore,
        lastSeenAt: new Date(),
      },
    }),
    db.conversation.update({
      where: { id: conversationId! },
      data: {
        status,
        summary: classification.resumen,
        intent: classification.intencion,
        leadScore,
        urgency: classification.urgencia,
        clienteId: entry.clienteId ?? undefined,
        classification: {
          upsert: {
            create: {
              workspaceId,
              intent: classification.intencion,
              urgency: classification.urgencia,
              leadScore,
              summary: classification.resumen,
              suggestedTags: JSON.stringify(classification.tags ?? []),
              briefData: JSON.stringify(classification.datosProyecto ?? {}),
              model: "operativo",
              promptVersion: "v1",
            },
            update: {
              intent: classification.intencion,
              urgency: classification.urgencia,
              leadScore,
              summary: classification.resumen,
              suggestedTags: JSON.stringify(classification.tags ?? []),
              briefData: JSON.stringify(classification.datosProyecto ?? {}),
              model: "operativo",
              promptVersion: "v1",
            },
          },
        },
      },
      include: {
        contact: true,
        classification: true,
      },
    }),
  ])

  return { contact, conversation }
}

function parseConversationClassification(classification?: {
  suggestedTags?: string | null
  briefData?: string | null
  summary?: string | null
  intent?: string | null
  leadScore?: number | null
  urgency?: string | null
} | null) {
  return {
    summary: classification?.summary ?? null,
    intent: classification?.intent ?? null,
    leadScore: classification?.leadScore ?? null,
    urgency: classification?.urgency ?? null,
    suggestedTags: parseJson<string[]>(classification?.suggestedTags),
    briefData: parseJson<Record<string, unknown>>(classification?.briefData),
  }
}

export async function listConversations(params: ListConversationsParams) {
  const { workspaceId, skip = 0, take = 20, status, channel, urgency, q } = params

  const where: Prisma.ConversationWhereInput = {
    workspaceId,
    ...(status && status !== "todos" ? { status } : {}),
    ...(channel && channel !== "todos" ? { channel } : {}),
    ...(urgency && urgency !== "todos" ? { urgency } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q } },
            { summary: { contains: q } },
            { intent: { contains: q } },
            { contact: { nombre: { contains: q } } },
            { contact: { email: { contains: q } } },
            { contact: { empresa: { contains: q } } },
          ],
        }
      : {}),
  }

  const [data, total] = await Promise.all([
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
  ])

  return { data, total }
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
      inboxEntries: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })
}

export async function addMessage(input: AddMessageInput) {
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null

  return db.$transaction(async (tx) => {
    const existing = await tx.conversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      select: { id: true, messageCount: true, status: true },
    })

    if (!existing) return null

    const message = await tx.message.create({
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
        lastMessageAt: message.createdAt,
        messageCount: existing.messageCount + 1,
        status: nextStatus,
        closedAt: nextStatus === "closed" || nextStatus === "archived" ? new Date() : null,
      },
    })

    return message
  })
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
  const existing = await db.conversationDraft.findFirst({
    where: {
      id: input.draftId,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
    },
  })

  if (!existing) return null

  const nextStatus =
    input.data.status
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
  data?: Record<string, unknown> | null
  resultId?: string | null
  resultModule?: string | null
  reviewedBy?: string | null
}) {
  return db.conversationAction.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      type: input.type,
      status: input.status ?? "executed",
      data: input.data ? JSON.stringify(input.data) : null,
      resultId: input.resultId ?? null,
      resultModule: input.resultModule ?? null,
      reviewedBy: input.reviewedBy ?? null,
      reviewedAt: input.reviewedBy ? new Date() : null,
    },
  })
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
      inboxEntries: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!conversation) {
    throw new Error("Conversación no encontrada")
  }

  const classification = parseConversationClassification(conversation.classification)
  const latestLegacyEntry = conversation.inboxEntries[0] ?? null
  const firstInboundMessage =
    conversation.messages.find((message) => message.direction === "inbound" && !message.isInternal)
    ?? conversation.messages[0]
    ?? null

  const sourceText = firstInboundMessage?.content ?? latestLegacyEntry?.mensaje ?? ""
  const clienteSnapshot = latestLegacyEntry?.datosCliente
    ? parseJson<Record<string, string>>(latestLegacyEntry.datosCliente)
    : null
  const proyectoSnapshot = latestLegacyEntry?.datosProyecto
    ? parseJson<Record<string, string>>(latestLegacyEntry.datosProyecto)
    : null

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
        clienteId: conversation.clienteId ?? latestLegacyEntry?.clienteId ?? null,
        proyectoId: conversation.proyectoId ?? latestLegacyEntry?.proyectoId ?? null,
        tareaId: latestLegacyEntry?.tareaId ?? null,
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
              clienteSnapshot?.nombre
              || conversation.contact.nombre
              || "Cliente desde Inbox",
            email:
              clienteSnapshot?.email
              || conversation.contact.email
              || null,
            telefono:
              clienteSnapshot?.telefono
              || conversation.contact.telefono
              || null,
            empresa:
              clienteSnapshot?.empresa
              || conversation.contact.empresa
              || null,
            notas: `Origen: Inbox (${conversation.channel})\n${classification.summary || sourceText.slice(0, 200)}`,
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
              proyectoSnapshot?.nombre
              || String(classification.briefData?.nombre ?? "")
              || classification.summary
              || latestLegacyEntry?.resumen
              || "Proyecto desde Inbox",
            descripcion:
              proyectoSnapshot?.descripcion
              || String(classification.briefData?.descripcion ?? "")
              || sourceText.slice(0, 500),
            estado: "planificacion",
            prioridad:
              conversation.urgency === "critica" ? "alta" : conversation.urgency || "media",
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
              || classification.summary
              || latestLegacyEntry?.intencion
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

    await tx.inboxEntry.updateMany({
      where: { workspaceId: input.workspaceId, conversationId: input.conversationId },
      data: {
        clienteId: output.ids.clienteId,
        proyectoId: output.ids.proyectoId,
        tareaId: output.ids.tareaId,
        estado: "procesado",
        processedAt: new Date(),
      },
    })

    const actionMap = [
      output.created.cliente && output.ids.clienteId ? { type: "create_client", resultId: output.ids.clienteId, resultModule: "clientes" } : null,
      output.created.proyecto && output.ids.proyectoId ? { type: "create_project", resultId: output.ids.proyectoId, resultModule: "proyectos" } : null,
      output.created.tarea && output.ids.tareaId ? { type: "create_task", resultId: output.ids.tareaId, resultModule: "tareas" } : null,
    ].filter(Boolean) as { type: string; resultId: string; resultModule: string }[]

    await Promise.all(actionMap.map((item) =>
      tx.conversationAction.create({
        data: {
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
          type: item.type,
          status: "executed",
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

    return output
  })

  return {
    ...results,
    conversationId: input.conversationId,
  }
}

export async function applyLegacyClassificationSnapshot(
  inboxEntryId: string,
  classification: InboxClassification,
) {
  return syncInboxEntryLegacySnapshot(inboxEntryId, classification, "clasificado")
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
