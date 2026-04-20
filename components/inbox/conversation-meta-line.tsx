"use client"

import { Badge, badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

function statusForSemantics(status: string): string {
  return status === "triaged" ? "assigned" : status
}

/** Semántica de color restringida: ámbar = lead oportunidad, verde = convertido, rojo = urgencia/riesgo, azul suave = nuevo, neutro donde aplica. */
function statusSemanticClasses(status: string): string {
  const s = statusForSemantics(status)
  switch (s) {
    case "awaiting_response":
      return "!border !border-[rgba(232,111,116,0.32)] !bg-[rgba(232,111,116,0.12)] !text-[var(--inbox-destructive)]"
    case "lead_detected":
      return "!border !border-[rgba(242,198,109,0.35)] !bg-[rgba(242,198,109,0.14)] !text-[var(--inbox-lead-color)]"
    case "new":
      return "!border !border-[rgba(147,197,253,0.22)] !bg-[rgba(59,130,246,0.1)] !text-[#93C5FD]"
    case "converted":
      return "!border !border-[rgba(143,198,162,0.28)] !bg-[rgba(143,198,162,0.14)] !text-[var(--inbox-success)]"
    case "assigned":
      return "!border !border-white/[0.1] !bg-white/[0.06] !text-[var(--inbox-list-text-secondary)]"
    default:
      return "!border !border-white/[0.08] !bg-white/[0.05] !text-[var(--inbox-list-text-secondary)]"
  }
}

/** Prioridad alta / crítica: mismo tono rojo que awaiting (atención fuerte); media/baja discretas. */
function urgencySoftClasses(urgencyVariant: string): string {
  switch (urgencyVariant) {
    case "urgency-critical":
    case "urgency-high":
      return "!border !border-[rgba(232,111,116,0.32)] !bg-[rgba(232,111,116,0.12)] !text-[var(--inbox-destructive)] shadow-none"
    case "urgency-medium":
      return "!border !border-white/[0.08] !bg-white/[0.07] !text-[var(--inbox-list-text-secondary)] shadow-none"
    case "urgency-low":
      return "!border !border-white/[0.06] !bg-white/[0.05] !text-[var(--inbox-list-text-secondary)]/85 shadow-none"
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
    conversationStatus === "archived" ||
    conversationStatus === "closed" ||
    conversationStatus === "trashed"

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {sectorLabel ? (
        <span className="rounded-md border border-[var(--inbox-list-border)] bg-[var(--inbox-list-background)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)]">
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
          className={cn(
            "h-auto rounded-md border-0 px-2 py-0.5 text-[10px] font-medium shadow-none",
            urgencySoftClasses(urgencyClassName),
          )}
        >
          {urgencyLabel}
        </Badge>
      ) : null}
      {typeof leadScore === "number" && (
        <span className="rounded-md border border-[rgba(242,198,109,0.35)] bg-[rgba(242,198,109,0.12)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--inbox-lead-color)] shadow-none">
          Lead {leadScore}
        </span>
      )}
    </div>
  )
}
