"use client"

import { useEffect, useRef } from "react"
import { AlertTriangle, ChevronLeft, Loader2, MessageSquare, Sparkles } from "lucide-react"
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
  /** Mensaje activo (para resaltar y centrar el scroll). */
  selectedMessageId?: string | null
  /** Callback al hacer clic en una burbuja del hilo. */
  onSelectMessage?: (messageId: string) => void
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
  selectedMessageId = null,
  onSelectMessage,
  onBack,
  onOpenContext,
}: ConversationThreadProps) {
  /**
   * Mapa estable de refs por messageId para hacer scrollIntoView cuando cambia la selección.
   * Se rellena con callback refs en el JSX más abajo.
   */
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!selectedMessageId) return
    const node = messageRefs.current.get(selectedMessageId)
    if (!node) return
    /** rAF asegura que el layout esté listo (especialmente al cambiar de conversación). */
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" })
    })
    return () => cancelAnimationFrame(id)
  }, [selectedMessageId, messages])

  const setMessageRef = (messageId: string) => (node: HTMLDivElement | null) => {
    if (node) messageRefs.current.set(messageId, node)
    else messageRefs.current.delete(messageId)
  }

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

  const isEmailChannel = channel === "email"

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
          {detailErrorMessage ? (
            <div className="flex min-h-[min(280px,50dvh)] flex-col items-center justify-center py-12">
              <EmptyState
                variant="inbox"
                icon={AlertTriangle}
                title="Could not load conversation"
                description={detailErrorMessage}
              />
            </div>
          ) : detailLoading ? (
            <div className="flex min-h-[min(280px,50dvh)] flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--inbox-text-secondary)]" aria-hidden />
              <p className="text-xs text-[var(--inbox-text-secondary)]">Loading conversation…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--inbox-border)] bg-white/[0.04] p-6">
              <p className="text-sm text-[var(--inbox-text-secondary)]">No messages yet.</p>
            </div>
          ) : isEmailChannel ? (
            messages.map((message, index) => (
              <div key={message.id} ref={setMessageRef(message.id)}>
                {index > 0 && (
                  <div className="my-4 flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-[var(--inbox-divider)]" />
                    <span className="shrink-0 text-[10px] font-medium text-[var(--inbox-text-secondary)]/50">
                      {message.tone === "outbound" ? "Reply" : "Email"} · {message.timestampLabel}
                    </span>
                    <div className="h-px flex-1 bg-[var(--inbox-divider)]" />
                  </div>
                )}
                <MessageBubble
                  id={message.id}
                  authorLabel={message.authorLabel}
                  roleLabel={message.roleLabel}
                  metaLabel={message.metaLabel}
                  timestampLabel={message.timestampLabel}
                  content={message.content}
                  tone={message.tone}
                  attachments={message.attachments}
                  emailMeta={message.emailMeta}
                  selected={selectedMessageId === message.id}
                  onSelect={onSelectMessage ? () => onSelectMessage(message.id) : undefined}
                />
              </div>
            ))
          ) : (
            messages.map((message) => (
              <div key={message.id} ref={setMessageRef(message.id)}>
                <MessageBubble
                  id={message.id}
                  authorLabel={message.authorLabel}
                  roleLabel={message.roleLabel}
                  metaLabel={message.metaLabel}
                  timestampLabel={message.timestampLabel}
                  content={message.content}
                  tone={message.tone}
                  attachments={message.attachments}
                  emailMeta={message.emailMeta}
                  selected={selectedMessageId === message.id}
                  onSelect={onSelectMessage ? () => onSelectMessage(message.id) : undefined}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  )
}
