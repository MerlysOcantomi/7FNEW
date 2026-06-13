"use client"

import { useEffect, useRef } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Mail, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/empty-state"
import { MessageBubble, type MessageAttachment, type MessageEmailMeta } from "@/components/inbox/message-bubble"
import { EmailReadingView, computeEmailNavigation, type EmailReadingMessage } from "@/components/inbox/email-reading-view"
import { cn } from "@/lib/utils"

export type EmailViewMode = "chat" | "email"

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
  /** Phase 2.5: cabeceras opcionales para el detail card "View full email". */
  fromLabel?: string | null
  recipientsLabel?: string | null
  subject?: string | null
  timestampFull?: string | null
  /** Soft-trash flag — when true the bubble renders a placeholder + Restore CTA instead of body. */
  trashed?: boolean
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
  /** Callback al pulsar Restore dentro de un bubble soft-trasheado. */
  onRestoreMessage?: (messageId: string) => void
  /** Callback al pulsar Trash en un mensaje (soft-trash de ese mensaje). */
  onTrashMessage?: (messageId: string) => void
  onBack?: () => void
  onOpenContext?: () => void
  /**
   * Reading mode for email conversations. `chat` keeps the original bubble pile;
   * `email` swaps the body for `EmailReadingView` (one email at a time, traditional
   * client layout). Ignored when `channel !== "email"`. Stored in localStorage by the
   * page-level shell — the thread is only responsible for rendering and notifying.
   */
  emailViewMode?: EmailViewMode
  onEmailViewModeChange?: (mode: EmailViewMode) => void
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
  messages,
  selectedMessageId = null,
  onSelectMessage,
  onRestoreMessage,
  onTrashMessage,
  onBack,
  onOpenContext,
  emailViewMode = "chat",
  onEmailViewModeChange,
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
  const showEmailToggle = isEmailChannel && Boolean(onEmailViewModeChange)
  const renderEmailView = isEmailChannel && emailViewMode === "email"

  /**
   * Compact segmented toggle: Chat | Email. Lives only in email-channel headers; non-email
   * channels never see it because there is no Email view to switch to. Two buttons sharing
   * the same surface mirror the rest of the inbox segmented controls (sidebar filters, ask
   * mode chips) for visual consistency.
   */
  const EmailViewToggle = showEmailToggle ? (
    <div
      role="group"
      aria-label="Email reading mode"
      className="inline-flex items-center gap-0.5 rounded-md border border-[var(--inbox-border)]/45 bg-white/[0.03] p-0.5 text-[11px]"
    >
      <button
        type="button"
        onClick={() => onEmailViewModeChange?.("chat")}
        aria-pressed={emailViewMode === "chat"}
        className={cn(
          "inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 font-medium transition-colors",
          emailViewMode === "chat"
            ? "bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]"
            : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
        )}
      >
        <MessageSquare className="h-3 w-3" aria-hidden="true" />
        Chat
      </button>
      <button
        type="button"
        onClick={() => onEmailViewModeChange?.("email")}
        aria-pressed={emailViewMode === "email"}
        className={cn(
          "inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 font-medium transition-colors",
          emailViewMode === "email"
            ? "bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]"
            : "text-[var(--inbox-text-secondary)] hover:text-[var(--inbox-text)]",
        )}
      >
        <Mail className="h-3 w-3" aria-hidden="true" />
        Email
      </button>
    </div>
  ) : null

  /**
   * Compact email Prev/Next — icons + position count only (no text labels). Lives in the
   * header (the old separate nav bar inside EmailReadingView was removed) to reclaim
   * vertical space. Only rendered in email reading mode with more than one navigable
   * email; the position/prev/next come from the shared `computeEmailNavigation` helper so
   * the header and the body always agree on "which email is current".
   */
  const emailNav = renderEmailView ? computeEmailNavigation(messages, selectedMessageId) : null
  const EmailNavControls = emailNav && emailNav.totalNavigable > 1 ? (
    <div
      role="group"
      aria-label="Email navigation"
      className="inline-flex items-center gap-0.5 rounded-md border border-[var(--inbox-border)]/45 bg-white/[0.03] p-0.5 text-[11px]"
    >
      <button
        type="button"
        onClick={() => emailNav.prevId && onSelectMessage?.(emailNav.prevId)}
        disabled={!emailNav.prevId}
        aria-label="Previous email"
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-[5px] transition-colors",
          emailNav.prevId
            ? "text-[var(--inbox-text-secondary)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
            : "cursor-not-allowed text-[var(--inbox-text-secondary)]/40",
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        className="px-1 tabular-nums font-medium text-[var(--inbox-text-secondary)]"
        aria-label={
          emailNav.currentNavIndex >= 0
            ? `Email ${emailNav.currentNavIndex + 1} of ${emailNav.totalNavigable}`
            : `${emailNav.totalNavigable} emails`
        }
      >
        {emailNav.currentNavIndex >= 0 ? `${emailNav.currentNavIndex + 1}/${emailNav.totalNavigable}` : `–/${emailNav.totalNavigable}`}
      </span>
      <button
        type="button"
        onClick={() => emailNav.nextId && onSelectMessage?.(emailNav.nextId)}
        disabled={!emailNav.nextId}
        aria-label="Next email"
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-[5px] transition-colors",
          emailNav.nextId
            ? "text-[var(--inbox-text-secondary)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
            : "cursor-not-allowed text-[var(--inbox-text-secondary)]/40",
        )}
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  ) : null

  /**
   * Conversation workflow status — visually distinct from the Chat/Email view selector
   * (which only changes how messages are displayed). Uses the dark-themed `Select` (good
   * contrast in the purple theme) instead of the shared `InlineSelect`'s native `<select>`,
   * and carries an explicit "Status" label so it never reads as a third view mode. Behavior,
   * values, options and the `onStatusChange` handler are unchanged.
   */
  const StatusControl = (
    <Select value={statusValue} onValueChange={(value) => { void onStatusChange(value) }}>
      <SelectTrigger
        aria-label="Conversation status"
        className={cn(
          // Compact, same height/feel as the Chat/Email toggle — light readable text in the
          // dark theme. No badge tint (the status-* keys are Badge variants, not CSS classes)
          // and no separate uppercase label; the inline "Status:" prefix keeps it clear.
          "h-7 w-auto gap-1.5 rounded-lg border border-[var(--inbox-border)] bg-transparent px-2 text-[11px] font-medium text-[var(--inbox-text)] shadow-none",
          "hover:bg-white/8 hover:text-[var(--inbox-accent)] focus:ring-1 focus:ring-[var(--inbox-accent)]/40",
        )}
      >
        <span className="text-[var(--inbox-text-secondary)]">Status:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-[var(--inbox-border)] bg-[var(--inbox-surface-elevated)]/95 text-[var(--inbox-text)] shadow-lg backdrop-blur-sm">
        {statusOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-xs text-[var(--inbox-text)] focus:bg-white/10 focus:text-[var(--inbox-accent)]"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  /** Subtle divider so the status control reads as separate from the Chat/Email toggle. */
  const ControlsDivider = showEmailToggle ? (
    <span className="h-4 w-px shrink-0 bg-[var(--inbox-divider)]" aria-hidden="true" />
  ) : null

  return (
    <>
      {/* Mobile navigation */}
      <div className="xl:hidden shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 rounded-lg px-2 text-xs text-[var(--inbox-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
            onClick={onBack}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Inbox
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg border-[var(--inbox-border)] bg-transparent text-xs text-[var(--inbox-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
            onClick={onOpenContext}
          >
            <Sparkles className="h-3 w-3" />
            Context
          </Button>
          {EmailNavControls}
          {EmailViewToggle}
          <div className="ml-auto flex items-center gap-2">
            {ControlsDivider}
            {StatusControl}
          </div>
        </div>
      </div>

      {/* Desktop header — single tight row to keep the thread chrome minimal. */}
      <div className="hidden xl:block shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-5 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94">
        <div className="flex items-center justify-between gap-4">
          {/*
           * Title + sender share ONE baseline-aligned row (was a two-line
           * stack). `truncate` on each keeps long subjects/senders from
           * pushing the toggle/status off-screen.
           */}
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <p className="truncate text-[13px] font-medium leading-tight text-[var(--inbox-text)]">{headerTitle}</p>
            <p className="truncate text-[11px] leading-tight text-[var(--inbox-text-secondary)]">{headerSubtitle}</p>
          </div>
          {/* Right-side controls — `shrink-0` prevents the EmailViewToggle / status select
           * from being compressed when the title is long; `truncate` on the title takes
           * care of the overflow on its side instead. */}
          <div className="flex shrink-0 items-center gap-2">
            {EmailNavControls}
            {EmailViewToggle}
            {ControlsDivider}
            {StatusControl}
          </div>
        </div>
      </div>

      {/* Thread */}
      {detailErrorMessage ? (
        <div className="flex min-h-[min(280px,50dvh)] flex-1 flex-col items-center justify-center bg-[var(--inbox-chat-background)] py-12">
          <EmptyState
            variant="inbox"
            icon={AlertTriangle}
            title="Could not load conversation"
            description={detailErrorMessage}
          />
        </div>
      ) : detailLoading ? (
        <div className="flex min-h-[min(280px,50dvh)] flex-1 flex-col items-center justify-center gap-3 bg-[var(--inbox-chat-background)] py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--inbox-text-secondary)]" aria-hidden />
          <p className="text-xs text-[var(--inbox-text-secondary)]">Loading conversation…</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 flex-col bg-[var(--inbox-chat-background)] px-5 py-6">
          <div className="rounded-2xl border border-dashed border-[var(--inbox-border)] bg-white/[0.04] p-6">
            <p className="text-sm text-[var(--inbox-text-secondary)]">No messages yet.</p>
          </div>
        </div>
      ) : renderEmailView ? (
        /**
         * Email reading mode — body is fully delegated to `EmailReadingView`. Selection,
         * deep-link, Smart Hub message mode, and trash placeholder all reuse the existing
         * props (`selectedMessageId`, `onSelectMessage`, `onRestoreMessage`) so we stay on
         * a single source of truth. The header above (with the Chat | Email toggle) is
         * always rendered, so the operator can flip back to Chat with one click.
         */
        <EmailReadingView
          messages={messages as EmailReadingMessage[]}
          selectedMessageId={selectedMessageId ?? null}
          onSelectMessage={(id) => onSelectMessage?.(id)}
          onRestoreMessage={onRestoreMessage}
          onTrashMessage={onTrashMessage}
        />
      ) : (
      <ScrollArea className="h-full min-h-0 flex-1 overflow-hidden">
        <div className={cn(
          "bg-[var(--inbox-chat-background)] px-5 py-6 md:px-6 md:py-7",
          isEmailChannel ? "space-y-0" : "space-y-4",
        )}>
          {isEmailChannel ? (
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
                  expandable
                  fromLabel={message.fromLabel}
                  recipientsLabel={message.recipientsLabel}
                  subject={message.subject}
                  timestampFull={message.timestampFull}
                  trashed={message.trashed}
                  onRestore={message.trashed && onRestoreMessage ? () => onRestoreMessage(message.id) : undefined}
                  onTrash={!message.trashed && onTrashMessage ? () => onTrashMessage(message.id) : undefined}
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
                  trashed={message.trashed}
                  onRestore={message.trashed && onRestoreMessage ? () => onRestoreMessage(message.id) : undefined}
                  onTrash={!message.trashed && onTrashMessage ? () => onTrashMessage(message.id) : undefined}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      )}
    </>
  )
}
