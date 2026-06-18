"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProtagonistReason, TodayProtagonist } from "@modules/today/briefing"
import type { TodayItem } from "@modules/today/types"

/**
 * "Start Here" — the single current protagonist (the "resolves" of "7F lives,
 * works, resolves").
 *
 * It picks nothing itself: the parent passes the one item chosen by
 * `pickProtagonist` plus an optional `onSendToAI` already bound to the
 * existing lane-move handler. Two actions only — Open (the item's real source
 * href) and Send to AI (real, where a handler exists). No Snooze, no
 * generative CTA, per the foundation-PR scope.
 *
 * When `protagonist` is null the operator's lane is empty, so it renders a
 * calm "you're all clear" card — the surface still reads as full and
 * intentional with zero work.
 *
 * Preview-only: mounted by the work_first_v2 hero
 * (`/today?todayLayout=work_first_v2`). Production Today is unchanged.
 */
export function TodayStartHere({
  protagonist,
  onSendToAI,
}: {
  protagonist: TodayProtagonist | null
  onSendToAI?: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)

  if (!protagonist) {
    return (
      <section
        aria-label="Start here"
        className="flex flex-col gap-2 rounded-[18px] border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5"
      >
        <Eyebrow />
        <span
          aria-hidden="true"
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
        >
          <CheckCircle2 size={18} strokeWidth={1.8} />
        </span>
        <p className="text-sm font-semibold text-[var(--text-primary-light)]">
          You&apos;re all clear
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary-light)]">
          Nothing needs you right now. New work and AI proposals will surface here as the day moves.
        </p>
      </section>
    )
  }

  const { item, reason } = protagonist
  const badge = REASON_BADGE[reason]

  const handleSend = async () => {
    if (!onSendToAI || pending) return
    setPending(true)
    try {
      await onSendToAI()
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      aria-label="Start here"
      className="relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] p-5 shadow-[var(--app-shadow-subtle)]"
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", badge.bar)} />
      <Eyebrow />
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            badge.pill,
          )}
        >
          {reason === "overdue" ? (
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none",
                badge.dot,
              )}
            />
          ) : null}
          {badge.label}
        </span>
        <span className="text-[11px] text-[var(--text-secondary-light)]">{sourceLabel(item)}</span>
      </div>

      <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary-light)]">
        {item.title}
      </h3>
      <p
        suppressHydrationWarning
        className="text-[13px] leading-relaxed text-[var(--text-secondary-light)]"
      >
        {whyLine(reason, item.dueAt)}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Link
          href={item.source.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
        >
          Open task
          <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        {onSendToAI ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={pending}
            aria-label="Send to AI"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-3.5 py-2 text-[13px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:bg-[var(--accent-primary)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={13} strokeWidth={2} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
            )}
            Send to AI
          </button>
        ) : null}
      </div>
    </section>
  )
}

function Eyebrow() {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent-on-dark)]">
      <Zap size={12} strokeWidth={2.2} aria-hidden="true" />
      Start here · now
    </p>
  )
}

const REASON_BADGE: Record<
  ProtagonistReason,
  { label: string; pill: string; bar: string; dot: string }
> = {
  overdue: {
    label: "Overdue",
    pill: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
    bar: "bg-[var(--status-danger-text)]",
    dot: "bg-[var(--status-danger-text)]",
  },
  today: {
    label: "Due today",
    pill: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
    bar: "bg-[var(--accent-primary)]",
    dot: "bg-[var(--status-info-text)]",
  },
  waiting: {
    label: "Waiting",
    pill: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
    bar: "bg-[var(--status-warning-text)]",
    dot: "bg-[var(--status-warning-text)]",
  },
  undated: {
    label: "No date",
    pill: "bg-[var(--app-surface-active)] text-[var(--text-secondary-light)]",
    bar: "bg-[var(--text-tertiary-light)]",
    dot: "bg-[var(--text-tertiary-light)]",
  },
}

function sourceLabel(item: TodayItem): string {
  switch (item.source.kind) {
    case "inbox":
      return "From Inbox · assigned to you"
    case "project":
      return item.source.projectName ? `From ${item.source.projectName}` : "From a project"
    case "manual":
      return "Task"
    case "calendar":
      return "From Calendar"
  }
}

function whyLine(reason: ProtagonistReason, dueAt: string | null): string {
  switch (reason) {
    case "overdue":
      return `Overdue${formatSince(dueAt)} — clearing it resets your board and gets the day moving.`
    case "today":
      return `Due today${formatAt(dueAt)}. The clearest win on the board right now.`
    case "waiting":
      return "Waiting on someone else. A quick nudge keeps it from stalling the day."
    case "undated":
      return "No due date yet — a good one to close while the day is open."
  }
}

function formatSince(iso: string | null): string {
  const date = toDate(iso)
  return date
    ? ` since ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
    : ""
}

function formatAt(iso: string | null): string {
  const date = toDate(iso)
  return date
    ? ` at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : ""
}

function toDate(iso: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}
