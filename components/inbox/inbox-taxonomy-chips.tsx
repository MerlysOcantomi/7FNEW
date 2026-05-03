"use client"

import { useState } from "react"
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
 *     a leading "Workspace categories" label, an optional cleared-state
 *     button, and one chip per label.
 *
 * Behaviour:
 *
 *   This is the **MVP display-only** mode chosen for this PR. Selecting
 *   a chip toggles its visual highlight and stores the selection in
 *   local state, but it **does NOT filter the conversation list**. A
 *   future PR will wire this to a real classification field once the
 *   AI classifier vocabulary is reconciled with the operator-defined
 *   taxonomy. Until then we explicitly avoid pretending to filter:
 *
 *     - The label reads "Workspace categories" — not "Filters".
 *     - Each chip carries a `title` tooltip explaining the status.
 *     - There is no badge / count / filter side-effect on the list.
 *
 * Why no client-side substring match against `subject`/`intent`? The
 * Inbox subjects are free-form and frequently in Spanish, while the
 * operator's taxonomy may be in English ("Lead 7F", "Bug" …). Faking
 * a filter would be misleading. Display-only is the honest MVP.
 *
 * Data source:
 *   `GET /api/workspace/taxonomies` (workspace-scoped, requires VIEWER+).
 *   The endpoint never exposes the raw `Workspace.config` blob — only
 *   the parsed `taxonomies` view.
 *
 * Workspace switch:
 *   The endpoint resolves the active workspace from the session/cookie
 *   context, so a switch causes the next render's fetch to return the
 *   new tenant's taxonomies. Soft refresh (Ctrl/Cmd+R) or remount via
 *   `key={workspaceId}` from the parent picks up the change.
 */

const TAXONOMY_ENDPOINT = "/api/workspace/taxonomies"

interface ApiPayload {
  taxonomies: WorkspaceTaxonomies
}

export function InboxTaxonomyChips() {
  const { data, loading, error } = useFetch<ApiPayload>(TAXONOMY_ENDPOINT)

  /**
   * Local UI state. `null` means "no chip selected"; the row's "Clear"
   * button resets to that state. We keep it as `string | null` instead
   * of indexing the array so the value survives even if the operator
   * edits/reorders the canonical list in another tab — the chip we no
   * longer render is dropped silently below.
   */
  const [selected, setSelected] = useState<string | null>(null)

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
   * Done at render time rather than via `useEffect` because it's a pure
   * derivation; storing it in state would just create one extra render.
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
                title="Selecting a category does not filter conversations yet — automatic classification will arrive in a future update."
                onClick={() =>
                  setSelected((current) => (current === label ? null : label))
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
            onClick={() => setSelected(null)}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]"
            aria-label="Clear category selection"
          >
            <X className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Clear</span>
          </button>
        ) : null}
      </div>

      {/*
       * Helper microcopy. We render it once per row (not per chip) to
       * avoid noise; the `title` tooltip on each chip stays for hover-
       * level discovery. Italic + low-emphasis to make clear the row is
       * informational, not a working filter.
       */}
      <p className="mt-1.5 text-[10px] italic leading-snug text-[var(--inbox-list-text-secondary)]/70">
        Vocabulario del workspace para clasificar mensajes. Aún no filtra
        la lista — la conexión al clasificador llegará en una próxima
        actualización.
      </p>
    </div>
  )
}
