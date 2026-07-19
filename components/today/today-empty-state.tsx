"use client"

import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

/**
 * Empty state for the Today view — shown only when ALL three buckets (Overdue,
 * Today, Undated) are empty. Per the PR 1 design rule "show clean empty
 * states, do NOT fabricate content", we deliberately keep this calm and small:
 * no aggressive CTAs, no fake counters, no "create your first task" funnel
 * (PR 1 is read-only — there's no creation surface here).
 *
 * The link to `/inbox` is a soft escape hatch for the operator who lands on
 * Today before any work has accumulated; it's the most common "what next?"
 * destination in the workspace.
 *
 * This intentionally uses a native anchor instead of Next's client-side Link.
 * The CTA must always request the canonical inbox route directly and must never
 * reuse a cached `/inbox/overview` navigation payload from the old destination.
 */
export function TodayEmptyState() {
  const { t } = useI18n()
  const copy = t.today.workboard.emptyState
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-10 text-center",
      )}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2
        className="mx-auto h-8 w-8 text-[var(--status-success-text)]/80"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-medium text-[var(--text-primary-light)]">
        {copy.title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary-light)]">
        {copy.body}
      </p>
      <a
        href="/inbox"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
      >
        {copy.inboxCta}
      </a>
    </div>
  )
}
