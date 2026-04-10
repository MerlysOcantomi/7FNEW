"use client"

import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { ConversationListItem } from "@/components/inbox/conversation-list-item"
import { InboxSubNavigation, type InboxFilter } from "@/components/inbox/inbox-sub-navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AssignmentFilter = "all" | "mine" | "unassigned"

interface ConversationItem {
  id: string
  channel: string
  title: string
  subtitle: string
  preview: string | null
  fullMessage?: string | null
  timeLabel: string
  isUnread: boolean
  statusLabel: string
  statusClassName: string
  channelLabel: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
  tone?: string
}

interface ConversationListProps {
  loading: boolean
  errorMessage: string | null
  conversations: ConversationItem[]
  selectedId: string | null
  search: string
  onSearchChange: (value: string) => void
  status: string
  statusOptions: Array<{ value: string; label: string }>
  onStatusChange: (value: string) => void
  channel: string
  channelOptions: Array<{ value: string; label: string }>
  onChannelChange: (value: string) => void
  assignmentFilter: AssignmentFilter
  onAssignmentFilterChange: (value: AssignmentFilter) => void
  stats: {
    total: number
    leads: number
    urgent: number
    unread: number
    reply: number
    waiting: number
    done: number
    archived: number
    spam: number
  }
  activeFilter: InboxFilter
  onFilterChange: (filter: InboxFilter) => void
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
  search,
  onSearchChange,
  status,
  statusOptions,
  onStatusChange,
  channel,
  channelOptions,
  onChannelChange,
  assignmentFilter,
  onAssignmentFilterChange,
  stats,
  activeFilter,
  onFilterChange,
  onSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  activeSearchTerm,
}: ConversationListProps) {
  const viewLabel =
    assignmentFilter === "mine"
      ? "My conversations"
      : assignmentFilter === "unassigned"
        ? "Unassigned conversations"
        : "All conversations"
  return (
    <div className="h-full min-h-0 w-full shrink-0 bg-[var(--inbox-surface)] xl:flex xl:flex-col xl:overflow-hidden">
      <div className="space-y-3 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-4 py-4 md:px-5">
        {/* Header simplificado */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--inbox-text)]">Inbox</h1>
          </div>
          {activeSearchTerm && (
            <p className="text-xs text-[var(--inbox-text-secondary)]">
              Searching: "{activeSearchTerm}"
            </p>
          )}
        </div>

        {/* Sub-navegación con iconitos coloridos */}
        <InboxSubNavigation 
          activeFilter={activeFilter}
          stats={stats}
          onFilterChange={onFilterChange}
        />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--inbox-muted)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, email, subject, messages..."
            className="h-9 rounded-[var(--inbox-radius-control)] border-[var(--inbox-border)] bg-[var(--inbox-background)] pl-10 shadow-none"
          />
        </div>

        {/* Filtros avanzados - más discretos */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-[var(--inbox-radius-control)] border-[var(--inbox-border)] bg-[var(--inbox-background)] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={channel} onValueChange={onChannelChange}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-[var(--inbox-radius-control)] border-[var(--inbox-border)] bg-[var(--inbox-background)] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {([
              { value: "all", label: "All" },
              { value: "mine", label: "Mine" },
              { value: "unassigned", label: "Unassigned" },
            ] as const).map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={assignmentFilter === option.value ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => onAssignmentFilterChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-3 py-4 md:px-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-[var(--inbox-radius-control)] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/70 p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))
          ) : errorMessage ? (
            <EmptyState
              icon={Search}
              title="Inbox unavailable"
              description={errorMessage}
            />
          ) : conversations.length === 0 ? (
            <EmptyState
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
                  subtitle={item.subtitle}
                  preview={item.preview}
                  fullMessage={item.fullMessage}
                  timeLabel={item.timeLabel}
                  selected={selectedId === item.id}
                  isUnread={item.isUnread}
                  onClick={() => onSelect(item.id)}
                  statusLabel={item.statusLabel}
                  statusClassName={item.statusClassName}
                  channelLabel={item.channelLabel}
                  urgencyLabel={item.urgencyLabel}
                  urgencyClassName={item.urgencyClassName}
                  leadScore={item.leadScore}
                  tone={item.tone}
                  // Quick actions - TODO: Implement real callbacks
                  onFavorite={() => console.log('Favorite:', item.id)}
                  onArchive={() => console.log('Archive:', item.id)}
                  onDelete={() => console.log('Delete:', item.id)}
                  onMarkRead={() => console.log('Mark read:', item.id)}
                  isFavorited={false}
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
                    className="w-full rounded-[var(--inbox-radius-control)]"
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
