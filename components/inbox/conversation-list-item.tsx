"use client"

import { useEffect, useRef } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { ConversationMetaLine } from "@/components/inbox/conversation-meta-line"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationListItemProps {
  title: string
  subtitle: string
  intent?: string | null
  timeLabel: string
  selected: boolean
  isUnread: boolean
  onClick: () => void
  channel: string
  statusLabel: string
  statusClassName: string
  channelLabel: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
  messageCount: number
}

export function ConversationListItem({
  title,
  subtitle,
  intent,
  timeLabel,
  selected,
  isUnread,
  onClick,
  channel,
  statusLabel,
  statusClassName,
  channelLabel,
  urgencyLabel,
  urgencyClassName,
  leadScore,
  messageCount,
}: ConversationListItemProps) {
  const itemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!selected) return
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  return (
    <button
      ref={itemRef}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-lg border-b px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
        selected
          ? "border-b-transparent bg-[var(--inbox-list-selected-bg)] ring-1 ring-[var(--inbox-list-selected)]/25"
          : "border-b border-white/[0.06] bg-transparent hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-4 left-0 w-1 rounded-r-full transition-all duration-200",
          selected ? "bg-[var(--inbox-list-selected)] shadow-sm" : "bg-transparent group-hover:bg-[var(--inbox-list-selected)]/30",
        )}
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2.5">
                {isUnread && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--inbox-list-selected)] shadow-sm ring-2 ring-[var(--inbox-list-selected)]/20" aria-hidden="true" />
                )}

                <p
                  className={cn(
                    "truncate pr-1 text-[15px] leading-tight",
                    isUnread ? "font-semibold tracking-tight text-[var(--inbox-list-text)]" : "font-medium text-[var(--inbox-list-text-secondary)]",
                  )}
                >
                  {title}
                </p>
                <ConversationChannelBadge channel={channel} label={channelLabel} selected={selected} />
              </div>
              <p className="truncate text-xs leading-relaxed text-[var(--inbox-list-text-secondary)]">{subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                suppressHydrationWarning
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  isUnread ? "text-[var(--inbox-list-text)] font-semibold" : "text-[var(--inbox-list-text-secondary)]",
                )}
              >
                {timeLabel}
              </span>
              {messageCount > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--inbox-list-background)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)]">
                  <MessageSquare className="h-2.5 w-2.5" />
                  {messageCount}
                </span>
              )}
            </div>
          </div>

          {intent && (
            <p className="mt-2 line-clamp-1 text-[13px] leading-snug text-[var(--inbox-list-text-secondary)]/80">
              {intent}
            </p>
          )}

          <ConversationMetaLine
            statusLabel={statusLabel}
            statusClassName={statusClassName}
            urgencyLabel={urgencyLabel}
            urgencyClassName={urgencyClassName}
            leadScore={leadScore}
          />
        </div>
      </div>
    </button>
  )
}
