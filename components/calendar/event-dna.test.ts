import { test } from "node:test"
import assert from "node:assert/strict"

import { calendar as enCalendar } from "@core/i18n/ui/en/calendar"
import { calendar as esCalendar } from "@core/i18n/ui/es/calendar"
import { deriveDateMeaning, deriveTimingRisk, isActionableOverdue, primaryCta } from "./event-dna"
import type { CalendarItem } from "./types"

const today = new Date(2026, 5, 24, 12, 0, 0) // Wed Jun 24 2026

function iso(y: number, mo: number, d: number, h = 0, mi = 0): string {
  return new Date(y, mo, d, h, mi, 0).toISOString()
}
function item(partial: Partial<CalendarItem> & Pick<CalendarItem, "type" | "date">): CalendarItem {
  return { id: "x", title: "x", allDay: true, status: "pendiente", ...partial }
}

test("deriveDateMeaning: relative labels", () => {
  assert.equal(deriveDateMeaning(iso(2026, 5, 24), today).label, "Today")
  assert.equal(deriveDateMeaning(iso(2026, 5, 25), today).label, "Tomorrow")
  assert.equal(deriveDateMeaning(iso(2026, 5, 23), today).label, "Yesterday")
  assert.equal(deriveDateMeaning(iso(2026, 5, 27), today).label, "In 3 days")
  assert.equal(deriveDateMeaning(iso(2026, 5, 20), today).label, "4 days ago")
  assert.equal(deriveDateMeaning(iso(2026, 6, 8), today).label, "In 2 weeks") // +14d
  assert.equal(deriveDateMeaning(iso(2026, 5, 10), today).label, "2 weeks ago") // -14d
  assert.equal(deriveDateMeaning("not-a-date", today).relativeDays !== deriveDateMeaning("not-a-date", today).relativeDays, true) // NaN
})

test("isActionableOverdue: only still-actionable past tareas/facturas", () => {
  assert.equal(isActionableOverdue(item({ type: "tarea", date: iso(2026, 5, 20), status: "pendiente" }), today), true)
  assert.equal(isActionableOverdue(item({ type: "tarea", date: iso(2026, 5, 20), status: "completada" }), today), false)
  assert.equal(isActionableOverdue(item({ type: "factura", date: iso(2026, 5, 20), status: "vencida" }), today), true)
  assert.equal(isActionableOverdue(item({ type: "factura", date: iso(2026, 5, 20), status: "pagada" }), today), false)
  assert.equal(isActionableOverdue(item({ type: "evento", date: iso(2026, 5, 20), status: "reunion" }), today), false) // eventos are never "overdue"
  assert.equal(isActionableOverdue(item({ type: "tarea", date: iso(2026, 5, 24), status: "pendiente" }), today), false) // today ≠ overdue
})

test("deriveTimingRisk: overdue > conflict > due-today > none", () => {
  assert.deepEqual(
    (({ level, tone, detail }) => ({ level, tone, detail }))(deriveTimingRisk(item({ type: "tarea", date: iso(2026, 5, 20), status: "pendiente" }), today)),
    { level: "overdue", tone: "danger", detail: "4 days past due" },
  )
  assert.equal(deriveTimingRisk(item({ type: "factura", date: iso(2026, 5, 20), status: "pagada" }), today).level, "none")
  const conflict = deriveTimingRisk(item({ type: "evento", date: iso(2026, 5, 24, 10), allDay: false, status: "reunion" }), today, true)
  assert.equal(conflict.level, "conflict")
  assert.equal(conflict.tone, "warning")
  assert.equal(deriveTimingRisk(item({ type: "evento", date: iso(2026, 5, 24, 10), allDay: false, status: "reunion" }), today).label, "Happening today")
  assert.equal(deriveTimingRisk(item({ type: "tarea", date: iso(2026, 5, 24), status: "pendiente" }), today).label, "Due today")
})

test("derivations localize when passed the Spanish catalog slices", () => {
  assert.equal(deriveDateMeaning(iso(2026, 5, 24), today, esCalendar.dna.meaning).label, "Hoy")
  assert.equal(deriveDateMeaning(iso(2026, 5, 27), today, esCalendar.dna.meaning).label, "En 3 días")
  assert.equal(deriveDateMeaning(iso(2026, 5, 10), today, esCalendar.dna.meaning).label, "Hace 2 semanas")
  const risk = deriveTimingRisk(item({ type: "tarea", date: iso(2026, 5, 20), status: "pendiente" }), today, false, esCalendar.dna.risks)
  assert.equal(risk.label, "Atrasado")
  assert.equal(risk.detail, "4 días de retraso")
  assert.deepEqual(
    primaryCta(item({ type: "tarea", date: iso(2026, 5, 24), status: "pendiente" }), today, false, esCalendar.dna.cta),
    { label: "Abrir en Hoy", href: "/today" },
  )
})

test("calendar catalogs: es is a real translation (differs from en, no empty strings)", () => {
  const leaves = (value: unknown, path: string, out: Map<string, string>): Map<string, string> => {
    if (typeof value === "string") out.set(path, value)
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) leaves(v, `${path}.${k}`, out)
    }
    return out
  }
  const en = leaves(enCalendar, "$", new Map())
  const es = leaves(esCalendar, "$", new Map())
  // Same string-leaf structure (functions are type-checked by the shared interface)…
  assert.deepEqual([...es.keys()].sort(), [...en.keys()].sort())
  // …no empty Spanish strings…
  for (const [path, value] of es) assert.ok(value.length > 0, `empty string at ${path}`)
  // …and the catalogs genuinely differ (not an English copy).
  const differing = [...en.keys()].filter((k) => en.get(k) !== es.get(k))
  assert.ok(differing.length > en.size / 2, "es calendar catalog looks like an English copy")
})

test("primaryCta: date- & module-aware, conflict wins", () => {
  assert.deepEqual(primaryCta(item({ type: "tarea", date: iso(2026, 5, 24), status: "pendiente" }), today), { label: "Open in Today", href: "/today" })
  assert.deepEqual(primaryCta(item({ type: "tarea", date: iso(2026, 5, 20), status: "pendiente" }), today), { label: "Open in Tasks", href: "/tareas" })
  assert.deepEqual(primaryCta(item({ type: "factura", date: iso(2026, 5, 20), status: "vencida" }), today), { label: "Open in Finance", href: "/finanzas" })
  // overdue but completed → no module bridge, just jump the calendar
  assert.deepEqual(primaryCta(item({ type: "tarea", date: iso(2026, 5, 20), status: "completada" }), today), { label: "Go to date" })
  // conflict overrides everything, no href (wired to onOpenDate)
  assert.deepEqual(primaryCta(item({ type: "evento", date: iso(2026, 5, 24, 10), allDay: false, status: "reunion" }), today, true), { label: "View conflict" })
  // future item → Go to date
  assert.deepEqual(primaryCta(item({ type: "evento", date: iso(2026, 5, 27, 9), allDay: false, status: "reunion" }), today), { label: "Go to date" })
})
