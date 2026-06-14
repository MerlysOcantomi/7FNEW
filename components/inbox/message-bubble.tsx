"use client"

import type React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Mail, RotateCcw, Trash2 } from "lucide-react"
import { AttachmentPreviews } from "@/components/inbox/attachment-previews"

type MessageTone = "inbound" | "outbound" | "internal" | "system"

export interface MessageAttachment {
  filename: string
  url: string
  contentType: string
  size?: number
}

export interface MessageEmailMeta {
  cc?: string[]
  bcc?: string[]
  to?: string[]
  mode?: "reply" | "reply_all" | "forward"
}

interface MessageBubbleProps {
  /** ID del Message original — opcional para no romper consumidores existentes; necesario para anclar/seleccionar. */
  id?: string
  authorLabel: string
  roleLabel: string
  metaLabel: string
  timestampLabel: string
  content: string
  tone: MessageTone
  attachments?: MessageAttachment[]
  emailMeta?: MessageEmailMeta
  /** Marca visual de "mensaje activo" (ring + tinte). Solo afecta estilos. */
  selected?: boolean
  /** Callback opcional al hacer clic en la burbuja (no se dispara si el usuario está seleccionando texto). */
  onSelect?: () => void
  /**
   * Phase 2.5: cuando es `true`, expone el toggle "View full email" para mostrar un detail card
   * inline con From/To/Subject/Date completo. Solo se renderiza el toggle para tonos `inbound`/`outbound`.
   */
  expandable?: boolean
  /** Texto "From" para el detail card expandido (puede incluir nombre y email). */
  fromLabel?: string | null
  /** Lista compacta de destinatarios (To) — string ya unida; se omite la fila si no llega. */
  recipientsLabel?: string | null
  /** Subject del email (se omite la fila si no llega). */
  subject?: string | null
  /** Fecha completa formateada (`Apr 28, 2026 7:23 PM`). Si no llega, fallback a `timestampLabel`. */
  timestampFull?: string | null
  /**
   * Soft-trashed flag — when true the bubble swaps its body for a muted dashed placeholder
   * ("Message moved to trash") and exposes a Restore CTA. Content/attachments/email details
   * are deliberately not rendered: the operator hid them on purpose. Layout (alignment, author
   * chip, timestamp) is preserved so the thread shape doesn't reflow.
   */
  trashed?: boolean
  /** Click handler for the inline Restore CTA inside the trashed placeholder. */
  onRestore?: () => void
  /**
   * Soft-trash THIS message. When provided (and the message isn't a system event or already
   * trashed), a discreet trash affordance appears on hover in the bubble's meta row. Lives on
   * the message itself — the composer no longer carries destructive actions. Restore is the
   * inline CTA above; there is no permanent delete.
   */
  onTrash?: () => void
}

export function MessageBubble({
  id,
  authorLabel,
  roleLabel,
  metaLabel,
  timestampLabel,
  content,
  tone,
  attachments,
  emailMeta,
  selected = false,
  onSelect,
  expandable = false,
  fromLabel,
  recipientsLabel,
  subject,
  timestampFull,
  trashed = false,
  onRestore,
  onTrash,
}: MessageBubbleProps) {
  const isRightAligned = tone === "outbound"
  const isSystem = tone === "system"
  const interactive = Boolean(onSelect)
  /**
   * Estado local de expansión "ver email completo". Se mantiene entre re-renders aunque el mensaje
   * deje de estar `selected`, por eso el toggle sigue visible mientras `expanded` para permitir colapsar.
   */
  const [expanded, setExpanded] = useState(false)
  const supportsExpand = expandable && (tone === "inbound" || tone === "outbound")
  const showExpandToggle = supportsExpand && (selected || expanded)
  const ccList = emailMeta?.cc?.filter(Boolean) ?? []
  const bccList = emailMeta?.bcc?.filter(Boolean) ?? []
  const toList = emailMeta?.to?.filter(Boolean) ?? []
  const recipientsLineFromMeta = toList.length > 0 ? toList.join(", ") : null
  const effectiveRecipients = recipientsLabel ?? recipientsLineFromMeta
  const effectiveTimestampFull = timestampFull ?? timestampLabel
  const hasAnyEmailHeader = Boolean(
    fromLabel || effectiveRecipients || subject || effectiveTimestampFull,
  )

  /**
   * Click en la burbuja → onSelect, pero solo si el usuario NO está seleccionando texto
   * (evita "robar" la selección de texto natural en el contenido).
   */
  function handleClick() {
    if (!onSelect) return
    if (typeof window !== "undefined") {
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) return
    }
    onSelect()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSelect) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      id={id ? `msg-${id}` : undefined}
      data-message-id={id}
      data-selected={selected ? "true" : undefined}
      role={interactive ? "group" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-pressed={interactive ? selected : undefined}
      className={cn(
        "group flex scroll-mt-24",
        isSystem ? "justify-center" : isRightAligned ? "justify-end" : "justify-start",
        interactive && "cursor-pointer focus:outline-none",
      )}
    >
      <div className={cn("max-w-[96%] sm:max-w-[82%] md:max-w-[78%]", isRightAligned && "items-end")}>
        <div
          className={cn(
            "mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1",
            isSystem
              ? "justify-center text-center"
              : isRightAligned
                ? "justify-end text-right"
                : "justify-start text-left",
          )}
        >
          <span className={cn(
            "text-xs font-semibold",
            tone === "inbound"
              ? "text-[var(--accent-on-dark)]"
              : "text-[var(--text-primary-light)]",
          )}>{authorLabel}</span>
          <span className="text-xs uppercase tracking-wide font-medium text-[var(--inbox-text-secondary)]">
            {roleLabel}
          </span>
          <span className={cn(
            "rounded-lg border px-2.5 py-0.5 text-xs leading-relaxed font-medium",
            /**
             * Dark theme inbound badge: el accent-soft (#E9E2FF) era un bloque casi blanco que
             * rompía la estética del bubble dark. Lo cambiamos a un chip purple translúcido que
             * mantiene la identidad accent (inbound = purple) sin el parche light-on-dark.
             */
            tone === "inbound"
              ? "border-[var(--inbox-accent)]/35 bg-[var(--inbox-accent)]/12 text-[var(--inbox-accent)]"
              : tone === "outbound"
                ? "border-[var(--inbox-chat-meta-outbound-border)] bg-[var(--inbox-chat-meta-outbound-bg)] text-[var(--inbox-chat-meta-outbound-text)]"
                : "border-[var(--inbox-border)] bg-white/[0.08] text-[var(--inbox-text-secondary)]"
          )}>
            {metaLabel}
          </span>
          <span suppressHydrationWarning className="text-xs whitespace-nowrap text-[var(--inbox-text-secondary)]">{timestampLabel}</span>
          {emailMeta?.mode === "forward" && (
            <span className="rounded-lg border border-[var(--inbox-accent)]/35 bg-[var(--inbox-accent)]/12 px-2 py-0.5 text-xs font-semibold text-[var(--inbox-accent)]">
              Forwarded
            </span>
          )}
          {emailMeta?.mode === "reply_all" && (
            <span className="rounded-lg border border-[var(--inbox-accent)]/35 bg-[var(--inbox-accent)]/12 px-2 py-0.5 text-xs font-semibold text-[var(--inbox-accent)]">
              Reply all
            </span>
          )}
          {onTrash && !trashed && !isSystem ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTrash()
              }}
              className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--inbox-text-secondary)] opacity-0 transition-opacity hover:bg-[var(--inbox-urgency-critical-bg)]/30 hover:text-[var(--inbox-urgency-critical-text)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--inbox-accent)]/40 group-hover:opacity-100"
              title="Trash this message"
              aria-label="Trash this message"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {emailMeta?.cc && emailMeta.cc.length > 0 && !trashed && (
          <p className={cn(
            "mb-1 px-1 text-[10px] text-[var(--inbox-text-secondary)]/70",
            isRightAligned ? "text-right" : "text-left",
          )}>
            CC: {emailMeta.cc.join(", ")}
          </p>
        )}

        {trashed ? (
          /**
           * Soft-trash placeholder — same outer slot as the real bubble, but body content,
           * attachments, and email-detail card are all suppressed. The wording is deliberately
           * neutral; the Restore CTA is the only affordance, and clicking it bubbles up to the
           * page handler that flips Message.metadata.trashedAt back off.
           */
          <div
            className={cn(
              "rounded-2xl border border-dashed px-5 py-3 text-xs italic shadow-none transition-colors",
              "border-[var(--inbox-border)]/55 bg-white/[0.03] text-[var(--inbox-text-secondary)]",
              "flex items-center justify-between gap-3",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span>Message moved to trash</span>
            </span>
            {onRestore ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRestore()
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  "text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent)]/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40",
                )}
                aria-label="Restore message"
              >
                <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
                Restore
              </button>
            ) : null}
          </div>
        ) : (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm leading-relaxed shadow-sm transition-all duration-300",
            tone === "outbound" &&
              "rounded-tr-lg border-[var(--inbox-chat-bubble-outbound)]/22 bg-[image:var(--inbox-chat-bubble-outbound-gradient)] text-white shadow-[0_6px_18px_var(--inbox-chat-bubble-outbound-shadow)] hover:shadow-[0_9px_22px_var(--inbox-chat-bubble-outbound-shadow-hover)]",
            /**
             * Inbound surface is token-driven so it adapts per theme without a
             * per-component hack. In Midnight the tokens resolve to the SAME
             * translucent white the bubble always used (white/0.06 fill, /0.10
             * border, /0.09 hover) — visually unchanged. In Lavender Mist they
             * resolve to a SOLID light surface so the bubble pops on the soft
             * lavender thread canvas. The selection ring below still wins.
             */
            tone === "inbound" &&
              "rounded-tl-lg border-[var(--inbox-chat-bubble-inbound-border)] bg-[var(--inbox-chat-bubble-inbound)] text-[var(--inbox-text)] shadow-[var(--inbox-shadow-card)] hover:bg-[var(--inbox-chat-bubble-inbound-hover)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.18)]",
            tone === "internal" &&
              "rounded-tl-lg border-[var(--inbox-warning)]/20 bg-[var(--inbox-warning)]/8 text-[var(--inbox-warning)] shadow-[0_4px_20px_rgba(217,119,6,0.10)]",
            tone === "system" &&
              "rounded-2xl border-dashed border-[var(--inbox-border)] bg-white/[0.04] text-[var(--inbox-text-secondary)]",
            selected &&
              "ring-2 ring-[var(--inbox-accent)]/60 ring-offset-2 ring-offset-[var(--inbox-chat-background)] shadow-[0_0_0_1px_var(--inbox-accent),0_8px_24px_rgba(99,102,241,0.18)]",
          )}
        >
          {expanded && hasAnyEmailHeader ? (
            <div
              className={cn(
                "mb-3 rounded-lg border px-3 py-2 text-xs leading-snug",
                tone === "outbound"
                  ? "border-white/15 bg-white/[0.08] text-white/90"
                  : "border-[var(--inbox-border)] bg-white/[0.04] text-[var(--inbox-text)]",
              )}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Mail
                  className={cn(
                    "h-3 w-3 shrink-0",
                    tone === "outbound" ? "text-white/80" : "text-[var(--inbox-accent)]",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest",
                    tone === "outbound" ? "text-white/80" : "text-[var(--inbox-accent)]",
                  )}
                >
                  Email details
                </span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                {fromLabel ? (
                  <>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      From
                    </dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">{fromLabel}</dd>
                  </>
                ) : null}
                {effectiveRecipients ? (
                  <>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      To
                    </dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">
                      {effectiveRecipients}
                    </dd>
                  </>
                ) : null}
                {ccList.length > 0 ? (
                  <>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      CC
                    </dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">
                      {ccList.join(", ")}
                    </dd>
                  </>
                ) : null}
                {bccList.length > 0 ? (
                  <>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      BCC
                    </dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere]">
                      {bccList.join(", ")}
                    </dd>
                  </>
                ) : null}
                {subject ? (
                  <>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      Subject
                    </dt>
                    <dd className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                      {subject}
                    </dd>
                  </>
                ) : null}
                {effectiveTimestampFull ? (
                  <>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      Date
                    </dt>
                    <dd
                      suppressHydrationWarning
                      className="min-w-0 tabular-nums opacity-90"
                    >
                      {effectiveTimestampFull}
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : null}
          <p className="whitespace-pre-wrap break-words">{content}</p>
          {attachments && attachments.length > 0 && (
            <div className="mt-2 border-t border-current/10 pt-2">
              <AttachmentPreviews attachments={attachments} tone={tone} variant="bubble" />
            </div>
          )}
          {showExpandToggle ? (
            <div className="mt-2 flex justify-end border-t border-current/10 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded((v) => !v)
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--inbox-accent)]/40",
                  tone === "outbound"
                    ? "text-white/85 hover:bg-white/10 hover:text-white"
                    : "text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent-soft)]",
                )}
                aria-expanded={expanded}
                aria-label={expanded ? "Hide email details" : "View full email"}
              >
                {expanded ? (
                  <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                {expanded ? "Hide details" : "View full email"}
              </button>
            </div>
          ) : null}
        </div>
        )}
      </div>
    </div>
  )
}
