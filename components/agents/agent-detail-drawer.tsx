"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Link2,
  X,
} from "lucide-react"
import type { AgentLiveState, AgentRosterEntry } from "@modules/agents/roster"
import { autonomyLabel } from "@modules/agents/roster"
import { ACCENT, agentIcon, statusVisual } from "./agent-visuals"

/**
 * Agent detail drawer — right-side overlay opened from an agent card.
 *
 * Read-only and honest: "Doing now" / "Today" / "Recently handled" reflect this
 * agent's REAL projected items (today, only Fanny has any); "Watching" and
 * "Works with the team" are static registry context. No writes. Closes with the
 * X, a click on the scrim, or Escape; focus moves to the close button on open
 * and is restored on close; body scroll is locked while open.
 */
export function AgentDetailDrawer({
  entry,
  live,
  onClose,
}: {
  entry: AgentRosterEntry
  live: AgentLiveState
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  const tokens = ACCENT[entry.accent]
  const Icon = agentIcon(entry.id)
  const sv = statusVisual(live.status)
  const recentlyHandled = live.items.filter((i) => i.lane === "executed").slice(0, 4)

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Close agent details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(8,5,18,0.62)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.name} details`}
        className="relative flex h-full w-[410px] max-w-[92vw] flex-col border-l border-[var(--border-dark-strong)] bg-[var(--app-surface-dark)] shadow-[-34px_0_70px_-30px_rgba(0,0,0,0.85)]"
      >
        {/* header */}
        <div className="flex items-start gap-3 border-b border-[var(--border-dark)] p-5">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: tokens.soft, color: tokens.fg }}
          >
            <Icon size={24} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold tracking-tight text-[var(--text-primary-light)]">{entry.name}</p>
            <p className="mt-0.5 text-[12px] text-[var(--text-tertiary-light)]">{entry.role}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.autonomy ? (
                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: tokens.soft, color: tokens.fg }}>
                  {autonomyLabel(entry.autonomy)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--app-surface-dark-elevated)] px-2 py-0.5 text-[10px] font-bold" style={{ color: sv.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sv.color }} aria-hidden="true" />
                {live.statusLabel}
              </span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface-dark-elevated)] text-[var(--text-tertiary-light)] transition-colors hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
          >
            <X size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <DrawerSection label="Doing now">
            <div
              className="rounded-xl border p-3.5"
              style={{ borderColor: tokens.border, background: "var(--app-surface-dark-elevated)" }}
            >
              <p className="text-[13px] leading-relaxed text-[var(--text-primary-light)]">
                {live.activity ?? (entry.active ? "Up to date — watching for new work." : "Ready in your registry — coming online.")}
              </p>
            </div>
          </DrawerSection>

          <DrawerSection label="Today">
            {live.items.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {live.items.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md"
                      style={{ background: "var(--inbox-success-soft)", color: "var(--inbox-success)" }}
                    >
                      <CheckCircle2 size={11} strokeWidth={2.6} />
                    </span>
                    <span className="text-[12.5px] leading-snug text-[var(--text-secondary-light)]">{item.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[var(--text-tertiary-light)]">No activity yet today.</p>
            )}
          </DrawerSection>

          <div
            className="rounded-xl border border-[var(--border-dark)] p-3.5"
            style={{ background: "var(--app-surface-subtle)" }}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <Link2 size={13} strokeWidth={2} style={{ color: "var(--accent-on-dark)" }} aria-hidden="true" />
              <p className="text-[11px] font-bold text-[var(--accent-on-dark)]">Works with the team</p>
            </div>
            <p className="text-[11.5px] leading-relaxed text-[var(--text-secondary-light)]">{entry.collaborationNote}</p>
          </div>

          <DrawerSection label="Watching">
            <ul className="flex flex-col gap-1.5">
              {entry.watching.map((w) => (
                <li key={w} className="flex items-center gap-2 text-[12px] text-[var(--text-secondary-light)]">
                  <Eye size={12} strokeWidth={2} className="shrink-0 text-[var(--text-tertiary-light)]" aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          </DrawerSection>

          {recentlyHandled.length > 0 ? (
            <DrawerSection label="Recently handled">
              <ul className="flex flex-col gap-1.5">
                {recentlyHandled.map((item) => (
                  <li key={item.id} className="text-[12px] text-[var(--text-tertiary-light)]">{item.title}</li>
                ))}
              </ul>
            </DrawerSection>
          ) : null}
        </div>

        {/* footer */}
        <div className="border-t border-[var(--border-dark)] p-4">
          {entry.section ? (
            <Link
              href={entry.section.href}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-3 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
            >
              Open in {entry.section.label}
              <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="This agent's section is coming online"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-3 text-[13.5px] font-semibold text-[var(--text-tertiary-light)] opacity-80"
            >
              Section coming online
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary-light)]">{label}</p>
      {children}
    </section>
  )
}
