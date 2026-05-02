import type { ClientInboxTodo } from "@/components/inbox/inbox-todo-list-item"

/**
 * Client-side helper for creating a To-do via the existing `/api/inbox/todos` POST endpoint.
 *
 * Centralized because Phase 3 introduces three capture surfaces (Smart Hub pending items,
 * Message actions in the composer, internal-note TODO suggestion) and we don't want each one
 * re-implementing fetch + error parsing. The helper is intentionally minimal:
 *  - No optimistic UI here — let the caller decide when to flip its local state.
 *  - No automatic refresh of the To-do view list — the caller knows whether `isTodoMode` is
 *    active and can bump its refresh key directly.
 *  - Always includes `credentials: "same-origin"` so the workspace session cookie is sent.
 *
 * Throws on transport errors. Returns `{ success: false, error }` on validation failures so
 * UI surfaces can render them without losing the wrapping try/catch shape.
 */

export interface CreateTodoRequest {
  title: string
  description?: string | null
  conversationId?: string | null
  sourceMessageId?: string | null
  sourceActionId?: string | null
  sourceNoteId?: string | null
  status?: ClientInboxTodo["status"]
  priority?: ClientInboxTodo["priority"]
  assigneeType?: ClientInboxTodo["assigneeType"]
  assigneeId?: string | null
  dueAt?: string | null
  remindAt?: string | null
  /** `operator` (default), `ai_pending_item`, `operator_message`, `internal_note`, etc. */
  createdSource?: string
  metadata?: Record<string, unknown> | null
}

export interface CreateTodoResult {
  success: boolean
  todo?: ClientInboxTodo
  error?: string
}

/**
 * Truncate a long string at a word boundary up to `max` chars. Used to derive a sensible
 * `title` from a message body when no shortIntent is available.
 */
export function truncateForTitle(text: string, max = 120): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  const sliced = cleaned.slice(0, max)
  const lastSpace = sliced.lastIndexOf(" ")
  return (lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:.\-]+$/, "") + "…"
}

/**
 * Map conversation urgency (`baja|media|alta|critica`) to InboxTodo priority. Returns `normal`
 * for unknown or absent urgency so a missing classification never inflates priority noise.
 */
export function priorityFromUrgency(urgency: string | null | undefined): ClientInboxTodo["priority"] {
  switch ((urgency ?? "").toLowerCase()) {
    case "critica":
      return "urgent"
    case "alta":
      return "high"
    case "baja":
      return "low"
    default:
      return "normal"
  }
}

const TODO_PREFIX_RE = /^\s*(?:to-?do|pendiente)\s*:\s*/i

/**
 * Detect an internal-note prefix that asks for a To-do. Returns the title (text after the
 * prefix, trimmed) or `null` when the note doesn't match. Recognized prefixes:
 *   - `TODO:` / `To-do:` / `to-do:` (any case, optional dash)
 *   - `Pendiente:` / `pendiente:` (Spanish)
 * The regex is anchored to the start so a TODO mention mid-paragraph doesn't trigger.
 */
export function detectInternalNoteTodo(content: string): string | null {
  if (!content) return null
  const match = content.match(TODO_PREFIX_RE)
  if (!match) return null
  const remainder = content.slice(match[0].length).trim()
  return remainder.length > 0 ? remainder : null
}

export async function createTodoOnServer(input: CreateTodoRequest): Promise<CreateTodoResult> {
  try {
    const response = await fetch("/api/inbox/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    })
    const json = (await response.json().catch(() => ({}))) as {
      success?: boolean
      data?: ClientInboxTodo
      error?: string | { message?: string }
    }
    if (!response.ok || !json?.success || !json?.data) {
      const errorMessage =
        typeof json?.error === "string"
          ? json.error
          : (json?.error && typeof json.error === "object" && typeof json.error.message === "string"
              ? json.error.message
              : "Could not create to-do")
      return { success: false, error: errorMessage }
    }
    return { success: true, todo: json.data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not create to-do",
    }
  }
}
