"use client"

import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { ConversationListItem, type ShortIntentEntry } from "@/components/inbox/conversation-list-item"

/**
 * Conversation list — pure listing surface.
 *
 * Filters, search, fetch and compose used to live in this component's header,
 * which forced everything to fight for ~30% of the viewport. They were lifted
 * to `<InboxToolbar>` (rendered above the three-column grid in `app/inbox/
 * page.tsx`) so they can span the full width and wrap their controls
 * naturally. This component now renders only the list itself: skeletons,
 * empty states, the items, and the load-more affordance.
 *
 * Empty-state copy still depends on `assignmentFilter` (so "Mine" / "Unassigned"
 * surface the right message) and `activeSearchTerm` (so the operator sees
 * which query produced the empty result). Both values continue to be supplied
 * by `page.tsx` even though the inputs that mutate them now live elsewhere.
 */

type AssignmentFilter = "all" | "mine" | "unassigned"

interface ConversationItem {
  id: string
  channel: string
  title: string
  /**
   * Subject is no longer rendered in the collapsed row (the row is sender-only by design —
   * see `ConversationListItem` for the full rationale). It still arrives in `conversationItems`
   * from `app/inbox/page.tsx` because the same shape is consumed by other surfaces (thread
   * header, Smart Hub, mobile sheet title) — keep the field but don't pass it down to the
   * list item.
   */
  subject?: string | null
  /**
   * Short AI signal for the radar row (thread `intent`, falling back to `summary`).
   * Forwarded to `<ConversationListItem>` and rendered as a single muted line under
   * the sender. `null` keeps the row to channel + sender + time only.
   */
  intentSummary?: string | null
  sectorLabel?: string | null
  timeLabel: string
  isUnread: boolean
  conversationStatus: string
  statusLabel: string
  statusClassName: string
  channelLabel: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
  messageCount: number
  /**
   * Operator-assigned workspace category from `Conversation.category`.
   * Forwarded as-is to `<ConversationListItem>` → `<ConversationMetaLine>`
   * which decides whether to render the badge. `null` / `undefined`
   * keeps the row identical to its pre-category appearance, which is
   * what Skina and any other workspace without taxonomies will see.
   */
  category?: string | null
  /**
   * PR 10 — count of Fanny-suggested `WorkspaceTask` rows still in
   * `proposed` status for this conversation. Forwarded as-is to
   * `<ConversationListItem>` → `<ConversationMetaLine>` which renders
   * a discreet "Fanny suggestion(s)" pill only when the value is `> 0`.
   * Defaults to `0` everywhere — the row stays visually identical for
   * conversations with no pending suggestions.
   */
  proposedTaskCount?: number
  /**
   * PR 2 — derived, read-only Smart Action state. Forwarded as-is to
   * `<ConversationListItem>` → `<ConversationMetaLine>`, which renders a
   * single subtle pill. `"none"` / `undefined` keeps the row identical.
   */
  smartActionState?:
    | "none"
    | "failed"
    | "needs_review"
    | "draft_ready"
    | "action_ready"
    | "task_created"
}

interface ConversationListProps {
  loading: boolean
  errorMessage: string | null
  conversations: ConversationItem[]
  selectedId: string | null
  expandedConversationId: string | null
  onToggleConversationExpand: (id: string) => void
  messageShortIntentsById: Record<string, ShortIntentEntry[]>
  messageIntentsLoadingId: string | null
  /** Click en un intent expandido (panel de la izquierda) → seleccionar conversación + mensaje. */
  onIntentSelect?: (conversationId: string, messageId: string) => void
  assignmentFilter: AssignmentFilter
  onSelect: (id: string) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  activeSearchTerm?: string
}

export function ConversationList({
  loading,
  errorMessage,
  conversations,
  selectedId,
  expandedConversationId,
  onToggleConversationExpand,
  messageShortIntentsById,
  messageIntentsLoadingId,
  onIntentSelect,
  assignmentFilter,
  onSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  activeSearchTerm,
}: ConversationListProps) {
  return (
    <div className="h-full min-h-0 w-full shrink-0 bg-[var(--inbox-list-background)] xl:flex xl:flex-col xl:overflow-hidden">
      <ScrollArea className="min-h-0 flex-1 bg-[var(--inbox-list-background)]">
        <div className="space-y-1 px-3 py-3 md:px-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-lg border-b border-white/[0.06] bg-white/[0.03] p-4">
                <Skeleton className="h-4 w-2/3 bg-white/10" />
                <Skeleton className="mt-2 h-3 w-1/2 bg-white/10" />
                <Skeleton className="mt-3 h-3 w-full bg-white/10" />
                <Skeleton className="mt-2 h-3 w-4/5 bg-white/10" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
                  <Skeleton className="h-5 w-14 rounded-full bg-white/10" />
                </div>
              </div>
            ))
          ) : errorMessage ? (
            <EmptyState
              variant="inbox"
              icon={Search}
              title="Inbox unavailable"
              description={errorMessage}
            />
          ) : conversations.length === 0 ? (
            <EmptyState
              variant="inbox"
              icon={Search}
              title={
                activeSearchTerm
                  ? "No results"
                  : assignmentFilter === "mine"
                    ? "Nothing assigned to you"
                    : assignmentFilter === "unassigned"
                      ? "All conversations are assigned"
                      : "No conversations"
              }
              description={
                activeSearchTerm
                  ? `No conversations match "${activeSearchTerm}". Try different keywords or broaden your filters.`
                  : assignmentFilter === "mine"
                    ? "You have no conversations assigned right now."
                    : assignmentFilter === "unassigned"
                      ? "Every conversation has an owner."
                      : "Try broadening your filters or check back later."
              }
            />
          ) : (
            <>
              {conversations.map((item) => (
                <ConversationListItem
                  key={item.id}
                  channel={item.channel}
                  title={item.title}
                  intentSummary={item.intentSummary}
                  sectorLabel={item.sectorLabel}
                  timeLabel={item.timeLabel}
                  selected={selectedId === item.id}
                  isUnread={item.isUnread}
                  onClick={() => onSelect(item.id)}
                  expanded={expandedConversationId === item.id}
                  onToggleExpand={() => onToggleConversationExpand(item.id)}
                  intents={messageShortIntentsById[item.id]}
                  intentsLoading={messageIntentsLoadingId === item.id}
                  onIntentSelect={
                    onIntentSelect
                      ? (messageId) => onIntentSelect(item.id, messageId)
                      : undefined
                  }
                  conversationStatus={item.conversationStatus}
                  statusLabel={item.statusLabel}
                  statusClassName={item.statusClassName}
                  channelLabel={item.channelLabel}
                  urgencyLabel={item.urgencyLabel}
                  urgencyClassName={item.urgencyClassName}
                  leadScore={item.leadScore}
                  messageCount={item.messageCount}
                  category={item.category}
                  proposedTaskCount={item.proposedTaskCount}
                  smartActionState={item.smartActionState}
                />
              ))}
              {hasMore && onLoadMore && (
                <div className="flex justify-center py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="w-full rounded-[var(--inbox-radius-control)] border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)] disabled:text-[var(--inbox-list-text-secondary)]/60"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more conversations"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
