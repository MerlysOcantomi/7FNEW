"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  FINESSE_ASSISTANT_COPY as COPY,
  FINESSE_MAX_QUESTION_LENGTH,
  getFinesseSuggestions,
  resolveFinessePageKey,
} from "@modules/assistant/finesse-assistant"
import { usePathname } from "next/navigation"
import { useFinesseAssistant } from "./finesse-assistant-provider"

/**
 * The Ask Finesse conversation body — shared verbatim by the desktop right
 * panel and the mobile bottom sheet, so the two form factors can never drift.
 *
 * Contents (mission §6): Finesse identity is owned by the surrounding
 * panel/sheet header; this body renders the current-context label, a short
 * contextual introduction, page-aware suggested prompts, the conversation,
 * the composer, and the loading / error / honest-unavailable states.
 */
export function FinesseAssistantConversation() {
  const pathname = usePathname()
  const { pageContext, messages, status, ask } = useFinesseAssistant()
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const pageKey = pageContext?.page ?? resolveFinessePageKey(pathname)
  const suggestions = getFinesseSuggestions(pageKey)
  const unavailable = status === "unavailable"

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, status])

  const submit = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || status === "loading" || unavailable) return
      setDraft("")
      void ask(trimmed)
    },
    [ask, status, unavailable],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrollable body */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {/* Context label + contextual introduction */}
        <div className="mb-4">
          <p className="text-[11px] text-[var(--text-tertiary-light)]">
            {COPY.contextLead}{" "}
            <span
              className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{
                color: "var(--accent-on-dark)",
                background: "var(--accent-muted)",
                borderColor: "var(--accent-muted-border)",
              }}
            >
              {COPY.pageLabels[pageKey]}
            </span>
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">
            {COPY.intros[pageKey]}
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--text-tertiary-light)]">
            {COPY.honestyNote}
          </p>
        </div>

        {unavailable ? (
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)",
              background: "var(--inbox-lead-soft, color-mix(in srgb, var(--inbox-lead) 10%, transparent))",
            }}
          >
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--inbox-lead)" }}>
              {COPY.unavailable.title}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-secondary-light)]">
              {COPY.unavailable.description}
            </p>
          </div>
        ) : null}

        {/* Suggestions — the panel never opens as an empty chat. */}
        {messages.length === 0 && !unavailable ? (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--text-tertiary-light)]">
              {COPY.suggestionsTitle}
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-2 text-left text-[12px] text-[var(--text-primary-light)] transition-colors hover:border-[var(--accent-muted-border)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-tertiary-light)]">{COPY.emptyConversation}</p>
          </div>
        ) : null}

        {/* Conversation */}
        {messages.length > 0 ? (
          <div role="log" aria-live="polite" className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "self-end bg-[var(--accent-primary)] text-white"
                    : "self-start border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] text-[var(--text-primary-light)]",
                )}
              >
                {m.content}
              </div>
            ))}

            {status === "loading" ? (
              <div className="flex items-center gap-2 self-start rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2.5">
                <Loader2 size={13} className="animate-spin text-[var(--accent-on-dark)]" aria-hidden="true" />
                <span className="text-[11.5px] text-[var(--text-secondary-light)]">{COPY.thinking}</span>
              </div>
            ) : null}

            {status === "error" ? (
              <div
                className="self-start rounded-2xl border px-3.5 py-2.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
                  background:
                    "var(--inbox-urgency-soft, color-mix(in srgb, var(--inbox-urgency) 10%, transparent))",
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: "var(--inbox-urgency)" }}>
                  {COPY.error.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary-light)]">{COPY.error.retry}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <form
        className="flex shrink-0 items-end gap-2 border-t border-[var(--border-dark)] px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit(draft)
            }
          }}
          rows={2}
          maxLength={FINESSE_MAX_QUESTION_LENGTH}
          placeholder={COPY.composerPlaceholder}
          aria-label={COPY.composerPlaceholder}
          disabled={unavailable}
          className="min-h-[42px] flex-1 resize-none rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-2 text-[12.5px] text-[var(--text-primary-light)] outline-none placeholder:text-[var(--text-tertiary-light)] focus:ring-2 focus:ring-[var(--accent-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={unavailable || status === "loading" || draft.trim().length === 0}
          aria-label={COPY.send}
          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-[var(--accent-primary)] text-white transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1"
        >
          {status === "loading" ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={16} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  )
}

/** Shared Finesse identity header for the panel and the mobile sheet. */
export function FinesseAssistantIdentity() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-primary), var(--accent-rich, var(--accent-primary-hover, var(--accent-primary))))",
        }}
      >
        <Sparkles size={15} strokeWidth={2} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[13.5px] font-semibold text-[var(--text-primary-light)]">{COPY.panelTitle}</p>
        <p className="text-[10px] text-[var(--text-tertiary-light)]">{COPY.panelSubtitle}</p>
      </div>
    </div>
  )
}
