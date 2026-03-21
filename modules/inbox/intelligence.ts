import { askMotorIA } from "@engines/ai"
import { db } from "@core/db"
import type {
  ConversationIntelligenceOutput,
  InboxClassification,
} from "./types"
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

export async function classifyInboxEntry(input: {
  nombre?: string
  email?: string
  telefono?: string
  mensaje: string
  fuente: string
}): Promise<InboxClassification> {
  const prompt = `Eres el sistema de clasificacion inteligente de 7F, una plataforma de gestion empresarial.

Analiza el siguiente mensaje entrante y clasifícalo:

DATOS DE ENTRADA:
- Fuente: ${input.fuente}
${input.nombre ? `- Nombre: ${input.nombre}` : ""}
${input.email ? `- Email: ${input.email}` : ""}
${input.telefono ? `- Telefono: ${input.telefono}` : ""}
- Mensaje: ${input.mensaje}

Responde UNICAMENTE con JSON valido (sin markdown, sin backticks):
{
  "tipo": "lead" | "ticket" | "consulta" | "proyecto" | "factura",
  "categoria": "categoria especifica del mensaje (ej: soporte tecnico, cotizacion, reclamo, informacion, nuevo proyecto, pago, etc.)",
  "urgencia": "baja" | "media" | "alta" | "critica",
  "intencion": "que quiere lograr el remitente en una frase corta",
  "resumen": "resumen de 1-2 oraciones del mensaje",
  "datosCliente": {
    "nombre": "nombre detectado o null",
    "email": "email detectado o null",
    "telefono": "telefono detectado o null",
    "empresa": "empresa detectada o null"
  },
  "datosProyecto": {
    "nombre": "nombre de proyecto mencionado o null",
    "descripcion": "descripcion si aplica o null",
    "presupuesto": "monto mencionado o null"
  },
  "notas": "observaciones adicionales relevantes",
  "tags": ["etiqueta1", "etiqueta2"]
}

REGLAS:
- tipo "lead": alguien interesado en contratar servicios o comprar
- tipo "ticket": reporte de problema, soporte, bug, queja
- tipo "consulta": pregunta general, informacion
- tipo "proyecto": solicitud concreta de trabajo o proyecto
- tipo "factura": relacionado con pagos, cobros, facturas
- urgencia "critica": requiere atencion inmediata
- urgencia "alta": requiere atencion en las proximas horas
- urgencia "media": puede esperar 1-2 dias
- urgencia "baja": sin presion de tiempo`

  console.log("[7F Inbox] Clasificando entrada:", input.mensaje.slice(0, 80))

  const response = await askMotorIA(prompt, "operativo")

  try {
    const cleaned = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()

    const result: InboxClassification = JSON.parse(cleaned)

    if (!result.tags) result.tags = []
    if (!result.datosCliente) result.datosCliente = {}
    if (!result.datosProyecto) result.datosProyecto = {}

    console.log("[7F Inbox] Clasificacion:", result.tipo, result.urgencia)
    return result
  } catch {
    console.error("[7F Inbox] Error parseando respuesta IA:", response.slice(0, 200))
    return {
      tipo: "consulta",
      categoria: "sin clasificar",
      urgencia: "media",
      intencion: "No se pudo determinar",
      resumen: input.mensaje.slice(0, 200),
      datosCliente: {
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
      },
      datosProyecto: {},
      notas: "Clasificacion automatica fallida. Requiere revision manual.",
      tags: ["revision-manual"],
    }
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
  latestLegacySnapshot?: {
    resumen?: string | null
    intencion?: string | null
    urgencia?: string | null
    tags?: string[] | null
  } | null
  messages: Array<{
    role: string
    direction: string
    content: string
    isInternal?: boolean
    createdAt?: string
  }>
}): Promise<ConversationIntelligenceOutput> {
  const transcript = input.messages
    .slice(-12)
    .map((message, index) => {
      const stamp = message.createdAt ? ` (${message.createdAt})` : ""
      const visibility = message.isInternal ? " [interno]" : ""
      return `${index + 1}. [${message.direction}/${message.role}]${stamp}${visibility}: ${message.content}`
    })
    .join("\n")

  const prompt = `Eres el motor de inteligencia operativa del Smart Inbox de 7F.

Analiza la conversación y responde SOLO con JSON válido.

CONTEXTO:
- ConversationId: ${input.conversationId}
- Canal: ${input.channel}
- Estado actual: ${input.status}
${input.subject ? `- Asunto: ${input.subject}` : ""}
${input.clienteId ? `- Cliente vinculado: ${input.clienteId}` : ""}
${input.proyectoId ? `- Proyecto vinculado: ${input.proyectoId}` : ""}
${input.assignedTo ? `- Responsable actual: ${input.assignedTo}` : ""}
${input.contact.nombre ? `- Contacto: ${input.contact.nombre}` : ""}
${input.contact.email ? `- Email: ${input.contact.email}` : ""}
${input.contact.telefono ? `- Telefono: ${input.contact.telefono}` : ""}
${input.contact.empresa ? `- Empresa: ${input.contact.empresa}` : ""}
${input.contact.tipo ? `- Tipo contacto: ${input.contact.tipo}` : ""}
${input.previousSummary ? `- Resumen previo: ${input.previousSummary}` : ""}
${input.previousIntent ? `- Intención previa: ${input.previousIntent}` : ""}
${input.latestLegacySnapshot?.resumen ? `- Snapshot legacy resumen: ${input.latestLegacySnapshot.resumen}` : ""}
${input.latestLegacySnapshot?.intencion ? `- Snapshot legacy intención: ${input.latestLegacySnapshot.intencion}` : ""}

MENSAJES RECIENTES:
${transcript || "Sin mensajes"}

Devuelve:
{
  "tipo": "lead" | "ticket" | "consulta" | "proyecto" | "factura",
  "categoria": "categoria operativa",
  "urgencia": "baja" | "media" | "alta" | "critica",
  "intencion": "frase corta",
  "resumen": "resumen actualizado de la conversación",
  "leadScore": 0,
  "scoreReasoning": "explicacion breve del score",
  "sentiment": "positivo|neutral|negativo|mixto",
  "sector": "sector detectado o vacio",
  "confidence": 0.0,
  "datosCliente": {
    "nombre": "string o vacio",
    "email": "string o vacio",
    "telefono": "string o vacio",
    "empresa": "string o vacio"
  },
  "datosProyecto": {
    "nombre": "string o vacio",
    "descripcion": "string o vacio",
    "presupuesto": "string o vacio"
  },
  "notas": "observaciones importantes",
  "tags": ["tag1", "tag2"],
  "facts": ["hecho verificable"],
  "pendingItems": ["pendiente"],
  "risks": ["riesgo"],
  "nextBestAction": {
    "type": "follow_up | clarify_scope | assign_operator | prepare_quote | wait_human",
    "description": "siguiente mejor acción"
  },
  "suggestedActions": [
    {
      "type": "create_client | create_project | create_task | schedule_followup | assign_operator | generate_proposal",
      "title": "titulo corto de la accion",
      "description": "descripcion ejecutiva de por que conviene",
      "confidence": 0.0
    }
  ],
  "handoff": {
    "headline": "titulo corto para operador",
    "summary": "contexto operativo para handoff",
    "facts": ["hechos clave"],
    "decisions": ["decisiones o acuerdos"],
    "pendingItems": ["pendientes"],
    "risks": ["riesgos"],
    "nextRecommendedAction": "proximo paso recomendado",
    "confidence": 0.0
  },
  "draft": {
    "shouldCreate": true,
    "title": "titulo corto del borrador",
    "content": "respuesta sugerida lista para editar",
    "tone": "consultivo|amable|directo|profesional",
    "targetChannel": "${input.channel}",
    "reason": "por que conviene crear este borrador"
  }
}

REGLAS:
- facts, pendingItems, risks y decisions deben ser listas breves y concretas.
- No inventes datos privados ni afirmes hechos no respaldados por la conversación.
- suggestedActions debe incluir solo acciones realmente útiles y evitar duplicados conceptuales.
- Si no corresponde crear borrador, usa draft.shouldCreate=false y deja content vacío.
- El handoff debe servir a un operador humano y ser más operativo que el resumen general.
- Mantén el JSON compacto y válido.`

  const response = await askMotorIA(prompt, "operativo")
  const parsed = parseJsonResponse<Partial<ConversationIntelligenceOutput>>(response)

  if (parsed) {
    return {
      tipo: parsed.tipo ?? "consulta",
      categoria: parsed.categoria ?? "seguimiento",
      urgencia: parsed.urgencia ?? "media",
      intencion: parsed.intencion ?? input.previousIntent ?? "Requiere seguimiento",
      resumen: parsed.resumen ?? input.previousSummary ?? input.messages.at(-1)?.content?.slice(0, 200) ?? "Sin resumen",
      leadScore: clampNumber(parsed.leadScore, 0, 100, 40),
      scoreReasoning: parsed.scoreReasoning ?? "Scoring generado a partir del contexto conversacional actual.",
      sentiment: parsed.sentiment ?? "neutral",
      sector: parsed.sector ?? "",
      confidence: clampNumber(parsed.confidence, 0, 1, 0.62),
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
            description: parsed.nextBestAction.description ?? "Revisión humana recomendada.",
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
          }))
        : [],
      handoff: {
        headline: parsed.handoff?.headline ?? "Contexto operativo listo para revisión",
        summary: parsed.handoff?.summary ?? parsed.resumen ?? input.previousSummary ?? "Sin contexto generado.",
        facts: Array.isArray(parsed.handoff?.facts) ? parsed.handoff.facts : [],
        decisions: Array.isArray(parsed.handoff?.decisions) ? parsed.handoff.decisions : [],
        pendingItems: Array.isArray(parsed.handoff?.pendingItems) ? parsed.handoff.pendingItems : [],
        risks: Array.isArray(parsed.handoff?.risks) ? parsed.handoff.risks : [],
        nextRecommendedAction: parsed.handoff?.nextRecommendedAction ?? parsed.nextBestAction?.description ?? "Revisión humana.",
        confidence: clampNumber(parsed.handoff?.confidence, 0, 1, 0.62),
      },
      draft: parsed.draft
        ? {
            shouldCreate: Boolean(parsed.draft.shouldCreate),
            title: parsed.draft.title ?? "Borrador de respuesta",
            content: parsed.draft.content ?? "",
            tone: parsed.draft.tone ?? "profesional",
            targetChannel: parsed.draft.targetChannel ?? input.channel,
            reason: parsed.draft.reason ?? "",
          }
        : null,
    }
  }

  const fallbackSummary = input.previousSummary ?? input.messages.at(-1)?.content?.slice(0, 200) ?? "Sin resumen"

  return {
    tipo: "consulta",
    categoria: "seguimiento",
    urgencia: input.latestLegacySnapshot?.urgencia as InboxClassification["urgencia"] ?? "media",
    intencion: input.previousIntent ?? "Requiere revisión humana",
    resumen: fallbackSummary,
    leadScore: 35,
    scoreReasoning: "Fallback aplicado por error de parseo del motor IA.",
    sentiment: "neutral",
    sector: "",
    confidence: 0.35,
    datosCliente: {
      nombre: input.contact.nombre ?? undefined,
      email: input.contact.email ?? undefined,
      telefono: input.contact.telefono ?? undefined,
      empresa: input.contact.empresa ?? undefined,
    },
    datosProyecto: {},
    notas: "Inteligencia conversacional en modo fallback. Requiere revisión manual.",
    tags: ["revision-manual"],
    facts: [],
    pendingItems: [],
    risks: ["La respuesta IA no pudo parsearse correctamente."],
    nextBestAction: {
      type: "wait_human",
      description: "Revisión humana recomendada antes de operar.",
    },
    suggestedActions: [],
    handoff: {
      headline: "Revisión manual recomendada",
      summary: fallbackSummary,
      facts: [],
      decisions: [],
      pendingItems: [],
      risks: ["Respuesta IA inválida o incompleta."],
      nextRecommendedAction: "Un operador debe revisar esta conversación.",
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
