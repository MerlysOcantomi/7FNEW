"use client"

import { Globe, Mail, MessageCircleMore, PenSquare, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationChannelBadgeProps {
  channel: string
  label: string
  selected?: boolean
}

const channelMap = {
  email: Mail,
  whatsapp: Smartphone,
  web_chat: MessageCircleMore,
  portal: Globe,
  manual: PenSquare,
  default: MessageCircleMore,
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
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        selected
          ? "bg-[var(--inbox-surface)] text-[var(--inbox-accent)]"
          : "bg-[var(--inbox-background)] text-[var(--inbox-text-secondary)]",
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </span>
  )
}
