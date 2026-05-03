"use client"

import { useState } from "react"
import { Loader2, Tag } from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import type { WorkspaceTaxonomies } from "@core/workspace-taxonomies"

/**
 * Inline category selector for a single conversation. Renders as a
 * compact `<select>` so it fits comfortably above the thread without
 * stealing layout from the existing status / channel chrome.
 *
 * Render contract:
 *
 *   - The active workspace has NO inbox taxonomy →
 *     render `null`. Operators in those tenants can't categorise
 *     anything (the API would reject it anyway), so showing an empty
 *     selector would be dead UI.
 *
 *   - Workspace HAS a non-empty taxonomy →
 *     render the selector with an "(uncategorised)" entry on top
 *     followed by every label from `taxonomies.inbox` in the order the
 *     reader returned them (already trimmed + deduped).
 *
 * Behaviour:
 *
 *   - The selector is uncontrolled w.r.t. backend state; the parent
 *     passes the current value via `value` and is responsible for
 *     refreshing whatever it has cached when our `onSaved` callback
 *     fires after a successful PATCH.
 *
 *   - Saving fires `PATCH /api/inbox/conversations/<id>/category` with
 *     `{ category: <string> | null }`. The backend validates against
 *     the same taxonomy list, so a stale chip selection here will be
 *     rejected with a clear error (we surface it as a small inline
 *     message and revert to the last known value).
 *
 *   - Errors are LOCAL: we never throw, never alert(). The thread keeps
 *     working even if categorisation flakes.
 */

const TAXONOMY_ENDPOINT = "/api/workspace/taxonomies"

interface ApiPayload {
  taxonomies: WorkspaceTaxonomies
}

interface Props {
  conversationId: string
  /** Current category from `Conversation.category`. `null` = uncategorised. */
  value: string | null
  /**
   * Called after a successful PATCH with the persisted value. The
   * parent should update its cached `Conversation` row so the next
   * render of the chip filter / list rows reflects the new state.
   */
  onSaved: (next: string | null) => void
  /**
   * `false` for VIEWER-level operators. Selector is rendered disabled
   * with a tooltip; the underlying API also rejects writes from
   * VIEWER, so this is purely UX (no enforcement here).
   */
  canMutate: boolean
}

const UNSET_VALUE = "__unset__"

export function ConversationCategoryEditor({
  conversationId,
  value,
  onSaved,
  canMutate,
}: Props) {
  const { data, loading, error } = useFetch<ApiPayload>(TAXONOMY_ENDPOINT)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const items = data?.taxonomies?.inbox ?? []
  const shouldRender = !loading && !error && items.length > 0
  if (!shouldRender) return null

  /**
   * `value` may carry a label that no longer exists in the taxonomy
   * (e.g. operator deleted it). We normalise the rendered value to the
   * unset sentinel in that case so the `<select>` doesn't silently
   * fall back to its first option (browser default for an unknown
   * `value`). The original DB value is preserved on the row — only
   * the SELECTOR is reset.
   */
  const renderedValue = value && items.includes(value) ? value : UNSET_VALUE

  async function handleChange(rawNext: string) {
    const next = rawNext === UNSET_VALUE ? null : rawNext
    if (next === value) return
    setLocalError(null)
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/category`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: next }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        setLocalError(json?.error?.message ?? "No se pudo actualizar la categoría")
        return
      }
      onSaved(next)
    } catch {
      setLocalError("Error de conexión")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={`conversation-category-${conversationId}`}
        className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80"
      >
        <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Category</span>
      </label>
      <select
        id={`conversation-category-${conversationId}`}
        value={renderedValue}
        onChange={(event) => void handleChange(event.target.value)}
        disabled={!canMutate || submitting}
        title={
          !canMutate
            ? "Requiere rol MEMBER o superior en este workspace"
            : "Asignar categoría del workspace"
        }
        className={cn(
          "h-7 max-w-[200px] rounded-md border border-[var(--inbox-list-border)] bg-transparent px-2 text-[11px] text-[var(--inbox-list-text)] outline-none transition-colors",
          "hover:bg-[var(--inbox-list-background)] focus:border-[var(--inbox-accent)] focus:ring-1 focus:ring-[var(--inbox-accent)]/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <option value={UNSET_VALUE}>(uncategorised)</option>
        {items.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      {submitting ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--inbox-list-text-secondary)]" aria-hidden="true" />
      ) : null}
      {localError ? (
        <span
          role="alert"
          className="text-[10px] italic text-rose-300/90"
          title={localError}
        >
          {localError}
        </span>
      ) : null}
    </div>
  )
}
