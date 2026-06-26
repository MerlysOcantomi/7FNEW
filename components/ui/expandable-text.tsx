"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * ExpandableText — Content Density Guard for long copy.
 *
 * Clamps text to a few lines and only reveals a "Read more" toggle when the
 * content actually overflows that clamp (no toggle on short text). Part of the
 * 7F Content Density Guard pattern — see docs/content-density-guard.md.
 *
 * Uses Tailwind's `line-clamp-*` utilities (kept as literal classes so they
 * survive the JIT scan). Theme-aware via tokens; no hardcoded colors.
 */

const CLAMP_CLASS: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
}

export interface ExpandableTextProps {
  children: React.ReactNode
  /** Lines to show when collapsed (1–6). Default 3. */
  lines?: 1 | 2 | 3 | 4 | 5 | 6
  /** Wrapper className (apply text color/size here). */
  className?: string
  /** Inner paragraph className (size/leading). */
  textClassName?: string
  moreLabel?: string
  lessLabel?: string
}

export function ExpandableText({
  children,
  lines = 3,
  className,
  textClassName,
  moreLabel = "Read more",
  lessLabel = "Show less",
}: ExpandableTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      // While clamped, scrollHeight (full) exceeds clientHeight (clamped) when it overflows.
      if (!expanded) setOverflowing(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [children, lines, expanded])

  return (
    <div className={className}>
      <p
        ref={ref}
        className={cn("text-sm leading-relaxed", textClassName, !expanded && CLAMP_CLASS[lines])}
      >
        {children}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-[var(--accent-primary)] transition-opacity hover:opacity-80"
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  )
}
