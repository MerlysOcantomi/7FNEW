"use client"

import { AlertTriangle, ChevronLeft, Loader2, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { InlineSelect } from "@/components/inline-edit"
import { MessageBubble, type MessageAttachment, type MessageEmailMeta } from "@/components/inbox/message-bubble"
import { FannyAssistCard, type FannyAssistState } from "@/components/inbox/fanny-assist-card"
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
  statusValue: string
  statusOptions: StatusOption[]
  onStatusChange: (value: string) => Promise<void>
  statusBadgeClassName: (value: string) => string
  messages: MessageItem[]
  onBack?: () => void
  onOpenContext?: () => void
  // Fanny props
  fannyState: FannyAssistState
  fannySummary?: string | null
  fannySuggestionTitle?: string | null
  fannySuggestionContent?: string | null
  fannyNextRecommendedAction?: string | null
  fannyConfidenceLabel?: string | null
  fannyDetectedLanguage?: string | null
  fannyAutoPopulated?: boolean
  onFannyToggleExpanded: () => void
  onFannyInsertSuggestion?: () => void
  onFannyEditSuggestion?: () => void
  onFannyDismiss: () => void
}

export function ConversationThread({
  hasSelectedId,
  detailLoading,
  detailErrorMessage,
  headerTitle,
  headerSubtitle,
  statusValue,
  statusOptions,
  onStatusChange,
  statusBadgeClassName,
  messages,
  onBack,
  onOpenContext,
  fannyState,
  fannySummary,
  fannySuggestionTitle,
  fannySuggestionContent,
  fannyNextRecommendedAction,
  fannyConfidenceLabel,
  fannyDetectedLanguage,
  fannyAutoPopulated,
  onFannyToggleExpanded,
  onFannyInsertSuggestion,
  onFannyEditSuggestion,
  onFannyDismiss,
}: ConversationThreadProps) {
  if (!hasSelectedId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
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
          icon={AlertTriangle}
          title="Could not load conversation"
          description={detailErrorMessage}
        />
      </div>
    )
  }

  return (
    <>
      {/* Mobile navigation */}
      <div className="xl:hidden shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 rounded-[var(--inbox-radius-control)] px-2 text-xs" onClick={onBack}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Inbox
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-[var(--inbox-radius-control)] text-xs" onClick={onOpenContext}>
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

      {/* Fanny header */}
      {fannyState !== "hidden" && (
        <div className="shrink-0">
          <FannyAssistCard
            state={fannyState}
            summary={fannySummary}
            suggestionTitle={fannySuggestionTitle}
            suggestionContent={fannySuggestionContent}
            nextRecommendedAction={fannyNextRecommendedAction}
            confidenceLabel={fannyConfidenceLabel}
            detectedLanguage={fannyDetectedLanguage}
            autoPopulated={fannyAutoPopulated}
            onToggleExpanded={onFannyToggleExpanded}
            onInsertSuggestion={onFannyInsertSuggestion}
            onEditSuggestion={onFannyEditSuggestion}
            onDismiss={onFannyDismiss}
          />
        </div>
      )}

      {/* Desktop status (when no Fanny or collapsed) */}
      <div className="hidden xl:block shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <h1 className="truncate font-medium text-[var(--inbox-text)]">{headerTitle}</h1>
              <span className="shrink-0 text-[var(--inbox-text-secondary)]">•</span>
              <p className="truncate text-[var(--inbox-text-secondary)]">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InlineSelect
              value={statusValue}
              options={statusOptions}
              onSave={onStatusChange}
              badgeClassName={statusBadgeClassName}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 bg-[var(--inbox-chat-background)] px-5 py-6 md:px-6 md:py-7">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--inbox-border)] bg-[var(--inbox-surface)]/50 p-6">
              <p className="text-sm text-[var(--inbox-text-secondary)]">No messages yet.</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                authorLabel={message.authorLabel}
                roleLabel={message.roleLabel}
                metaLabel={message.metaLabel}
                timestampLabel={message.timestampLabel}
                content={message.content}
                tone={message.tone}
                attachments={message.attachments}
                emailMeta={message.emailMeta}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </>
  )
}
