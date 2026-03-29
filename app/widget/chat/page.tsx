"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

interface ChatMessage {
  id: string
  role: string
  direction: string
  content: string
  createdAt: string
}

const POLL_INTERVAL_MS = 4000
const STORAGE_PREFIX = "7f_chat_"

function getStored(siteKey: string, key: string) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${siteKey}_${key}`)
  } catch {
    return null
  }
}

function setStored(siteKey: string, key: string, value: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${siteKey}_${key}`, value)
  } catch {}
}

function ChatWidget() {
  const searchParams = useSearchParams()
  const siteKey = searchParams.get("key") || ""

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const [visitorName, setVisitorName] = useState("")
  const [visitorEmail, setVisitorEmail] = useState("")
  const [identityCollected, setIdentityCollected] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!siteKey) return
    let vid = getStored(siteKey, "visitorId")
    if (!vid) {
      vid = crypto.randomUUID()
      setStored(siteKey, "visitorId", vid)
    }
    setVisitorId(vid)
    const cid = getStored(siteKey, "conversationId")
    if (cid) setConversationId(cid)

    const storedName = getStored(siteKey, "visitorName")
    const storedEmail = getStored(siteKey, "visitorEmail")
    if (storedName) {
      setVisitorName(storedName)
      setIdentityCollected(true)
    }
    if (storedEmail) setVisitorEmail(storedEmail)

    setReady(true)
  }, [siteKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !visitorId || !siteKey) return
    try {
      const res = await fetch(
        `/api/inbox/public/conversations/${conversationId}/messages?visitorId=${encodeURIComponent(visitorId)}&siteKey=${encodeURIComponent(siteKey)}`,
      )
      const json = await res.json()
      if (json.success && Array.isArray(json.data?.messages)) {
        setMessages(json.data.messages)
      }
    } catch {}
  }, [conversationId, visitorId, siteKey])

  useEffect(() => {
    if (!conversationId) return
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [conversationId, fetchMessages])

  function handleIdentitySubmit() {
    const trimmedName = visitorName.trim()
    if (!trimmedName) {
      nameInputRef.current?.focus()
      return
    }
    setVisitorName(trimmedName)
    setStored(siteKey, "visitorName", trimmedName)
    const trimmedEmail = visitorEmail.trim()
    if (trimmedEmail) {
      setVisitorEmail(trimmedEmail)
      setStored(siteKey, "visitorEmail", trimmedEmail)
    }
    setIdentityCollected(true)
  }

  async function sendMessage() {
    if (!input.trim() || sending || !visitorId || !siteKey) return

    setSending(true)
    setError(null)

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "visitor",
      direction: "inbound",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    const savedInput = input.trim()
    setInput("")

    try {
      const payload: Record<string, unknown> = {
        siteKey,
        visitorId,
        conversationId,
        content: savedInput,
      }
      if (visitorName.trim()) payload.visitorName = visitorName.trim()
      if (visitorEmail.trim()) payload.visitorEmail = visitorEmail.trim()

      const res = await fetch("/api/inbox/public/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Send failed")

      if (json.data?.conversationId && json.data.conversationId !== conversationId) {
        setConversationId(json.data.conversationId)
        setStored(siteKey, "conversationId", json.data.conversationId)
      }

      setTimeout(fetchMessages, 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message")
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  function handleClose() {
    try {
      window.parent.postMessage("7f_chat_close", "*")
    } catch {}
  }

  if (!siteKey) {
    return (
      <div style={S.centered}>
        <p style={{ color: "#94A3B8", fontSize: 14 }}>Widget configuration missing.</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={S.centered}>
        <p style={{ color: "#94A3B8", fontSize: 13 }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Chat with us</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>We typically reply in a few minutes</div>
        </div>
        <button onClick={handleClose} style={S.closeBtn} aria-label="Close">
          ✕
        </button>
      </div>

      {!identityCollected ? (
        <div style={S.identityScreen}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Before we start</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, marginBottom: 20 }}>
            Tell us your name so we know who we&apos;re talking to.
          </div>
          <input
            ref={nameInputRef}
            type="text"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            placeholder="Your name *"
            style={S.identityInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleIdentitySubmit()
              }
            }}
            autoFocus
          />
          <input
            type="email"
            value={visitorEmail}
            onChange={(e) => setVisitorEmail(e.target.value)}
            placeholder="Email (optional)"
            style={{ ...S.identityInput, marginTop: 8 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleIdentitySubmit()
              }
            }}
          />
          <button
            onClick={handleIdentitySubmit}
            style={{
              ...S.identityBtn,
              opacity: visitorName.trim() ? 1 : 0.5,
              cursor: visitorName.trim() ? "pointer" : "default",
            }}
          >
            Start chat →
          </button>
        </div>
      ) : (
        <>
          <div style={S.messageArea}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
                  Hi{visitorName ? ` ${visitorName}` : ""}! Send us a message and we&apos;ll get back to you shortly.
                </div>
              </div>
            )}
            {messages.map((msg) => {
              const isVisitor = msg.direction === "inbound"
              return (
                <div key={msg.id} style={{ alignSelf: isVisitor ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: isVisitor ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: isVisitor ? "#0F172A" : "#F1F5F9",
                      color: isVisitor ? "#FFFFFF" : "#0F172A",
                      fontSize: 13,
                      lineHeight: 1.5,
                      wordBreak: "break-word" as const,
                    }}
                  >
                    {msg.content}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94A3B8",
                      marginTop: 3,
                      textAlign: isVisitor ? "right" : "left",
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div style={{ padding: "6px 16px", background: "#FEF2F2", fontSize: 12, color: "#991B1B" }}>
              {error}
            </div>
          )}

          <div style={S.inputArea}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              style={S.textarea}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#3B82F6" }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              style={{
                ...S.sendBtn,
                background: sending || !input.trim() ? "#CBD5E1" : "#0F172A",
                cursor: sending || !input.trim() ? "default" : "pointer",
              }}
            >
              {sending ? "…" : "→"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  centered: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#FFFFFF",
    overflow: "hidden",
  },
  header: {
    padding: "14px 16px",
    background: "#0F172A",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#FFFFFF",
    cursor: "pointer",
    fontSize: 18,
    padding: 4,
    lineHeight: 1,
  },
  identityScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
    textAlign: "center" as const,
  },
  identityInput: {
    width: "100%",
    maxWidth: 260,
    padding: "10px 14px",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
  },
  identityBtn: {
    marginTop: 16,
    padding: "10px 24px",
    background: "#0F172A",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
  },
  messageArea: {
    flex: 1,
    overflowY: "auto" as const,
    padding: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  inputArea: {
    padding: "12px 16px",
    borderTop: "1px solid #E2E8F0",
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    resize: "none" as const,
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.4,
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    color: "#FFFFFF",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  },
}

export default function ChatWidgetPage() {
  return (
    <Suspense fallback={<div style={S.centered}><p style={{ color: "#94A3B8", fontSize: 13 }}>Loading...</p></div>}>
      <ChatWidget />
    </Suspense>
  )
}
