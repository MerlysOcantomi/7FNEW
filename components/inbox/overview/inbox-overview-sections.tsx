"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Radar,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CHANNEL_CAPTION,
  CHANNELS,
  INBOX_MODES,
  NEEDS_ACTION,
  PRIORITY_TOKENS,
  PROPOSALS,
  TODAY_READY,
  WAITING,
} from "./overview-data"

/** Shared card shell — opaque surface, token border. */
const CARD = "rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5"
const HEADING = "font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary-light)]"
const CAPTION = "font-mono text-[11px] text-[var(--text-tertiary-light)]"

// ─── Channel Activity ───────────────────────────────────────────────────────

export function ChannelActivity() {
  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <Radar className="h-4 w-4 text-[var(--accent-on-dark)]" />
          <span className={HEADING}>Channel activity</span>
        </span>
        <span className={CAPTION}>{CHANNEL_CAPTION}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon
          return (
            <div
              key={ch.name}
              className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3"
            >
              <span
                className="mb-2 inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg"
                style={{ background: `color-mix(in srgb, ${ch.accent} 16%, transparent)`, color: ch.accent }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums text-[var(--text-primary-light)]">{ch.count}</span>
                <span className="truncate text-xs text-[var(--text-secondary-light)]">{ch.name}</span>
              </div>
              <div className="mt-2 flex h-5 items-end gap-[2px] opacity-50" aria-hidden="true">
                {ch.spark.map((v, i) => (
                  <span key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(v * 100, 8)}%`, background: ch.accent }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Needs Action ───────────────────────────────────────────────────────────

export function NeedsAction() {
  return (
    <section className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <span className={HEADING}>Needs action</span>
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
            style={{ background: "var(--inbox-urgency-soft)", color: "var(--inbox-urgency)" }}
          >
            {NEEDS_ACTION.length}
          </span>
        </span>
        <span className={CAPTION}>prioritized by Fanny</span>
      </div>

      <ul className="flex flex-col">
        {NEEDS_ACTION.map((item, i) => {
          const tone = PRIORITY_TOKENS[item.priority]
          return (
            <li key={i}>
              <div className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--app-surface-dark-hover)]">
                <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: tone.accent }} aria-hidden="true" />
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
                >
                  {item.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{item.sender}</span>
                    <span className="shrink-0 text-[11px] text-[var(--text-tertiary-light)]">{item.channel}</span>
                    <span className="shrink-0 text-[11px] text-[var(--text-tertiary-light)]">·</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-tertiary-light)]">{item.time}</span>
                  </div>
                  <p className="truncate text-[12.5px] text-[var(--text-secondary-light)]">{item.preview}</p>
                </div>
                <span
                  className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: tone.soft, color: tone.accent }}
                >
                  {item.action}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ─── Proposed by Fanny (Accept/Dismiss are UI-only stubs) ────────────────────

export function ProposedByFanny() {
  const [resolved, setResolved] = useState<Record<string, "accepted" | "dismissed">>({})
  const visible = PROPOSALS.filter((p) => !resolved[p.id])

  return (
    <section
      id="overview-proposed"
      className="scroll-mt-24 rounded-[18px] border p-5"
      style={{
        borderColor: "var(--accent-muted-border)",
        background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-rich) 12%, var(--app-surface-dark)), var(--app-surface-dark))",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-on-dark)]" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">
            Proposed by Fanny
          </span>
        </span>
        <span className={CAPTION}>suggestions · not yet tasks</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-[12.5px] text-[var(--text-secondary-light)]">
          All suggestions reviewed. Accepted ones move to Today.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((p) => {
            const Icon = p.icon
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3"
              >
                <span
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[var(--text-secondary-light)]">
                    <span className="font-semibold text-[var(--text-primary-light)]">{p.title}</span> — {p.detail}
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-tertiary-light)]">{p.meta}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setResolved((r) => ({ ...r, [p.id]: "accepted" }))}
                    aria-label={`Accept: ${p.title}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
                    style={{ background: "var(--accent-primary)" }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolved((r) => ({ ...r, [p.id]: "dismissed" }))}
                    aria-label={`Dismiss: ${p.title}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-dark-strong)] text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-dark-hover)] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── Ready in Today (bridge only) ───────────────────────────────────────────

export function ReadyInToday() {
  return (
    <section className={cn(CARD, "flex flex-col")}>
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[var(--inbox-success)]" />
        <span className={HEADING}>Ready in Today</span>
      </div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-[var(--text-primary-light)]">{TODAY_READY.length}</span>
        <span className="text-[12.5px] text-[var(--text-secondary-light)]">tasks ready for today</span>
      </div>
      <ul className="mb-4 flex flex-1 flex-col gap-2">
        {TODAY_READY.map((t, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <Circle className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary-light)]" />
            <span className="truncate text-[12.5px] text-[var(--text-secondary-light)]">{t}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/today"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-dark-strong)] px-3 py-2 text-[13px] font-medium text-[var(--text-primary-light)] transition-colors hover:bg-[var(--app-surface-dark-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
      >
        View Today
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}

// ─── Waiting / Follow-ups ───────────────────────────────────────────────────

export function WaitingFollowups() {
  return (
    <section className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={HEADING}>Waiting · Follow-ups</span>
        <span className={CAPTION}>{WAITING.length} open</span>
      </div>
      <ul className="flex flex-col">
        {WAITING.map((w, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center gap-3 py-2.5",
              i !== WAITING.length - 1 && "border-b border-[var(--border-dark)]",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: w.dot }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[var(--text-primary-light)]">{w.label}</p>
              <p className="truncate text-[11.5px] text-[var(--text-tertiary-light)]">{w.sub}</p>
            </div>
            <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--text-secondary-light)]">{w.meta}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Open Inbox (work modes) ────────────────────────────────────────────────

export function OpenInboxModes() {
  return (
    <section className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={HEADING}>Open Inbox</span>
        <span className={CAPTION}>work mode</span>
      </div>
      <div className="flex flex-col gap-2">
        {INBOX_MODES.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.label}
              href={m.href}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3 transition-colors hover:border-[var(--accent-muted-border)] hover:bg-[var(--app-surface-dark-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
            >
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--text-primary-light)]">{m.label}</p>
                <p className="truncate text-[11.5px] text-[var(--text-tertiary-light)]">{m.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary-light)] transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
