"use client"

import type { LucideIcon } from "lucide-react"
import { BTN_PRIMARY, CARD_CLASS } from "./marketing-ui"

/** Shared empty state for the Marketing sections (photos, posts, campaigns). */
export function MarketingEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}) {
  return (
    <div className={`${CARD_CLASS} flex flex-col items-center justify-center gap-2 text-center ${compact ? "p-5" : "p-8"}`}>
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-full"
        style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
      >
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <p className="text-[13.5px] font-semibold text-[var(--text-primary-light)]">{title}</p>
      {description ? (
        <p className="max-w-sm text-[12px] leading-relaxed text-[var(--text-secondary-light)]">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={`${BTN_PRIMARY} mt-2`}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
