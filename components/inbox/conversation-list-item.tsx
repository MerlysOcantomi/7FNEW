"use client"

import { useEffect, useRef } from "react"
import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
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
   * Collapsed-row philosophy (radar, not a database): the left column exists to scan
   * "what entered + what needs attention" fast. The row shows ONLY a channel anchor,
   * the sender, a subtle time, a short AI intent line, and at most ONE critical signal.
   *
   * The chip cluster that used to live here (sector, status, urgency, lead score,
   * category, pending-decisions, Smart Action) was intentionally removed — that deeper
   * organization metadata belongs in the right Fanny/context panel + thread header,
   * where it is already surfaced. The props below (`statusLabel`, `leadScore`,
   * `category`, `proposedTaskCount`, `smartActionState`, etc.) are RETAINED on the
   * interface so the page→list plumbing and types stay intact for a follow-up PR that
   * relocates them into the right panel; they are deliberately NOT rendered in the row.
   */
  /** Short AI request summary (thread intent → summary fallback). Rendered as one muted block of up to 3 lines. */
  intentSummary?: string | null
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
  /**
   * Operator-assigned workspace category. Forwarded to
   * `<ConversationMetaLine>` which renders the badge inline next to
   * status/urgency. `null` / `undefined` means uncategorised — the row
   * looks identical to its pre-PR state.
   */
  category?: string | null
  /**
   * PR 10 — count of Fanny-suggested `WorkspaceTask` rows still in
   * `proposed` status for this conversation. Forwarded to
   * `<ConversationMetaLine>` which renders the pill only when the
   * value is `> 0`. Defaults to `0` to keep the row visually identical
   * for conversations without suggestions.
   */
  proposedTaskCount?: number
  /**
   * PR 2 — derived, read-only Smart Action state. Forwarded as-is to
   * `<ConversationMetaLine>`, which renders a single subtle pill (and
   * de-dupes against the proposed-task pill). `"none"` / `undefined`
   * leaves the row visually identical.
   */
  smartActionState?:
    | "none"
    | "failed"
    | "needs_review"
    | "draft_ready"
    | "action_ready"
    | "task_created"
}

export function ConversationListItem({
  title,
  intentSummary,
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
  channelLabel,
  urgencyLabel,
  urgencyClassName,
  messageCount,
}: ConversationListItemProps) {
  const itemRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selected) return
    itemRef.current?.scrollIntoView({ block: "nearest" })
  }, [selected])

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

  /**
   * The single critical signal allowed on the radar row. We surface urgency ONLY when it
   * is high/critical (the case an operator must not miss) and the thread is not terminal
   * (archived/closed/trashed). Everything else stays off the left column to keep it calm.
   */
  const isTerminal =
    conversationStatus === "archived" ||
    conversationStatus === "closed" ||
    conversationStatus === "trashed"
  const isHighUrgency =
    !isTerminal &&
    (urgencyClassName === "urgency-critical" || urgencyClassName === "urgency-high")

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
      <div className="flex min-w-0 items-start gap-1">
        {/*
         * Chevron-only expand affordance. The left column is narrow, so we drop
         * the text label entirely (was "Details"/"Signals") to give the sender,
         * chips and intent preview more horizontal room. The chevron stays
         * discoverable via a comfortable square hit area, a subtle bordered
         * background, strong stroke, and a clear 90° rotation on expand. Kept
         * as its OWN button (separate from the sender-select button below) so
         * toggling never races conversation selection.
         */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide details" : "Show details"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          className={cn(
            "mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
            expanded
              ? "border-[var(--inbox-list-selected)]/55 bg-[var(--inbox-list-selected-bg)] text-[var(--inbox-list-selected)]"
              : "border-white/[0.1] text-[var(--inbox-list-text-secondary)] hover:border-[var(--inbox-list-selected)]/40 hover:bg-white/[0.06] hover:text-[var(--inbox-list-text)]",
          )}
        >
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform duration-200", expanded && "rotate-90")}
            strokeWidth={2.5}
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
          <div className="min-w-0 flex-1 space-y-1">
            {/*
             * Row 1 — the scan line. Channel badge is the FIRST visual anchor (per the
             * radar model), then the sender (single line, truncates), then a subtle unread
             * dot + relative time on the right. `messageCount` only shows when > 1.
             */}
            <div className="flex min-w-0 items-center gap-2">
              <ConversationChannelBadge channel={channel} label={channelLabel} selected={selected} />
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-[15px] leading-tight",
                  isUnread
                    ? "font-semibold tracking-tight text-[var(--inbox-list-text)]"
                    : "font-medium text-[var(--inbox-list-text-secondary)]",
                )}
                title={title}
              >
                {title}
              </p>
              {messageCount > 1 ? (
                <span
                  aria-label={`${messageCount} mensajes`}
                  className={cn(
                    "shrink-0 text-[10px] font-semibold tabular-nums tracking-tight text-[var(--inbox-list-text-secondary)]",
                    isUnread && "text-[var(--inbox-list-text)]",
                  )}
                >
                  {messageCount}
                </span>
              ) : null}
              {isUnread ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-[var(--inbox-list-selected)] shadow-sm ring-2 ring-[var(--inbox-list-selected)]/20"
                  aria-label="Unread"
                />
              ) : null}
              <span
                suppressHydrationWarning
                className={cn(
                  "shrink-0 whitespace-nowrap text-[10px] font-medium tabular-nums tracking-tight",
                  isUnread
                    ? "font-semibold text-[var(--inbox-list-text)]"
                    : "text-[var(--inbox-list-text-secondary)]",
                )}
              >
                {timeLabel}
              </span>
            </div>

            {/*
             * Row 2 — the radar signal line. The short AI request summary (muted, up to
             * 3 lines — the narrow Reading-mode column needs vertical room to stay
             * readable instead of an aggressive one-line ellipsis) plus AT MOST ONE
             * critical signal (high/critical urgency). No status, lead, category,
             * Smart Action or pending-decision chips here — those live in the right
             * context panel. The whole line is omitted when there is nothing to show.
             */}
            {intentSummary || isHighUrgency ? (
              <div className="flex min-w-0 items-start gap-2">
                {intentSummary ? (
                  <p
                    className="min-w-0 flex-1 line-clamp-3 text-[12px] leading-snug text-[var(--inbox-list-text-secondary)]"
                    title={intentSummary}
                  >
                    {intentSummary}
                  </p>
                ) : (
                  <span className="min-w-0 flex-1" aria-hidden="true" />
                )}
                {isHighUrgency ? (
                  <span
                    className="max-w-[7rem] shrink-0 truncate rounded-md border border-[rgba(232,111,116,0.32)] bg-[rgba(232,111,116,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--inbox-destructive)] whitespace-nowrap"
                    title={`Urgency: ${urgencyLabel}`}
                  >
                    {urgencyLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </button>
      </div>

      {intentPanelVisible ? (
        <div className="mt-1.5 border-t border-white/[0.06] pt-1.5 pl-7 pr-1">
          {intentsLoading ? (
            <div className="flex items-center gap-2 py-0.5 text-[var(--inbox-list-text-secondary)]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              <span className="text-[11px]">Loading requests…</span>
            </div>
          ) : latestActiveIntent ? (
            <div className="space-y-1.5">
              {/*
                Headline: the most recent active request. Rendered prominently so the
                operator gets a one-glance answer to "what does this thread need next?".
                Click → select the corresponding Message in the center column.
              */}
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--inbox-list-text-secondary)]">
                Request
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onIntentSelect?.(latestActiveIntent.messageId)
                }}
                title={latestActiveIntent.text}
                aria-label={`Open message: ${latestActiveIntent.text}`}
                className={cn(
                  "block w-full border-l-2 border-[var(--inbox-list-selected)] pl-2 text-left text-[12px] leading-snug text-[var(--inbox-list-text)] [overflow-wrap:anywhere]",
                  "rounded-r-md transition-colors hover:bg-[var(--inbox-list-selected-bg)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-list-selected)]/30",
                )}
              >
                {latestActiveIntent.text}
              </button>

              {/*
                Earlier requests render directly as a clean list (most recent first).
                The old second-level "View more" toggle was removed: hiding work behind
                a tiny control read as technical and cost an extra click. Each row keeps
                the same message-level navigation as the headline.
              */}
              {olderIntents.length > 0 ? (
                <>
                  <p className="pt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--inbox-list-text-secondary)]">
                    Earlier requests
                  </p>
                  <ul className="space-y-1" role="list">
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
                </>
              ) : null}
            </div>
          ) : (
            <p className="py-0.5 text-[11px] leading-snug text-[var(--inbox-list-text-secondary)]">
              Nothing waiting in this thread.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
