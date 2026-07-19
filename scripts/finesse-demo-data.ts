/**
 * Finesse demo data source of truth.
 *
 * Pure functions for:
 *   - Deterministic ID generation (idempotent)
 *   - Relative date calculation
 *   - Demo dataset definitions
 *   - Validation helpers
 *
 * No database access. No side effects. Testable.
 */

import { addDays, startOfDay } from "date-fns"

/**
 * Deterministic workspace prefix for demo records.
 * Used to create globally unique identifiers across all workspaces.
 */
export function getWorkspaceShortId(workspaceId: string): string {
  return workspaceId.slice(0, 8)
}

/**
 * Generate a unique invoice number for demo data.
 * Format: DEMO-FINESSE-<workspace-short>-<seq>
 * Deterministic: same workspace + seq always gives same number.
 */
export function generateDemoInvoiceNumber(
  workspaceId: string,
  sequence: number,
): string {
  const shortId = getWorkspaceShortId(workspaceId)
  return `DEMO-FINESSE-${shortId}-${String(sequence).padStart(3, "0")}`
}

/**
 * Generate a unique email for demo clients.
 * Format: demo-<type>-<sequence>@demo.example.com
 */
export function generateDemoEmail(type: string, sequence: number): string {
  return `demo-${type}-${String(sequence).padStart(2, "0")}@demo.example.com`
}

/**
 * Generate a unique phone number for demo data.
 * Format: +34 000 000 <sequence>
 */
export function generateDemoPhone(sequence: number): string {
  const paddedSeq = String(sequence).padStart(3, "0")
  return `+34 000 000 ${paddedSeq}`
}

/**
 * Calculate relative date from today.
 * daysOffset: 0 = today, 1 = tomorrow, -1 = yesterday, etc.
 * hour/minute for scheduling.
 */
export function getRelativeDate(
  daysOffset: number,
  hour: number = 9,
  minute: number = 0,
): Date {
  const d = addDays(startOfDay(new Date()), daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/**
 * Demo clients dataset.
 * Use deterministic emails so idempotency works.
 */
export interface DemoClientData {
  nombre: string
  email: string
  telefono: string
  empresa: string
  tipo: string
  estado: string
  notas: string
}

export const FINESSE_DEMO_CLIENTS: DemoClientData[] = [
  {
    nombre: "María García Rodríguez",
    email: generateDemoEmail("client", 1),
    telefono: generateDemoPhone(1),
    empresa: "Beauty Self",
    tipo: "visitante",
    estado: "activo",
    notas: "Cliente habitual, preferencias: manicura gel.",
  },
  {
    nombre: "Sofía Martínez López",
    email: generateDemoEmail("client", 2),
    telefono: generateDemoPhone(2),
    empresa: "Independiente",
    tipo: "visitante",
    estado: "activo",
    notas: "Referida por María. Interesada en tratamientos faciales.",
  },
  {
    nombre: "Laura Ruiz Fernández",
    email: generateDemoEmail("client", 3),
    telefono: generateDemoPhone(3),
    empresa: "Laura's Wellness",
    tipo: "visitante",
    estado: "activo",
    notas: "Cliente VIP, membresía mensual. Favorita: masaje + spa.",
  },
  {
    nombre: "Carla López Sánchez",
    email: generateDemoEmail("client", 4),
    telefono: generateDemoPhone(4),
    empresa: "Consultoría Carla",
    tipo: "visitante",
    estado: "prospecto",
    notas: "Lead reciente. Primera consulta programada.",
  },
  {
    nombre: "Valentina Pérez Giménez",
    email: generateDemoEmail("client", 5),
    telefono: generateDemoPhone(5),
    empresa: "V.P. Services",
    tipo: "visitante",
    estado: "inactivo",
    notas: "Cliente anterior, última cita hace 3 meses.",
  },
  {
    nombre: "Isabel González Martín",
    email: generateDemoEmail("client", 6),
    telefono: generateDemoPhone(6),
    empresa: "Comunicaciones Isabel",
    tipo: "visitante",
    estado: "activo",
    notas: "Servicio regular de mantenimiento.",
  },
  {
    nombre: "Rocío Díaz Alvarez",
    email: generateDemoEmail("client", 7),
    telefono: generateDemoPhone(7),
    empresa: "Rocío's Studio",
    tipo: "visitante",
    estado: "activo",
    notas: "Emprendedora, packages mensuales.",
  },
  {
    nombre: "Patricia Moreno Jiménez",
    email: generateDemoEmail("client", 8),
    telefono: generateDemoPhone(8),
    empresa: "Eventos Patricia",
    tipo: "visitante",
    estado: "prospecto",
    notas: "Interesada en servicios para eventos.",
  },
]

/**
 * Demo events dataset.
 * Distributed across today + 7 days.
 * tipo is always "cita" for Beauty appointments.
 */
export interface DemoEventData {
  clientIndex: number
  titulo: string
  daysOffset: number
  hora: number
  minuto: number
  duracionMinutos: number
  tipo: string
  /** Demo marker for idempotent updates */
  demoMarker: string
}

export const FINESSE_DEMO_EVENTS: DemoEventData[] = [
  { clientIndex: 0, titulo: "Manicura + Pedicura", daysOffset: 0, hora: 9, minuto: 30, duracionMinutos: 60, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:01" },
  { clientIndex: 1, titulo: "Gel Nail Art", daysOffset: 0, hora: 11, minuto: 0, duracionMinutos: 90, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:02" },
  { clientIndex: 2, titulo: "Facial rejuvenecedor", daysOffset: 0, hora: 14, minuto: 0, duracionMinutos: 120, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:03" },
  { clientIndex: 3, titulo: "Consulta inicial", daysOffset: 1, hora: 10, minuto: 0, duracionMinutos: 30, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:04" },
  { clientIndex: 0, titulo: "Depilación laser", daysOffset: 2, hora: 15, minuto: 30, duracionMinutos: 45, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:05" },
  { clientIndex: 1, titulo: "Peeling químico", daysOffset: 3, hora: 11, minuto: 0, duracionMinutos: 75, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:06" },
  { clientIndex: 2, titulo: "Masaje relajante", daysOffset: 4, hora: 16, minuto: 0, duracionMinutos: 90, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:07" },
  { clientIndex: 4, titulo: "Revisión pigmentación", daysOffset: 5, hora: 14, minuto: 30, duracionMinutos: 45, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:08" },
  { clientIndex: 3, titulo: "Tratamiento corporal", daysOffset: 6, hora: 10, minuto: 0, duracionMinutos: 120, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:09" },
  { clientIndex: 0, titulo: "Pedicura semipermanente", daysOffset: 7, hora: 13, minuto: 0, duracionMinutos: 60, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:10" },
  { clientIndex: 5, titulo: "Limpieza facial profunda", daysOffset: 1, hora: 16, minuto: 0, duracionMinutos: 75, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:11" },
  { clientIndex: 6, titulo: "Manicura expresss", daysOffset: 2, hora: 9, minuto: 0, duracionMinutos: 30, tipo: "cita", demoMarker: "FINESSE_DEMO:cita:12" },
]

/**
 * Demo conversations dataset.
 */
export interface DemoConversationMessage {
  direction: "inbound" | "outbound"
  role: string
  content: string
  hoursAgo?: number
}

export interface DemoConversationData {
  clientIndex: number
  subject: string
  messages: DemoConversationMessage[]
  /** Demo marker for idempotent updates */
  demoMarker: string
}

export const FINESSE_DEMO_CONVERSATIONS: DemoConversationData[] = [
  {
    clientIndex: 0,
    subject: "Cuándo tengo mi próxima cita?",
    demoMarker: "FINESSE_DEMO:conv:01",
    messages: [
      {
        direction: "inbound",
        role: "user",
        content: "Hola, quería saber cuándo es mi próxima cita de manicura.",
        hoursAgo: 4,
      },
      {
        direction: "outbound",
        role: "assistant",
        content: "¡Hola María! Tu próxima cita es mañana a las 09:30. Te esperamos. 💅",
        hoursAgo: 3,
      },
      {
        direction: "inbound",
        role: "user",
        content: "Perfecto, gracias!",
        hoursAgo: 2,
      },
    ],
  },
  {
    clientIndex: 1,
    subject: "Qué servicios ofrecen?",
    demoMarker: "FINESSE_DEMO:conv:02",
    messages: [
      {
        direction: "inbound",
        role: "user",
        content: "Buenos días, soy nueva en la zona. Qué servicios ofrecen?",
        hoursAgo: 12,
      },
      {
        direction: "outbound",
        role: "assistant",
        content:
          "Hola Sofía! Ofrecemos manicura, pedicura, uñas gel, tratamientos faciales y masajes. Puedes ver nuestro menú completo en el sitio.",
        hoursAgo: 10,
      },
      {
        direction: "inbound",
        role: "user",
        content: "Me interesa una manicura gel para este viernes.",
        hoursAgo: 8,
      },
    ],
  },
  {
    clientIndex: 2,
    subject: "Quiero hacer una cita VIP",
    demoMarker: "FINESSE_DEMO:conv:03",
    messages: [
      {
        direction: "inbound",
        role: "user",
        content: "Hola! Soy Laura, miembro VIP. Quería agendar mi sesión mensual.",
        hoursAgo: 6,
      },
      {
        direction: "outbound",
        role: "assistant",
        content:
          "¡Laura! Perfecto, te reservamos el paquete completo (facial + masaje) para la semana que viene. Tu horario preferido?",
        hoursAgo: 5,
      },
    ],
  },
  {
    clientIndex: 3,
    subject: "Promo especial para nuevas clientas",
    demoMarker: "FINESSE_DEMO:conv:04",
    messages: [
      {
        direction: "outbound",
        role: "assistant",
        content: "Hola Carla! Tenemos una promo especial 20% off para nuevas clientas. ¿Te interesa?",
        hoursAgo: 24,
      },
      {
        direction: "inbound",
        role: "user",
        content: "Sí! Cuándo puedo venir?",
        hoursAgo: 20,
      },
    ],
  },
  {
    clientIndex: 5,
    subject: "Consulta sobre membresía anual",
    demoMarker: "FINESSE_DEMO:conv:05",
    messages: [
      {
        direction: "inbound",
        role: "user",
        content: "Hola, interesada en conocer el plan de membresía anual.",
        hoursAgo: 18,
      },
      {
        direction: "outbound",
        role: "assistant",
        content: "Hola Isabel! Nuestro plan anual incluye 20% de descuento y acceso prioritario a nuevos servicios.",
        hoursAgo: 16,
      },
    ],
  },
]

/**
 * Demo invoices dataset.
 */
export interface DemoInvoiceData {
  clientIndex: number
  estado: string
  subtotal: number
  impuesto: number
  descripcion: string
  daysAgo: number
  /**
   * Due date as an offset in days from today (negative = already overdue).
   * Omitted for drafts, which have no due date yet.
   */
  dueOffsetDays?: number
  /** Days ago the invoice was paid. Only for estado "pagada". */
  paidDaysAgo?: number
  /** Demo marker for idempotent updates */
  demoMarker: string
}

export const FINESSE_DEMO_INVOICES: DemoInvoiceData[] = [
  {
    clientIndex: 0,
    estado: "pagada",
    subtotal: 100,
    impuesto: 21,
    descripcion: "Manicura + Pedicura",
    daysAgo: 0,
    dueOffsetDays: 14,
    paidDaysAgo: 0,
    demoMarker: "FINESSE_DEMO:invoice:001",
  },
  {
    clientIndex: 1,
    estado: "pagada",
    subtotal: 150,
    impuesto: 31.5,
    descripcion: "Gel Nail Art",
    daysAgo: 3,
    dueOffsetDays: 11,
    paidDaysAgo: 2,
    demoMarker: "FINESSE_DEMO:invoice:002",
  },
  {
    clientIndex: 2,
    estado: "enviada",
    subtotal: 200,
    impuesto: 42,
    descripcion: "Facial rejuvenecedor",
    daysAgo: 1,
    dueOffsetDays: 13,
    demoMarker: "FINESSE_DEMO:invoice:003",
  },
  {
    clientIndex: 3,
    estado: "borrador",
    subtotal: 120,
    impuesto: 25.2,
    descripcion: "Consulta + tratamiento",
    daysAgo: 0,
    demoMarker: "FINESSE_DEMO:invoice:004",
  },
  {
    clientIndex: 4,
    estado: "vencida",
    subtotal: 80,
    impuesto: 16.8,
    descripcion: "Manicura mantenimiento",
    daysAgo: 15,
    dueOffsetDays: -5,
    demoMarker: "FINESSE_DEMO:invoice:005",
  },
]

/**
 * Demo content pieces (Momento Beauty).
 */
export interface DemoContentPieceData {
  titulo: string
  copy: string
  plataforma: string
  tipo: string
  estado: string
  daysAgo?: number
  daysInFuture?: number
  /** Demo marker for idempotent updates */
  demoMarker: string
}

export const FINESSE_DEMO_CONTENT_PIECES: DemoContentPieceData[] = [
  {
    titulo: "Nuestras favoritas del viernes",
    copy: "✨ Los looks que arrasaron esta semana. ¿Cuál es tu favorito? 💅 #BeautyFriday #NailArt",
    plataforma: "instagram",
    tipo: "post",
    estado: "published",
    daysAgo: 2,
    demoMarker: "FINESSE_DEMO:content:01",
  },
  {
    titulo: "Ofertas especiales de primavera",
    copy: "🌸 20% OFF en servicios selectos. Solo esta semana. Reserva ya! 📱",
    plataforma: "instagram",
    tipo: "carousel",
    estado: "scheduled",
    daysInFuture: 1,
    demoMarker: "FINESSE_DEMO:content:02",
  },
  {
    titulo: "Transición de uñas: antes y después",
    copy: "La transformación que amas en 15 segundos ⏱️ #NailTransformation #BeautyTok",
    plataforma: "tiktok",
    tipo: "reel",
    estado: "draft",
    demoMarker: "FINESSE_DEMO:content:03",
  },
  {
    titulo: "Tips de cuidado en casa",
    copy: "Cómo mantener tus uñas perfectas entre citas 💅 Sigue estos 5 pasos...",
    plataforma: "instagram",
    tipo: "post",
    estado: "draft",
    demoMarker: "FINESSE_DEMO:content:04",
  },
]

/**
 * Demo workspace tasks (WorkspaceTask) — what Today's "My work" / "AI work"
 * lanes read. Visibility rules honored here (see modules/today/aggregator.ts):
 *   - only statuses proposed | open | in_progress | waiting surface;
 *   - tasks dated later than today are dropped by the Today buckets, so every
 *     dated demo task is due today;
 *   - undated tasks only surface for their assignee, so undated demo tasks are
 *     always assigned to the owner.
 */
export interface DemoWorkspaceTaskData {
  title: string
  description: string
  /** proposed | open | in_progress | waiting */
  status: "proposed" | "open" | "in_progress" | "waiting"
  /** low | normal | high | urgent */
  priority: "low" | "normal" | "high" | "urgent"
  /** owner → assigned to the seeding owner; ai → Fanny; unassigned */
  assign: "owner" | "ai" | "unassigned"
  /** Due today at this hour. Omitted = undated (must then be assign: "owner"). */
  dueHour?: number
  dueMinute?: number
  /** Optional link to a demo client (index into FINESSE_DEMO_CLIENTS). */
  clientIndex?: number
  /** Optional link to a demo event (its demoMarker). */
  eventMarker?: string
  /** Optional link to a demo conversation (its demoMarker). */
  conversationMarker?: string
  /** Short human label of where the task comes from (shown by the UI). */
  sourceLabel: string
  /** user | fanny | system */
  suggestedBy?: "user" | "fanny" | "system"
  /** manual | ai_assisted | ai */
  executionMode?: "manual" | "ai_assisted" | "ai"
  /** Demo marker for idempotent updates (stored in sourceId). */
  demoMarker: string
}

/** sourceType used for every demo WorkspaceTask — the idempotency lookup key. */
export const FINESSE_DEMO_TASK_SOURCE_TYPE = "finesse_demo"

export const FINESSE_DEMO_WORKSPACE_TASKS: DemoWorkspaceTaskData[] = [
  {
    title: "Confirmar la cita de Carla (consulta inicial de mañana)",
    description: "Carla todavía no ha confirmado su primera consulta. Enviarle un recordatorio hoy.",
    status: "open",
    priority: "high",
    assign: "owner",
    dueHour: 18,
    dueMinute: 0,
    clientIndex: 3,
    eventMarker: "FINESSE_DEMO:cita:04",
    sourceLabel: "Agenda",
    suggestedBy: "user",
    executionMode: "manual",
    demoMarker: "FINESSE_DEMO:task:01",
  },
  {
    title: "Reclamar la factura vencida de Valentina",
    description: "La factura DEMO de mantenimiento lleva 5 días vencida. Enviar recordatorio de pago.",
    status: "open",
    priority: "high",
    assign: "owner",
    dueHour: 12,
    dueMinute: 0,
    clientIndex: 4,
    sourceLabel: "Facturación",
    suggestedBy: "user",
    executionMode: "manual",
    demoMarker: "FINESSE_DEMO:task:02",
  },
  {
    title: "Responder a Sofía: quiere manicura gel el viernes",
    description: "Sofía pidió cita para una manicura gel este viernes. Proponerle hueco por la mañana.",
    status: "in_progress",
    priority: "high",
    assign: "owner",
    dueHour: 11,
    dueMinute: 0,
    clientIndex: 1,
    conversationMarker: "FINESSE_DEMO:conv:02",
    sourceLabel: "Inbox",
    suggestedBy: "user",
    executionMode: "manual",
    demoMarker: "FINESSE_DEMO:task:03",
  },
  {
    title: "Proponer nueva cita a Valentina (3 meses sin visita)",
    description: "Valentina no viene desde hace 3 meses. Borrador de mensaje de rebooking listo para revisar.",
    status: "proposed",
    priority: "normal",
    assign: "ai",
    dueHour: 16,
    dueMinute: 0,
    clientIndex: 4,
    sourceLabel: "Fanny",
    suggestedBy: "fanny",
    executionMode: "ai_assisted",
    demoMarker: "FINESSE_DEMO:task:04",
  },
  {
    title: "Esperando confirmación del proveedor de esmaltes",
    description: "Pedido de esmaltes semipermanentes enviado; falta confirmación de entrega.",
    status: "waiting",
    priority: "normal",
    assign: "owner",
    dueHour: 17,
    dueMinute: 30,
    sourceLabel: "Inventario",
    suggestedBy: "user",
    executionMode: "manual",
    demoMarker: "FINESSE_DEMO:task:05",
  },
  {
    title: "Preparar la promo de primavera (20% nuevas clientas)",
    description: "Definir servicios incluidos y texto del post antes de programarlo.",
    status: "open",
    priority: "normal",
    assign: "owner",
    sourceLabel: "Marketing",
    suggestedBy: "user",
    executionMode: "manual",
    demoMarker: "FINESSE_DEMO:task:06",
  },
]

/**
 * Demo legacy CRM tasks (Tarea) — what the /tareas page reads. Kept distinct
 * from the WorkspaceTask titles so Today (which merges both models) never
 * shows near-duplicates. The demo marker lives on its own line inside
 * `descripcion` (the model has no free metadata column); the seeder matches
 * with `contains`.
 */
export interface DemoTareaData {
  titulo: string
  /** Human description; the marker is appended on its own line by the seeder. */
  descripcion: string
  /** pendiente | en_progreso | completada */
  estado: "pendiente" | "en_progreso" | "completada"
  /** baja | media | alta | urgente */
  prioridad: "baja" | "media" | "alta" | "urgente"
  /** Deadline offset in days from today. Omitted = no deadline. */
  dueOffsetDays?: number
  clientIndex?: number
  /** Demo marker for idempotent updates */
  demoMarker: string
}

export const FINESSE_DEMO_TAREAS: DemoTareaData[] = [
  {
    titulo: "Actualizar la lista de precios de tratamientos",
    descripcion: "Revisar los precios de faciales y masajes antes de la temporada alta.",
    estado: "pendiente",
    prioridad: "media",
    dueOffsetDays: 3,
    demoMarker: "FINESSE_DEMO:tarea:01",
  },
  {
    titulo: "Renovar el escaparate con la campaña de primavera",
    descripcion: "Colocar la cartelería nueva y las muestras de color de esta temporada.",
    estado: "pendiente",
    prioridad: "baja",
    dueOffsetDays: 5,
    demoMarker: "FINESSE_DEMO:tarea:02",
  },
  {
    titulo: "Preparar ficha de preferencias de Laura",
    descripcion: "Completar la ficha VIP con sus tratamientos favoritos y alergias.",
    estado: "en_progreso",
    prioridad: "alta",
    dueOffsetDays: 1,
    clientIndex: 2,
    demoMarker: "FINESSE_DEMO:tarea:03",
  },
]

/**
 * Demo business profile — the canonical `Workspace.config.businessProfile`
 * shape (see `WorkspaceBusinessProfile` in core/verticals.ts). This is what
 * /business-profile and the agent context read. Merged fill-only-missing so
 * a profile the owner already edited is never overwritten.
 */
export const FINESSE_DEMO_BUSINESS_PROFILE: Record<string, unknown> = {
  businessName: "Finesse Studio Beauty",
  businessDescription:
    "Salón boutique de manicura, estética facial y bienestar en el centro. Citas con reserva previa, atención personalizada y productos cruelty-free.",
  services: [
    "Manicura semipermanente",
    "Pedicura",
    "Nail art",
    "Limpieza facial",
    "Facial rejuvenecedor",
    "Masaje relajante",
    "Depilación láser",
    "Lifting de pestañas",
  ],
  tone: "Cercano y profesional, con un toque cálido. Tuteamos a las clientas.",
  region: "Madrid Centro, España",
  languages: ["es", "en"],
  workingHours: "Martes a sábado de 10:00 a 19:00. Lunes y domingo cerrado.",
  attentionRules: [
    "Confirmar cada cita el día anterior por mensaje.",
    "Responder los mensajes nuevos en menos de 2 horas dentro del horario.",
    "Ofrecer rebooking a clientas sin visita en los últimos 60 días.",
  ],
}

/**
 * Demo service catalog fallback — same shape as the Beauty pack seed
 * (`BEAUTY_SERVICE_CATALOG_SEED`). Only written to `Workspace.config` when the
 * workspace resolves to an EMPTY catalog (e.g. its verticalKey is a Beauty
 * alias like "salon" with no Vertical row carrying defaults). If the vertical
 * defaults or the workspace already provide a catalog, this is not used —
 * the workspace keeps its canonical source.
 */
export const FINESSE_DEMO_SERVICE_CATALOG: Array<{
  name: string
  category: string
  active: boolean
}> = [
  { name: "Manicura semipermanente", category: "Uñas", active: true },
  { name: "Pedicura", category: "Uñas", active: true },
  { name: "Nail art", category: "Uñas", active: true },
  { name: "Limpieza facial", category: "Estética", active: true },
  { name: "Facial rejuvenecedor", category: "Estética", active: true },
  { name: "Masaje relajante", category: "Bienestar", active: true },
  { name: "Depilación láser", category: "Estética", active: true },
  { name: "Lifting de pestañas", category: "Pestañas", active: true },
]

/**
 * Validate demo data consistency.
 */
export function validateDemoData(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check client index references
  for (const evt of FINESSE_DEMO_EVENTS) {
    if (evt.clientIndex < 0 || evt.clientIndex >= FINESSE_DEMO_CLIENTS.length) {
      errors.push(`Event references invalid clientIndex ${evt.clientIndex}`)
    }
  }

  for (const conv of FINESSE_DEMO_CONVERSATIONS) {
    if (conv.clientIndex < 0 || conv.clientIndex >= FINESSE_DEMO_CLIENTS.length) {
      errors.push(`Conversation references invalid clientIndex ${conv.clientIndex}`)
    }
  }

  for (const inv of FINESSE_DEMO_INVOICES) {
    if (inv.clientIndex < 0 || inv.clientIndex >= FINESSE_DEMO_CLIENTS.length) {
      errors.push(`Invoice references invalid clientIndex ${inv.clientIndex}`)
    }
    // Date coherence: an overdue invoice must actually be past due; a paid
    // invoice must know when it was paid; a draft carries no due date.
    if (inv.estado === "vencida" && !(typeof inv.dueOffsetDays === "number" && inv.dueOffsetDays < 0)) {
      errors.push(`Overdue invoice ${inv.demoMarker} must have a negative dueOffsetDays`)
    }
    if (inv.estado === "pagada" && typeof inv.paidDaysAgo !== "number") {
      errors.push(`Paid invoice ${inv.demoMarker} must have paidDaysAgo`)
    }
    if (inv.estado !== "pagada" && typeof inv.paidDaysAgo === "number") {
      errors.push(`Invoice ${inv.demoMarker} has paidDaysAgo but is not "pagada"`)
    }
    if (inv.estado === "borrador" && typeof inv.dueOffsetDays === "number") {
      errors.push(`Draft invoice ${inv.demoMarker} must not have a due date`)
    }
  }

  // Workspace tasks: index bounds, cross-references and Today visibility rules.
  const eventMarkers = new Set(FINESSE_DEMO_EVENTS.map((e) => e.demoMarker))
  const convMarkers = new Set(FINESSE_DEMO_CONVERSATIONS.map((c) => c.demoMarker))
  for (const task of FINESSE_DEMO_WORKSPACE_TASKS) {
    if (
      typeof task.clientIndex === "number" &&
      (task.clientIndex < 0 || task.clientIndex >= FINESSE_DEMO_CLIENTS.length)
    ) {
      errors.push(`Workspace task ${task.demoMarker} references invalid clientIndex ${task.clientIndex}`)
    }
    if (task.eventMarker && !eventMarkers.has(task.eventMarker)) {
      errors.push(`Workspace task ${task.demoMarker} references unknown eventMarker ${task.eventMarker}`)
    }
    if (task.conversationMarker && !convMarkers.has(task.conversationMarker)) {
      errors.push(
        `Workspace task ${task.demoMarker} references unknown conversationMarker ${task.conversationMarker}`,
      )
    }
    // Today only surfaces undated tasks for their assignee — an undated task
    // not assigned to the owner would be invisible everywhere.
    if (task.dueHour === undefined && task.assign !== "owner") {
      errors.push(`Undated workspace task ${task.demoMarker} must be assigned to the owner`)
    }
  }

  for (const tarea of FINESSE_DEMO_TAREAS) {
    if (
      typeof tarea.clientIndex === "number" &&
      (tarea.clientIndex < 0 || tarea.clientIndex >= FINESSE_DEMO_CLIENTS.length)
    ) {
      errors.push(`Tarea ${tarea.demoMarker} references invalid clientIndex ${tarea.clientIndex}`)
    }
  }

  // Check email uniqueness
  const emails = FINESSE_DEMO_CLIENTS.map((c) => c.email)
  const uniqueEmails = new Set(emails)
  if (emails.length !== uniqueEmails.size) {
    errors.push("Duplicate emails in clients dataset")
  }

  // Check demo markers: none empty, none duplicated (idempotency depends on them)
  const allMarkers = [
    ...FINESSE_DEMO_EVENTS.map((e) => e.demoMarker),
    ...FINESSE_DEMO_CONVERSATIONS.map((c) => c.demoMarker),
    ...FINESSE_DEMO_INVOICES.map((i) => i.demoMarker),
    ...FINESSE_DEMO_CONTENT_PIECES.map((p) => p.demoMarker),
    ...FINESSE_DEMO_WORKSPACE_TASKS.map((t) => t.demoMarker),
    ...FINESSE_DEMO_TAREAS.map((t) => t.demoMarker),
  ]
  const seenMarkers = new Set<string>()
  for (const marker of allMarkers) {
    if (marker.trim() === "") {
      errors.push("Empty demoMarker in dataset")
    } else if (seenMarkers.has(marker)) {
      errors.push(`Duplicate demoMarker: ${marker}`)
    }
    seenMarkers.add(marker)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Summary of demo dataset sizes.
 */
export function getDemoDatasetSummary() {
  return {
    clients: FINESSE_DEMO_CLIENTS.length,
    events: FINESSE_DEMO_EVENTS.length,
    conversations: FINESSE_DEMO_CONVERSATIONS.length,
    messages: FINESSE_DEMO_CONVERSATIONS.reduce((sum, c) => sum + c.messages.length, 0),
    invoices: FINESSE_DEMO_INVOICES.length,
    contentPieces: FINESSE_DEMO_CONTENT_PIECES.length,
    workspaceTasks: FINESSE_DEMO_WORKSPACE_TASKS.length,
    tareas: FINESSE_DEMO_TAREAS.length,
  }
}

/**
 * Build a deterministic map of clients by email.
 * Isolates from database query order — the seeder resolves each record
 * via email, not array index, so results remain idempotent regardless
 * of how db.cliente.findMany() returns them.
 */
export function buildClientMap(
  clients: Array<{ id: string; email: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const client of clients) {
    if (client.email) {
      map.set(client.email, client.id)
    }
  }
  return map
}

/**
 * Resolve a demo client to their database ID using deterministic email.
 * Returns null if the email is not in the map (should not happen in normal flow).
 */
export function resolveClientId(
  demoClient: Pick<DemoClientData, "email">,
  clientMap: Map<string, string>,
): string | null {
  return clientMap.get(demoClient.email) || null
}
