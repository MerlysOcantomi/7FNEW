"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * PreviewList — Content Density Guard for list-heavy sections.
 *
 * Shows a useful preview (first N items) and a single contextual affordance to
 * reach the rest, so cards/panels never grow endlessly. Part of the 7F Content
 * Density Guard pattern — see docs/content-density-guard.md.
 *
 * Critical-safety: `isPinned` items ALWAYS appear in the preview even if they
 * fall past `previewCount`, so a high-risk row is never hidden behind "View
 * all". The footer always surfaces the hidden count.
 *
 * Three affordance variants:
 *   - "expand" — toggles the full list inline (Show less to collapse).
 *   - "link"   — navigates to `href` (the canonical full view).
 *   - "action" — calls `onMore` (e.g. switch a lens / open a panel).
 */

type MoreLabel = string | ((remaining: number) => string)

export interface PreviewListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  /** Items to show before collapsing. Default 5. */
  previewCount?: number
  /** Pinned items always show in the preview (e.g. overdue / high-risk). */
  isPinned?: (item: T) => boolean
  getKey?: (item: T, index: number) => string | number
  variant?: "expand" | "link" | "action"
  href?: string
  onMore?: () => void
  /** Footer text; receives the hidden count. Default `View all (N)`. */
  moreLabel?: MoreLabel
  lessLabel?: string
  className?: string
  listClassName?: string
  footerClassName?: string
}

export function PreviewList<T>({
  items,
  renderItem,
  previewCount = 5,
  isPinned,
  getKey,
  variant = "expand",
  href,
  onMore,
  moreLabel = (n) => `View all (${n})`,
  lessLabel = "Show less",
  className,
  listClassName,
  footerClassName,
}: PreviewListProps<T>) {
  const [expanded, setExpanded] = useState(false)

  const { previewIndices, hiddenCount } = useMemo(() => {
    if (items.length <= previewCount) {
      return { previewIndices: items.map((_, i) => i), hiddenCount: 0 }
    }
    const shown = new Set<number>()
    for (let i = 0; i < previewCount; i++) shown.add(i)
    if (isPinned) {
      // Guarantee critical rows are visible even past the preview cutoff.
      items.forEach((item, i) => {
        if (i >= previewCount && isPinned(item)) shown.add(i)
      })
    }
    const previewIndices = Array.from(shown).sort((a, b) => a - b)
    return { previewIndices, hiddenCount: items.length - previewIndices.length }
  }, [items, previewCount, isPinned])

  const indices = expanded ? items.map((_, i) => i) : previewIndices
  const key = (item: T, i: number) => (getKey ? getKey(item, i) : i)
  const label = typeof moreLabel === "function" ? moreLabel(hiddenCount) : moreLabel

  const showFooter = hiddenCount > 0 || (variant === "expand" && expanded)

  return (
    <div className={className}>
      <div className={listClassName}>
        {indices.map((i) => (
          <Fragment key={key(items[i], i)}>{renderItem(items[i], i)}</Fragment>
        ))}
      </div>

      {showFooter && (
        <div className="mt-2">
          {variant === "link" && href ? (
            <Link href={href} className={cn(FOOTER_BASE, footerClassName)}>
              {label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : variant === "action" ? (
            <button type="button" onClick={onMore} className={cn(FOOTER_BASE, footerClassName)}>
              {label}
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(FOOTER_BASE, footerClassName)}
            >
              {expanded ? lessLabel : label}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const FOOTER_BASE =
  "inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-primary)] transition-opacity hover:opacity-80"
