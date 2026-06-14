"use client"

import Link from "next/link"
import { ArrowUpRight, Mic, Sparkles } from "lucide-react"

/**
 * Fanny Morning Briefing — the hero of the Overview.
 *
 * Fanny's presence is ABSTRACT on purpose: no avatar, no doll. A premium violet
 * orb with a soft glow, two expanding concentric rings, and a tiny 5-bar waveform.
 * All colours come from theme tokens; the only literals are decorative shadow/glow
 * alphas (rgba black/white), matching the codebase convention. Motion respects
 * prefers-reduced-motion via the `data-inbox-anim` hook in globals.css.
 */

const WAVE_BARS = [0.5, 0.85, 1, 0.7, 0.45]

function FannyOrb() {
  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      {/* Expanding rings */}
      {[0, 1].map((i) => (
        <span
          key={i}
          data-inbox-anim
          aria-hidden="true"
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: "var(--accent-muted-border)",
            animation: "inbox-orb-ring 3.2s ease-out infinite",
            animationDelay: `${i * 1.6}s`,
          }}
        />
      ))}
      {/* Soft outer glow */}
      <span
        data-inbox-anim
        aria-hidden="true"
        className="absolute inset-2 rounded-full blur-xl"
        style={{
          background: "radial-gradient(circle at 50% 50%, var(--accent-primary), transparent 70%)",
          animation: "inbox-orb-glow 3.5s ease-in-out infinite",
        }}
      />
      {/* Core orb */}
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, var(--accent-on-dark), var(--accent-primary) 45%, var(--accent-rich) 100%)",
          boxShadow: "0 10px 30px -8px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.25)",
        }}
      >
        {/* Waveform */}
        <div className="flex h-8 items-center gap-[3px]">
          {WAVE_BARS.map((h, i) => (
            <span
              key={i}
              data-inbox-anim
              aria-hidden="true"
              className="w-[3px] rounded-full"
              style={{
                height: `${h * 100}%`,
                background: "rgba(255,255,255,0.92)",
                transformOrigin: "center",
                animation: "inbox-wave 1.3s ease-in-out infinite",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function FannyBriefing() {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] border p-6 md:p-8"
      style={{
        borderColor: "var(--accent-muted-border)",
        background:
          "linear-gradient(125deg, color-mix(in srgb, var(--accent-rich) 26%, var(--app-surface-dark-elevated)) 0%, var(--app-surface-dark-elevated) 58%, var(--app-surface-dark) 100%)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.55), inset 0 1px 0 var(--border-dark-strong)",
      }}
    >
      {/* Decorative violet glow, top-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-muted), transparent 70%)" }}
      />

      <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
        <FannyOrb />

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-on-dark)]">
              Fanny · Morning Briefing
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: "var(--inbox-success-soft)", color: "var(--inbox-success)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--inbox-success)" }} />
              Live
            </span>
          </div>

          <p className="text-[17px] font-medium leading-relaxed text-[var(--text-primary-light)] md:text-[19px]">
            Here&apos;s where things stand.{" "}
            <span className="font-semibold text-[var(--accent-on-dark)]">María</span> followed up about
            tomorrow&apos;s meeting, two new leads asked for pricing, and one client is waiting for
            confirmation. I prepared{" "}
            <span className="font-semibold text-[var(--accent-on-dark)]">3 suggested actions</span> for you.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <a
              href="#overview-proposed"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
              style={{ background: "var(--accent-primary)" }}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              Review 3 suggestions
            </a>
            <Link
              href="/inbox?layout=triage"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-dark-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary-light)] transition-colors hover:bg-[var(--app-surface-dark-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
            >
              <ArrowUpRight className="h-4 w-4 shrink-0" />
              Open Inbox Brief
            </Link>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-dark-hover)] hover:text-[var(--text-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted-border)]"
            >
              <Mic className="h-4 w-4 shrink-0" />
              Ask Fanny
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
