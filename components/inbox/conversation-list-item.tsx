"use client"

import { useEffect, useRef, useState } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { ConversationMetaLine } from "@/components/inbox/conversation-meta-line"
import { ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Cada intent expandido conserva su `messageId` original para poder seleccionar el Message en el hilo. */
export interface ShortIntentEntry {
  messageId: string
  text: string
}

interface ConversationListItemProps {
  title: string
  /**
   * Subject / short conversation label shown as the secondary line in the *collapsed* row.
   * Replaced the old AI-derived `senderIntent` snippet on this row to keep scanning fast: the
   * collapsed row is "who + what is this thread about" only. Intents live in the expanded panel.
   * Optional because not every channel has a structured subject (web chat, walk-in, etc.).
   */
  subject?: string | null
  sectorLabel?: string | null
  timeLabel: string
  selected: boolean
  isUnread: boolean
  onClick: () => void
  expanded: boolean
  onToggleExpand: () => void
  /**
   * Pre-filtered active intents: caller already removed trashed messages, intentStatus="done",
   * internal notes and system messages. Order is chronological — the LAST entry is the latest
   * active intent and gets surfaced as the headline of the expanded panel.
   */
  intents?: ShortIntentEntry[]
  intentsLoading: boolean
  /** Disparado al hacer clic en un intent expandido — el padre debe seleccionar el Message correspondiente. */
  onIntentSelect?: (messageId: string) => void
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
  subject,
  sectorLabel,
  timeLabel,
  selected,
  isUnread,
  onClick,
  expanded,
  onToggleExpand,
  intents,
  intentsLoading,
  onIntentSelect,
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
  /**
   * Local toggle for the "View N more intents" link inside the expanded panel. Kept as
   * component-local state (not lifted) because it's a purely presentational, per-row affordance
   * with no impact on selection, URL params, or fetching. Reset implicitly when the row collapses
   * via the useEffect below.
   */
  const [showOlderIntents, setShowOlderIntents] = useState(false)

  useEffect(() => {
    if (!selected) return
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

  useEffect(() => {
    if (!expanded) setShowOlderIntents(false)
  }, [expanded])

  /** `undefined` = aún no cargado; `[]` = cargado sin intents activos (todo done/trash/etc.). */
  const intentPanelVisible =
    expanded && (intentsLoading || intents !== undefined)

  /**
   * `intents` ya viene filtrado y deduplicado por el parent (pickExpandedIntents + done/trash
   * filters). Tomamos la última posición como "latest active intent" porque la lista respeta
   * orden cronológico ascendente — la dedup del helper es last-wins, así que la entrada más
   * reciente queda al final.
   */
  const latestActiveIntent = intents && intents.length > 0 ? intents[intents.length - 1] : null
  const olderIntents = intents && intents.length > 1 ? intents.slice(0, -1) : []

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
                    {subject ? (
                      /**
                       * Single-line truncated subject — never wraps. This is structural metadata
                       * (the email Subject header, or web-chat label), not AI text, so we can
                       * trust it to be short. If a subject is unusually long it gets ellipsized;
                       * the operator can read the full one in the thread header.
                       */
                      <p
                        className="mt-0.5 truncate text-[12.5px] leading-snug text-[var(--inbox-list-text-secondary)]"
                        title={subject}
                      >
                        {subject}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    {messageCount > 1 ? (
                      <span
                        aria-label={`${messageCount} mensajes`}
                        className={cn(
                          "min-w-[1ch] text-right text-[10px] font-semibold tabular-nums tracking-tight text-[var(--inbox-list-text-secondary)]",
                          isUnread && "text-[var(--inbox-list-text)]",
                        )}
                      >
                        {messageCount}
                      </span>
                    ) : null}
                    <ConversationChannelBadge channel={channel} label={channelLabel} selected={selected} />
                  </div>
                  <span
                    suppressHydrationWarning
                    className={cn(
                      "whitespace-nowrap text-[10px] font-medium tabular-nums tracking-tight",
                      isUnread
                        ? "font-semibold text-[var(--inbox-list-text)]"
                        : "text-[var(--inbox-list-text-secondary)]",
                    )}
                  >
                    {timeLabel}
                  </span>
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
          ) : latestActiveIntent ? (
            <div className="space-y-1">
              {/*
                Headline: the single most recent active intent. Rendered prominently so the
                operator gets a one-glance answer to "what does this thread need next?" without
                scanning a list. Click → seleccionar el Message correspondiente.
              */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onIntentSelect?.(latestActiveIntent.messageId)
                }}
                title={latestActiveIntent.text}
                aria-label={`Open latest active intent: ${latestActiveIntent.text}`}
                className={cn(
                  "block w-full border-l-2 border-[var(--inbox-list-selected)] pl-2 text-left text-[12px] leading-snug text-[var(--inbox-list-text)] [overflow-wrap:anywhere]",
                  "rounded-r-md transition-colors hover:bg-[var(--inbox-list-selected-bg)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
                )}
              >
                {latestActiveIntent.text}
              </button>

              {olderIntents.length > 0 ? (
                <>
                  <button
                    type="button"
                    aria-expanded={showOlderIntents}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowOlderIntents((prev) => !prev)
                    }}
                    className={cn(
                      "ml-2 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10.5px] font-medium text-[var(--inbox-list-text-secondary)] transition-colors",
                      "hover:text-[var(--inbox-list-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
                    )}
                  >
                    {showOlderIntents
                      ? "Hide older intents"
                      : `View ${olderIntents.length} more ${olderIntents.length === 1 ? "intent" : "intents"}`}
                  </button>

                  {showOlderIntents ? (
                    <ul className="space-y-1 pt-0.5" role="list">
                      {[...olderIntents].reverse().map((intent, idx) => (
                        <li key={`${intent.messageId}-${idx}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onIntentSelect?.(intent.messageId)
                            }}
                            title={intent.text}
                            aria-label={`Open message: ${intent.text}`}
                            className={cn(
                              "block w-full border-l-2 border-[var(--inbox-list-selected)]/35 pl-2 text-left text-[11px] leading-snug text-[var(--inbox-list-text-secondary)] transition-colors [overflow-wrap:anywhere]",
                              "rounded-r-md hover:border-[var(--inbox-list-selected)] hover:bg-[var(--inbox-list-selected-bg)] hover:text-[var(--inbox-list-text)]",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
                            )}
                          >
                            {intent.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <p className="py-0.5 text-[11px] leading-snug text-[var(--inbox-list-text-secondary)]">
              No pending intents.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
