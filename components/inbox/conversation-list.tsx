"use client"

import { Loader2, Search, Inbox, RefreshCw, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { ConversationListItem } from "@/components/inbox/conversation-list-item"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type AssignmentFilter = "all" | "mine" | "unassigned"

/** Base de los dos `<Select>` de filtros (alineado con altura/composer). */
const INBOX_FILTER_TRIGGER_BASE =
  "h-8 w-full justify-between gap-1 rounded-[8px] px-2.5 text-xs shadow-none transition-all duration-150 outline-none [&_svg]:opacity-50"
/** “All…” — delineado permanente sin parecer selección del sidebar. */
const INBOX_FILTER_TRIGGER_IDLE =
  "border border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] shadow-[0_0_0_1px_rgba(148,163,184,0.1)] hover:bg-white/[0.03] focus-visible:ring-1 focus-visible:ring-[var(--app-accent)]/25 data-[state=open]:bg-white/[0.05] data-[state=open]:shadow-[0_0_0_1px_var(--app-accent)/25]"
/** Filtro aplicado: mismo chrome que `SHELL_TOOLBAR_ICON_ACTIVE` / ítem activo sidebar. */
const INBOX_FILTER_TRIGGER_ACTIVE =
  "relative border-transparent bg-[var(--app-sidebar-surface)] font-medium text-[var(--app-accent)] shadow-[0_0_0_1px_var(--app-accent),0_0_10px_0_rgba(99,102,241,0.22)] before:pointer-events-none before:absolute before:left-px before:top-1/2 before:z-10 before:h-3.5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--app-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent)]/30 [&_svg]:opacity-70 [&_svg]:text-[var(--app-accent)]"

interface ConversationItem {
  id: string
  channel: string
  title: string
  senderIntent?: string | null
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
}

interface ConversationListProps {
  loading: boolean
  errorMessage: string | null
  conversations: ConversationItem[]
  selectedId: string | null
  expandedConversationId: string | null
  onToggleConversationExpand: (id: string) => void
  messageShortIntentsById: Record<string, string[]>
  messageIntentsLoadingId: string | null
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
    trash: number
  }
  onSelect: (id: string) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  activeSearchTerm?: string
  onFetchEmails?: () => void
  fetchingEmails?: boolean
  lastSyncedAt?: Date | null
  onCompose?: () => void
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
  onSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  activeSearchTerm,
  onFetchEmails,
  fetchingEmails = false,
  lastSyncedAt,
  onCompose,
}: ConversationListProps) {
  const viewLabel =
    assignmentFilter === "mine"
      ? "My conversations"
      : assignmentFilter === "unassigned"
        ? "Unassigned conversations"
        : "All conversations"
  return (
    <div className="h-full min-h-0 w-full shrink-0 bg-[var(--inbox-list-background)] xl:flex xl:flex-col xl:overflow-hidden">
      <div className="space-y-3 border-b border-[var(--inbox-list-border)] bg-[var(--inbox-list-surface)] px-4 py-4 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight text-[var(--inbox-list-text)]">Inbox</h1>
          <div className="flex items-center gap-2">
            {activeSearchTerm && (
              <div className="px-2 py-1 rounded-md bg-[var(--inbox-list-selected-bg)] text-xs text-[var(--inbox-list-selected)] font-medium">
                &ldquo;{activeSearchTerm}&rdquo;
              </div>
            )}
            {onFetchEmails && (
              <div className="flex items-center gap-1.5">
                {lastSyncedAt && !fetchingEmails && (
                  <span className="text-[10px] text-[var(--inbox-list-text-secondary)]/60" title={lastSyncedAt.toLocaleString()}>
                    {formatSyncAge(lastSyncedAt)}
                  </span>
                )}
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                    fetchingEmails
                      ? "text-[var(--inbox-accent)]"
                      : "text-[var(--inbox-list-text-secondary)] hover:text-[var(--inbox-list-text)] hover:bg-[var(--inbox-list-background)]",
                  )}
                  onClick={onFetchEmails}
                  disabled={fetchingEmails}
                  title={fetchingEmails ? "Syncing emails..." : "Refresh now"}
                >
                  <RefreshCw className={cn("h-3 w-3", fetchingEmails && "animate-spin")} />
                  {fetchingEmails && <span>Syncing…</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        {onCompose && (
          <button
            type="button"
            onClick={onCompose}
            className="flex w-full items-center gap-2 rounded-lg bg-[var(--inbox-accent)] px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--inbox-accent-hover)] active:bg-[var(--inbox-accent)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Compose
          </button>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--inbox-list-text-secondary)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations..."
            className="h-9 rounded-lg border-[var(--inbox-list-border)] bg-white/[0.05] pl-9 text-sm text-[var(--inbox-list-text)] placeholder:text-[var(--inbox-list-text-secondary)] focus:border-[var(--inbox-list-selected)] focus:ring-1 focus:ring-[var(--inbox-list-selected)]/25 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger
              className={cn(
                INBOX_FILTER_TRIGGER_BASE,
                status === "all" ? INBOX_FILTER_TRIGGER_IDLE : INBOX_FILTER_TRIGGER_ACTIVE,
              )}
            >
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
            <SelectTrigger
              className={cn(
                INBOX_FILTER_TRIGGER_BASE,
                channel === "all" ? INBOX_FILTER_TRIGGER_IDLE : INBOX_FILTER_TRIGGER_ACTIVE,
              )}
            >
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
        </div>

        <div className="grid grid-cols-3 gap-1">
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
              className={cn(
                "h-7 w-full text-xs rounded-lg transition-all",
                assignmentFilter === option.value
                  ? "bg-[var(--inbox-list-selected-bg)] text-[var(--inbox-list-selected)] shadow-sm"
                  : "text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:shadow-sm",
              )}
              onClick={() => onAssignmentFilterChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

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
                  senderIntent={item.senderIntent}
                  sectorLabel={item.sectorLabel}
                  timeLabel={item.timeLabel}
                  selected={selectedId === item.id}
                  isUnread={item.isUnread}
                  onClick={() => onSelect(item.id)}
                  expanded={expandedConversationId === item.id}
                  onToggleExpand={() => onToggleConversationExpand(item.id)}
                  shortIntentLines={messageShortIntentsById[item.id]}
                  intentsLoading={messageIntentsLoadingId === item.id}
                  conversationStatus={item.conversationStatus}
                  statusLabel={item.statusLabel}
                  statusClassName={item.statusClassName}
                  channelLabel={item.channelLabel}
                  urgencyLabel={item.urgencyLabel}
                  urgencyClassName={item.urgencyClassName}
                  leadScore={item.leadScore}
                  messageCount={item.messageCount}
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

function formatSyncAge(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}
