"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, X, Loader2, Sparkles, MessageSquare, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * "Talk to Fanny" — control de assistant a nivel Inbox, distinto del dictado del composer.
 *
 * Diferencia clave con el Mic del composer:
 *  - Mic del composer (dentro del AI panel → Voice tab) = convierte voz en texto de respuesta.
 *  - Talk to Fanny = preguntar/instruir a la IA sobre la inbox/mensaje/conversación.
 *
 * Phase 1 (este commit):
 *  - Botón flotante fixed bottom-right.
 *  - Panel inline con input de texto (no speech-to-text todavía).
 *  - Reusa `/api/inbox/conversations/[id]/ask` cuando hay conversación abierta.
 *  - Sin ejecución autónoma; solo Q&A. Acciones peligrosas se sugieren pero no se disparan.
 */

interface TalkToFannyProps {
  conversationId: string | null
  selectedMessageId: string | null
  /**
   * Acting on integration — when supplied by the inbox page, scope is driven by the operator's
   * composer choice (Latest / Selected / All) instead of being auto-derived from selection.
   * If omitted, falls back to the legacy auto-derived behaviour for backward compatibility.
   */
  actingOnScope?: "latest" | "selected" | "all"
  /** Latest inbound message id, used to anchor "Latest" scope without changing thread highlight. */
  latestInboundMessageId?: string | null
  /** Override className for outer fixed wrapper (positioning). Defaults to bottom-right floating. */
  className?: string
  /**
   * Controlled mode. When `open` is provided, the component is driven by the
   * parent (e.g. the global Ask Fanny trigger in the top action row) and the
   * floating launcher FAB is NOT rendered — the panel anchors top-right under
   * the toolbar instead of bottom-right. When omitted, it stays the legacy
   * self-contained floating launcher + panel.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Embedded mode. When true the assistant renders INLINE filling its parent
   * (the Inbox right Intelligence panel) as a "panel mode" — no fixed/overlay
   * positioning, full-height flex column, header back button returns to
   * Insights. The parent decides when to mount it (so visibility is owned by
   * the right column, not this component's `open`).
   */
  embedded?: boolean
}

type Scope = "message" | "conversation" | "inbox"

const SCOPE_META: Record<Scope, { label: string; description: string }> = {
  message: {
    label: "Selected message",
    description: "Fanny answers about the message you have selected.",
  },
  conversation: {
    label: "Current conversation",
    description: "Fanny answers about the open conversation.",
  },
  inbox: {
    label: "Inbox",
    description: "Inbox-wide questions are coming soon — open a conversation to ask Fanny.",
  },
}

const ACTING_ON_LABEL: Record<"latest" | "selected" | "all", { label: string; description: string }> = {
  latest: {
    label: "Latest message",
    description: "Fanny answers about the most recent relevant message.",
  },
  selected: {
    label: "Selected message",
    description: "Fanny answers about the message you have selected.",
  },
  all: {
    label: "Whole conversation",
    description: "Fanny answers about the entire open conversation.",
  },
}

export function TalkToFanny({ conversationId, selectedMessageId, actingOnScope, latestInboundMessageId = null, className, open: controlledOpen, onOpenChange, embedded = false }: TalkToFannyProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next)
      else setInternalOpen(next)
    },
    [isControlled, onOpenChange],
  )
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  /**
   * Scope resolution:
   *  - Driven by `actingOnScope` when the parent provides one (composer is the source of truth).
   *      "selected" → message scope anchored at selectedMessageId (or conversation if missing).
   *      "latest"   → message scope anchored at selected ?? latestInbound (or conversation).
   *      "all"      → conversation scope; never sends a messageId.
   *  - Falls back to legacy auto-derive when no actingOnScope is provided.
   */
  const anchorMessageId: string | null = (() => {
    if (!conversationId) return null
    if (!actingOnScope) return selectedMessageId
    if (actingOnScope === "all") return null
    if (actingOnScope === "selected") return selectedMessageId
    return selectedMessageId ?? latestInboundMessageId
  })()

  const scope: Scope = !conversationId
    ? "inbox"
    : actingOnScope === "all"
      ? "conversation"
      : anchorMessageId
        ? "message"
        : "conversation"

  const scopeMeta: { label: string; description: string } = (() => {
    if (scope === "inbox") return SCOPE_META.inbox
    if (actingOnScope) return ACTING_ON_LABEL[actingOnScope]
    return SCOPE_META[scope]
  })()
  const hasConversation = Boolean(conversationId)

  const reset = useCallback(() => {
    setAnswer(null)
    setError(null)
    setQuestion("")
  }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      reset()
      setLoading(false)
    }
  }, [open, reset])

  /** Esc cierra el panel — UX consistente con otros overlays del Inbox. */
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  async function ask() {
    if (!question.trim() || loading || !conversationId) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch(`/api/inbox/conversations/${conversationId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          mode: scope === "message" ? "message" : "conversation",
          /** Anchor follows Acting on (composer) when present; otherwise legacy auto-derive. */
          ...(anchorMessageId ? { messageId: anchorMessageId } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || "Fanny could not answer.")
      }
      setAnswer(typeof json.data?.answer === "string" ? json.data.answer : "(empty answer)")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Fanny.")
    } finally {
      setLoading(false)
    }
  }

  const ScopeIcon = scope === "message" ? Sparkles : scope === "conversation" ? MessageSquare : Inbox

  /** Reusable atoms shared by the floating-overlay and embedded (right-panel) shells. */
  const scopeChip = (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        hasConversation
          ? "border-[var(--inbox-accent)]/40 bg-[var(--inbox-accent)]/10 text-[var(--inbox-accent)]"
          : "border-[var(--inbox-border)]/45 bg-white/[0.04] text-[var(--inbox-text-secondary)]",
      )}
      title={scopeMeta.description}
    >
      <ScopeIcon className="h-3 w-3" aria-hidden />
      Scope · {scopeMeta.label}
    </span>
  )

  const descriptionEl = (
    <p className="text-[10px] leading-relaxed text-[var(--inbox-text-secondary)]">{scopeMeta.description}</p>
  )

  const textareaEl = (
    <Textarea
      ref={inputRef}
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
      placeholder={hasConversation ? "Ask Fanny anything about this conversation…" : "Open a conversation first."}
      rows={3}
      disabled={!hasConversation || loading}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void ask()
        }
      }}
      className="min-h-[64px] resize-y rounded-md border border-[var(--inbox-border)]/40 bg-[var(--inbox-composer-input)] px-2.5 py-2 text-[12px] leading-snug text-[var(--inbox-composer-input-text)] placeholder:text-[var(--inbox-composer-placeholder)]/85 focus-visible:border-[var(--inbox-accent)]/70 focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/18"
    />
  )

  const errorEl = error ? (
    <p className="rounded border border-[var(--inbox-warning)]/35 bg-[var(--inbox-warning)]/10 px-2 py-1 text-[11px] text-[var(--inbox-warning)]">
      {error}
    </p>
  ) : null

  const answerEl = answer ? (
    <div className="rounded-md border border-[var(--inbox-accent)]/30 bg-white/[0.05] p-2.5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-on-dark)]">Fanny</p>
      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--inbox-text)]">{answer}</p>
    </div>
  ) : null

  const askRow = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] text-[var(--inbox-text-secondary)]">Ctrl/⌘+Enter to ask</p>
      <Button
        type="button"
        size="sm"
        variant="accent"
        disabled={!hasConversation || !question.trim() || loading}
        onClick={() => void ask()}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </span>
        ) : (
          "Ask Fanny"
        )}
      </Button>
    </div>
  )

  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--inbox-border)]/35 bg-black/35 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--inbox-accent)]/20 text-[var(--inbox-accent)]">
          <Mic className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent-on-dark)]">Ask Fanny</p>
          <p className="truncate text-[10px] text-[var(--inbox-text-secondary)]">
            Ask about messages, conversations, or your inbox.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md p-1 text-[var(--inbox-text-secondary)] hover:bg-white/[0.08] hover:text-[var(--inbox-text)]"
        aria-label={embedded ? "Back to insights" : "Close"}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  /**
   * Embedded shell — fills the right Intelligence panel. Header + scrollable
   * content (scope, answer, error) + pinned input footer so the prompt stays
   * reachable while long answers scroll above it.
   */
  if (embedded) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col bg-[var(--inbox-composer-background)]", className)} role="dialog" aria-label="Ask Fanny">
        {header}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {scopeChip}
          {descriptionEl}
          {answerEl}
          {errorEl}
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--inbox-border)]/35 p-3">
          {textareaEl}
          {askRow}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed z-40",
        isControlled ? "right-4 top-[58px] md:right-6" : "bottom-6 right-6",
        className,
      )}
    >
      {open && (
        <div
          className={cn(
            "w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--inbox-border)]/45 bg-[var(--inbox-composer-background)] shadow-[0_10px_40px_rgba(0,0,0,0.45)]",
            !isControlled && "mb-3",
          )}
          role="dialog"
          aria-label="Talk to Fanny"
        >
          {header}
          <div className="flex flex-col gap-2 p-3">
            {scopeChip}
            {descriptionEl}
            {textareaEl}
            {errorEl}
            {answerEl}
            {askRow}
          </div>
        </div>
      )}

      {/*
        Floating launcher FAB — only in legacy/uncontrolled mode. In controlled
        mode the global Ask Fanny trigger (top action row) owns launching, so we
        render only the panel here and never a second floating entry.
      */}
      {!isControlled && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "group relative grid h-12 w-12 place-items-center rounded-full shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition-all",
            "bg-[var(--inbox-accent)] text-white hover:scale-105 hover:shadow-[0_10px_32px_rgba(99,102,241,0.5)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--inbox-chat-background)]",
            open && "ring-2 ring-[var(--inbox-accent)]/60 ring-offset-2 ring-offset-[var(--inbox-chat-background)]",
          )}
          title="Talk to Fanny"
          aria-label="Talk to Fanny"
          aria-expanded={open}
        >
          <Mic className="h-5 w-5" strokeWidth={2.2} />
          <span className="pointer-events-none absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[8px] font-black text-[var(--inbox-accent)] shadow-sm">
            F
          </span>
        </button>
      )}
    </div>
  )
}
