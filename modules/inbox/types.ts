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
    type: "create_client" | "create_project" | "create_task" | "schedule_followup" | "assign_operator" | "generate_proposal"
    title: string
    description: string
    confidence: number
  }>
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
