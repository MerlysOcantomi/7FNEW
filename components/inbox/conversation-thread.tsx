"use client"

import { AlertTriangle, ChevronLeft, Loader2, MessageSquare, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { InlineSelect } from "@/components/inline-edit"
import { MessageBubble } from "@/components/inbox/message-bubble"

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
      <div className="shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--inbox-surface)]/92 md:px-5">
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

            <p className="truncate text-base font-semibold text-foreground md:text-lg">{headerTitle}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {headerSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden rounded-[var(--inbox-radius-control)] xl:inline-flex min-[1440px]:hidden"
              onClick={onOpenContext}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Context
            </Button>
            <div className="flex min-w-[172px] items-center gap-2 rounded-[var(--inbox-radius-control)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-2.5 py-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={assignedTo}
                onChange={(event) => onAssign(event.target.value)}
                disabled={assignSaving}
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.nombre || member.email}
                  </option>
                ))}
              </select>
              {assignSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
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

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 bg-[linear-gradient(180deg,rgba(246,247,249,0.88)_0%,rgba(246,247,249,0.42)_100%)] px-4 py-4 md:px-5 md:py-5">
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
              />
            ))
          )}

        </div>
      </ScrollArea>
    </>
  )
}
