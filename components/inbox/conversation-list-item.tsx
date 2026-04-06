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
        "group relative w-full rounded-[var(--inbox-radius-control)] border px-3.5 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/30",
        selected
          ? "border-[var(--inbox-accent)]/20 bg-[var(--inbox-accent-soft)]/78 shadow-[0_8px_18px_rgba(17,24,39,0.04)]"
          : "border-transparent bg-transparent hover:border-[var(--inbox-divider)] hover:bg-[var(--inbox-background)]/92",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-r-full transition-colors",
          selected ? "bg-[var(--inbox-accent)]" : "bg-transparent group-hover:bg-[var(--inbox-divider)]",
        )}
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                {isUnread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--inbox-accent)]" aria-hidden="true" />
                )}
                <p
                  className={cn(
                    "truncate pr-1 text-sm text-[var(--inbox-text)]",
                    isUnread ? "font-semibold" : "font-medium",
                  )}
                >
                  {title}
                </p>
                <ConversationChannelBadge channel={channel} label={channelLabel} selected={selected} />
              </div>
              <p className="truncate text-[11px] text-[var(--inbox-text-secondary)]">{subtitle}</p>
            </div>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap pt-0.5 text-[10px] font-medium",
                isUnread ? "text-[var(--inbox-text)]" : "text-[var(--inbox-muted)]",
              )}
            >
              {timeLabel}
            </span>
          </div>

          {preview?.trim() ? (
            <p
              className={cn(
                "mt-2 line-clamp-1 text-[13px] leading-5",
                isUnread ? "text-[var(--inbox-text-secondary)]" : "text-[var(--inbox-muted)]",
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
