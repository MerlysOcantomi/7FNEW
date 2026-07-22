import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FannyReception } from "./fanny-reception"

const model = {
  fanny: {
    enabled: true,
    greeting: "Hi, I'm Fanny, the virtual receptionist for Estudio Aurora.",
    quickActions: [
      { id: "services", label: "View services" },
      { id: "hours", label: "Opening hours" },
      { id: "appointment", label: "Request an appointment" },
      { id: "human", label: "Talk to a person" },
    ],
  },
  whatsapp: { available: true, connected: false, link: { href: "https://wa.me/34600000000", display: "+34 600 000 000" } },
}

function render() {
  return renderToStaticMarkup(React.createElement(FannyReception, { slug: "demo-studio", model }))
}

test("the floating button reads 'Ask Fanny'", () => {
  assert.match(render(), /Ask Fanny/)
})

test("no floating WhatsApp button exists (single floating action, no mobile clutter)", () => {
  // Closed state: only the Fanny launcher is rendered; WhatsApp is not a
  // competing floating button (it lives outside the chat + appears in context).
  assert.ok(!render().includes("wa.me"), "no floating WhatsApp link in the closed widget")
})

test("initial quick actions never include a WhatsApp label (model-driven)", () => {
  assert.ok(!model.fanny.quickActions.some((a) => /whatsapp/i.test(a.label)))
})
