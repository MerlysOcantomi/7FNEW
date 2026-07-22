import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildWhatsappLink,
  buildQuickActions,
  buildReceptionModel,
  DeterministicFannyProvider,
  resolveFannyProvider,
  validateAppointmentRequest,
  normalizeConsent,
} from "./reception"
import type { PresenceContentSource } from "./content-source"

function content(overrides: Partial<PresenceContentSource> = {}): PresenceContentSource {
  return {
    workspaceId: "ws_1",
    identity: { name: "Estudio Aurora", description: "A calm studio" },
    services: [
      { name: "Consultation", category: "General", active: true },
      { name: "Retired", category: null, active: false },
    ],
    hours: "Mon–Fri 9–19",
    region: "Madrid",
    channels: { whatsapp: "+34 600 000 000", phone: null, social: { instagram: "https://instagram.com/x" } },
    availableSources: [],
    ...overrides,
  }
}

// ---- WhatsApp link (server-resolved number only) --------------------------

test("buildWhatsappLink normalizes digits and adds an optional prefilled message", () => {
  const link = buildWhatsappLink("+34 600 000 000", "Hi from the site")
  assert.ok(link)
  assert.match(link!.href, /^https:\/\/wa\.me\/34600000000\?text=/)
  assert.equal(link!.display, "+34 600 000 000")
})

test("buildWhatsappLink rejects implausible numbers", () => {
  assert.equal(buildWhatsappLink("123"), null)
  assert.equal(buildWhatsappLink(""), null)
  assert.equal(buildWhatsappLink(null), null)
})

// ---- quick actions (only backed by real data) -----------------------------

test("initial quick actions never include WhatsApp (Fanny leads); services/hours gated by data", () => {
  const ids = buildQuickActions(content()).map((a) => a.id)
  assert.deepEqual(ids, ["services", "hours", "appointment", "human"])
  assert.ok(!ids.includes("whatsapp"), "WhatsApp must not be an initial action")
})

test("no services / hours → those actions are omitted (no empty controls)", () => {
  const ids = buildQuickActions(
    content({ services: [], hours: null, region: null, channels: { whatsapp: null, phone: null, social: {} } }),
  ).map((a) => a.id)
  assert.deepEqual(ids, ["appointment", "human"])
})

// ---- dual reception model --------------------------------------------------

test("reception model exposes Fanny + WhatsApp; distinguishes link vs connected", () => {
  const withNumber = buildReceptionModel(content(), { whatsappConnected: false, fannyEnabled: true })
  assert.equal(withNumber.whatsapp.available, true)
  assert.equal(withNumber.whatsapp.connected, false) // public link, official API not connected
  assert.ok(withNumber.fanny.greeting.includes("Estudio Aurora"))

  const noNumber = buildReceptionModel(
    content({ channels: { whatsapp: null, phone: null, social: {} } }),
    { whatsappConnected: false, fannyEnabled: true },
  )
  assert.equal(noNumber.whatsapp.available, false)
  assert.equal(noNumber.whatsapp.link, null)
})

// ---- deterministic Fanny responder ----------------------------------------

const fanny = new DeterministicFannyProvider()

test("services / hours / location answered from public content", () => {
  assert.match(fanny.respond({ message: "what services do you offer?", content: content() }).reply, /Consultation/)
  assert.match(fanny.respond({ message: "opening hours?", content: content() }).reply, /Mon–Fri 9–19/)
  assert.match(fanny.respond({ message: "where are you?", content: content() }).reply, /Madrid/)
})

test("missing data degrades gracefully (no invented info)", () => {
  const bare = content({ hours: null })
  const r = fanny.respond({ message: "hours?", content: bare })
  assert.ok(!/Mon–Fri/.test(r.reply))
})

test("human request sets handoff and suggests WhatsApp (context)", () => {
  const r = fanny.respond({ message: "I want to talk to a person", content: content() })
  assert.equal(r.intent, "human")
  assert.equal(r.handoff, true)
  assert.equal(r.suggestWhatsapp, true)
})

test("plain answers (services/hours) do NOT suggest WhatsApp", () => {
  assert.equal(fanny.respond({ message: "services?", content: content() }).suggestWhatsapp, false)
  assert.equal(fanny.respond({ message: "hours?", content: content() }).suggestWhatsapp, false)
  assert.equal(fanny.respond({ message: "hi", content: content() }).suggestWhatsapp, false)
})

test("appointment intent offers the form", () => {
  const r = fanny.respond({ message: "can I book an appointment?", content: content() })
  assert.equal(r.intent, "appointment")
  assert.equal(r.offerAppointmentForm, true)
})

test("a quick action short-circuits classification", () => {
  const r = fanny.respond({ message: "", action: "hours", content: content() })
  assert.equal(r.intent, "hours")
})

test("explicit whatsapp question suggests WhatsApp without forcing the visitor out", () => {
  const r = fanny.respond({ message: "do you have whatsapp?", content: content() })
  assert.equal(r.intent, "whatsapp")
  assert.equal(r.handoff, false)
  assert.equal(r.suggestWhatsapp, true)
})

test("fallback offers safe options and WhatsApp continuity, never errors", () => {
  const r = fanny.respond({ message: "asdfqwer zzz", content: content() })
  assert.equal(r.intent, "fallback")
  assert.ok(r.reply.length > 0)
  assert.equal(r.suggestWhatsapp, true)
})

test("resolveFannyProvider defaults to the deterministic engine (no AI required)", () => {
  assert.equal(resolveFannyProvider().id, "deterministic")
  assert.equal(resolveFannyProvider(null).id, "deterministic")
})

// ---- appointment validation (never auto-confirms) -------------------------

test("appointment requires a name; a non-chat preference requires contact", () => {
  assert.equal(validateAppointmentRequest({}).ok, false)
  const noContact = validateAppointmentRequest({ name: "Ana", contactPreference: "whatsapp" })
  assert.equal(noContact.ok, false)
  assert.ok(noContact.errors.includes("contact_required_for_preference"))
})

test("valid appointment produces a structured summary", () => {
  const v = validateAppointmentRequest({ name: "Ana", service: "Consultation", preferredDay: "Friday", contactPreference: "chat" })
  assert.equal(v.ok, true)
  assert.equal(v.request!.contactPreference, "chat")
  assert.match(v.summary!, /Appointment request from Ana/)
  assert.match(v.summary!, /Service: Consultation/)
})

test("unknown contact preference falls back to chat", () => {
  const v = validateAppointmentRequest({ name: "Ana", contactPreference: "carrier-pigeon" })
  assert.equal(v.request!.contactPreference, "chat")
})

// ---- consent (promotional is explicit opt-in) -----------------------------

test("promotional consent defaults to false; operational is implicit", () => {
  assert.deepEqual(normalizeConsent(null), { operational: true, promotional: false })
  assert.deepEqual(normalizeConsent({}), { operational: true, promotional: false })
  assert.deepEqual(normalizeConsent({ promotional: "yes" }), { operational: true, promotional: false })
})

test("promotional consent is granted only when explicitly true", () => {
  assert.deepEqual(normalizeConsent({ promotional: true }), { operational: true, promotional: true })
})
