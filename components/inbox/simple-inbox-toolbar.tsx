"use client"

import { useEffect, useId, useState } from "react"
import { Check, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react"
import type { UIMessages } from "@core/i18n/ui"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  SIMPLE_INBOX_LAYOUT as layout,
  hasAdvancedInboxFilters, isDefaultInboxView, isInboxDatePreset,
  resetInboxToolbar, selectInboxStatus, selectPendingInboxWork,
  type InboxToolbarProps,
} from "./inbox-toolbar-model"

type Messages = UIMessages["inbox"]["toolbar"]
export interface SimpleInboxToolbarProps extends InboxToolbarProps { messages: Messages }

const IDLE = "border-[var(--inbox-list-border)] bg-transparent text-[var(--inbox-list-text-secondary)] hover:bg-[var(--inbox-list-background)] hover:text-[var(--inbox-list-text)]"
const ACTIVE = "border-[var(--inbox-accent)]/40 bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]"
const FOCUS = "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
const LABEL = "min-w-0 truncate"
const ICON = "size-3 shrink-0"

/**
 * Presentation-only: all values and handlers still belong to the Inbox page.
 * Mobile: 3 primary controls, 2 secondary controls, then full-width local search.
 * The standard/email toolbar is preserved separately; no transport is enabled here.
 */
export function SimpleInboxToolbar(p: SimpleInboxToolbarProps) {
  const m = p.messages
  const id = useId()
  const channelPanelId = `${id}-channels`
  const morePanelId = `${id}-more`
  const advanced = hasAdvancedInboxFilters(p)
  const [channelOpen, setChannelOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(advanced)
  // Do not depend on moreOpen: the operator must be able to close this panel
  // while a filter remains active. Its badge keeps that state visible.
  useEffect(() => { if (advanced) setMoreOpen(true) }, [advanced])

  const work = p.workFilterOptions?.length ? p.workFilterOptions : [
    { value: "all", label: m.workFilters.all },
    { value: "needs_action", label: m.workFilters.pending },
  ]
  const all = work.find((option) => option.value === "all")
  const pending = work.find((option) => option.value === "needs_action")
  const date = p.datePreset ?? "all"
  const channelName = p.channelOptions.find((option) => option.value === p.channel)?.label ?? m.allChannels
  const dates = [
    { value: "all", label: m.dates.all }, { value: "today", label: m.dates.today },
    { value: "7d", label: m.dates.last7Days }, { value: "30d", label: m.dates.last30Days },
  ]
  const priorities = [
    { value: "all", label: m.priorities.any }, { value: "critica", label: m.priorities.critical },
    { value: "alta", label: m.priorities.high }, { value: "media", label: m.priorities.medium },
    { value: "baja", label: m.priorities.low },
  ]
  const control = (active: boolean) => cn(layout.control, FOCUS, active ? ACTIVE : IDLE)

  return (
    <div data-inbox-toolbar="simple" className="min-w-0 shrink-0 rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-list-surface)] shadow-[var(--app-shadow-subtle)]">
      <div data-inbox-toolbar-row className={layout.row} role="group" aria-label={m.workFilterAria}>
        {all && p.onPrimaryWorkFilterChange ? (
          <button type="button" data-inbox-control="all" disabled={all.disabled}
            aria-pressed={isDefaultInboxView(p)} className={cn(control(isDefaultInboxView(p)), layout.primary)}
            onClick={() => { resetInboxToolbar(p); setChannelOpen(false); setMoreOpen(false) }}>
            <span className={LABEL}>{all.label}</span>
          </button>
        ) : null}

        <button type="button" data-inbox-control="channels" className={cn(control(p.channel !== "all"), layout.primary)}
          title={channelName} aria-label={`${m.channelsHeading}: ${channelName}`}
          aria-expanded={channelOpen} aria-controls={channelPanelId}
          onClick={() => setChannelOpen((open) => !open)}>
          <span className={LABEL}>{p.channel === "all" ? m.channelsHeading : channelName}</span>
          {channelOpen ? <ChevronUp className={ICON} aria-hidden="true" /> : <ChevronDown className={ICON} aria-hidden="true" />}
        </button>

        {pending && p.onPrimaryWorkFilterChange ? (
          <button type="button" data-inbox-control="pending" disabled={pending.disabled}
            aria-pressed={p.primaryWorkFilter === "needs_action" && p.status === "all"}
            className={cn(control(p.primaryWorkFilter === "needs_action" && p.status === "all"), layout.primary)}
            onClick={() => selectPendingInboxWork(p)}>
            <span className={LABEL}>{m.workFilters.pending}</span>
          </button>
        ) : null}

        {p.onDatePresetChange ? (
          <Select value={date} onValueChange={(value) => { if (isInboxDatePreset(value)) p.onDatePresetChange?.(value) }}>
            <SelectTrigger size="sm" data-inbox-control="date" aria-label={m.dateFilterAria}
              className={cn(control(date !== "all"), layout.select, layout.secondary)}>
              <SelectValue><span className={LABEL}>{date === "all" ? m.dateLabel : dates.find((item) => item.value === date)?.label}</span></SelectValue>
            </SelectTrigger>
            <SelectContent>{dates.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}

        <button type="button" data-inbox-control="more" aria-expanded={moreOpen} aria-controls={morePanelId}
          className={cn(control(advanced || moreOpen), layout.secondary, !p.onDatePresetChange && "col-span-6")}
          onClick={() => setMoreOpen((open) => !open)}>
          <SlidersHorizontal className={ICON} aria-hidden="true" />
          <span className={LABEL}>{m.moreFilters}</span>
          {advanced ? <span className="shrink-0 text-[9px] font-bold">{m.filtersOnBadge}</span> : null}
          {moreOpen ? <ChevronUp className={ICON} aria-hidden="true" /> : <ChevronDown className={ICON} aria-hidden="true" />}
        </button>

        <div className={layout.search}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--inbox-list-text-secondary)]" aria-hidden="true" />
          <Input type="search" data-inbox-control="search" value={p.search} onChange={(event) => p.onSearchChange(event.target.value)}
            placeholder={m.filterPlaceholder} aria-label={m.filterAria}
            className={cn(layout.control, IDLE, FOCUS, "w-full sm:w-full md:text-xs pl-9 pr-10 shadow-none [&::-webkit-search-cancel-button]:appearance-none")} />
          {p.search ? <button type="button" aria-label={m.clearFilter} onClick={() => p.onSearchChange("")}
            className={cn("absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-full text-[var(--inbox-list-text-secondary)] sm:size-8", FOCUS)}>
            <X className="size-3.5" aria-hidden="true" />
          </button> : null}
        </div>
      </div>

      {channelOpen ? (
        <div id={channelPanelId} role="group" aria-label={m.channelsHeading} className="border-t border-[var(--inbox-list-border)]/60 p-3">
          <div className="flex flex-wrap gap-2">
            {p.channelOptions.map((option) => (
              <button type="button" key={option.value} disabled={option.disabled} aria-pressed={p.channel === option.value}
                className={cn(control(p.channel === option.value), "w-auto", option.disabled && "border-dashed")}
                onClick={() => { if (!option.disabled) { p.onChannelChange(option.value); setChannelOpen(false) } }}>
                {p.channel === option.value ? <Check className={ICON} aria-hidden="true" /> : null}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {moreOpen ? (
        <div id={morePanelId} className="grid gap-3 border-t border-[var(--inbox-list-border)]/60 p-3 sm:grid-cols-2">
          {p.onUrgencyFilterChange ? (
            <div className="min-w-0">
              <label id={`${id}-priority`} className="mb-1 block text-xs text-[var(--inbox-list-text-secondary)]">{m.priorityLabel}</label>
              <Select value={p.urgencyFilter ?? "all"} onValueChange={p.onUrgencyFilterChange}>
                <SelectTrigger size="sm" aria-labelledby={`${id}-priority`}
                  className={cn(control((p.urgencyFilter ?? "all") !== "all"), layout.select, "w-full sm:w-full")}><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="min-w-0">
            <label id={`${id}-status`} className="mb-1 block text-xs text-[var(--inbox-list-text-secondary)]">{m.conversationStatusLabel}</label>
            <Select value={p.status} onValueChange={(value) => selectInboxStatus(p, value)}>
              <SelectTrigger size="sm" aria-labelledby={`${id}-status`}
                className={cn(control(p.status !== "all"), layout.select, "w-full sm:w-full")}><SelectValue /></SelectTrigger>
              <SelectContent>{p.statusOptions.map((item) => <SelectItem key={item.value} value={item.value} disabled={item.disabled}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  )
}
