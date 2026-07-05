/**
 * Pure derivation layer for the Inbox conversation list.
 *
 * This module owns the client-side list transformations that used to live
 * inline in `app/inbox/page.tsx` as `useMemo` bodies. It is intentionally
 * pure: no React, no hooks, no database, no server actions, no workspace
 * context, no side effects, and no logging. The page keeps thin `useMemo`
 * wrappers that call these functions so behavior is byte-for-byte identical
 * while the logic becomes unit-testable with `node:test` (see
 * `docs/inbox-pipeline-testing.md` and `list-derivation.test.ts`).
 *
 * IMPORTANT — server vs client filtering: most filter dimensions (search `q`,
 * status, urgency, channel, assignment, category) are applied SERVER-SIDE via
 * the `/api/inbox/conversations` query string and are NOT part of this module.
 * The only client-side derivations are:
 *   - `mapSidebarFilter`      : URL `?filter=` → API query shape
 *   - `resolvePrimaryWorkFilter`: URL `?filter=` → work-chip highlight value
 *   - `selectSidebarConversations` / `selectListConversations`: the "All"
 *     terminal-status strip + the degradation fallback
 *   - `computeTerminalRescueActive`: the "everything is archived/closed/trash"
 *     rescue predicate
 *   - `applyIntentStatusFilter`: the `Message.metadata.intentStatus` work filter
 *   - `buildStatusFilterOptions` / `buildStatusEditOptions`: status <Select>
 *     option builders
 *
 * The conversation-shaped functions are generic over the element type so the
 * page keeps its local `ConversationListItem` typing without moving the
 * interface out of the component.
 */

import { statusLabel, statusLabelDisplay } from "@/lib/inbox-labels"

/** Ordered status values surfaced by the status filter/editor selects. */
export const STATUS_OPTIONS = [
  "all",
  "new",
  "triaged",
  "assigned",
  "awaiting_response",
  "lead_detected",
  "resolved",
  "converted",
  "closed",
  "archived",
  "trashed",
]

/** Channel values surfaced by the channel filter select. */
export const CHANNEL_OPTIONS = ["all", "manual", "web_chat", "email", "portal", "whatsapp"]

/**
 * Map sidebar `?filter=` URL values to the API query shape (`status` + `urgency`). The new
 * operational sidebar (Smart Inbox / Work / Smart views / Storage) drives the labels below;
 * legacy keys (`new`, `in_progress`, `urgent`, `needs_reply`, `leads`) are kept as aliases
 * so existing bookmarks, notifications, and links don't 404 silently. Unknown filters fall
 * through to `{}` (default Inbox view) which is also what `todo` and `scheduled` use today —
 * those are placeholder nav entries for future engines (To-do queue, Scheduled-by-EventHint).
 */
export function mapSidebarFilter(filter: string | null): { status?: string; urgency?: string } {
  switch (filter) {
    /** ─ Storage ─ */
    case "archived": return { status: "archived" }
    case "closed": return { status: "closed" }
    case "trash": return { status: "trashed" }
    /** ─ Work ─ */
    /**
     * "Needs action" = conversations where someone on our side has to do something next.
     * `new` (untouched), `assigned` (operator owns it), `triaged` (AI classified, waiting
     * for human), `lead_detected` (qualified opportunity that needs follow-up). We
     * intentionally exclude `awaiting_response` here because that's "we replied, waiting on
     * them" — surfaced in the Waiting bucket instead.
     */
    case "needs_action": return { status: "new,assigned,triaged,lead_detected" }
    /** "Waiting" = we're waiting on the customer / external party to respond. */
    case "waiting": return { status: "awaiting_response" }
    /**
     * "Done" = work that's finished from the operator's perspective. Includes the new
     * `resolved` (work done, conversation stays active for follow-ups), `closed` (terminal),
     * and `converted` (turned into Cliente / Proyecto / Tarea). Storage's "Closed" sub-link
     * narrows this further to just `closed` for archival browsing.
     */
    case "done": return { status: "resolved,closed,converted" }
    /**
     * "To-do" is a placeholder for the future action queue. Routes to /inbox so the active
     * highlight works; `{}` returned here means no extra status filter is applied — the
     * page falls back to the default Inbox view. Replacing this single arm is all that's
     * needed when the To-do engine ships.
     */
    case "todo": return {}
    /** ─ Smart views ─ */
    case "opportunities": return { status: "lead_detected" }
    /**
     * "Scheduled" placeholder — will eventually filter by Message.metadata EventHint or by
     * ConversationAction.type === "create_event". Returning `{}` keeps the active highlight
     * working without breaking the list.
     */
    case "scheduled": return {}
    /** ─ Legacy aliases (preserve external bookmarks) ─ */
    case "new": return { status: "new" }
    case "in_progress": return { status: "assigned,awaiting_response,triaged" }
    case "urgent": return { urgency: "alta,critica" }
    case "needs_reply": return { status: "awaiting_response" }
    case "leads": return { status: "lead_detected" }
    default: return {}
  }
}

/** Work-chip highlight value derived from the sidebar `?filter=`. */
export type PrimaryWorkFilter = "all" | "needs_action" | "waiting" | "done" | "other"

/**
 * Resolve the primary Work-filter chip highlight from the sidebar `?filter=` URL value.
 * Anything outside the four daily values maps to "other" so no chip is highlighted.
 */
export function resolvePrimaryWorkFilter(sidebarFilter: string | null): PrimaryWorkFilter {
  if (!sidebarFilter || sidebarFilter === "inbox") return "all"
  if (sidebarFilter === "needs_action") return "needs_action"
  if (sidebarFilter === "waiting") return "waiting"
  if (sidebarFilter === "done") return "done"
  return "other"
}

/**
 * Best-effort metadata parser for client-side reads. Returns an object form regardless of
 * whether the source already pre-parsed it or left it as a JSON string. We never throw — a
 * corrupted blob is treated as "no metadata", which keeps the UI in a safe default state.
 */
export function readMessageMetadata(
  raw: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== "string" || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** True when a message has been soft-trashed via Message.metadata.trashedAt. */
export function isMessageTrashed(
  meta: string | Record<string, unknown> | null | undefined,
): boolean {
  const parsed = readMessageMetadata(meta)
  if (!parsed) return false
  return typeof parsed.trashedAt === "string" && parsed.trashedAt.length > 0
}

/**
 * Infer the intent status of a conversation as a whole, based on the most recent inbound
 * (non-internal) message's `metadata.intentStatus`. Returns "done" when explicitly marked,
 * "open" otherwise (including "no metadata" / "no inbound" — the default before any operator
 * action is open work).
 *
 * The helper is shared by the Work filter and could be reused server-side later. We read
 * messages defensively because the list endpoint returns `messages` newest-first (top 5).
 */
export interface IntentStatusMessage {
  direction?: string | null
  isInternal?: boolean | null
  metadata?: string | Record<string, unknown> | null
  createdAt?: string | Date | null
}

export function inferConversationIntentStatus(
  conversation: { messages?: ReadonlyArray<IntentStatusMessage> | null },
): "open" | "done" {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : []
  if (messages.length === 0) return "open"

  /** The list endpoint returns messages ordered by createdAt desc, so the first inbound match
   *  is also the latest one. We tolerate either ordering by tie-breaking on createdAt when
   *  available — defensive in case some caller passes ascending arrays. Trashed messages are
   *  skipped: they're invisible to Fanny and the operator's mental model treats them as if
   *  they were never sent. */
  let candidate: IntentStatusMessage | null = null
  let candidateTs = -Infinity
  for (const m of messages) {
    if (m.direction !== "inbound") continue
    if (m.isInternal === true) continue
    if (isMessageTrashed(m.metadata)) continue
    const ts = m.createdAt ? new Date(m.createdAt as string | Date).getTime() : 0
    if (ts > candidateTs) {
      candidate = m
      candidateTs = ts
    }
  }
  if (!candidate) return "open"

  const parsed = readMessageMetadata(candidate.metadata)
  if (!parsed) return "open"
  return parsed.intentStatus === "done" ? "done" : "open"
}

/** Minimal structural shape the list-strip functions read off each conversation row. */
interface StatusBearingConversation {
  status: string
}

/**
 * Vista "All statuses": ocultar cerradas/archivadas/papelera en la lista principal.
 * Rescate: si ese filtro deja 0 filas pero la API sí devolvió conversaciones (p. ej. todas
 * archivadas), mostrar la lista completa para no vaciar el inbox.
 *
 * Excepción: si la sidebar está pidiendo explícitamente un status (?filter=archived|trash|...),
 * ya hicimos pasar ese status al backend, así que confiamos en lo que devolvió y no aplicamos
 * el strip cliente — si no, el operador haría click en "Trash" y vería 0 filas porque
 * estaríamos re-ocultando justo lo que la API acaba de filtrar.
 *
 * `status` is the active status-filter select value ("all" means no explicit status);
 * `filterStatus` is the sidebar-derived status (`mapSidebarFilter(...).status`), if any.
 */
export function selectSidebarConversations<T extends StatusBearingConversation>(
  conversations: ReadonlyArray<T>,
  status: string,
  filterStatus: string | undefined,
): T[] {
  if (status !== "all") return [...conversations]
  if (filterStatus) return [...conversations]
  const filtered = conversations.filter(
    (c) => c.status !== "archived" && c.status !== "closed" && c.status !== "trashed",
  )
  if (filtered.length === 0 && conversations.length > 0) {
    return [...conversations]
  }
  return filtered
}

/**
 * Lista única para pintar/seleccionar/navegar: mismo filtro que `selectSidebarConversations`,
 * pero si ese filtro deja 0 filas y la API sí devolvió datos, degradamos a la lista completa.
 */
export function selectListConversations<T>(
  conversations: ReadonlyArray<T>,
  sidebarConversations: ReadonlyArray<T>,
): T[] {
  if (conversations.length === 0) return []
  if (sidebarConversations.length > 0) return [...sidebarConversations]
  return [...conversations]
}

/**
 * Apply the client-side Work filter on top of the existing server-side filters. It depends on
 * `Message.metadata.intentStatus` (a JSON sub-field SQLite cannot index efficiently), so it
 * runs client-side. `intentStatusFilter` is one of "all" | "open" | "done".
 */
export function applyIntentStatusFilter<T extends { messages?: ReadonlyArray<IntentStatusMessage> | null }>(
  conversations: ReadonlyArray<T>,
  intentStatusFilter: string,
): T[] {
  if (intentStatusFilter === "all") {
    return [...conversations]
  }
  return conversations.filter((c) => {
    const status = inferConversationIntentStatus(c)
    if (intentStatusFilter === "done" && status !== "done") return false
    if (intentStatusFilter === "open" && status === "done") return false
    return true
  })
}

/**
 * True cuando en "All" ninguna fila pasa el filtro activo (todo archivo/cerrado/papelera) y el
 * rescate muestra la lista completa. Mirrors the predicate behind the terminal-rescue banner.
 */
export function computeTerminalRescueActive<T extends StatusBearingConversation>(
  conversations: ReadonlyArray<T>,
  status: string,
): boolean {
  if (status !== "all" || conversations.length === 0) return false
  const activeRows = conversations.filter(
    (c) => c.status !== "archived" && c.status !== "closed" && c.status !== "trashed",
  )
  return activeRows.length === 0
}

/** Option shape consumed by the status `<Select>` components. */
export interface StatusOption {
  value: string
  label: string
}

/** Build the status FILTER options (list toolbar). Excludes the internal `triaged` value. */
export function buildStatusFilterOptions(uiLocale?: string | null): StatusOption[] {
  return STATUS_OPTIONS.filter((s) => s !== "triaged").map((s) => ({
    value: s,
    label: s === "all" ? "All statuses" : statusLabel(s, uiLocale),
  }))
}

/**
 * Build the status EDIT options (per-conversation editor). `selectedStatus` is the currently
 * selected conversation's status, which gates the special-cased `triaged`/`trashed` rows.
 */
export function buildStatusEditOptions(
  selectedStatus: string | null | undefined,
  uiLocale?: string | null,
): StatusOption[] {
  if (selectedStatus === "trashed") {
    return [{ value: "triaged", label: statusLabelDisplay("triaged", uiLocale) }]
  }
  const base = STATUS_OPTIONS.filter((s) => s !== "all" && s !== "triaged").map((s) => ({
    value: s,
    label: statusLabel(s, uiLocale),
  }))
  if (selectedStatus === "triaged") {
    return [{ value: "triaged", label: statusLabelDisplay("triaged", uiLocale) }, ...base]
  }
  return base
}
