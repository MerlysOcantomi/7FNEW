"use client"

import { AlertTriangle, ArrowRight, ChevronLeft, Globe, Loader2, MessageSquare, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { InlineSelect } from "@/components/inline-edit"
import { MessageBubble, type MessageAttachment, type MessageEmailMeta } from "@/components/inbox/message-bubble"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface MemberOption {
  userId: string
  nombre: string | null
  email: string
}

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
  assignedTo: string
  members: MemberOption[]
  assignSaving: boolean
  onAssign: (value: string) => void
  statusValue: string
  statusOptions: StatusOption[]
  onStatusChange: (value: string) => Promise<void>
  statusBadgeClassName: (value: string) => string
  messages: MessageItem[]
  onBack?: () => void
  onOpenContext?: () => void
  handoffSummary?: string | null
  nextAction?: string | null
  detectedLanguage?: string | null
  urgencyLabel?: string | null
  urgencyClassName?: string | null
  suggestedActionsCount?: number
}

export function ConversationThread({
  hasSelectedId,
  detailLoading,
  detailErrorMessage,
  headerTitle,
  headerSubtitle,
  assignedTo,
  members,
  assignSaving,
  onAssign,
  statusValue,
  statusOptions,
  onStatusChange,
  statusBadgeClassName,
  messages,
  onBack,
  onOpenContext,
  handoffSummary,
  nextAction,
  detectedLanguage,
  urgencyLabel,
  urgencyClassName,
  suggestedActionsCount = 0,
}: ConversationThreadProps) {
  const hasSituationContext = Boolean(handoffSummary || nextAction)
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      <div className="shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-5 py-5 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/94 md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-2 xl:hidden">
              <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 rounded-[var(--inbox-radius-control)] px-2" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" />
                Inbox
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-[var(--inbox-radius-control)]" onClick={onOpenContext}>
                <Sparkles className="h-3.5 w-3.5" />
                Context
              </Button>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-[var(--inbox-muted)]">
              Case Thread
            </p>
            <h1 className="mt-2 truncate text-lg font-bold text-foreground leading-tight md:text-xl">{headerTitle}</h1>
            <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-[var(--inbox-text-secondary)]">
              {headerSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden rounded-[var(--inbox-radius-control)]"
              onClick={onOpenContext}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Context
            </Button>
            <div className="flex min-w-[200px] items-center gap-2.5 rounded-[var(--inbox-radius-control)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 shadow-sm">
              <Users className="h-4 w-4 text-[var(--inbox-text-secondary)]" />
              <Select 
                value={assignedTo || "unassigned"} 
                onValueChange={(value) => onAssign(value === "unassigned" ? "" : value)} 
                disabled={assignSaving}
              >
                <SelectTrigger className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="min-w-[200px]">
                  <SelectItem value="unassigned">
                    <span className="text-[var(--inbox-text-secondary)]">Unassigned</span>
                  </SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {member.nombre || member.email}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--inbox-text-secondary)]" />}
            </div>

            <InlineSelect
              value={statusValue}
              options={statusOptions}
              onSave={onStatusChange}
              badgeClassName={statusBadgeClassName}
            />
          </div>
        </div>
      </div>

      {hasSituationContext && (
        <div className="shrink-0 border-b border-[var(--inbox-divider)] bg-gradient-to-r from-[var(--inbox-accent-soft)]/25 to-[var(--inbox-accent-soft)]/35 px-5 py-3.5 md:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)]/60 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-[var(--inbox-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              {handoffSummary && (
                <p className="text-sm leading-relaxed text-[var(--inbox-text-secondary)] font-medium">
                  {handoffSummary}
                </p>
              )}
              {nextAction && (
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--inbox-text)]">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
                  <span className="truncate">{nextAction}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {detectedLanguage && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/80 px-2.5 py-1 text-xs font-semibold text-[var(--inbox-text-secondary)] backdrop-blur-sm">
                  <Globe className="h-3 w-3" />
                  {detectedLanguage.toUpperCase()}
                </span>
              )}
              {urgencyLabel && urgencyClassName && (
                <span className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", urgencyClassName)}>
                  {urgencyLabel}
                </span>
              )}
              {suggestedActionsCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenContext}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--inbox-accent-soft)]/80 px-2.5 py-1 text-xs font-semibold text-[var(--inbox-accent)] transition-all duration-200 hover:bg-[var(--inbox-accent-soft)] hover:shadow-sm"
                >
                  <Sparkles className="h-3 w-3" />
                  {suggestedActionsCount} action{suggestedActionsCount === 1 ? "" : "s"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 bg-[linear-gradient(180deg,rgba(246,247,249,0.92)_0%,rgba(246,247,249,0.5)_72%,rgba(246,247,249,0.24)_100%)] px-4 py-4 md:px-5 md:py-5">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6">
              <p className="text-sm text-muted-foreground">No messages yet.</p>
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
