/**
 * Ask Finesse — pure contracts and page mapping for the global Beauty
 * assistant. No React, no DB, no clock — safe on client, server and in
 * tests (mirrors `modules/overview/beauty-overview.ts`). All visible copy
 * lives in the localized catalogs under `./i18n` (English base, five official
 * locales), resolved from the effective `useI18n()` locale by the components.
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
  /** How the turn originated. Absent = "text" (pre-voice messages). */
  inputMode?: "text" | "voice"
  /**
   * Voice turns stream: `partial` while transcribing, `final` once settled,
   * `interrupted` when a barge-in cut the assistant short (the partial text is
   * kept, honestly marked, never presented as a complete answer).
   */
  status?: "partial" | "final" | "interrupted" | "error"
}

export type FinesseAssistantStatus = "idle" | "loading" | "error" | "unavailable"

// ─── Question limits (shared client/server) ──────────────────────────────────

export const FINESSE_MAX_QUESTION_LENGTH = 1000

// ─── Voice ↔ conversation merge (pure, id-keyed — one visible conversation) ──

export interface VoiceMessageUpdate {
  id: string
  role: "user" | "assistant"
  content: string
  status: "partial" | "final" | "interrupted"
}

/**
 * Upsert a voice turn into the shared conversation. Keyed by Realtime item id:
 * a partial transcript is REPLACED by its final text (never duplicated), and a
 * finalized/interrupted turn is never downgraded by a late partial.
 */
export function applyVoiceMessage(
  messages: FinesseAssistantMessage[],
  update: VoiceMessageUpdate,
): FinesseAssistantMessage[] {
  const index = messages.findIndex((m) => m.id === update.id)
  if (index === -1) {
    return [
      ...messages,
      {
        id: update.id,
        role: update.role,
        content: update.content,
        inputMode: "voice",
        status: update.status,
      },
    ]
  }
  const existing = messages[index]
  if (existing.status === "final" || existing.status === "interrupted") return messages
  if (existing.content === update.content && existing.status === update.status) return messages
  const next = [...messages]
  next[index] = { ...existing, content: update.content, status: update.status }
  return next
}

/**
 * Mark a streaming ASSISTANT voice turn as interrupted (barge-in). Its partial
 * text is kept but honestly marked — never presented as a complete answer.
 * No-op for user turns, unknown ids, or already-final answers.
 */
export function markVoiceMessageInterrupted(
  messages: FinesseAssistantMessage[],
  id: string,
): FinesseAssistantMessage[] {
  let changed = false
  const next = messages.map((m) => {
    if (m.id === id && m.role === "assistant" && m.status !== "final" && m.status !== "interrupted") {
      changed = true
      return { ...m, status: "interrupted" as const }
    }
    return m
  })
  return changed ? next : messages
}

/**
 * Short, safe summary of the finalized conversation for a new voice session —
 * the last few turns, clipped per turn. NEVER the unlimited transcript.
 */
export function buildVoiceConversationSummary(
  messages: FinesseAssistantMessage[],
  { maxTurns = 4, maxCharsPerTurn = 120 }: { maxTurns?: number; maxCharsPerTurn?: number } = {},
): string | null {
  const finalized = messages.filter((m) => m.status !== "partial" && m.content.trim().length > 0)
  if (finalized.length === 0) return null
  return finalized
    .slice(-maxTurns)
    .map((m) => `${m.role === "user" ? "User" : "Finesse"}: ${m.content.slice(0, maxCharsPerTurn)}`)
    .join("\n")
}

// ─── Server-side context sanitation (shared by the text + voice routes) ──────

/**
 * Whitelist-sanitize a client-published page context. Server routes call this
 * BEFORE building any prompt; workspace/vertical are then re-derived from the
 * AUTHENTICATED workspace — never taken from the payload.
 */
export function sanitizeFinesseContext(raw: unknown): Partial<FinesseAssistantContext> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const out: Partial<FinesseAssistantContext> = {}

  const str = (v: unknown, max = 120): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : undefined

  out.page = str(source.page) as FinesseAssistantContext["page"] | undefined
  out.route = str(source.route)
  out.section = str(source.section)
  out.selectedEntityType = str(source.selectedEntityType)
  out.selectedEntityId = str(source.selectedEntityId)
  out.locale = str(source.locale, 20)
  out.currency = str(source.currency, 8)

  const period = source.period
  if (period && typeof period === "object" && !Array.isArray(period)) {
    const p = period as Record<string, unknown>
    const preset = str(p.preset, 12)
    const start = str(p.start, 12)
    const end = str(p.end, 12)
    if (preset && start && end) {
      out.period = {
        preset: preset as NonNullable<FinesseAssistantContext["period"]>["preset"],
        start,
        end,
      }
    }
  }

  const metrics = source.visibleMetrics
  if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
    const entries = Object.entries(metrics as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" || typeof v === "string" || v === null)
      .slice(0, 24) as Array<[string, number | string | null]>
    if (entries.length > 0) out.visibleMetrics = Object.fromEntries(entries)
  }

  return out
}
