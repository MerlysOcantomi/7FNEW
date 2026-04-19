"use client"

import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

/** Colores por significado: respuesta pendiente / lead / nuevo / conversión vs trabajo en curso */
function statusSemanticClasses(status: string): string {
  switch (status) {
    case "awaiting_response":
      return "!border-transparent !bg-[rgba(232,111,116,0.18)] !text-[var(--inbox-destructive)]"
    case "lead_detected":
      return "!border-transparent !bg-[rgba(143,198,162,0.24)] !text-[var(--inbox-success)]"
    case "new":
      return "!border-transparent !bg-[rgba(155,142,245,0.22)] !text-[var(--inbox-unread-color)]"
    case "converted":
      return "!border-transparent !bg-[rgba(143,198,162,0.2)] !text-[var(--inbox-success)]"
    case "assigned":
      return "!border-transparent !bg-[rgba(124,77,255,0.14)] !text-[var(--inbox-accent)]"
    case "triaged":
      return "!border-transparent !bg-[rgba(124,77,255,0.1)] !text-[var(--inbox-accent)]"
    default:
      return ""
  }
}

interface ConversationMetaLineProps {
  conversationStatus: string
  statusLabel: string
  statusClassName: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
  sectorLabel?: string | null
}

export function ConversationMetaLine({
  conversationStatus,
  statusLabel,
  statusClassName,
  urgencyLabel,
  urgencyClassName,
  leadScore,
  sectorLabel,
}: ConversationMetaLineProps) {
  const hideTerminal =
    conversationStatus === "archived" || conversationStatus === "closed"

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {sectorLabel ? (
        <span className="rounded-lg border border-[var(--inbox-list-border)] bg-[var(--inbox-list-background)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)]">
          {sectorLabel}
        </span>
      ) : null}
      {!hideTerminal ? (
        <Badge
          variant={statusClassName as BadgeVariant}
          className={cn(
            "h-auto rounded-lg border-0 px-2 py-0.5 text-[10px] font-semibold shadow-none",
            statusSemanticClasses(conversationStatus),
          )}
        >
          {statusLabel}
        </Badge>
      ) : null}
      {!hideTerminal ? (
        <Badge
          variant={urgencyClassName as BadgeVariant}
          className="h-auto rounded-lg border-0 px-2 py-0.5 text-[10px] font-medium shadow-none"
        >
          {urgencyLabel}
        </Badge>
      ) : null}
      {typeof leadScore === "number" && (
        <span className="rounded-lg bg-[rgba(143,198,162,0.22)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--inbox-success)] shadow-sm">
          Lead {leadScore}
        </span>
      )}
    </div>
  )
}
