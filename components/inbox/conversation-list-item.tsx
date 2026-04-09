"use client"

import { useEffect, useRef, useState } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { ConversationMetaLine } from "@/components/inbox/conversation-meta-line"
import { ChevronDown, ChevronRight, ArrowRight, ArrowLeft, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationListItemProps {
  title: string
  subtitle: string
  preview?: string | null
  fullMessage?: string | null
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
  // Message-specific props
  tone?: "inbound" | "outbound" | "internal" | "system"
  authorName?: string
}

export function ConversationListItem({
  title,
  subtitle,
  preview,
  fullMessage,
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
  tone,
  authorName,
}: ConversationListItemProps) {
  const itemRef = useRef<HTMLButtonElement | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!selected) return
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  useEffect(() => {
    if (!selected) setExpanded(false)
  }, [selected])

  const hasFullMessage = selected && fullMessage && fullMessage !== preview

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
                
                {/* Message direction indicator */}
                {tone && (
                  <div className="shrink-0">
                    {tone === "inbound" && (
                      <ArrowLeft className="h-3 w-3 text-blue-500" />
                    )}
                    {tone === "outbound" && (
                      <ArrowRight className="h-3 w-3 text-green-500" />
                    )}
                    {tone === "internal" && (
                      <MessageSquare className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
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

          {(preview?.trim() || fullMessage?.trim()) && (
            <div className="mt-2.5">
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  expanded ? "whitespace-pre-wrap" : "line-clamp-1",
                  isUnread ? "text-[var(--inbox-text-secondary)] font-medium" : "text-[var(--inbox-muted)]",
                )}
              >
                {expanded && fullMessage ? fullMessage : preview}
              </p>
              
              {hasFullMessage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                  className="mt-1.5 flex items-center gap-1 text-xs text-[var(--inbox-accent)] hover:text-[var(--inbox-accent-hover)] transition-colors"
                >
                  {expanded ? (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      Read full message
                    </>
                  )}
                </button>
              )}
            </div>
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
