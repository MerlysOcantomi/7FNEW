import { askMotorIA } from "./ai"

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
