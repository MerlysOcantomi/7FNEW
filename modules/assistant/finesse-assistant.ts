/**
 * Ask Finesse — pure contracts, page mapping and Spanish copy for the global
 * Beauty assistant. No React, no DB, no clock — safe on client, server and in
 * tests (mirrors `modules/overview/beauty-overview.ts`).
 *
 * The assistant is page-aware: pages REGISTER a small serializable context
 * (`FinesseAssistantPageContext`) through the provider, and this module maps
 * the current route → page key → contextual suggestions + intro. Context is
 * minimal and explicit — never scraped from the DOM — and the server route
 * re-scopes it to the authenticated workspace before building any prompt.
 */

import type { OverviewPeriodPreset } from "@modules/overview/types"

// ─── Page mapping ────────────────────────────────────────────────────────────

export type FinesseAssistantPageKey =
  | "my-salon"
  | "today"
  | "agenda"
  | "clients"
  | "messages"
  | "catalog"
  | "marketing"
  | "billing"
  | "team"
  | "settings"
  | "other"

/**
 * Route → page key for every surface the Beauty shell mounts. Pure prefix
 * mapping (query strings already stripped by the caller). Unknown routes are
 * honest "other" — generic suggestions, never a wrong context label.
 */
export function resolveFinessePageKey(pathname: string): FinesseAssistantPageKey {
  if (pathname === "/") return "my-salon"
  if (pathname === "/today" || pathname.startsWith("/today/")) return "today"
  if (pathname === "/calendario" || pathname.startsWith("/calendario/")) return "agenda"
  if (pathname === "/clientes" || pathname.startsWith("/clientes/")) return "clients"
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return "messages"
  if (pathname === "/services" || pathname.startsWith("/services/")) return "catalog"
  if (pathname === "/contenido" || pathname.startsWith("/contenido/")) return "marketing"
  if (pathname === "/facturacion" || pathname.startsWith("/facturacion/")) return "billing"
  if (pathname === "/usuarios" || pathname.startsWith("/usuarios/")) return "team"
  if (pathname === "/business-profile" || pathname.startsWith("/business-profile/")) return "settings"
  return "other"
}

// ─── Context contract ────────────────────────────────────────────────────────

/**
 * What a page can register (all optional beyond `page`). Serializable, small
 * and permission-aware by construction: pages only put in what the viewer
 * already sees on screen (e.g. `visibleMetrics` from the overview snapshot).
 */
export interface FinesseAssistantPageContext {
  page: FinesseAssistantPageKey
  section?: string
  selectedEntityType?: string
  selectedEntityId?: string
  period?: { preset: OverviewPeriodPreset; start: string; end: string }
  visibleMetrics?: Record<string, number | string | null>
}

/** The full context the panel sends to the API (workspace added by provider). */
export interface FinesseAssistantContext extends FinesseAssistantPageContext {
  workspaceId: string
  vertical: string
  route: string
  locale?: string
  currency?: string
}

// ─── Conversation contract ───────────────────────────────────────────────────

export interface FinesseAssistantMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export type FinesseAssistantStatus = "idle" | "loading" | "error" | "unavailable"

// ─── Copy (Spanish, España — same convention as the Beauty configs) ──────────

export interface FinesseAssistantCopy {
  /** Launcher label (desktop pill). */
  launcherLabel: string
  /** Accessible name for the icon-only mobile launcher. */
  launcherAria: string
  panelTitle: string
  panelSubtitle: string
  contextLead: string
  pageLabels: Record<FinesseAssistantPageKey, string>
  intros: Record<FinesseAssistantPageKey, string>
  suggestionsTitle: string
  composerPlaceholder: string
  send: string
  close: string
  thinking: string
  /** Honest state when the AI backend is not configured. */
  unavailable: { title: string; description: string }
  error: { title: string; retry: string }
  /** Honesty note: Finesse advises, it does not execute actions. */
  honestyNote: string
  emptyConversation: string
}

export const FINESSE_ASSISTANT_COPY: FinesseAssistantCopy = {
  launcherLabel: "Preguntar a Finesse",
  launcherAria: "Preguntar a Finesse, tu asistente de negocio",
  panelTitle: "Finesse",
  panelSubtitle: "beauty intelligence · by Sevenef",
  contextLead: "Estás en",
  pageLabels: {
    "my-salon": "Mi salón",
    today: "Hoy",
    agenda: "Agenda",
    clients: "Clientes",
    messages: "Mensajes",
    catalog: "Servicios",
    marketing: "Marketing",
    billing: "Cobros",
    team: "Equipo",
    settings: "Ajustes",
    other: "7F Beauty",
  },
  intros: {
    "my-salon": "Puedo explicarte cómo va tu salón este periodo y qué puedes mejorar.",
    today: "Puedo ayudarte a organizar tu día y decidir qué hacer primero.",
    agenda: "Puedo ayudarte con tus citas, huecos libres y horas punta.",
    clients: "Puedo ayudarte a cuidar a tus clientas y detectar quién necesita atención.",
    messages: "Puedo ayudarte a poner orden en tus conversaciones.",
    catalog: "Puedo ayudarte a entender qué servicios funcionan mejor.",
    marketing: "Puedo darte ideas para tu contenido y campañas.",
    billing: "Puedo ayudarte con tus cobros y facturas pendientes.",
    team: "Puedo ayudarte a organizar el trabajo de tu equipo.",
    settings: "Puedo ayudarte a configurar tu espacio de trabajo.",
    other: "Pregúntame lo que necesites sobre tu negocio.",
  },
  suggestionsTitle: "Sugerencias",
  composerPlaceholder: "Escribe tu pregunta…",
  send: "Enviar",
  close: "Cerrar",
  thinking: "Finesse está pensando…",
  unavailable: {
    title: "Finesse aún no está conectada.",
    description:
      "El asistente estará disponible cuando se conecte el servicio de IA. Todo lo demás de tu espacio sigue funcionando con normalidad.",
  },
  error: {
    title: "No he podido responder ahora mismo.",
    retry: "Vuelve a intentarlo en unos segundos.",
  },
  honestyNote:
    "Finesse responde con la información visible en tu espacio. Todavía no ejecuta acciones por ti.",
  emptyConversation: "Elige una sugerencia o escribe tu pregunta.",
}

// ─── Contextual suggestions (mission §8, Spanish) ────────────────────────────

const SUGGESTIONS: Record<FinesseAssistantPageKey, string[]> = {
  "my-salon": [
    "Explícame este periodo",
    "¿Por qué cambiaron mis ingresos?",
    "¿Qué clientas deberían volver?",
    "¿Cómo puedo mejorar el próximo mes?",
  ],
  today: ["¿Qué hago primero?", "Resume mi día", "¿Qué necesita mi atención?"],
  agenda: [
    "Busca hueco libre mañana",
    "¿Cuáles son mis horas punta?",
    "¿Dónde caben dos citas más?",
  ],
  clients: [
    "¿A quién debería volver a contactar?",
    "¿Qué clientas no han vuelto?",
    "Muéstrame mis clientas más fieles",
  ],
  messages: [
    "Resume las conversaciones pendientes",
    "¿Qué mensajes necesitan respuesta?",
  ],
  catalog: ["¿Qué servicio funciona mejor?", "¿Qué debería promocionar?"],
  marketing: [
    "Crea una publicación",
    "Sugiéreme una campaña",
    "Usa mi último trabajo",
    "Ayúdame a llenar huecos libres",
  ],
  billing: ["¿Qué cobros tengo pendientes?", "Resume mis ingresos del periodo"],
  team: ["¿Cómo va el trabajo del equipo?"],
  settings: ["¿Qué me falta por configurar?"],
  other: ["¿Cómo va mi negocio?", "¿Qué necesita mi atención hoy?"],
}

/** Suggestions for a page key — configurable in one place, page-derived. */
export function getFinesseSuggestions(page: FinesseAssistantPageKey): string[] {
  return SUGGESTIONS[page]
}

// ─── Question limits (shared client/server) ──────────────────────────────────

export const FINESSE_MAX_QUESTION_LENGTH = 1000
