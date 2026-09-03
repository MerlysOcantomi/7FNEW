import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AttentionSection } from "./beauty-today-real"
import { getBeautyTodayMessages } from "@modules/today/i18n"
import type { BeautyTodayAction, BeautyTodayPayload } from "@modules/today/beauty-real"

const beauty = getBeautyTodayMessages("es")

const task = (itemId: string, href: string, overdue = false): BeautyTodayAction => ({
  itemId,
  title: `Tarea ${itemId}`,
  description: null,
  priority: "high",
  dueAt: null,
  suggestedByAi: false,
  isWaiting: false,
  overdue,
  href,
  basis: { sourceLabel: null, clientId: null, clientName: null, eventoId: null, conversationId: null },
})

const payload = (over: Partial<BeautyTodayPayload>): BeautyTodayPayload => ({
  date: "2026-09-03",
  timezone: "Europe/Madrid",
  generatedAt: "2026-09-03T10:00:00.000Z",
  currency: "EUR",
  nextAppointment: null,
  appointments: [],
  gaps: [],
  urgentActions: [],
  suggestedActions: [],
  otherOpenTaskCount: 0,
  pendingConversations: null,
  overdueInvoices: null,
  pendingInvoices: null,
  inspiration: { items: [], total: 0 },
  dataQuality: { appointments: false, tasks: false, conversations: false, finance: false },
  source: "real",
  ...over,
})

const render = (data: BeautyTodayPayload) =>
  renderToStaticMarkup(React.createElement(AttentionSection, { data, beauty, currentPathname: "/today" }))

test("attention: messages stay a link to /inbox; invoices stay a link to /facturacion", () => {
  const html = render(payload({ pendingConversations: 2, overdueInvoices: { count: 1, amount: 80 } }))
  assert.match(html, /<a[^>]*href="\/inbox"[^>]*data-attention-row="link"|<a[^>]*data-attention-row="link"[^>]*href="\/inbox"/)
  assert.match(html, /href="\/facturacion"/)
  assert.match(html, /2 mensajes sin responder/)
  assert.match(html, /1 cobro vencido/)
})

test("attention: a WorkspaceTask whose destination is /today itself renders as an informative row, not a link", () => {
  const html = render(payload({ urgentActions: [task("t1", "/today", true)] }))
  assert.match(html, /Tarea t1/)
  assert.match(html, /data-attention-row="static"/)
  assert.doesNotMatch(html, /<a[^>]*href="\/today"/)
  assert.doesNotMatch(html, /data-attention-row="link"/)
  // No navigation affordance on the static row: no chevron, no hover class.
  assert.doesNotMatch(html, /lucide-chevron-right/)
  assert.doesNotMatch(html, /hover:bg-\[var\(--app-surface-hover\)\]/)
})

test("attention: a task with a real destination keeps its link, mixed with a static one (ranking untouched)", () => {
  const html = render(payload({ urgentActions: [task("board", "/today", true), task("real", "/tareas/real")] }))
  assert.match(html, /href="\/tareas\/real"/)
  assert.match(html, /data-attention-row="static"/)
  assert.match(html, /data-attention-row="link"/)
  // Overdue task ranks first (declared/rank order preserved).
  assert.ok(html.indexOf("Tarea board") < html.indexOf("Tarea real"))
})

test("attention: the legacy board CTA never comes back", () => {
  const html = render(payload({ urgentActions: [task("a", "/today", true), task("b", "/today"), task("c", "/today"), task("d", "/today")], suggestedActions: [task("p", "/today")] }))
  assert.doesNotMatch(html, /todayLayout=work_first/)
  assert.doesNotMatch(html, /Ver todo/)
  assert.match(html, /y 1 más/)
  assert.match(html, /Finesse tiene 1 propuesta/)
})
