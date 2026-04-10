"use client"

import { useEffect, useRef, useState } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { ConversationMetaLine } from "@/components/inbox/conversation-meta-line"
import { ChevronDown, ChevronRight, ArrowRight, ArrowLeft, MessageSquare, Star, Archive, Trash2, MailOpen, MailCheck } from "lucide-react"
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
  tone?: "inbound" | "outbound" | "internal" | "system"
  // Quick actions
  onFavorite?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onMarkRead?: () => void
  isFavorited?: boolean
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
  // Quick actions
  onFavorite,
  onArchive,
  onDelete,
  onMarkRead,
  isFavorited = false,
}: ConversationListItemProps) {
  const itemRef = useRef<HTMLButtonElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (!selected) {
      setExpanded(false)
      return
    }
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  const hasFullMessage = selected && fullMessage && fullMessage !== preview

  return (
    <button
      ref={itemRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-lg border-b px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
        selected
          ? "border-b-[var(--inbox-list-selected)]/20 bg-[var(--inbox-list-selected-bg)] ring-1 ring-[var(--inbox-list-selected)]/10"
          : "border-b-[var(--inbox-list-divider)]/30 bg-[var(--inbox-list-surface)] hover:bg-[var(--inbox-list-background)]",
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
                
                {/* Message direction indicator */}
                {tone && (
                  <div className="shrink-0">
                    {tone === "inbound" && (
                      <ArrowLeft className="h-3 w-3 text-[var(--inbox-accent)]" />
                    )}
                    {tone === "outbound" && (
                      <ArrowRight className="h-3 w-3 text-[var(--inbox-success)]" />
                    )}
                    {tone === "internal" && (
                      <MessageSquare className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
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
            <span
              suppressHydrationWarning
              className={cn(
                "shrink-0 whitespace-nowrap pt-1 text-xs font-medium",
                isUnread ? "text-[var(--inbox-list-text)] font-semibold" : "text-[var(--inbox-list-text-secondary)]",
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
                  isUnread ? "text-[var(--inbox-list-text-secondary)] font-medium" : "text-[var(--inbox-list-text-secondary)]/75",
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
                  className="mt-1.5 flex items-center gap-1 text-xs text-[var(--inbox-list-selected)] hover:text-[var(--inbox-list-selected)]/80 transition-colors"
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

      {/* Quick Actions Overlay */}
      {isHovered && !selected && (onFavorite || onArchive || onDelete || onMarkRead) && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[var(--inbox-list-surface)]/95 backdrop-blur-sm border border-[var(--inbox-border)] rounded-lg shadow-lg px-1 py-1">
          {onMarkRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkRead()
              }}
              className="p-1.5 rounded-md text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)] hover:bg-[var(--inbox-background)] transition-colors"
              title={isUnread ? "Mark as read" : "Mark as unread"}
            >
              {isUnread ? <MailOpen className="h-3.5 w-3.5" /> : <MailCheck className="h-3.5 w-3.5" />}
            </button>
          )}
          {onFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onFavorite()
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isFavorited 
                  ? "text-[var(--inbox-lead-color)] hover:text-[var(--inbox-lead-color)]/80" 
                  : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-lead-color)]"
              )}
              title={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onArchive()
              }}
              className="p-1.5 rounded-md text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-archive-color)] hover:bg-[var(--inbox-background)] transition-colors"
              title="Archive"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 rounded-md text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-destructive)] hover:bg-[var(--inbox-urgency-critical-bg)] transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </button>
  )
}
