/**
 * Shared visual vocabulary for the "Mi salón" (Finesse Business Overview)
 * surface. Mirrors `components/marketing/marketing-ui.ts` and the Beauty "Hoy"
 * card family so the three Finesse surfaces read as one product.
 *
 * COLORS: theme tokens only (no parallel palette) — everything here takes the
 * Rose Nude skin for free under `data-theme="rose-nude"`. States never rely on
 * color alone: tones always render next to a text label or arrow glyph.
 */

import type { CSSProperties } from "react"
import type { ComparisonTone } from "@modules/overview/derive"
import type { FormatLocale } from "@core/i18n/format"
import { toIntlLocale } from "@core/i18n/format"

/** Shared card shell classes (mirrors the Beauty "Hoy" card family). */
export const CARD_CLASS =
  "rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"

/** Card section title (calm, editorial — not dashboard chrome). */
export const CARD_TITLE_CLASS =
  "text-[15px] font-semibold tracking-tight text-[var(--text-primary-light)]"

export const CARD_HINT_CLASS = "text-[11.5px] text-[var(--text-tertiary-light)]"

/** Shared chip classes — tones supply colors, this supplies shape. */
export const CHIP_CLASS =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"

export const BTN_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1"

export const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${BTN_FOCUS}`

export const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary-light)] disabled:cursor-not-allowed disabled:opacity-60 ${BTN_FOCUS}`

/** Soft accent action (used by section CTAs like "Revisar agenda"). */
export const BTN_SOFT = `inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BTN_FOCUS}`

export const BTN_SOFT_STYLE: CSSProperties = {
  background: "var(--accent-muted)",
  color: "var(--accent-on-dark)",
  borderColor: "var(--accent-muted-border)",
}

// ─── Tones (positive / negative / neutral, never color-only) ─────────────────

export interface ToneStyle {
  text: string
  bg: string
  border: string
}

export const TONE_STYLES: Record<ComparisonTone, ToneStyle> = {
  up: {
    text: "var(--inbox-success)",
    bg: "var(--inbox-success-soft, color-mix(in srgb, var(--inbox-success) 12%, transparent))",
    border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
  },
  down: {
    text: "var(--inbox-urgency)",
    bg: "var(--inbox-urgency-soft, color-mix(in srgb, var(--inbox-urgency) 12%, transparent))",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
  },
  flat: {
    text: "var(--text-secondary-light)",
    bg: "var(--app-surface-subtle)",
    border: "var(--border-dark)",
  },
}

/** Arrow glyph per tone so movement never relies on color alone. */
export const TONE_GLYPH: Record<ComparisonTone, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
}

// ─── Chart colors (token-derived, no hex) ────────────────────────────────────

export const CHART_BAR_PRIMARY =
  "linear-gradient(180deg, var(--accent-primary), var(--accent-primary-hover, var(--accent-primary)))"

export const CHART_BAR_MUTED =
  "color-mix(in srgb, var(--accent-primary) 26%, var(--app-surface-dark-elevated))"

export const CHART_TRACK = "var(--app-surface-subtle)"

/** Client-mix donut segments: returning = accent, new = info. */
export const MIX_RETURNING_COLOR = "var(--accent-primary)"
export const MIX_NEW_COLOR = "var(--inbox-info)"

// ─── Flexible date labels ────────────────────────────────────────────────────

/**
 * Locale-aware date label with explicit `Intl` parts (weekday/month/… shapes
 * the core `formatDate` fixed format doesn't cover). Same failure contract as
 * `core/i18n/format.ts`: invalid input renders "" — never throws.
 */
export function formatDateParts(
  value: Date | null | undefined,
  { locale, ...options }: { locale: FormatLocale } & Intl.DateTimeFormatOptions,
): string {
  if (!value || Number.isNaN(value.getTime())) return ""
  try {
    return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(value)
  } catch {
    return ""
  }
}

// ─── Compact money for chart tick labels ─────────────────────────────────────

/**
 * Compact currency ("2,5 mil €" → narrow "2,5 K€" style depends on locale) for
 * bar-top labels where the full amount would collide at narrow widths. Uses
 * `Intl` with the workspace currency — never a hardcoded symbol. Falls back to
 * an empty string on invalid input (same contract as `core/i18n/format.ts`).
 */
export function formatCurrencyCompact(
  value: number | null | undefined,
  { locale, currency }: { locale: FormatLocale; currency: string },
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return ""
  }
}
