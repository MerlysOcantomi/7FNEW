"use client"

import { useState } from "react"
import { Loader2, Search, RefreshCw, Plus, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { ConversationListItem, type ShortIntentEntry } from "@/components/inbox/conversation-list-item"
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
  /**
   * Subject / short conversation label rendered as the secondary line in the *collapsed* row.
   * Replaced the old `senderIntent` (AI-derived snippet) on this surface to keep the list
   * scannable: collapsed = "who + what", expanded = "what to do next". The AI intent text now
   * lives only inside the expanded panel as `latestActiveIntent`.
   */
  subject?: string | null
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
  messageShortIntentsById: Record<string, ShortIntentEntry[]>
  messageIntentsLoadingId: string | null
  /** Click en un intent expandido (panel de la izquierda) → seleccionar conversación + mensaje. */
  onIntentSelect?: (conversationId: string, messageId: string) => void
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
  /**
   * Work / intent filter — orthogonal to conversation status. "open" hides conversations whose
   * latest inbound message is marked done in `Message.metadata.intentStatus`; "done" only shows
   * those. Storage is shared with the More menu's "Mark as done" so we never split state across
   * two systems.
   */
  intentStatusFilter?: "all" | "open" | "done"
  onIntentStatusFilterChange?: (value: "all" | "open" | "done") => void
  /**
   * Sender / remitente filter. Options are derived from the loaded list to keep this MVP. When
   * `senderOptions` is empty we hide the select instead of showing an empty dropdown.
   */
  senderFilter?: string
  senderOptions?: Array<{ value: string; label: string }>
  onSenderFilterChange?: (value: string) => void
  /**
   * Primary work filter chips on the top row. Mirrors the sidebar `?filter=` URL — the
   * chips are a shortcut surface inside the list itself so the operator can jump between
   * the most common work states (All / Needs action / Waiting / Done) without leaving
   * the panel. Single source of truth: the value comes from the URL `?filter=` in the
   * page-level shell, the change handler routes back to the URL. We do NOT keep a
   * second local state here so the chips and the sidebar can never disagree.
   *
   * Allowed values:
   *  - "all"          → no filter (default Inbox view, equivalent to `?filter=` empty)
   *  - "needs_action" → `?filter=needs_action`
   *  - "waiting"      → `?filter=waiting`
   *  - "done"         → `?filter=done`
   *
   * When the operator is on a sidebar entry that doesn't map to any of these (e.g.
   * Archived, Trash, Opportunities, To-do), no chip is highlighted — the sidebar
   * already shows where they are. Clicking a chip from that state navigates back to
   * one of the primary work views.
   */
  primaryWorkFilter?: "all" | "needs_action" | "waiting" | "done" | "other"
  onPrimaryWorkFilterChange?: (value: "all" | "needs_action" | "waiting" | "done") => void
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
  onIntentSelect,
  search,
  onSearchChange,
  status,
  statusOptions,
  onStatusChange,
  channel,
  channelOptions,
  onChannelChange,
  intentStatusFilter = "all",
  onIntentStatusFilterChange,
  senderFilter = "all",
  senderOptions = [],
  onSenderFilterChange,
  primaryWorkFilter = "all",
  onPrimaryWorkFilterChange,
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
  /**
   * Operational refactor (round 2): the primary row is now four work chips
   * (All / Needs action / Waiting / Done) tied to the sidebar `?filter=` URL. The
   * heavier `<Select>` controls — Status (with technical states like `lead_detected`,
   * `awaiting_response`, `triaged`) and Work intent (per-message done/open) — moved
   * to Advanced filters because they are power-user surfaces, not daily controls.
   *
   * Advanced is closed by default and auto-opens whenever any of its inputs holds a
   * non-default value, so the operator never has a "why is my list filtered?" moment.
   */
  const advancedHasActiveFilter =
    senderFilter !== "all" ||
    assignmentFilter !== "all" ||
    status !== "all" ||
    intentStatusFilter !== "all"
  const [advancedOpen, setAdvancedOpen] = useState(advancedHasActiveFilter)
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

        {/*
         * Primary row — work chips (All / Needs action / Waiting / Done). These map 1:1
         * to the sidebar Work group entries via the shared `?filter=` URL param, so the
         * chips and the sidebar are always in sync. When the operator is on a sidebar
         * entry that isn't one of these (e.g. Trash, Archived, Opportunities, To-do),
         * no chip is highlighted — the sidebar already shows where they are.
         *
         * Heavier filters (Status with all transition states, Work intent per-message)
         * moved to Advanced filters below.
         */}
        {onPrimaryWorkFilterChange ? (
          <div
            role="group"
            aria-label="Work filter"
            className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
          >
            {([
              { value: "all", label: "All" },
              { value: "needs_action", label: "Needs action" },
              { value: "waiting", label: "Waiting" },
              { value: "done", label: "Done" },
            ] as const).map((option) => {
              const isActive = primaryWorkFilter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPrimaryWorkFilterChange(option.value)}
                  aria-pressed={isActive}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                    isActive
                      ? "border-transparent bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)] shadow-[0_0_0_1px_var(--inbox-accent)/40]"
                      : "border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]",
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        ) : null}

        {/*
         * Channel chips — replaces the heavy `<Select>` so channel switching stays one click
         * and visually obvious. Horizontally scrollable on narrow screens (overflow-x-auto)
         * so we can add Instagram / Telegram later without breaking the layout.
         */}
        <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {channelOptions.map((option) => {
            const isActive = channel === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChannelChange(option.value)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-transparent bg-[var(--inbox-list-selected-bg)] text-[var(--inbox-list-selected)] shadow-sm"
                    : "border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]",
                )}
                aria-pressed={isActive}
                title={`Channel: ${option.label}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {/*
         * Advanced filters — collapsed by default. Holds the power-user controls that
         * don't fit the daily work chips: Status (with all transition states like
         * `lead_detected`, `awaiting_response`, `triaged`), Work intent (per-message
         * done/open via `Message.metadata.intentStatus`), Sender, and Assignment.
         *
         * Auto-expands whenever any of its inputs holds a non-default value so operators
         * always see the reason their list looks filtered. The wiring is preserved (no
         * functional removals) so power workflows that depended on the old top-row
         * Status/Work selects continue to work — they just live one extra click away.
         */}
        <div className="rounded-lg border border-[var(--inbox-list-border)]/50 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-medium text-[var(--inbox-list-text-secondary)] hover:text-[var(--inbox-list-text)]"
              aria-expanded={advancedOpen}
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3 w-3" />
                Advanced filters
                {advancedHasActiveFilter && (
                  <span className="rounded-full bg-[var(--inbox-accent)]/20 px-1.5 text-[9px] font-bold text-[var(--inbox-accent)]">
                    on
                  </span>
                )}
              </span>
              {advancedOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {advancedOpen && (
              <div className="space-y-2 border-t border-[var(--inbox-list-border)]/50 px-2.5 pb-2.5 pt-2">
                {/**
                 * Status — all conversation states. Demoted from the primary row because
                 * the four work chips above cover the daily flow (All / Needs action /
                 * Waiting / Done). This select stays for power use cases like jumping to
                 * `lead_detected`, `awaiting_response`, `triaged`, etc.
                 */}
                <Select value={status} onValueChange={onStatusChange}>
                  <SelectTrigger
                    className={cn(
                      INBOX_FILTER_TRIGGER_BASE,
                      status === "all" ? INBOX_FILTER_TRIGGER_IDLE : INBOX_FILTER_TRIGGER_ACTIVE,
                    )}
                    aria-label="Status filter"
                    title="Conversation status"
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

                {/**
                 * Work intent — per-message `Message.metadata.intentStatus`. Different
                 * from the Done chip above (which is conversation-level). Power filter,
                 * lives here so the daily chips stay focused.
                 */}
                {onIntentStatusFilterChange ? (
                  <Select
                    value={intentStatusFilter}
                    onValueChange={(v) => onIntentStatusFilterChange(v as "all" | "open" | "done")}
                  >
                    <SelectTrigger
                      className={cn(
                        INBOX_FILTER_TRIGGER_BASE,
                        intentStatusFilter === "all" ? INBOX_FILTER_TRIGGER_IDLE : INBOX_FILTER_TRIGGER_ACTIVE,
                      )}
                      aria-label="Work intent filter"
                      title="Per-message work / intent filter"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Work intent: All</SelectItem>
                      <SelectItem value="open">Work intent: Open</SelectItem>
                      <SelectItem value="done">Work intent: Done</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}

                {onSenderFilterChange && senderOptions.length > 0 ? (
                  <Select value={senderFilter} onValueChange={onSenderFilterChange}>
                    <SelectTrigger
                      className={cn(
                        INBOX_FILTER_TRIGGER_BASE,
                        senderFilter === "all" ? INBOX_FILTER_TRIGGER_IDLE : INBOX_FILTER_TRIGGER_ACTIVE,
                      )}
                      aria-label="Sender filter"
                      title="Filter by sender / remitente"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All senders</SelectItem>
                      {senderOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

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
            )}
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
                  subject={item.subject}
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

function formatSyncAge(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}
