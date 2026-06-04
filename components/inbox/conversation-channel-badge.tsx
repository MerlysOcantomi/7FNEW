"use client"

import { Globe, Mail, MessageCircleMore, MessageSquare, PenSquare, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationChannelBadgeProps {
  channel: string
  label: string
  selected?: boolean
}

/**
 * Channel → icon map. Deliberately GENERIC (no brand/provider marks): we key on
 * the transport channel (`Conversation.channel`), not the provider, so we never
 * imply Gmail/Outlook/etc. without connection data to back it. Each channel gets
 * a visually distinct glyph so the source is recognisable at a glance in the
 * narrow list column:
 *   email      → Mail            (envelope)
 *   whatsapp   → Smartphone      (phone-based messenger — distinct from web chat)
 *   web_chat   → MessageCircleMore (rounded chat bubble)
 *   portal     → Globe           (client portal / web)
 *   manual     → PenSquare       (operator-typed)
 *   default    → MessageSquare   (unknown channel — distinct from web_chat above)
 */
const channelMap = {
  email: Mail,
  whatsapp: Smartphone,
  web_chat: MessageCircleMore,
  web: MessageCircleMore,
  portal: Globe,
  manual: PenSquare,
  default: MessageSquare,
} as const

export function ConversationChannelBadge({
  channel,
  label,
  selected = false,
}: ConversationChannelBadgeProps) {
  const Icon = channelMap[channel as keyof typeof channelMap] ?? channelMap.default

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        selected
          ? "bg-[var(--inbox-surface)] text-[var(--inbox-accent)]"
          : "bg-[var(--inbox-background)] text-[var(--inbox-text-secondary)]",
      )}
      title={`Channel: ${label}`}
      aria-label={`Channel: ${label}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
