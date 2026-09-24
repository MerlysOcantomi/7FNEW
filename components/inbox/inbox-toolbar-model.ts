/** SESSION 7F-INBOX-20260923-01: shared presentation and filter interactions. */
export type InboxDatePreset = "all" | "today" | "7d" | "30d"
export type InboxAssignmentFilter = "all" | "mine" | "unassigned"
export type InboxFilterOption = { value: string; label: string; disabled?: boolean }

export interface InboxToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  activeSearchTerm?: string
  onFetchEmails?: () => void
  fetchingEmails?: boolean
  lastSyncedAt?: Date | null
  onCompose?: () => void
  primaryWorkFilter?: string
  onPrimaryWorkFilterChange?: (value: string) => void
  workFilterOptions?: InboxFilterOption[]
  variant?: "simple" | "standard"
  datePreset?: InboxDatePreset
  onDatePresetChange?: (value: InboxDatePreset) => void
  channel: string
  channelOptions: InboxFilterOption[]
  onChannelChange: (value: string) => void
  status: string
  statusOptions: InboxFilterOption[]
  onStatusChange: (value: string) => void
  urgencyFilter?: string
  onUrgencyFilterChange?: (value: string) => void
  intentStatusFilter?: "all" | "open" | "done"
  onIntentStatusFilterChange?: (value: "all" | "open" | "done") => void
  assignmentFilter: InboxAssignmentFilter
  onAssignmentFilterChange: (value: InboxAssignmentFilter) => void
  isTodoMode?: boolean
}

/** One geometry for buttons, selects and search. No color/theme overrides. */
export const SIMPLE_INBOX_LAYOUT = {
  row: "grid min-w-0 grid-cols-6 items-center gap-2 p-2 sm:flex sm:flex-wrap sm:px-3 md:px-4",
  control: "inline-flex h-10 min-w-0 w-full items-center justify-center gap-1 rounded-[var(--app-control-radius,999px)] border px-1.5 py-0 text-xs font-medium leading-none whitespace-nowrap sm:h-8 sm:w-auto sm:gap-1.5 sm:px-3",
  primary: "col-span-2 sm:col-auto sm:shrink-0",
  secondary: "col-span-3 sm:col-auto sm:shrink-0",
  search: "relative col-span-6 min-w-0 w-full sm:col-auto sm:ml-auto sm:w-[170px] lg:w-[210px]",
  // Radix's data-size height is more specific than a bare h-* utility.
  select: "data-[size=sm]:h-10 sm:data-[size=sm]:h-8 justify-between shadow-none [&_svg]:size-3 [&_svg]:shrink-0",
} as const

export function hasAdvancedInboxFilters(p: InboxToolbarProps): boolean {
  return p.status !== "all" || p.assignmentFilter !== "all" ||
    (p.urgencyFilter ?? "all") !== "all" || (p.intentStatusFilter ?? "all") !== "all"
}

/** "All" is the baseline view, not a synonym for "all channels". */
export function isDefaultInboxView(p: InboxToolbarProps): boolean {
  return (p.primaryWorkFilter ?? "all") === "all" && p.channel === "all" &&
    (p.datePreset ?? "all") === "all" && !p.search.trim() && !hasAdvancedInboxFilters(p)
}

/** Reset only the controlled Inbox dimensions; never touch selection or global search. */
export function resetInboxToolbar(p: InboxToolbarProps): void {
  p.onChannelChange("all")
  p.onStatusChange("all")
  p.onUrgencyFilterChange?.("all")
  p.onAssignmentFilterChange("all")
  p.onIntentStatusFilterChange?.("all")
  p.onDatePresetChange?.("all")
  p.onSearchChange("")
  // This handler owns the URL. Invoke it last to keep id/messageId intact.
  p.onPrimaryWorkFilterChange?.("all")
}

/** A prior Resolved/Archived selection must not silently override Pending. */
export function selectPendingInboxWork(p: InboxToolbarProps): void {
  p.onStatusChange("all")
  p.onPrimaryWorkFilterChange?.("needs_action")
}

export function selectInboxStatus(p: InboxToolbarProps, status: string): void {
  p.onPrimaryWorkFilterChange?.("all")
  p.onStatusChange(status)
}

export function isInboxDatePreset(value: string): value is InboxDatePreset {
  return value === "all" || value === "today" || value === "7d" || value === "30d"
}
