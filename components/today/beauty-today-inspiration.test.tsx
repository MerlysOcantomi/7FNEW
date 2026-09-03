import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { InspirationSection } from "./beauty-today-real"
import { getBeautyTodayMessages } from "@modules/today/i18n"

const t = getBeautyTodayMessages("es").real

test("inspiration: empty state is a calm product container, no fake gallery, no images", () => {
  const html = renderToStaticMarkup(
    React.createElement(InspirationSection, { inspiration: { items: [], total: 0 }, t }),
  )
  assert.match(html, /Mi inspiración/)
  assert.match(html, /Aún no hay fotos de tus trabajos/)
  assert.doesNotMatch(html, /<img/)
  assert.doesNotMatch(html, /\d+ trabajos?</) // no count label without photos
})

test("inspiration: real approved photos render as lazy thumbnails with accessible alt + total count", () => {
  const html = renderToStaticMarkup(
    React.createElement(InspirationSection, {
      inspiration: {
        items: [
          { id: "m1", url: "https://blob.example/m1.jpg", width: 800, height: 800, purpose: "work_sample" },
          { id: "m2", url: "https://blob.example/m2.jpg", width: null, height: null, purpose: "gallery" },
        ],
        total: 9,
      },
      t,
    }),
  )
  assert.equal((html.match(/<img/g) ?? []).length, 2)
  assert.match(html, /src="https:\/\/blob\.example\/m1\.jpg"/)
  assert.match(html, /alt="Trabajo 1"/)
  assert.match(html, /alt="Trabajo 2"/)
  assert.match(html, /loading="lazy"/)
  assert.match(html, /9 trabajos/)
})

test("inspiration: tokens only — no hardcoded colors in the markup", () => {
  const html = renderToStaticMarkup(
    React.createElement(InspirationSection, { inspiration: { items: [], total: 0 }, t }),
  )
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/)
  assert.doesNotMatch(html, /rgba?\(/)
})
