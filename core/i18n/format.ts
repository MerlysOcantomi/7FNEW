/**
 * Central regional formatters — pure, typed, server/client safe (§12,
 * P4.CORE-5L). Native Intl only; no dependencies, no React, no Prisma.
 *
 * Contract:
 * - Every operation receives what it needs EXPLICITLY: a UI locale or a
 *   regional Intl tag, a `timeZone` when dates need one, a `currency` for
 *   money and a `now` for relative time. Formatters never read the clock,
 *   never infer currency/timezone/country from the language, and never
 *   translate content — they only shape numbers and dates.
 * - Translation locale ("de") vs FORMAT locale ("de-CH"): `toIntlLocale`
 *   maps a canonical UI locale to its registry Intl default (es→es-ES,
 *   en→en-GB, de→de-DE, fr→fr-FR, it→it-IT) and honors valid regional
 *   variants verbatim (de-CH stays de-CH). Unknown input falls back to the
 *   registry default of the FALLBACK locale (en-GB — never a hardcoded
 *   en-US).
 * - Invalid/ambiguous dates and non-finite numbers return "" so callers
 *   decide their own placeholder; nothing throws during render. That includes
 *   Intl RangeErrors caused by external configuration — an invalid currency
 *   code, timezone, malformed regional tag or out-of-range numeric option
 *   degrades to "" instead of breaking the page. Programming errors outside
 *   the Intl calls are NOT swallowed.
 * - Date strings are accepted only as unambiguous ISO 8601 ("2026-03-05",
 *   "2026-03-05T14:30:00Z"). Regional forms like "03/04/2026" are rejected
 *   (returning "") rather than guessed — no regional parsing, and the native
 *   ECMA-262 timezone semantics of ISO strings are left untouched.
 */

import { LOCALE_REGISTRY, FALLBACK_LOCALE, type SupportedLocale } from "./types"
import { parseLocale, isValidLocale } from "./locale"

/** A canonical UI locale ("de") or a regional Intl tag ("de-CH"). */
export type FormatLocale = SupportedLocale | (string & {})

/** Resolve the concrete Intl locale for any UI locale or regional tag. */
export function toIntlLocale(locale: FormatLocale | null | undefined): string {
  if (typeof locale === "string" && locale.trim()) {
    const tag = locale.trim().replace(/_/g, "-")
    const lower = tag.toLowerCase()
    if (isValidLocale(lower)) return LOCALE_REGISTRY[lower].intlLocale
    const base = lower.split("-")[0]
    if (isValidLocale(base) && tag.includes("-")) {
      // Regional variant of an official locale: honor it verbatim when Intl
      // accepts it (de-CH, fr-CH, es-MX…). Malformed tags fall through.
      try {
        new Intl.NumberFormat(tag)
        return tag
      } catch {
        return LOCALE_REGISTRY[base].intlLocale
      }
    }
    // Unknown language → the fallback locale's regional default.
    return LOCALE_REGISTRY[parseLocale(lower)].intlLocale
  }
  return LOCALE_REGISTRY[FALLBACK_LOCALE].intlLocale
}

/**
 * Unambiguous ISO 8601: date, or date + "T" time with optional seconds,
 * fraction and offset. Anything else ("03/04/2026", "04-05-2026", free text)
 * is ambiguous across regions and rejected.
 */
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

/** Validated date input → Date, or null for invalid/ambiguous values. */
function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null
  const trimmed = value.trim()
  const m = ISO_8601.exec(trimmed)
  if (!m) return null
  // Calendar-validate the fields — engines roll "2026-02-30" over to March
  // instead of rejecting it, and a silently shifted date is worse than none.
  const [, year, month, day, hour, minute, second] = m
  if (Number(month) < 1 || Number(month) > 12) return null
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  if (Number(day) < 1 || Number(day) > daysInMonth) return null
  if (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59))
    return null
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface DateFormatOptions {
  locale: FormatLocale
  /** Explicit IANA timezone when the rendering context defines one. */
  timeZone?: string
}

export function formatDate(
  value: Date | string | number | null | undefined,
  { locale, timeZone }: DateFormatOptions,
): string {
  const d = toValidDate(value)
  if (!d) return ""
  try {
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).format(d)
  } catch {
    return "" // invalid timeZone/tag from configuration must not break render
  }
}

export function formatTime(
  value: Date | string | number | null | undefined,
  { locale, timeZone }: DateFormatOptions,
): string {
  const d = toValidDate(value)
  if (!d) return ""
  try {
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(d)
  } catch {
    return ""
  }
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  { locale, timeZone }: DateFormatOptions,
): string {
  const d = toValidDate(value)
  if (!d) return ""
  try {
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(d)
  } catch {
    return ""
  }
}

export function formatNumber(
  value: number | null | undefined,
  { locale, maximumFractionDigits }: { locale: FormatLocale; maximumFractionDigits?: number },
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits }).format(value)
  } catch {
    return "" // out-of-range digit options are a config problem, not a crash
  }
}

/** `ratio` is 0..1 (0.42 → "42%"), not a pre-multiplied percentage. */
export function formatPercent(
  ratio: number | null | undefined,
  { locale, maximumFractionDigits = 0 }: { locale: FormatLocale; maximumFractionDigits?: number },
): string {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return ""
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      style: "percent",
      maximumFractionDigits,
    }).format(ratio)
  } catch {
    return ""
  }
}

/**
 * Money. `currency` (ISO 4217) is REQUIRED and comes from workspace/document
 * configuration — never derived from the language. Spanish UI + CHF, German
 * UI + EUR, French UI + GBP are all first-class combinations.
 */
export function formatCurrency(
  value: number | null | undefined,
  { locale, currency }: { locale: FormatLocale; currency: string },
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency }).format(value)
  } catch {
    return "" // an invalid/empty ISO 4217 code renders nothing, not a crash
  }
}

const RELATIVE_STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
]

/**
 * Relative time between `value` and an EXPLICIT `now` (pure — helpers never
 * read the clock, which also keeps server/client renders identical).
 */
export function formatRelativeTime(
  value: Date | string | number | null | undefined,
  { locale, now }: { locale: FormatLocale; now: Date | number },
): string {
  const d = toValidDate(value)
  const ref = toValidDate(now)
  if (!d || !ref) return ""
  const delta = d.getTime() - ref.getTime()
  try {
    const rtf = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: "auto" })
    for (const { unit, ms } of RELATIVE_STEPS) {
      if (Math.abs(delta) >= ms) return rtf.format(Math.trunc(delta / ms), unit)
    }
    return rtf.format(Math.trunc(delta / 1000), "second")
  } catch {
    return ""
  }
}
