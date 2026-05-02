"use client"

import { CheckSquare, ListTodo, Loader2, RefreshCw } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import {
  InboxTodoListItem,
  type ClientInboxTodo,
} from "@/components/inbox/inbox-todo-list-item"

/**
 * InboxTodoList — sidebar To-do view (Phase 2 of the operational queue).
 *
 * Sibling to ConversationList: same column slot, same dark surface tokens, but a flat list of
 * actionable items instead of conversation threads. Filter is fixed to `status=open,waiting` at
 * the page layer; we don't expose it here because the MVP scope explicitly avoids extra controls.
 *
 * Selection drives a deep-link (`?id=<conversationId>&messageId=<sourceMessageId>`) handled by
 * the page; this component only emits the click. Status mutations (done / dismiss) are also
 * delegated upward — keeps the list dumb and reusable later from a different mount point.
 */

interface ContactInfo {
  /** Best-effort label: contact name → empresa → email → "(Unknown sender)". */
  label: string | null
  /** Localized channel label for the source conversation, when known. */
  channelLabel: string | null
}

interface InboxTodoListProps {
  todos: ClientInboxTodo[]
  loading: boolean
  errorMessage?: string | null
  selectedId?: string | null
  /** Optional resolver for displaying the contact attached to a To-do's conversation. */
  contactsByConversationId?: Record<string, ContactInfo | undefined>
  busyTodoId?: string | null
  onSelect: (todo: ClientInboxTodo) => void
  onToggleDone: (todo: ClientInboxTodo) => void
  onDismiss: (todo: ClientInboxTodo) => void
  /** Manual refresh — the parent typically polls but operators may want a fresh sync. */
  onRefresh?: () => void
}

export function InboxTodoList({
  todos,
  loading,
  errorMessage,
  selectedId,
  contactsByConversationId,
  busyTodoId,
  onSelect,
  onToggleDone,
  onDismiss,
  onRefresh,
}: InboxTodoListProps) {
  /**
   * Show overdue / due-today first, then the rest by createdAt desc. We don't sort by
   * priority because urgent items without a due date shouldn't outrank truly-late items.
   * The chip styling already makes priority visible.
   */
  const sorted = [...todos].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
    if (aDue !== bDue) return aDue - bDue
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="h-full min-h-0 w-full shrink-0 bg-[var(--inbox-list-background)] xl:flex xl:flex-col xl:overflow-hidden">
      <div className="space-y-2 border-b border-[var(--inbox-list-border)] bg-[var(--inbox-list-surface)] px-4 py-4 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListTodo
              className="h-4 w-4 text-[var(--inbox-accent)]"
              strokeWidth={2}
            />
            <h1 className="text-lg font-bold tracking-tight text-[var(--inbox-list-text)]">
              To-do
            </h1>
            {!loading && todos.length > 0 && (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[var(--inbox-list-text-secondary)]">
                {todos.length}
              </span>
            )}
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                loading
                  ? "text-[var(--inbox-accent)]"
                  : "text-[var(--inbox-list-text-secondary)] hover:text-[var(--inbox-list-text)] hover:bg-[var(--inbox-list-background)]",
              )}
              title={loading ? "Refreshing…" : "Refresh"}
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </button>
          )}
        </div>
        <p className="text-[11px] text-[var(--inbox-list-text-secondary)]">
          {/*
           * Subtitle is intentionally aspirational — surfaces the future capability without
           * promising it. Once Phase 3 (convert pendingItem → todo) ships, swap for "Tap any
           * pending item in a conversation to add it here".
           */}
          Open work surfaced from messages, notes, and Fanny.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1 bg-[var(--inbox-list-background)]">
        <div className="space-y-1 px-3 py-3 md:px-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-lg px-2.5 py-2"
              >
                <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded bg-white/10" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 bg-white/10" />
                  <Skeleton className="h-2.5 w-1/2 bg-white/10" />
                </div>
              </div>
            ))
          ) : errorMessage ? (
            <EmptyState
              variant="inbox"
              icon={Loader2}
              title="To-dos unavailable"
              description={errorMessage}
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              variant="inbox"
              icon={CheckSquare}
              title="No to-dos yet"
              description="Fanny and Smart Inbox will surface actionable work here."
            />
          ) : (
            sorted.map((todo) => {
              const contact = todo.conversationId
                ? contactsByConversationId?.[todo.conversationId]
                : undefined
              return (
                <InboxTodoListItem
                  key={todo.id}
                  todo={todo}
                  contactLabel={contact?.label ?? null}
                  channelLabel={contact?.channelLabel ?? null}
                  selected={selectedId === todo.id}
                  busy={busyTodoId === todo.id}
                  onSelect={() => onSelect(todo)}
                  onToggleDone={() => onToggleDone(todo)}
                  onDismiss={() => onDismiss(todo)}
                />
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
