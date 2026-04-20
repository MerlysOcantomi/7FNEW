"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { AlertTriangle, ChevronLeft, Crosshair, Loader2, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { InlineSelect } from "@/components/inline-edit"
import { MessageBubble, type MessageAttachment, type MessageEmailMeta } from "@/components/inbox/message-bubble"
import { cn } from "@/lib/utils"

interface StatusOption {
  value: string
  label: string
}

interface MessageItem {
  id: string
  authorLabel: string
  roleLabel: string
  metaLabel: string
  timestampLabel: string
  content: string
  tone: "inbound" | "outbound" | "internal" | "system"
  attachments?: MessageAttachment[]
  emailMeta?: MessageEmailMeta
}

interface ConversationThreadProps {
  hasSelectedId: boolean
  detailLoading: boolean
  detailErrorMessage: string | null
  headerTitle: string
  headerSubtitle: string
  channel: string
  statusValue: string
  statusOptions: StatusOption[]
  onStatusChange: (value: string) => Promise<void>
  statusBadgeClassName: (value: string) => string
  messages: MessageItem[]
  /** Message-level focus (Smart Inbox) */
  focusedMessageId?: string | null
  onFocusMessage?: (messageId: string) => void
  messageShortIntentById?: Record<string, string>
  onBack?: () => void
  onOpenContext?: () => void
}

export function ConversationThread({
  hasSelectedId,
  detailLoading,
  detailErrorMessage,
  headerTitle,
  headerSubtitle,
  channel,
  statusValue,
  statusOptions,
  onStatusChange,
  statusBadgeClassName,
  messages,
  focusedMessageId = null,
  onFocusMessage,
  messageShortIntentById = {},
  onBack,
  onOpenContext,
}: ConversationThreadProps) {
  const lastScrolledFocusRef = useRef<string | null>(null)

  useEffect(() => {
    if (!focusedMessageId) {
      lastScrolledFocusRef.current = null
      return
    }
    if (lastScrolledFocusRef.current === focusedMessageId) return
    const el = document.querySelector(`[data-message-id="${CSS.escape(focusedMessageId)}"]`)
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" })
      lastScrolledFocusRef.current = focusedMessageId
    }
  }, [focusedMessageId, messages])

  if (!hasSelectedId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          variant="inbox"
          icon={MessageSquare}
          title="Select a conversation"
          description="Choose a thread from the list to review context and reply."
        />
      </div>
    )
  }

  if (detailLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--inbox-text-secondary)]" />
      </div>
    )
  }

  if (detailErrorMessage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          variant="inbox"
          icon={AlertTriangle}
          title="Could not load conversation"
          description={detailErrorMessage}
        />
      </div>
    )
  }

  const isEmailChannel = channel === "email"
  const canFocus = Boolean(onFocusMessage)

  return (
    <>
      {/* Mobile navigation */}
      <div className="xl:hidden shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 rounded-lg px-2 text-xs" onClick={onBack}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Inbox
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg text-xs" onClick={onOpenContext}>
            <Sparkles className="h-3 w-3" />
            Context
          </Button>
          <div className="ml-auto">
            <InlineSelect
              value={statusValue}
              options={statusOptions}
              onSave={onStatusChange}
              badgeClassName={statusBadgeClassName}
            />
          </div>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden xl:block shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--inbox-text)]">{headerTitle}</p>
            <p className="truncate text-xs text-[var(--inbox-text-secondary)]">{headerSubtitle}</p>
          </div>
          <InlineSelect
            value={statusValue}
            options={statusOptions}
            onSave={onStatusChange}
            badgeClassName={statusBadgeClassName}
          />
        </div>
      </div>

      {/* Thread */}
      <ScrollArea className="h-full min-h-0 flex-1 overflow-hidden">
        <div className={cn(
          "bg-[var(--inbox-chat-background)] px-5 py-6 md:px-6 md:py-7",
          isEmailChannel ? "space-y-0" : "space-y-4",
        )}>
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--inbox-border)] bg-white/[0.04] p-6">
              <p className="text-sm text-[var(--inbox-text-secondary)]">No messages yet.</p>
            </div>
          ) : isEmailChannel ? (
            messages.map((message, index) => (
              <div
                key={message.id}
                data-message-id={message.id}
                className={cn(
                  "rounded-2xl transition-[box-shadow,background-color] duration-200",
                  focusedMessageId === message.id &&
                    "bg-[var(--inbox-accent-soft)]/35 ring-1 ring-[var(--inbox-accent)]/45",
                )}
              >
                {index > 0 && (
                  <div className="my-4 flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-[var(--inbox-divider)]" />
                    <span className="shrink-0 text-[10px] font-medium text-[var(--inbox-text-secondary)]/50">
                      {message.tone === "outbound" ? "Reply" : "Email"} · {message.timestampLabel}
                    </span>
                    <div className="h-px flex-1 bg-[var(--inbox-divider)]" />
                  </div>
                )}
                <ThreadMessageChrome
                  shortIntent={messageShortIntentById[message.id]}
                  showFocus={canFocus && message.tone === "inbound"}
                  isFocused={focusedMessageId === message.id}
                  onFocus={() => onFocusMessage?.(message.id)}
                  onIntentActivate={() => onFocusMessage?.(message.id)}
                >
                  <MessageBubble
                    authorLabel={message.authorLabel}
                    roleLabel={message.roleLabel}
                    metaLabel={message.metaLabel}
                    timestampLabel={message.timestampLabel}
                    content={message.content}
                    tone={message.tone}
                    attachments={message.attachments}
                    emailMeta={message.emailMeta}
                  />
                </ThreadMessageChrome>
              </div>
            ))
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                data-message-id={message.id}
                className={cn(
                  "rounded-2xl transition-[box-shadow,background-color] duration-200",
                  focusedMessageId === message.id &&
                    "bg-[var(--inbox-accent-soft)]/35 ring-1 ring-[var(--inbox-accent)]/45",
                )}
              >
                <ThreadMessageChrome
                  shortIntent={messageShortIntentById[message.id]}
                  showFocus={canFocus && message.tone === "inbound"}
                  isFocused={focusedMessageId === message.id}
                  onFocus={() => onFocusMessage?.(message.id)}
                  onIntentActivate={() => onFocusMessage?.(message.id)}
                >
                  <MessageBubble
                    authorLabel={message.authorLabel}
                    roleLabel={message.roleLabel}
                    metaLabel={message.metaLabel}
                    timestampLabel={message.timestampLabel}
                    content={message.content}
                    tone={message.tone}
                    attachments={message.attachments}
                    emailMeta={message.emailMeta}
                  />
                </ThreadMessageChrome>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function ThreadMessageChrome({
  children,
  shortIntent,
  showFocus,
  isFocused,
  onFocus,
  onIntentActivate,
}: {
  children: ReactNode
  shortIntent?: string
  showFocus: boolean
  isFocused: boolean
  onFocus: () => void
  onIntentActivate: () => void
}) {
  const showIntentRow = Boolean(shortIntent) || showFocus

  if (!showIntentRow) {
    return <>{children}</>
  }

  return (
    <div className="px-0.5 py-1">
      <div className="mb-1.5 flex flex-wrap items-center justify-end gap-1.5">
        {shortIntent ? (
          <button
            type="button"
            onClick={onIntentActivate}
            className={cn(
              "max-w-[min(100%,420px)] truncate rounded-lg border px-2 py-0.5 text-left text-[10px] font-medium transition-colors",
              "border-[var(--inbox-accent)]/35 bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent-soft)]/80",
              isFocused && "ring-1 ring-[var(--inbox-accent)]/50",
            )}
            title="Focus this message for Intelligence Hub"
          >
            {shortIntent}
          </button>
        ) : null}
        {showFocus ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-6 gap-1 rounded-md px-2 text-[10px]",
              isFocused && "border-[var(--inbox-accent)]/50 bg-[var(--inbox-accent-soft)]/50",
            )}
            onClick={onFocus}
          >
            <Crosshair className="h-3 w-3" aria-hidden />
            Focus
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  )
}
