import { Sparkles } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { PartOfDay } from "@modules/today/briefing"

/**
 * Fanny Morning Briefing — the day's voice (the "lives" of "7F lives, works,
 * resolves").
 *
 * Presentational only. It renders one deterministic, rule-based line (built by
 * `buildBriefingLine` from real `/api/today` counts) under a
 * "Fanny · <part of day> briefing" eyebrow. It is NOT live LLM output and
 * never fabricates data — the honesty guarantee lives in
 * `modules/today/briefing.ts`.
 *
 * Preview-only: mounted by the work_first_v2 hero
 * (`/today?todayLayout=work_first_v2`). Production Today is unchanged.
 *
 * All colours are existing theme tokens so the panel follows Midnight (and any
 * future theme) without bespoke values.
 */
export function TodayBriefing({
  line,
  partOfDay,
}: {
  line: string
  partOfDay: PartOfDay
}) {
  const { t } = useI18n()
  const briefing = t.today.briefing

  return (
    <section
      aria-label={briefing.ariaLabel}
      className="relative flex flex-col overflow-hidden rounded-[18px] border border-[var(--accent-muted-border)] bg-[var(--app-surface-dark)] p-5"
    >
      {/* Soft accent glow — decorative, static (no animation). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--accent-muted)] blur-2xl"
      />
      <div className="relative flex flex-1 flex-col justify-center gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent-on-dark)]"
          >
            <Sparkles size={14} strokeWidth={2} />
          </span>
          {/* "Fanny" is a proper name; the part-of-day briefing label localizes. */}
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-on-dark)]">
            Fanny · {briefing.eyebrow[partOfDay]}
          </span>
        </div>
        <p
          suppressHydrationWarning
          className="text-[15px] font-medium leading-relaxed text-[var(--text-primary-light)] [text-wrap:pretty]"
        >
          {line}
        </p>
      </div>
    </section>
  )
}
