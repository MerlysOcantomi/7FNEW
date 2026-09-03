import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TodayDateGlyph } from "./today-date-glyph"

const render = (day: number | null) => renderToStaticMarkup(React.createElement(TodayDateGlyph, { day }))

test("Today glyph prints the given day of month inside the calendar frame", () => {
  const html = render(3)
  assert.match(html, /data-today-day[^>]*>3<\/text>/)
  assert.match(html, /<rect /) // the frame is always drawn
})

test("Today glyph renders the frame only (no number) before the client knows the day", () => {
  const html = render(null)
  assert.doesNotMatch(html, /<text/)
  assert.match(html, /<rect /)
})

test("Today glyph is decorative: aria-hidden, currentColor, no hardcoded colors", () => {
  const html = render(21)
  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /stroke="currentColor"/)
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/)
  assert.doesNotMatch(html, /rgba?\(/)
  assert.match(html, />21<\/text>/)
})
