"use client"

import { cn } from "@/lib/utils"

interface ConversationMetaLineProps {
  statusLabel: string
  statusClassName: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
}

export function ConversationMetaLine({
  statusLabel,
  statusClassName,
  urgencyLabel,
  urgencyClassName,
  leadScore,
}: ConversationMetaLineProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClassName)}>
        {statusLabel}
      </span>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyClassName)}>
        {urgencyLabel}
      </span>
      {typeof leadScore === "number" && (
        <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-text-secondary)]">
          Lead {leadScore}
        </span>
      )}
    </div>
  )
}
