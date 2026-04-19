"use client"

import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

interface ConversationMetaLineProps {
  statusLabel: string
  statusClassName: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
  sectorLabel?: string | null
}

export function ConversationMetaLine({
  statusLabel,
  statusClassName,
  urgencyLabel,
  urgencyClassName,
  leadScore,
  sectorLabel,
}: ConversationMetaLineProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {sectorLabel ? (
        <span className="rounded-lg border border-[var(--inbox-list-border)] bg-[var(--inbox-list-background)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)]">
          {sectorLabel}
        </span>
      ) : null}
      <Badge
        variant={statusClassName as BadgeVariant}
        className="h-auto rounded-lg border-0 px-2 py-0.5 text-[10px] font-semibold shadow-none"
      >
        {statusLabel}
      </Badge>
      <Badge
        variant={urgencyClassName as BadgeVariant}
        className="h-auto rounded-lg border-0 px-2 py-0.5 text-[10px] font-medium shadow-none"
      >
        {urgencyLabel}
      </Badge>
      {typeof leadScore === "number" && (
        <span className="rounded-lg bg-[var(--inbox-list-selected-bg)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--inbox-list-selected)] shadow-sm">
          Lead {leadScore}
        </span>
      )}
    </div>
  )
}
