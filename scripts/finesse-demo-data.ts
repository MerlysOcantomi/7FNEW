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
  demoMarker?: string
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
  demoMarker?: string
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
  /** Demo marker for idempotent updates */
  demoMarker?: string
}

export const FINESSE_DEMO_INVOICES: DemoInvoiceData[] = [
  {
    clientIndex: 0,
    estado: "pagada",
    subtotal: 100,
    impuesto: 21,
    descripcion: "Manicura + Pedicura",
    daysAgo: 0,
    demoMarker: "FINESSE_DEMO:invoice:001",
  },
  {
    clientIndex: 1,
    estado: "pagada",
    subtotal: 150,
    impuesto: 31.5,
    descripcion: "Gel Nail Art",
    daysAgo: 3,
    demoMarker: "FINESSE_DEMO:invoice:002",
  },
  {
    clientIndex: 2,
    estado: "enviada",
    subtotal: 200,
    impuesto: 42,
    descripcion: "Facial rejuvenecedor",
    daysAgo: 1,
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
    descripcion: "Manicura mantencimiento",
    daysAgo: 15,
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
  demoMarker?: string
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
  }

  // Check email uniqueness
  const emails = FINESSE_DEMO_CLIENTS.map((c) => c.email)
  const uniqueEmails = new Set(emails)
  if (emails.length !== uniqueEmails.size) {
    errors.push("Duplicate emails in clients dataset")
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
  demoClient: DemoClientData,
  clientMap: Map<string, string>,
): string | null {
  return clientMap.get(demoClient.email) || null
}
