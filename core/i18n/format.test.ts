import assert from "node:assert/strict"
import test from "node:test"

import {
  toIntlLocale,
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatCurrency,
  formatRelativeTime,
} from "./format"

/**
 * Assertions compare against native Intl output for the SAME resolved locale,
 * so they stay correct across ICU versions and Unicode spacing (NBSP etc.)
 * instead of hardcoding fragile literals — the formatToParts-equivalent
 * robustness the mission asks for.
 */
const SAMPLE = new Date(Date.UTC(2026, 2, 5, 14, 30)) // 2026-03-05T14:30Z

test("toIntlLocale: UI locales map to registry regional defaults", () => {
  assert.equal(toIntlLocale("es"), "es-ES")
  assert.equal(toIntlLocale("en"), "en-GB")
  assert.equal(toIntlLocale("de"), "de-DE")
  assert.equal(toIntlLocale("fr"), "fr-FR")
  assert.equal(toIntlLocale("it"), "it-IT")
})

test("toIntlLocale: regional variants of official locales are honored verbatim", () => {
  assert.equal(toIntlLocale("de-CH"), "de-CH")
  assert.equal(toIntlLocale("fr-CH"), "fr-CH")
  assert.equal(toIntlLocale("it-CH"), "it-CH")
  assert.equal(toIntlLocale("es_MX"), "es-MX")
  assert.equal(toIntlLocale("en-US"), "en-US")
})

test("toIntlLocale: unknown/empty input → fallback regional default (en-GB, never en-US)", () => {
  assert.equal(toIntlLocale("zz"), "en-GB")
  assert.equal(toIntlLocale(""), "en-GB")
  assert.equal(toIntlLocale(null), "en-GB")
  assert.equal(toIntlLocale(undefined), "en-GB")
})

test("formatDate: matches Intl for the five defaults and Swiss variants", () => {
  for (const tag of ["es", "en", "de", "fr", "it", "de-CH", "fr-CH", "it-CH"]) {
    const expected = new Intl.DateTimeFormat(toIntlLocale(tag), {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(SAMPLE)
    assert.equal(formatDate(SAMPLE, { locale: tag }), expected, `locale ${tag}`)
  }
})

test("formatDate/formatTime: explicit timezone shifts the rendered value", () => {
  const nearMidnight = new Date(Date.UTC(2026, 0, 1, 0, 30)) // Jan 1 00:30 UTC
  const utcDay = formatDate(nearMidnight, { locale: "en", timeZone: "UTC" })
  const nyDay = formatDate(nearMidnight, { locale: "en", timeZone: "America/New_York" })
  assert.notEqual(utcDay, nyDay) // still Dec 31 in New York
  const utcTime = formatTime(SAMPLE, { locale: "en", timeZone: "UTC" })
  const madridTime = formatTime(SAMPLE, { locale: "en", timeZone: "Europe/Madrid" })
  assert.notEqual(utcTime, madridTime)
})

test("formatDateTime: matches Intl composition", () => {
  const expected = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(SAMPLE)
  assert.equal(formatDateTime(SAMPLE, { locale: "es", timeZone: "UTC" }), expected)
})

test("formatNumber/formatPercent: regional grouping and percent style", () => {
  assert.equal(formatNumber(1234567.89, { locale: "es" }),
    new Intl.NumberFormat("es-ES").format(1234567.89))
  assert.equal(formatNumber(1234567.89, { locale: "en" }),
    new Intl.NumberFormat("en-GB").format(1234567.89))
  assert.notEqual(formatNumber(1234567.89, { locale: "es" }), formatNumber(1234567.89, { locale: "en" }))
  assert.equal(formatPercent(0.425, { locale: "de", maximumFractionDigits: 1 }),
    new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 }).format(0.425))
})

test("formatCurrency: explicit currency, never inferred from the language", () => {
  // Spanish UI + CHF and German UI + EUR are first-class combinations.
  const esChf = formatCurrency(1234.56, { locale: "es", currency: "CHF" })
  const deEur = formatCurrency(1234.56, { locale: "de", currency: "EUR" })
  const frGbp = formatCurrency(1234.56, { locale: "fr", currency: "GBP" })
  const itChf = formatCurrency(1234.56, { locale: "it-CH", currency: "CHF" })
  assert.equal(esChf, new Intl.NumberFormat("es-ES", { style: "currency", currency: "CHF" }).format(1234.56))
  assert.equal(deEur, new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(1234.56))
  assert.equal(frGbp, new Intl.NumberFormat("fr-FR", { style: "currency", currency: "GBP" }).format(1234.56))
  assert.equal(itChf, new Intl.NumberFormat("it-CH", { style: "currency", currency: "CHF" }).format(1234.56))
  // Same language, different currency → different output (currency drives it).
  assert.notEqual(esChf, formatCurrency(1234.56, { locale: "es", currency: "EUR" }))
})

test("formatCurrency: currency parts survive across locales (formatToParts)", () => {
  const parts = new Intl.NumberFormat(toIntlLocale("es"), {
    style: "currency",
    currency: "CHF",
  }).formatToParts(99)
  assert.ok(parts.some((p) => p.type === "currency"))
})

test("formatRelativeTime: explicit now, no clock reads", () => {
  const now = new Date(Date.UTC(2026, 2, 5, 12, 0))
  const yesterday = new Date(Date.UTC(2026, 2, 4, 12, 0))
  const inTwoHours = new Date(Date.UTC(2026, 2, 5, 14, 0))
  assert.equal(
    formatRelativeTime(yesterday, { locale: "en", now }),
    new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" }).format(-1, "day"),
  )
  assert.equal(
    formatRelativeTime(inTwoHours, { locale: "fr", now }),
    new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" }).format(2, "hour"),
  )
})

test("formatters: invalid input returns empty string, never throws", () => {
  assert.equal(formatDate("not-a-date", { locale: "es" }), "")
  assert.equal(formatDate(null, { locale: "es" }), "")
  assert.equal(formatNumber(Number.NaN, { locale: "de" }), "")
  assert.equal(formatCurrency(undefined, { locale: "it", currency: "CHF" }), "")
  assert.equal(formatRelativeTime("nope", { locale: "en", now: Date.now() }), "")
})
