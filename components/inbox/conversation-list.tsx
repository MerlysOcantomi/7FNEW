"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/empty-state"
import { ConversationListItem } from "@/components/inbox/conversation-list-item"

type AssignmentFilter = "all" | "mine" | "unassigned"

interface ConversationItem {
  id: string
  channel: string
  title: string
  subtitle: string
  preview: string
  timeLabel: string
  isUnread: boolean
  statusLabel: string
  statusClassName: string
  channelLabel: string
  urgencyLabel: string
  urgencyClassName: string
  leadScore?: number | null
}

interface ConversationListProps {
  loading: boolean
  errorMessage: string | null
  conversations: ConversationItem[]
  selectedId: string | null
  search: string
  onSearchChange: (value: string) => void
  status: string
  statusOptions: string[]
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
  }
  onSelect: (id: string) => void
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
  onSelect,
}: ConversationListProps) {
  return (
    <div className="h-full min-h-0 w-full shrink-0 bg-[var(--inbox-surface)] xl:flex xl:flex-col xl:overflow-hidden">
      <div className="space-y-3 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-4 py-4 md:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-[var(--inbox-text)]">Inbox</h1>
            <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-[var(--inbox-text-secondary)]">
              Unified multichannel conversations.
            </p>
          </div>
          <div className="flex max-w-[10rem] flex-wrap justify-end gap-1.5 text-[11px]">
            <span className="rounded-full border border-[var(--inbox-divider)] bg-[var(--inbox-background)] px-2 py-1 text-[var(--inbox-text-secondary)]">
              {loading ? "..." : `${stats.total} conv`}
            </span>
            {stats.leads > 0 && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                {stats.leads} leads
              </span>
            )}
            {stats.urgent > 0 && (
              <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700">
                {stats.urgent} urgent
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--inbox-muted)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations..."
            className="h-10 rounded-[var(--inbox-radius-control)] border-[var(--inbox-border)] bg-[var(--inbox-background)] pl-10 shadow-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-10 rounded-[var(--inbox-radius-control)] border border-[var(--inbox-border)] bg-[var(--inbox-background)] px-3 text-sm text-[var(--inbox-text)] outline-none transition-[color,box-shadow] focus-visible:border-[var(--inbox-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--inbox-accent)]/20"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </option>
            ))}
          </select>

          <select
            value={channel}
            onChange={(event) => onChannelChange(event.target.value)}
            className="h-10 rounded-[var(--inbox-radius-control)] border border-[var(--inbox-border)] bg-[var(--inbox-background)] px-3 text-sm text-[var(--inbox-text)] outline-none transition-[color,box-shadow] focus-visible:border-[var(--inbox-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--inbox-accent)]/20"
          >
            {channelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "all", label: "All" },
            { value: "mine", label: "Mine" },
            { value: "unassigned", label: "Unassigned" },
          ] as const).map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={assignmentFilter === option.value ? "accent" : "outline"}
              className="rounded-[var(--inbox-radius-control)] px-2 text-[11px] sm:text-xs"
              onClick={() => onAssignmentFilterChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-3 py-3 md:px-4">
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
              title="No conversations"
              description="Try broadening your filters or search terms."
            />
          ) : (
            conversations.map((item) => (
              <ConversationListItem
                key={item.id}
                channel={item.channel}
                title={item.title}
                subtitle={item.subtitle}
                preview={item.preview}
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
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
