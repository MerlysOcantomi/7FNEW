"use client"

import { useEffect, useRef } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { ConversationMetaLine } from "@/components/inbox/conversation-meta-line"
import { ChevronRight, Loader2, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConversationListItemProps {
  title: string
  senderIntent?: string | null
  sectorLabel?: string | null
  timeLabel: string
  selected: boolean
  isUnread: boolean
  onClick: () => void
  expanded: boolean
  onToggleExpand: () => void
  shortIntentLines?: string[]
  intentsLoading: boolean
  channel: string
  conversationStatus: string
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
  senderIntent,
  sectorLabel,
  timeLabel,
  selected,
  isUnread,
  onClick,
  expanded,
  onToggleExpand,
  shortIntentLines,
  intentsLoading,
  channel,
  conversationStatus,
  statusLabel,
  statusClassName,
  channelLabel,
  urgencyLabel,
  urgencyClassName,
  leadScore,
  messageCount,
}: ConversationListItemProps) {
  const itemRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selected) return
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  /** `undefined` = aún no cargado; `[]` = cargado sin shortIntent en metadata (o todo filtrado). */
  const intentPanelVisible =
    expanded && (intentsLoading || shortIntentLines !== undefined)

  return (
    <div
      ref={itemRef}
      className={cn(
        "group relative w-full rounded-lg border-b px-2.5 py-2.5 text-left transition-all duration-200",
        selected
          ? "border-b-transparent bg-[var(--inbox-list-selected-bg)] ring-1 ring-[var(--inbox-list-selected)]/25"
          : "border-b border-white/[0.06] bg-transparent hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-3 left-0 w-1 rounded-r-full transition-all duration-200",
          selected
            ? "bg-[var(--inbox-list-selected)] shadow-sm"
            : "bg-transparent group-hover:bg-[var(--inbox-list-selected)]/30",
        )}
        aria-hidden="true"
      />
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse per-message intents" : "Expand per-message intents"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          className={cn(
            "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--inbox-list-text-secondary)] transition-colors",
            "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
          )}
        >
          <ChevronRight
            className={cn("h-3 w-3 shrink-0 transition-transform duration-200", expanded && "rotate-90")}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          className={cn(
            "min-w-0 flex-1 rounded-md px-1 py-0 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--inbox-list-background)]",
          )}
        >
          <div className="flex gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  {isUnread && (
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--inbox-list-selected)] shadow-sm ring-2 ring-[var(--inbox-list-selected)]/20"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-[15px] leading-tight",
                        isUnread
                          ? "font-semibold tracking-tight text-[var(--inbox-list-text)]"
                          : "font-medium text-[var(--inbox-list-text-secondary)]",
                      )}
                    >
                      {title}
                    </p>
                    {senderIntent ? (
                      <p
                        className="mt-0.5 block max-w-full text-[13px] leading-snug text-[var(--inbox-list-text-secondary)] break-words [overflow-wrap:anywhere]"
                        title={senderIntent}
                      >
                        {senderIntent}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  <ConversationChannelBadge channel={channel} label={channelLabel} selected={selected} />
                  <span
                    suppressHydrationWarning
                    className={cn(
                      "whitespace-nowrap text-[11px] font-medium tabular-nums",
                      isUnread
                        ? "font-semibold text-[var(--inbox-list-text)]"
                        : "text-[var(--inbox-list-text-secondary)]",
                    )}
                  >
                    {timeLabel}
                  </span>
                  {messageCount > 1 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--inbox-list-background)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)]">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {messageCount}
                    </span>
                  ) : null}
                </div>
              </div>

              <ConversationMetaLine
                conversationStatus={conversationStatus}
                sectorLabel={sectorLabel}
                statusLabel={statusLabel}
                statusClassName={statusClassName}
                urgencyLabel={urgencyLabel}
                urgencyClassName={urgencyClassName}
                leadScore={leadScore}
              />
            </div>
          </div>
        </button>
      </div>

      {intentPanelVisible ? (
        <div className="mt-1.5 border-t border-white/[0.06] pt-1.5 pl-7 pr-1">
          {intentsLoading ? (
            <div className="flex items-center gap-2 py-0.5 text-[var(--inbox-list-text-secondary)]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              <span className="text-[11px]">Loading intents…</span>
            </div>
          ) : shortIntentLines && shortIntentLines.length > 0 ? (
            <ul className="space-y-1" role="list">
              {shortIntentLines.map((line, idx) => (
                <li
                  key={`${idx}-${line.slice(0, 24)}`}
                  className="border-l-2 border-[var(--inbox-list-selected)]/35 pl-2 text-[11px] leading-snug text-[var(--inbox-list-text-secondary)] [overflow-wrap:anywhere]"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-0.5 text-[11px] leading-snug text-[var(--inbox-list-text-secondary)]">
              No hay intents por mensaje guardados.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
