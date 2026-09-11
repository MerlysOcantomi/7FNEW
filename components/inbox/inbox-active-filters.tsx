"use client"

import { X } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

/**
 * Active-filter tokens row (INBOX-UX-SAFE-01).
 *
 * Presentational and decoupled: the page decides WHICH dimensions are active
 * (URL view outside the chip row, search, channel, status, priority,
 * assignment, category) and how to remove each one; this component only
 * renders them as removable tokens plus one "clear all" action. It renders
 * nothing when there is no token, so mounting it never changes the layout of
 * an unfiltered Inbox.
 *
 * Why it exists: an experience level may hide the control that activated a
 * filter (e.g. Simple hides "More filters"), and a `?filter=` deep link may
 * point outside the chip row. Simplifying must never hide a restriction —
 * every active filter stays visible and one click away from being removed.
 */
export interface InboxActiveFilterToken {
  /** Stable key for React and tests (e.g. "status", "channel", "filter"). */
  key: string
  /** Dimension prefix ("Status") — from the toolbar catalog. */
  dimension: string
  /** Human value ("Archived"). */
  label: string
  onRemove: () => void
}

interface InboxActiveFiltersProps {
  tokens: readonly InboxActiveFilterToken[]
  onClearAll: () => void
  className?: string
}

export function InboxActiveFilters({ tokens, onClearAll, className }: InboxActiveFiltersProps) {
  const { t } = useI18n()
  const m = t.inbox.toolbar.activeFilters
  if (tokens.length === 0) return null
  return (
    <div
      role="group"
      aria-label={m.heading}
      data-testid="inbox-active-filters"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--inbox-list-border)]/60 bg-[var(--inbox-list-background)] px-3 py-1.5 text-[11px]",
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
        {m.heading}
      </span>
      {tokens.map((token) => {
        const text = `${token.dimension}: ${token.label}`
        return (
          <span
            key={token.key}
            className="inline-flex items-center gap-1 rounded-full border border-transparent bg-[var(--inbox-accent)]/15 py-0.5 pl-2.5 pr-1 font-medium text-[var(--inbox-accent)] shadow-[0_0_0_1px_var(--inbox-accent)/40]"
          >
            <span className="whitespace-nowrap">{text}</span>
            <button
              type="button"
              onClick={token.onRemove}
              aria-label={m.remove(text)}
              title={m.remove(text)}
              className="rounded-full p-0.5 transition-colors hover:bg-[var(--inbox-accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        )
      })}
      {tokens.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto rounded-md px-2 py-0.5 font-medium text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--inbox-list-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40"
        >
          {m.clearAll}
        </button>
      ) : null}
    </div>
  )
}
