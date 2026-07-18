"use client"

import { Sparkles } from "lucide-react"
import type { BeautyMarketingConfig } from "@modules/marketing/beauty-marketing"
import type { FreyaBrief } from "@modules/marketing/types"

/**
 * Freya's short recommendation block — a real-feeling assistant note (observes
 * recent works, recommends the next step), deliberately NOT a chat. Mirrors
 * the FinesseAssistant card family from the Beauty "Hoy" overview.
 */
export function FreyaMarketingBrief({
  config,
  brief,
}: {
  config: BeautyMarketingConfig
  brief: FreyaBrief | null
}) {
  return (
    <section
      aria-label={config.freya.name}
      className="rounded-[18px] border p-4"
      style={{
        borderColor: "var(--accent-muted-border)",
        background:
          "linear-gradient(150deg, var(--accent-muted), var(--app-surface-dark) 62%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 place-items-center rounded-lg text-white"
          style={{ background: "var(--accent-primary)" }}
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-primary-light)]">
          {config.freya.name}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary-light)]">{config.freya.role}</span>
        {brief && brief.readyCount > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-secondary-light)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--inbox-success)" }}
            />
            {brief.readyCount} {config.freya.readySuffix}
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-primary-light)]">
        {brief ? brief.message : config.freya.empty}
      </p>
    </section>
  )
}
