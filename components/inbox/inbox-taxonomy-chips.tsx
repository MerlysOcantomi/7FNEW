"use client"

import { Tag, X } from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import type { WorkspaceTaxonomies } from "@core/workspace-taxonomies"

/**
 * Workspace-level taxonomy chips for the Smart Inbox.
 *
 * Reads `Workspace.config.taxonomies.inbox` (sanitised by
 * `core/workspace-taxonomies.ts`) and surfaces each label as a chip
 * just below the inbox toolbar.
 *
 * Render contract:
 *
 *   - Workspaces WITHOUT taxonomies (empty array, missing key, malformed
 *     config, fetch error, fetch in-flight) → render `null`. The Inbox
 *     of those tenants behaves exactly as before this PR.
 *
 *   - Workspaces WITH taxonomies → render a single full-width row with
 *     a leading "Workspace categories" label, optional "Clear" button,
 *     and one chip per label.
 *
 * Behaviour (controlled component):
 *
 *   The component is a controlled UI primitive. The parent owns the
 *   selection state via `selected` + `onSelectedChange`. Clicking a
 *   chip toggles it on/off; clicking "Clear" forces the selection to
 *   `null`. The component does NOT call any mutation API itself — it
 *   only reflects the selection up so the parent's filtering pipeline
 *   (`conversationsAfterUserFilters` in `app/inbox/page.tsx`) can
 *   apply it client-side against `Conversation.category`.
 *
 *   Categories are assigned manually per conversation via
 *   `<ConversationCategoryEditor>` in the thread header; the backend
 *   route (`PATCH /api/inbox/conversations/[id]/category`) validates
 *   each value against this same taxonomy list, so chip values and
 *   `Conversation.category` values stay in sync.
 *
 * Data source:
 *   `GET /api/workspace/taxonomies` (workspace-scoped, requires VIEWER+).
 *   The endpoint never exposes the raw `Workspace.config` blob — only
 *   the parsed `taxonomies` view.
 */

const TAXONOMY_ENDPOINT = "/api/workspace/taxonomies"

interface ApiPayload {
  taxonomies: WorkspaceTaxonomies
}

interface Props {
  selected: string | null
  onSelectedChange: (value: string | null) => void
}

export function InboxTaxonomyChips({ selected, onSelectedChange }: Props) {
  const { data, loading, error } = useFetch<ApiPayload>(TAXONOMY_ENDPOINT)

  /**
   * Defensive guards — `useFetch` already returns `data: null` while
   * loading and on error, but we also want to treat a successfully
   * fetched empty array exactly like "nothing to show". This collapses
   * every "render nothing" code path into a single `if`.
   */
  const items = data?.taxonomies?.inbox ?? []
  const shouldRender = !loading && !error && items.length > 0
  if (!shouldRender) return null

  /**
   * Drop a stale selection that no longer exists in the current list
   * (e.g. operator removed a label from the taxonomy in another tab).
   * Done at render time as a pure derivation. We deliberately do NOT
   * notify the parent here — the next user click will resolve the
   * stale state, and emitting from a render is bad practice.
   */
  const effectiveSelected = selected && items.includes(selected) ? selected : null

  return (
    <div
      className="shrink-0 rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-list-surface)] px-3 py-2 shadow-[var(--app-shadow-subtle)] md:px-4"
      role="group"
      aria-label="Workspace categories"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
          <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Workspace categories</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((label) => {
            const isActive = effectiveSelected === label
            return (
              <button
                key={label}
                type="button"
                aria-pressed={isActive}
                title={
                  isActive
                    ? `Filtrando por “${label}”. Clic para quitar el filtro.`
                    : `Filtrar por “${label}”.`
                }
                onClick={() =>
                  onSelectedChange(isActive ? null : label)
                }
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-transparent bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)] shadow-[0_0_0_1px_var(--inbox-accent)/40]"
                    : "border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]",
                )}
              >
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {effectiveSelected ? (
          <button
            type="button"
            onClick={() => onSelectedChange(null)}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]"
            aria-label="Clear category filter"
          >
            <X className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Clear</span>
          </button>
        ) : null}
      </div>

      {effectiveSelected ? (
        <p className="mt-1.5 text-[10px] italic leading-snug text-[var(--inbox-list-text-secondary)]/70">
          Mostrando solo conversaciones con categoría{" "}
          <span className="font-semibold not-italic text-[var(--inbox-accent)]">
            {effectiveSelected}
          </span>
          . Las no categorizadas se ocultan mientras el filtro esté activo.
        </p>
      ) : null}
    </div>
  )
}
