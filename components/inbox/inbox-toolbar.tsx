"use client"

import { useEffect, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/**
 * Smart Inbox toolbar — full-width controls that sit ABOVE the three-column
 * grid (list / thread / Smart Hub). Owns no state of its own beyond the local
 * UI toggles for "channel picker open" and "more filters open"; every filter
 * value/handler is lifted from `app/inbox/page.tsx` so the URL/deep-link
 * contract is preserved exactly as before.
 *
 * Why a separate toolbar?
 * - Filters used to live inside `ConversationList`'s header, constrained to
 *   ~30% of the viewport. WhatsApp would collapse to a single letter, work
 *   chips fought channel chips for the same row, and Advanced filters were
 *   wedged into a tiny strip. By promoting the chrome above the grid we get
 *   the full viewport width and can wrap channel chips horizontally without
 *   horizontal scroll/marquee tricks.
 * - The three columns (list / thread / Smart Hub) keep their own internal
 *   chrome and scrolling — no breaking changes to their layout contracts.
 *
 * Behavioural contract:
 * - Search input is debounced upstream; the toolbar just renders the value.
 * - Work chips mirror the sidebar `?filter=` URL via `onPrimaryWorkFilterChange`.
 * - Channel picker collapses by default; opens to a wrapping panel of
 *   channel chips. Selected channel surfaces as a `Check` icon on the chip.
 * - More filters is collapsed by default and auto-opens whenever any
 *   advanced filter holds a non-default value.
 * - In To-do mode (`isTodoMode`), conversation-only filters (work / channel /
 *   advanced) are hidden so the toolbar reflects the current operational
 *   surface (search + actions only). The To-do list itself owns its own
 *   internal filters.
 */

type AssignmentFilter = "all" | "mine" | "unassigned"

const FILTER_TRIGGER_BASE =
  "h-8 w-full justify-between gap-1 rounded-[8px] px-2.5 text-xs shadow-none transition-all duration-150 outline-none [&_svg]:opacity-50"
const FILTER_TRIGGER_IDLE =
  "border border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] shadow-[0_0_0_1px_rgba(148,163,184,0.1)] hover:bg-white/[0.03] focus-visible:ring-1 focus-visible:ring-[var(--app-accent)]/25 data-[state=open]:bg-white/[0.05] data-[state=open]:shadow-[0_0_0_1px_var(--app-accent)/25]"
const FILTER_TRIGGER_ACTIVE =
  "relative border-transparent bg-[var(--app-sidebar-surface)] font-medium text-[var(--app-accent)] shadow-[0_0_0_1px_var(--app-accent),0_0_10px_0_rgba(99,102,241,0.22)] focus-visible:ring-[3px] focus-visible:ring-[var(--app-accent)]/30 [&_svg]:opacity-70 [&_svg]:text-[var(--app-accent)]"

interface InboxToolbarProps {
  // Row 1 — search + global actions
  search: string
  onSearchChange: (value: string) => void
  activeSearchTerm?: string
  onFetchEmails?: () => void
  fetchingEmails?: boolean
  lastSyncedAt?: Date | null
  onCompose?: () => void

  // Row 2 — primary work + channel picker trigger
  primaryWorkFilter?: "all" | "needs_action" | "waiting" | "done" | "other"
  onPrimaryWorkFilterChange?: (value: "all" | "needs_action" | "waiting" | "done") => void
  channel: string
  channelOptions: Array<{ value: string; label: string }>
  onChannelChange: (value: string) => void

  // Row 4 — More filters (advanced)
  status: string
  statusOptions: Array<{ value: string; label: string }>
  onStatusChange: (value: string) => void
  /**
   * Priority/urgency filter. UI label is "Priority" (operator-friendly) but the
   * values are the canonical `Conversation.urgency` strings
   * (critica/alta/media/baja); "all" clears it. Single-select.
   */
  urgencyFilter?: string
  onUrgencyFilterChange?: (value: string) => void
  intentStatusFilter?: "all" | "open" | "done"
  onIntentStatusFilterChange?: (value: "all" | "open" | "done") => void
  assignmentFilter: AssignmentFilter
  onAssignmentFilterChange: (value: AssignmentFilter) => void

  isTodoMode?: boolean
}

function formatSyncAge(date: Date) {
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return "just now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const WORK_FILTERS = [
  { value: "all", label: "All" },
  { value: "needs_action", label: "Needs attention" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
] as const

/**
 * Priority filter options. UI labels are operator-friendly; values are the
 * canonical `Conversation.urgency` strings the API already understands (see
 * `mapSidebarFilter` / `listConversations`). Fixed vocabulary (NOT workspace
 * taxonomy), so it's safe to keep inline here like WORK_FILTERS.
 */
const PRIORITY_FILTERS = [
  { value: "all", label: "Any priority" },
  { value: "critica", label: "Critical" },
  { value: "alta", label: "High" },
  { value: "media", label: "Medium" },
  { value: "baja", label: "Low" },
] as const

/**
 * Assignment filter options. Same values/behavior as the previous segmented
 * three-button group (All / Mine / Unassigned) — only the presentation changes
 * to a `Select`, so it lines up with Priority / Sender and stops eating a wide
 * row in the More filters panel. `"all"` is the cleared/idle state.
 */
const ASSIGNMENT_FILTERS = [
  { value: "all", label: "Anyone" },
  { value: "mine", label: "Mine" },
  { value: "unassigned", label: "Unassigned" },
] as const

export function InboxToolbar({
  search,
  onSearchChange,
  activeSearchTerm,
  onFetchEmails,
  fetchingEmails = false,
  lastSyncedAt,
  onCompose,
  primaryWorkFilter = "all",
  onPrimaryWorkFilterChange,
  channel,
  channelOptions,
  onChannelChange,
  status,
  statusOptions,
  onStatusChange,
  urgencyFilter = "all",
  onUrgencyFilterChange,
  intentStatusFilter = "all",
  onIntentStatusFilterChange,
  assignmentFilter,
  onAssignmentFilterChange,
  isTodoMode = false,
}: InboxToolbarProps) {
  const advancedHasActiveFilter =
    assignmentFilter !== "all" ||
    status !== "all" ||
    urgencyFilter !== "all" ||
    intentStatusFilter !== "all"

  const [channelOpen, setChannelOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(advancedHasActiveFilter)

  /**
   * If the operator activates an advanced filter from elsewhere (e.g. URL
   * deep-link, sidebar) we surface the More filters panel automatically —
   * never let a filter be "on" with no visible reason for it.
   */
  useEffect(() => {
    if (advancedHasActiveFilter && !moreOpen) setMoreOpen(true)
  }, [advancedHasActiveFilter, moreOpen])

  /**
   * Conversation status is now demoted into a collapsed "Advanced" disclosure:
   * its precise states (lead_detected, archived, converted, closed…) are admin/
   * specific, not daily filters — the top chips cover the normal flow. Collapsed
   * by default so the panel doesn't grow; auto-opens when an exact status is
   * active so the override never hides silently. Behavior/query unchanged.
   */
  const statusFilterActive = status !== "all"
  const [advancedOpen, setAdvancedOpen] = useState(statusFilterActive)
  useEffect(() => {
    if (statusFilterActive && !advancedOpen) setAdvancedOpen(true)
  }, [statusFilterActive, advancedOpen])

  const activeChannelLabel =
    channelOptions.find((option) => option.value === channel)?.label ?? "All channels"

  return (
    <div className="shrink-0 rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-list-surface)] shadow-[var(--app-shadow-subtle)]">
      {/*
       * Compact single-row toolbar. Everything lives on ONE line on desktop to
       * maximise the Inbox vertical space:
       *   [+ Compose] [work chips] [Channel] [More filters] … [Filter inbox] […]
       *
       * - Compose is a VISIBLE primary action (icon-only "+" on narrow widths),
       *   wired to the existing `onCompose` handler — no longer buried in the
       *   overflow menu.
       * - "Filter inbox" is the LOCAL list filter (NOT Global Search). It sits
       *   near the end, immediately before the overflow kebab, width-capped and
       *   visually secondary so it never reads as a hero search bar.
       * - "Sync now" stays demoted inside the overflow kebab (auto-sync on load
       *   already covers the common case).
       *
       * Conversation-only controls (work chips / channel / More filters) are
       * hidden in To-do mode; Compose + Filter + overflow stay available.
       * `flex-wrap` keeps narrow viewports usable: lower-priority controls wrap
       * to a second line instead of clipping.
       */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 md:px-4">
        {onCompose ? (
          <Button
            type="button"
            size="sm"
            variant="accent"
            onClick={() => onCompose()}
            title="Compose new message"
            aria-label="Compose new message"
            className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
        ) : null}

        {!isTodoMode && onPrimaryWorkFilterChange ? (
          <div role="group" aria-label="Work filter" className="flex shrink-0 flex-wrap items-center gap-1">
            {WORK_FILTERS.map((option) => {
              const isActive = primaryWorkFilter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPrimaryWorkFilterChange(option.value)}
                  aria-pressed={isActive}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
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
         * Channel picker trigger — collapsed state only shows the active
         * channel label. Click toggles the wrapping channel panel below.
         */}
        {!isTodoMode ? (
          <button
            type="button"
            onClick={() => setChannelOpen((open) => !open)}
            aria-expanded={channelOpen}
            aria-controls="inbox-toolbar-channel-panel"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
              channel !== "all"
                ? "border-transparent bg-[var(--inbox-list-selected-bg)] text-[var(--inbox-list-selected)] shadow-sm"
                : "border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]",
            )}
          >
            <span className="whitespace-nowrap">
              <span className="opacity-60">Channel:</span> {activeChannelLabel}
            </span>
            {channelOpen ? (
              <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
          </button>
        ) : null}

        {!isTodoMode ? (
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="inbox-toolbar-more-panel"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
              moreOpen
                ? "bg-[var(--inbox-list-background)] text-[var(--inbox-list-text)]"
                : "text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]",
            )}
          >
            <SlidersHorizontal className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">More filters</span>
            {advancedHasActiveFilter ? (
              <span className="rounded-full bg-[var(--inbox-accent)]/20 px-1.5 text-[9px] font-bold text-[var(--inbox-accent)]">
                on
              </span>
            ) : null}
            {moreOpen ? (
              <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
          </button>
        ) : null}

        {/*
         * Right cluster — pushed to the row end with `ml-auto`. Holds the LOCAL
         * "Filter inbox" input (secondary, width-capped) immediately before the
         * overflow kebab, matching the desired order: … [Filter inbox] […].
         */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">
          {activeSearchTerm ? (
            <div
              className="hidden shrink-0 rounded-md bg-[var(--inbox-list-selected-bg)] px-2 py-1 text-[11px] font-medium text-[var(--inbox-list-selected)] lg:block"
              title={`Filtering: ${activeSearchTerm}`}
            >
              <span className="whitespace-nowrap">&ldquo;{activeSearchTerm}&rdquo;</span>
            </div>
          ) : null}

          <div className="relative w-[120px] sm:w-[150px] lg:w-[190px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0 text-[var(--inbox-list-text-secondary)]/70"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Filter inbox..."
              aria-label="Filter inbox"
              className="h-8 w-full rounded-lg border-[var(--inbox-list-border)] bg-white/[0.03] pl-8 pr-7 text-[11px] text-[var(--inbox-list-text)] placeholder:text-[11px] placeholder:text-[var(--inbox-list-text-secondary)] focus:border-[var(--inbox-list-selected)] focus:ring-1 focus:ring-[var(--inbox-list-selected)]/25"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => onSearchChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--inbox-list-text)]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {onFetchEmails ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Inbox actions"
                  title="Inbox actions"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)] data-[state=open]:bg-[var(--inbox-list-background)] data-[state=open]:text-[var(--inbox-list-text)]"
                >
                  {fetchingEmails ? (
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={(event) => {
                    if (fetchingEmails) {
                      event.preventDefault()
                      return
                    }
                    onFetchEmails()
                  }}
                  disabled={fetchingEmails}
                  className="gap-2"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", fetchingEmails && "animate-spin")}
                    aria-hidden="true"
                  />
                  {fetchingEmails ? "Syncing…" : "Sync now"}
                </DropdownMenuItem>
                {lastSyncedAt && !fetchingEmails ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel
                      className="text-[11px] font-normal text-[var(--inbox-list-text-secondary)]"
                      title={lastSyncedAt.toLocaleString()}
                    >
                      Last synced {formatSyncAge(lastSyncedAt)}
                    </DropdownMenuLabel>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/*
       * Row 3 — Full-width channel panel. Wraps naturally so labels never
       * truncate (WhatsApp / LinkedIn / Messenger render in full).
       *
       * Selected channel is marked with a leading `Check` icon — explicit and
       * accessible for color-blind operators (the highlight alone isn't
       * enough). Each chip is `whitespace-nowrap` so labels never break mid-
       * word, and the row wraps with `flex-wrap` so we never need
       * horizontal scrolling/marquee animations.
       */}
      {!isTodoMode && channelOpen ? (
        <div
          id="inbox-toolbar-channel-panel"
          className="border-t border-[var(--inbox-list-border)]/60 px-3 py-2.5 md:px-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
              Channels
            </span>
            <button
              type="button"
              onClick={() => setChannelOpen(false)}
              className="rounded-md p-1 text-[var(--inbox-list-text-secondary)] transition-colors hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]"
              aria-label="Close channel picker"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channelOptions.map((option) => {
              const isActive = channel === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChannelChange(option.value)}
                  aria-pressed={isActive}
                  title={`Channel: ${option.label}`}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "border-transparent bg-[var(--inbox-list-selected-bg)] text-[var(--inbox-list-selected)] shadow-sm"
                      : "border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]",
                  )}
                >
                  {isActive ? (
                    <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full border border-current opacity-40" />
                  )}
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/*
       * Row 4 — More filters (advanced). Status / Work intent / Sender are
       * power-user controls that don't fit the daily work chips. Assignment
       * (All / Mine / Unassigned) keeps its three-button group layout.
       *
       * Visual order — Status, Work intent, Sender, Assignment — matches the
       * legacy layout the operators are used to. The grid stacks to one
       * column on narrow viewports.
       */}
      {!isTodoMode && moreOpen ? (
        <div
          id="inbox-toolbar-more-panel"
          className="border-t border-[var(--inbox-list-border)]/60 px-3 py-2.5 md:px-4"
        >
          <div className="grid gap-x-2 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {onUrgencyFilterChange ? (
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
                  Priority
                </label>
                <Select value={urgencyFilter} onValueChange={onUrgencyFilterChange}>
                  <SelectTrigger
                    className={cn(
                      FILTER_TRIGGER_BASE,
                      urgencyFilter === "all" ? FILTER_TRIGGER_IDLE : FILTER_TRIGGER_ACTIVE,
                    )}
                    aria-label="Priority filter"
                    title="Filter by conversation priority / urgency"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {onIntentStatusFilterChange ? (
              <div className="min-w-0">
                {/*
                 * "Open items" (was "Work intent"): filters on the per-message
                 * open/done state (`Message.metadata.intentStatus` via
                 * `inferConversationIntentStatus`), NOT `Conversation.intent`.
                 * Renamed label-only to remove that confusion; logic unchanged.
                 */}
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
                  Open items
                </label>
                <Select
                  value={intentStatusFilter}
                  onValueChange={(value) =>
                    onIntentStatusFilterChange(value as "all" | "open" | "done")
                  }
                >
                  <SelectTrigger
                    className={cn(
                      FILTER_TRIGGER_BASE,
                      intentStatusFilter === "all" ? FILTER_TRIGGER_IDLE : FILTER_TRIGGER_ACTIVE,
                    )}
                    aria-label="Open items filter"
                    title="Per-message open / done items"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
                Assignment
              </label>
              {/*
               * Was a wide three-button segmented group; now a Select so it
               * matches Priority / Sender and the panel stays compact. Same
               * state + handler + values (all / mine / unassigned) — only the
               * presentation changed.
               */}
              <Select
                value={assignmentFilter}
                onValueChange={(value) => onAssignmentFilterChange(value as AssignmentFilter)}
              >
                <SelectTrigger
                  className={cn(
                    FILTER_TRIGGER_BASE,
                    assignmentFilter === "all" ? FILTER_TRIGGER_IDLE : FILTER_TRIGGER_ACTIVE,
                  )}
                  aria-label="Assignment filter"
                  title="Filter by assignment (anyone / mine / unassigned)"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/*
           * Advanced disclosure — holds the demoted "Conversation status" select.
           * Collapsed by default (auto-opens when a status is active) so the panel
           * stays short and the precise/admin states don't compete with the daily
           * Priority / Sender / Assignment filters. Query/behavior unchanged.
           */}
          <div className="mt-2 border-t border-[var(--inbox-list-border)]/60 pt-1.5">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              aria-controls="inbox-toolbar-advanced-panel"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                advancedOpen
                  ? "text-[var(--inbox-list-text)]"
                  : "text-[var(--inbox-list-text-secondary)]/80 hover:text-[var(--inbox-list-text)]",
              )}
            >
              <span>Advanced</span>
              {statusFilterActive ? (
                <span className="rounded-full bg-[var(--inbox-accent)]/20 px-1.5 text-[9px] font-bold normal-case text-[var(--inbox-accent)]">
                  on
                </span>
              ) : null}
              {advancedOpen ? (
                <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
            </button>

            {advancedOpen ? (
              <div id="inbox-toolbar-advanced-panel" className="mt-1.5 grid gap-x-2 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0">
                  <label className="mb-1 flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-list-text-secondary)]/80">
                    <span>Conversation status</span>
                    {/*
                     * Both this and the top work chips (All / Needs attention /
                     * Waiting / Done) drive the same `status` query param; an
                     * explicit pick here wins by precedence in the page query
                     * builder. Surfacing that keeps the override non-silent.
                     */}
                    <span className="font-normal normal-case tracking-normal text-[var(--inbox-list-text-secondary)]/55">
                      overrides the status chips
                    </span>
                  </label>
                  <Select value={status} onValueChange={onStatusChange}>
                    <SelectTrigger
                      className={cn(
                        FILTER_TRIGGER_BASE,
                        status === "all" ? FILTER_TRIGGER_IDLE : FILTER_TRIGGER_ACTIVE,
                      )}
                      aria-label="Conversation status filter (overrides the status chips)"
                      title="Exact conversation status — overrides the top status chips"
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
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
