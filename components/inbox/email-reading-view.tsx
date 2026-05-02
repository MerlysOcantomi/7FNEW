"use client"

import { useEffect, useMemo } from "react"
import {
  ChevronLeft, ChevronRight, Mail, RotateCcw, Trash2, Download, FileText, Paperclip,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import type { MessageAttachment, MessageEmailMeta } from "@/components/inbox/message-bubble"
import { cn } from "@/lib/utils"

/**
 * Single-email reading view for the Smart Inbox.
 *
 * Renders one email at a time using a traditional email-client layout (subject header,
 * From/To/CC/Date row, body, attachments) instead of the chat-bubble pile. Designed as a
 * sibling of `ConversationThread` so that switching between modes only swaps the body
 * region — header, status select, mobile nav, and surrounding flex chain stay identical.
 *
 * Selection model is shared with the chat view via the existing `selectedMessageId` prop:
 * navigating Prev/Next here calls `onSelectMessage(id)`, which the page already wires to
 * `?messageId=<id>` deep-link sync, Smart Hub message mode, scoped composer actions, etc.
 * There is no second source of truth.
 *
 * Navigation rules:
 *  - Navigable messages: `tone` ∈ {inbound, outbound} and not trashed. Internal notes
 *    and system messages are excluded from the email reader because they are not real
 *    emails. They remain visible in the chat view.
 *  - If the operator explicitly selected a trashed message (deep-link, More menu, etc.),
 *    we show the trash placeholder + Restore CTA at that position. Prev/Next still skip
 *    over trashed messages so the operator can escape the placeholder.
 *  - When no navigable messages exist (e.g. all-internal thread, fresh archive, or every
 *    message trashed), we render an empty state instead of a blank panel.
 */
export interface EmailReadingMessage {
  id: string
  authorLabel: string
  roleLabel: string
  metaLabel: string
  timestampLabel: string
  content: string
  tone: "inbound" | "outbound" | "internal" | "system"
  attachments?: MessageAttachment[]
  emailMeta?: MessageEmailMeta
  fromLabel?: string | null
  recipientsLabel?: string | null
  subject?: string | null
  timestampFull?: string | null
  trashed?: boolean
}

interface EmailReadingViewProps {
  messages: EmailReadingMessage[]
  selectedMessageId: string | null
  onSelectMessage: (messageId: string) => void
  onRestoreMessage?: (messageId: string) => void
}

const NAVIGABLE_TONES: ReadonlyArray<EmailReadingMessage["tone"]> = ["inbound", "outbound"]

function isNavigable(message: EmailReadingMessage): boolean {
  if (!NAVIGABLE_TONES.includes(message.tone)) return false
  if (message.trashed) return false
  return true
}

export function EmailReadingView({
  messages,
  selectedMessageId,
  onSelectMessage,
  onRestoreMessage,
}: EmailReadingViewProps) {
  /**
   * Navigable list = real emails minus trashed. Memoized because we recompute Prev/Next
   * from this list on every keystroke and a fresh array on each render would invalidate
   * downstream `useMemo`s unnecessarily.
   */
  const navigable = useMemo(() => messages.filter(isNavigable), [messages])

  /**
   * Currently displayed message. Three branches:
   *  1. The page selected a specific message (via thread click, deep-link, More menu).
   *     Honour it as long as it exists in this conversation, even if it's trashed —
   *     trashed selections render the placeholder so the operator can Restore.
   *  2. No selection but we have at least one navigable message → use the last one
   *     (newest, since `messages` is chronological).
   *  3. Nothing renderable → null, the empty state below kicks in.
   */
  const currentMessage = useMemo<EmailReadingMessage | null>(() => {
    if (selectedMessageId) {
      const explicit = messages.find((m) => m.id === selectedMessageId)
      if (explicit) return explicit
    }
    if (navigable.length > 0) return navigable[navigable.length - 1]
    return null
  }, [messages, selectedMessageId, navigable])

  /**
   * If we landed on a default (newest navigable) message because the page didn't select
   * anything, propagate that selection upward so the rest of the system (Smart Hub
   * message mode, composer "Acting on", deep link `?messageId=`) stays in sync. We only
   * do this when there's no explicit selection yet and only when we picked an actual
   * message — never overwrite a user choice.
   */
  useEffect(() => {
    if (selectedMessageId) return
    if (!currentMessage) return
    onSelectMessage(currentMessage.id)
  }, [selectedMessageId, currentMessage, onSelectMessage])

  if (!currentMessage) {
    return (
      <div className="flex min-h-[min(280px,50dvh)] flex-col items-center justify-center px-5 py-10">
        <EmptyState
          variant="inbox"
          icon={Mail}
          title="No emails to display"
          description="This conversation has no inbound or outbound emails to read in single-email mode. Switch back to Chat view to see internal notes and system events."
        />
      </div>
    )
  }

  const currentNavIndex = navigable.findIndex((m) => m.id === currentMessage.id)
  const totalNavigable = navigable.length

  /**
   * Prev/Next walk the navigable list (which excludes trashed messages by design). When
   * the current message is trashed, `currentNavIndex` will be -1 — we can't navigate
   * relative to a list we're not in, so we fall back to "go to the last navigable" /
   * "go to the first navigable" heuristics so the operator can escape the placeholder
   * with a single click in either direction.
   */
  let prevId: string | null = null
  let nextId: string | null = null
  if (currentNavIndex >= 0) {
    if (currentNavIndex > 0) prevId = navigable[currentNavIndex - 1].id
    if (currentNavIndex < totalNavigable - 1) nextId = navigable[currentNavIndex + 1].id
  } else if (totalNavigable > 0) {
    prevId = navigable[totalNavigable - 1].id
    nextId = navigable[0].id
  }

  const positionLabel = currentMessage.trashed
    ? "Trashed email"
    : currentNavIndex >= 0
      ? `Email ${currentNavIndex + 1} of ${totalNavigable}`
      : "—"

  const ccList = currentMessage.emailMeta?.cc?.filter(Boolean) ?? []
  const bccList = currentMessage.emailMeta?.bcc?.filter(Boolean) ?? []
  const subject = currentMessage.subject?.trim() || "(No subject)"
  const fromLabel = currentMessage.fromLabel || currentMessage.authorLabel
  const dateLabel = currentMessage.timestampFull || currentMessage.timestampLabel
  const isOutbound = currentMessage.tone === "outbound"
  const isInbound = currentMessage.tone === "inbound"

  return (
    <ScrollArea className="h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-full flex-col gap-3 bg-[var(--inbox-chat-background)] px-5 py-5 md:px-8 md:py-6">
        {/* Top nav bar — Prev / position / Next. Sticky-feel inside the scroll area. */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--inbox-border)]/40 bg-white/[0.03] px-3 py-2">
          <button
            type="button"
            onClick={() => prevId && onSelectMessage(prevId)}
            disabled={!prevId}
            aria-label="Previous email"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              prevId
                ? "text-[var(--inbox-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
                : "cursor-not-allowed text-[var(--inbox-text-secondary)]/50",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </button>
          <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--inbox-text-secondary)]">
            <Mail className="h-3 w-3" aria-hidden="true" />
            <span>{positionLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => nextId && onSelectMessage(nextId)}
            disabled={!nextId}
            aria-label="Next email"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              nextId
                ? "text-[var(--inbox-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
                : "cursor-not-allowed text-[var(--inbox-text-secondary)]/50",
            )}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {currentMessage.trashed ? (
          /**
           * Trashed selection — render the same placeholder shape MessageBubble uses, with
           * inline Restore CTA. We keep the position bar above (already rendered) so Prev/
           * Next remain visible and the operator can navigate out without restoring first.
           */
          <div className="rounded-2xl border border-dashed border-[var(--inbox-border)]/55 bg-white/[0.03] px-5 py-4 text-sm italic text-[var(--inbox-text-secondary)]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                <span>Message moved to trash</span>
              </span>
              {onRestoreMessage ? (
                <button
                  type="button"
                  onClick={() => onRestoreMessage(currentMessage.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                    "text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent)]/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40",
                  )}
                  aria-label="Restore message"
                >
                  <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Restore
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <article
            className={cn(
              "rounded-2xl border bg-[var(--inbox-surface)] shadow-[var(--inbox-shadow-card)]",
              "border-[var(--inbox-border)]/55",
              isOutbound ? "border-l-4 border-l-[var(--inbox-chat-bubble-outbound)]/60" : "",
              isInbound ? "border-l-4 border-l-[var(--inbox-accent)]/45" : "",
            )}
          >
            <header className="border-b border-[var(--inbox-border)]/40 px-5 py-4 md:px-6">
              <div className="flex items-start justify-between gap-3">
                <h1 className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-[var(--inbox-text)]">
                  {subject}
                </h1>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    isInbound &&
                      "border-[var(--inbox-accent)]/35 bg-[var(--inbox-accent)]/12 text-[var(--inbox-accent)]",
                    isOutbound &&
                      "border-[var(--inbox-chat-meta-outbound-border)] bg-[var(--inbox-chat-meta-outbound-bg)] text-[var(--inbox-chat-meta-outbound-text)]",
                    currentMessage.tone === "internal" &&
                      "border-[var(--inbox-warning)]/30 bg-[var(--inbox-warning)]/10 text-[var(--inbox-warning)]",
                    currentMessage.tone === "system" &&
                      "border-[var(--inbox-border)] bg-white/[0.05] text-[var(--inbox-text-secondary)]",
                  )}
                >
                  {currentMessage.metaLabel}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-snug text-[var(--inbox-text)]/90">
                <dt className="font-semibold uppercase tracking-wider text-[10px] text-[var(--inbox-text-secondary)]">From</dt>
                <dd className="min-w-0 break-words [overflow-wrap:anywhere]">{fromLabel}</dd>
                {currentMessage.recipientsLabel ? (
                  <>
                    <dt className="font-semibold uppercase tracking-wider text-[10px] text-[var(--inbox-text-secondary)]">To</dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">{currentMessage.recipientsLabel}</dd>
                  </>
                ) : null}
                {ccList.length > 0 ? (
                  <>
                    <dt className="font-semibold uppercase tracking-wider text-[10px] text-[var(--inbox-text-secondary)]">CC</dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">{ccList.join(", ")}</dd>
                  </>
                ) : null}
                {bccList.length > 0 ? (
                  <>
                    <dt className="font-semibold uppercase tracking-wider text-[10px] text-[var(--inbox-text-secondary)]">BCC</dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">{bccList.join(", ")}</dd>
                  </>
                ) : null}
                <dt className="font-semibold uppercase tracking-wider text-[10px] text-[var(--inbox-text-secondary)]">Date</dt>
                <dd suppressHydrationWarning className="min-w-0 tabular-nums opacity-90">{dateLabel}</dd>
              </dl>
            </header>

            <div className="px-5 py-4 md:px-6">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--inbox-text)]">
                {currentMessage.content}
              </p>
            </div>

            {currentMessage.attachments && currentMessage.attachments.length > 0 ? (
              <footer className="border-t border-[var(--inbox-border)]/40 px-5 py-3 md:px-6">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3 text-[var(--inbox-text-secondary)]" aria-hidden="true" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-text-secondary)]">
                    Attachments ({currentMessage.attachments.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentMessage.attachments.map((att) => (
                    <a
                      key={att.url || att.filename}
                      href={att.url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border border-[var(--inbox-border)]/50 bg-white/[0.03] px-2 py-1 text-xs transition-colors",
                        att.url
                          ? "cursor-pointer text-[var(--inbox-text)] hover:border-[var(--inbox-accent)]/40 hover:bg-white/[0.06] hover:text-[var(--inbox-accent)]"
                          : "cursor-default text-[var(--inbox-text-secondary)] opacity-60",
                      )}
                      onClick={att.url ? undefined : (e) => e.preventDefault()}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="max-w-[220px] truncate font-medium">{att.filename}</span>
                      {att.size != null ? (
                        <span className="text-[10px] opacity-70">
                          {att.size < 1024
                            ? `${att.size} B`
                            : att.size < 1048576
                              ? `${Math.round(att.size / 1024)} KB`
                              : `${(att.size / 1048576).toFixed(1)} MB`}
                        </span>
                      ) : null}
                      {att.url ? <Download className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" /> : null}
                    </a>
                  ))}
                </div>
              </footer>
            ) : null}
          </article>
        )}
      </div>
    </ScrollArea>
  )
}
