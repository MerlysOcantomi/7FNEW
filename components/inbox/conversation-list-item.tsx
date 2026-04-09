"use client"

import { useEffect, useRef } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { ConversationMetaLine } from "@/components/inbox/conversation-meta-line"
import { cn } from "@/lib/utils"

interface ConversationListItemProps {
  title: string
  subtitle: string
  preview?: string | null
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
}

export function ConversationListItem({
  title,
  subtitle,
  preview,
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
        "group relative w-full rounded-[var(--inbox-radius-control)] border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/30",
        selected
          ? "border-[var(--inbox-accent)]/40 bg-[var(--inbox-accent-soft)]/85 shadow-[0_8px_24px_rgba(47,111,115,0.08)]"
          : "border-transparent bg-transparent hover:border-[var(--inbox-divider)]/60 hover:bg-[var(--inbox-background)]/95 hover:shadow-sm",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-3 left-0 w-1.5 rounded-r-full transition-all duration-200",
          selected ? "bg-[var(--inbox-accent)] shadow-sm" : "bg-transparent group-hover:bg-[var(--inbox-divider)]/50",
        )}
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2.5">
                {isUnread && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--inbox-accent)] shadow-sm ring-2 ring-[var(--inbox-accent)]/20" aria-hidden="true" />
                )}
                <p
                  className={cn(
                    "truncate pr-1 text-[15px] leading-tight text-[var(--inbox-text)]",
                    isUnread ? "font-semibold tracking-tight" : "font-medium",
                  )}
                >
                  {title}
                </p>
                <ConversationChannelBadge channel={channel} label={channelLabel} selected={selected} />
              </div>
              <p className="truncate text-xs leading-relaxed text-[var(--inbox-text-secondary)]">{subtitle}</p>
            </div>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap pt-1 text-xs font-medium",
                isUnread ? "text-[var(--inbox-text)] font-semibold" : "text-[var(--inbox-muted)]",
              )}
            >
              {timeLabel}
            </span>
          </div>

          {preview?.trim() ? (
            <p
              className={cn(
                "mt-2.5 line-clamp-1 text-sm leading-relaxed",
                isUnread ? "text-[var(--inbox-text-secondary)] font-medium" : "text-[var(--inbox-muted)]",
              )}
            >
              {preview}
            </p>
          ) : null}

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
