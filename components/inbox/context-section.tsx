"use client"

import { cn } from "@/lib/utils"

interface ContextSectionItem {
  label: string
  value: string | number | null | undefined
  href?: string
  tone?: "default" | "accent" | "warning"
}

interface ContextSectionProps {
  title: string
  summary?: string
  items: ContextSectionItem[]
  emptyLabel?: string
}

export function ContextSection({
  title,
  summary,
  items,
  emptyLabel = "No data available yet.",
}: ContextSectionProps) {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined && `${item.value}`.trim() !== "")

  return (
    <section className="space-y-3 rounded-[10px] border border-[var(--inbox-intelligence-border)] bg-white/6 p-3">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--inbox-intelligence-text-secondary)]">
          {title}
        </p>
        {summary && <p className="text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">{summary}</p>}
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const valueClassName =
              item.tone === "accent"
                ? "text-[var(--inbox-accent)]"
                : item.tone === "warning"
                  ? "text-[var(--inbox-warning)]"
                  : "text-[var(--inbox-intelligence-text)]"

            return (
              <div key={`${title}-${item.label}`} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 text-[var(--inbox-intelligence-text-secondary)]">{item.label}</span>
                {item.href ? (
                  <a
                    href={item.href}
                    className={cn(
                      "max-w-[65%] truncate text-right font-medium transition-colors hover:text-[var(--inbox-accent-hover)] hover:underline",
                      valueClassName,
                    )}
                  >
                    {item.value}
                  </a>
                ) : (
                  <span className={cn("max-w-[65%] text-right font-medium", valueClassName)}>{item.value}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
