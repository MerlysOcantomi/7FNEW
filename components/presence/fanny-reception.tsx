"use client"

/**
 * Sevenef Presence — Fanny reception widget (PRESENCE-FANNY-01).
 *
 * A floating, accessible dual-reception surface for published Presence sites:
 *   - Fanny: a web chat that answers from the public Business Profile and opens
 *     a Smart Inbox `web_chat` conversation.
 *   - WhatsApp: a prominent floating button (and an in-chat button) that opens
 *     the business's public number — never hidden, never a fallback-only action.
 *
 * Anonymous session id in sessionStorage (no login, no fingerprinting). All
 * strings are English (the repo's base language) — Spanish is not hardcoded.
 * Respects prefers-reduced-motion; does not block page content.
 */

import { useEffect, useRef, useState } from "react"
import { MessageCircle, X, Send, Phone } from "lucide-react"

interface ReceptionModel {
  fanny: { enabled: boolean; greeting: string; quickActions: Array<{ id: string; label: string }> }
  whatsapp: { available: boolean; connected: boolean; link: { href: string; display: string } | null }
}

interface ChatLine {
  from: "fanny" | "visitor"
  text: string
}

interface AppointmentForm {
  name: string
  service: string
  preferredDay: string
  contact: string
  contactPreference: string
  comment: string
  promotional: boolean
}

const EMPTY_APPOINTMENT: AppointmentForm = {
  name: "",
  service: "",
  preferredDay: "",
  contact: "",
  contactPreference: "chat",
  comment: "",
  promotional: false,
}

function getVisitorId(slug: string): string {
  if (typeof window === "undefined") return "anon"
  const key = `presence_reception_${slug}`
  let id = window.sessionStorage.getItem(key)
  if (!id) {
    id = (crypto.randomUUID?.() ?? `v-${Date.now()}-${Math.round(Math.random() * 1e9)}`).replace(/[^A-Za-z0-9._-]/g, "")
    window.sessionStorage.setItem(key, id)
  }
  return id
}

export function FannyReception({
  slug,
  model,
}: {
  slug: string
  model: ReceptionModel
}) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<ChatLine[]>([])
  const [quickActions, setQuickActions] = useState(model.fanny.quickActions)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [appt, setAppt] = useState<AppointmentForm>(EMPTY_APPOINTMENT)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && lines.length === 0) {
      setLines([{ from: "fanny", text: model.fanny.greeting }])
    }
  }, [open, lines.length, model.fanny.greeting])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  async function post(payload: Record<string, unknown>) {
    const res = await fetch(`/api/sites/${encodeURIComponent(slug)}/reception`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: getVisitorId(slug), ...payload }),
    })
    return res.json().catch(() => ({ ok: false }))
  }

  async function send(text: string, action?: string) {
    if (sending) return
    if (text) setLines((l) => [...l, { from: "visitor", text }])
    setSending(true)
    try {
      const data = await post({ message: text, action })
      if (data.ok) {
        if (data.reply) setLines((l) => [...l, { from: "fanny", text: data.reply }])
        if (Array.isArray(data.quickActions)) setQuickActions(data.quickActions)
        if (data.offerAppointmentForm) setShowForm(true)
      } else {
        setLines((l) => [...l, { from: "fanny", text: "Sorry, I couldn't process that right now." }])
      }
    } finally {
      setSending(false)
    }
  }

  function onQuickAction(id: string) {
    if (id === "whatsapp") {
      if (model.whatsapp.link) window.open(model.whatsapp.link.href, "_blank", "noopener,noreferrer")
      return
    }
    if (id === "appointment") {
      setShowForm(true)
      return
    }
    void send("", id)
  }

  async function submitAppointment(e: React.FormEvent) {
    e.preventDefault()
    if (sending || !appt.name.trim()) return
    setSending(true)
    try {
      const data = await post({
        appointment: {
          name: appt.name,
          service: appt.service,
          preferredDay: appt.preferredDay,
          contact: appt.contact,
          contactPreference: appt.contactPreference,
          comment: appt.comment,
        },
        consent: { promotional: appt.promotional },
      })
      if (data.ok && data.reply) {
        setLines((l) => [...l, { from: "visitor", text: `Appointment request: ${appt.name}` }, { from: "fanny", text: data.reply }])
        setShowForm(false)
        setAppt(EMPTY_APPOINTMENT)
      }
    } finally {
      setSending(false)
    }
  }

  const inputBase =
    "w-full rounded-md border border-[var(--border-dark)] bg-[var(--app-canvas)] px-3 py-2 text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-tertiary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"

  return (
    <>
      {/* Floating action stack — WhatsApp stays visible alongside Fanny. */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
        {model.whatsapp.available && model.whatsapp.link ? (
          <a
            href={model.whatsapp.link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message us on WhatsApp"
            className="flex h-12 items-center gap-2 rounded-full bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--accent-on-dark)] shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            WhatsApp
          </a>
        ) : null}
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open the Fanny reception chat"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-primary-light)] shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Chat panel */}
      {open ? (
        <div
          role="dialog"
          aria-label="Fanny reception chat"
          className="fixed bottom-5 right-5 z-50 flex h-[min(78vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--app-canvas)] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary-light)]">Fanny</p>
              <p className="text-xs text-[var(--text-tertiary-light)]">Virtual reception</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-md p-1 text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-dark-hover)]">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {lines.map((line, i) => (
              <div key={i} className={line.from === "visitor" ? "flex justify-end" : "flex justify-start"}>
                <p
                  className={
                    (line.from === "visitor"
                      ? "bg-[var(--accent-primary)] text-[var(--accent-on-dark)]"
                      : "bg-[var(--app-surface-dark)] text-[var(--text-primary-light)]") +
                    " max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm"
                  }
                >
                  {line.text}
                </p>
              </div>
            ))}

            {showForm ? (
              <form onSubmit={submitAppointment} className="space-y-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-3">
                <p className="text-xs font-medium text-[var(--text-secondary-light)]">Appointment request</p>
                <input className={inputBase} placeholder="Your name" value={appt.name} onChange={(e) => setAppt({ ...appt, name: e.target.value })} required aria-label="Your name" />
                <input className={inputBase} placeholder="Service (optional)" value={appt.service} onChange={(e) => setAppt({ ...appt, service: e.target.value })} aria-label="Service" />
                <input className={inputBase} placeholder="Preferred day / time (optional)" value={appt.preferredDay} onChange={(e) => setAppt({ ...appt, preferredDay: e.target.value })} aria-label="Preferred day" />
                <select className={inputBase} value={appt.contactPreference} onChange={(e) => setAppt({ ...appt, contactPreference: e.target.value })} aria-label="Preferred contact">
                  <option value="chat">Reply here in the chat</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                </select>
                {appt.contactPreference !== "chat" ? (
                  <input className={inputBase} placeholder="Phone or email" value={appt.contact} onChange={(e) => setAppt({ ...appt, contact: e.target.value })} aria-label="Contact" />
                ) : null}
                <label className="flex items-start gap-2 text-xs text-[var(--text-tertiary-light)]">
                  <input type="checkbox" checked={appt.promotional} onChange={(e) => setAppt({ ...appt, promotional: e.target.checked })} className="mt-0.5" />
                  <span>I&apos;d like to occasionally receive promotions and news by WhatsApp (optional).</span>
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={sending || !appt.name.trim()} className="flex-1 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--accent-on-dark)] disabled:opacity-50">Send request</button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-[var(--border-dark)] px-3 py-2 text-sm text-[var(--text-secondary-light)]">Cancel</button>
                </div>
              </form>
            ) : null}
          </div>

          {/* Quick actions */}
          {quickActions.length > 0 && !showForm ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--border-dark)] px-4 py-3">
              {quickActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onQuickAction(a.id)}
                  className={
                    (a.id === "whatsapp"
                      ? "border-[var(--accent-primary)] text-[var(--accent-on-dark)] bg-[var(--accent-primary)]"
                      : "border-[var(--border-dark)] text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-dark-hover)]") +
                    " rounded-full border px-3 py-1.5 text-xs font-medium"
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); const t = input.trim(); if (t) { setInput(""); void send(t) } }}
            className="flex items-center gap-2 border-t border-[var(--border-dark)] px-3 py-3"
          >
            <label htmlFor="fanny-input" className="sr-only">Message Fanny</label>
            <input id="fanny-input" className={inputBase} placeholder="Type a message…" value={input} onChange={(e) => setInput(e.target.value)} disabled={sending} />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send" className="rounded-md bg-[var(--accent-primary)] p-2 text-[var(--accent-on-dark)] disabled:opacity-50">
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  )
}
