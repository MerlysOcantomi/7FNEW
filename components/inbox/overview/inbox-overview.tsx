"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FannyBriefing } from "./inbox-overview-briefing"
import {
  ChannelActivity,
  NeedsAction,
  OpenInboxModes,
  ProposedByFanny,
  ReadyInToday,
  WaitingFollowups,
} from "./inbox-overview-sections"
import {
  formatDateLong,
  formatDateShort,
  formatTime,
  getGreeting,
  getWeather,
  WEATHER_TOKENS,
} from "./overview-data"

/**
 * Smart Inbox — Overview (Option A).
 *
 * The daily entry point: a Fanny briefing that summarises, prioritises and proposes,
 * then hands off to the Inbox (working messages) and Today (confirmed tasks). It never
 * duplicates either — "Ready in Today" and the mode cards are bridges, not workspaces.
 *
 * Scope (this phase): premium Midnight-first visual with DEMO data (see overview-data.ts),
 * a live clock/date, descriptive placeholder weather, and safe navigation into the existing
 * Inbox/Today routes. Proposed actions Accept/Dismiss are UI-only stubs. No backend, no new
 * business logic. Rendered inside AppShell (which owns the rail + scrollport).
 */
export function InboxOverview() {
  // Live clock — gated to after-mount so SSR/client time can't mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const ref = now ?? new Date()
  const greeting = getGreeting(ref)
  const weather = getWeather(ref)
  const wTokens = WEATHER_TOKENS[weather.tone]
  const WeatherIcon = weather.icon

  return (
    <div className="relative">
      {/* Subtle violet wash, top-right (decorative, token-based) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-8 h-56"
        style={{ background: "radial-gradient(120% 80% at 82% 0%, var(--accent-muted), transparent 60%)" }}
      />

      <div className="relative flex flex-col gap-6 pb-10">
        {/* 1 · Daily header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em]">
              <span className="text-[var(--accent-on-dark)]">7F · Smart Inbox</span>{" "}
              <span className="text-[var(--text-tertiary-light)]">· Overview</span>
            </p>
            <h1
              suppressHydrationWarning
              className="text-[28px] font-extrabold leading-tight text-[var(--text-primary-light)] md:text-[34px]"
            >
              {greeting}, Merlys.
            </h1>
            <p suppressHydrationWarning className="mt-1.5 text-[15px] text-[var(--text-secondary-light)]">
              Today is {formatDateLong(ref)}. Fanny found{" "}
              <span className="font-semibold text-[var(--text-primary-light)]">8 messages</span> that need attention.
            </p>
          </div>

          {/* Right: time + weather, then Open Inbox */}
          <div className="flex shrink-0 flex-col items-stretch gap-[11px] lg:w-[320px]">
            <div className="flex items-center justify-end gap-3.5">
              <div className="flex flex-col items-end leading-none">
                <span suppressHydrationWarning className="font-mono text-[22px] font-medium text-[var(--text-primary-light)]">
                  {now ? formatTime(now) : "--:--"}
                </span>
                <span suppressHydrationWarning className="mt-1 text-[11px] text-[var(--text-tertiary-light)]">
                  {formatDateShort(ref)}
                </span>
              </div>

              <div
                className="inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5"
                style={{
                  background: wTokens.soft,
                  borderColor: `color-mix(in srgb, ${wTokens.accent} 30%, transparent)`,
                }}
              >
                <span className="relative inline-flex h-5 w-5 items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full blur-md"
                    style={{ background: `radial-gradient(circle, ${wTokens.accent}, transparent 70%)`, opacity: 0.5 }}
                  />
                  <WeatherIcon className="relative h-5 w-5" style={{ color: wTokens.accent }} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] font-medium text-[var(--text-primary-light)]">{weather.label}</span>
                  <span className="text-[11px]" style={{ color: wTokens.accent }}>
                    {weather.detail}
                  </span>
                </span>
              </div>
            </div>

            <Link
              href="/inbox"
              className="inline-flex items-center justify-center gap-2 self-stretch rounded-lg px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
              style={{
                background: "var(--accent-primary)",
                boxShadow: "0 10px 26px -6px color-mix(in srgb, var(--accent-primary) 40%, transparent)",
              }}
            >
              Open Inbox
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* 2 · Fanny morning briefing */}
        <FannyBriefing />

        {/* 3 · Channel activity */}
        <ChannelActivity />

        {/* 4 · Needs action + Proposed by Fanny */}
        <div className="grid gap-5 md:grid-cols-[1.35fr_1fr]">
          <NeedsAction />
          <ProposedByFanny />
        </div>

        {/* 5 · Bridges: Ready in Today · Waiting · Open Inbox */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr_1fr]">
          <ReadyInToday />
          <WaitingFollowups />
          <OpenInboxModes />
        </div>

        {/* 6 · Product note */}
        <p className="pt-2 text-center text-[12px] text-[var(--text-tertiary-light)]">
          Overview is for the briefing{" · "}Inbox is for working messages{" · "}Today is for executing confirmed tasks
        </p>
      </div>
    </div>
  )
}
