"use client"

import {
  Globe,
  Instagram,
  Mail,
  MessageCircle,
  MessageCircleMore,
  MessageSquare,
  MessageSquareText,
  Music2,
  PenSquare,
  Smartphone,
  type LucideIcon,
} from "lucide-react"
import { getInboxChannel, type InboxChannelIconToken } from "@core/inbox/channel-registry"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

interface ConversationChannelBadgeProps {
  channel: string
  label: string
  selected?: boolean
}

/**
 * Icon-token → glyph map. The CHANNEL itself comes from the central registry
 * (`core/inbox/channel-registry.ts`, which also resolves legacy aliases like
 * "web"); only the token → Lucide resolution lives here, because the registry
 * is deliberately icon-library-free. Glyphs stay generic where the channel is
 * generic (we key on `Conversation.channel`, never a provider, so we don't
 * imply Gmail/Outlook/etc. without connection data to back it).
 */
export const ICON_BY_TOKEN: Record<InboxChannelIconToken, LucideIcon> = {
  mail: Mail,
  smartphone: Smartphone,
  "chat-bubble": MessageCircleMore,
  globe: Globe,
  "pen-square": PenSquare,
  instagram: Instagram,
  messenger: MessageCircle,
  "music-note": Music2,
  "message-sms": MessageSquareText,
  generic: MessageSquare,
}

export function ConversationChannelBadge({
  channel,
  label,
  selected = false,
}: ConversationChannelBadgeProps) {
  const { t } = useI18n()
  const Icon = ICON_BY_TOKEN[getInboxChannel(channel)?.iconToken ?? "generic"]

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        selected
          ? "bg-[var(--inbox-surface)] text-[var(--inbox-accent)]"
          : "bg-[var(--inbox-background)] text-[var(--inbox-text-secondary)]",
      )}
      title={t.inbox.channelTitle(label)}
      aria-label={t.inbox.channelTitle(label)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {/*
       * The badge stays `shrink-0` (it is the row's first anchor and must not collapse),
       * but the label itself is capped + truncates so an unexpectedly long channel label
       * can never push the row past the narrow list column width.
       */}
      <span className="max-w-[7rem] truncate">{label}</span>
    </span>
  )
}
