"use client"

import { useEffect, useMemo, useState } from "react"
import { InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users, ChevronDown, ChevronUp, Loader2,
  Mail, Phone, Building2, Globe, ArrowRight, CornerUpLeft,
  User, FolderKanban, CheckSquare, MessageSquare,
  Paperclip, PhoneCall, AlertTriangle, ListChecks, Link2, Sparkles,
  Send, Copy, Check, CornerDownLeft, CalendarPlus, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { actionTypeLabel, actionStatusBadge, actionStatusLabel, channelLabel } from "@/lib/inbox-labels"

/**
 * Contrast fix: el variant `ghost` de shadcn aplica `text-foreground` (token global, casi negro
 * en light theme). Sobre las superficies oscuras del Inbox queda ilegible. Esta constante se
 * compone DESPUÉS del variant para que tailwind-merge sobrescriba color y hover con tokens
 * legibles del inbox. Disabled queda muted pero no invisible.
 */
const INBOX_GHOST_BUTTON =
  "text-[var(--inbox-intelligence-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)] focus-visible:text-[var(--inbox-intelligence-text)] disabled:text-[var(--inbox-intelligence-text-secondary)]/60"

export interface ActionItem {
  id: string
  type: string
  status: string
  source?: string | null
  confidence?: number | null
  sourceMessageId?: string | null
  data?: Record<string, unknown> | null
  resultModule?: string | null
  resultId?: string | null
  executionNotes?: string | null
  errorMessage?: string | null
}

/**
 * Phase 3: información compacta del mensaje seleccionado para el modo message-aware del panel.
 * Phase B: ahora puede traer signals derivados client-side (shortIntent, direction, attachments,
 * links). Todos opcionales — si vienen, el panel los muestra; si no, cae al render previo.
 */
export interface SelectedMessageInfo {
  messageId: string
  authorLabel: string
  timestampLabel?: string | null
  snippet?: string | null
  shortIntent?: string | null
  direction?: "inbound" | "outbound" | "internal" | "system" | string | null
  hasAttachments?: boolean
  hasLinks?: boolean
  isInbound?: boolean
  isOutbound?: boolean
  /**
   * Phase 1 calendar event detection. Populated only when the AI persisted a `create_event`
   * ConversationAction whose `sourceMessageId` matches the selected message AND the message is
   * inbound non-internal. Null otherwise. The panel uses this to show the Add to calendar CTA
   * inside Smart actions.
   */
  eventHint?: SelectedEventHint | null
}

/**
 * Lightweight, UI-focused projection of the persisted EventHint. We deliberately keep this
 * separate from the inbox types module to avoid pulling server types into a client component.
 */
export interface SelectedEventHint {
  title: string
  startISO: string | null
  endISO?: string | null
  allDay?: boolean
  location?: string | null
  purpose?: string | null
  sourceMessageId?: string | null
  confidence?: number | null
  /** Optional id of the underlying ConversationAction (Phase 2 will use it to call /execute). */
  actionId?: string | null
}

interface ContextPanelProps {
  selected: {
    id: string
    summary: string | null
    status: string
    urgency?: string | null
    assignedTo?: string | null
    sentiment?: string | null
    classification?: {
      summary?: string | null
      intent?: string | null
      nextBestAction?: Record<string, unknown> | null
    } | null
    /**
     * Phase A: ahora consumimos también `headline`, `facts`, `decisions`, `pendingItems`,
     * `risks`, `confidence` y `sourceMessageId`. Todo es opcional y se renderiza con guards
     * para no romper si el endpoint los omite o llegan en formatos inesperados.
     */
    handoff?: {
      status: string
      summary?: string | null
      nextRecommendedAction?: string | null
      confidence?: number | null
      headline?: string | null
      facts?: string[] | null
      decisions?: string[] | null
      pendingItems?: string[] | null
      risks?: string[] | null
      sourceMessageId?: string | null
    } | null
    actions?: ActionItem[]
    /** Si falta (datos incompletos), todo el panel usa fallbacks sin romper render. */
    contact?: {
      nombre?: string | null
      email?: string | null
      empresa?: string | null
      telefono?: string | null
      tipo?: string
    }
    cliente?: { id: string; nombre: string; email?: string | null; empresa?: string | null } | null
    proyecto?: { id: string; nombre: string; estado?: string | null } | null
    channel: string
    leadScore: number | null
    detectedLanguage: string | null
  }
  updateHandoff: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>
  handoffState: string | null
  handleSuggestedAction: (action: ActionItem, operation: "approve" | "dismiss" | "execute" | "approve_and_execute") => Promise<void>
  pendingActionId: string | null
  handleConvert: (action: "cliente" | "proyecto" | "tarea" | "todo") => Promise<void>
  actionState: string | null
  members: Array<{ userId: string; nombre: string | null; email: string }>
  assignSaving: boolean
  onAssign: (value: string) => void
  /**
   * Phase 3: cuando llegan ambos, el panel pasa a "message mode": cambia el header,
   * muestra una tarjeta compacta del mensaje y prioriza/etiqueta las acciones cuyo
   * `sourceMessageId === selectedMessageId`.
   */
  selectedMessageId?: string | null
  selectedMessageInfo?: SelectedMessageInfo | null
  /**
   * Phase C: visibilidad y aplicación del draft sugerido desde el Smart actions block.
   * Si `hasSuggestedDraft` es true, mostramos el botón "Reply with AI draft" que invoca
   * `onUseSuggestedDraft` (el page.tsx ya elige el draft correcto, scoped al mensaje).
   */
  hasSuggestedDraft?: boolean
  onUseSuggestedDraft?: () => void
  /**
   * Ask Fanny: callback opcional que el panel invoca cuando el operador pulsa "Insert into reply"
   * sobre la respuesta. El page.tsx llena el composer; sin este callback el botón se oculta.
   */
  onInsertReply?: (text: string) => void
  /**
   * Phase 2 — invoked when the operator confirms the calendar preview. The page is responsible
   * for calling the action approve+execute pipeline against `selectedMessageInfo.eventHint.actionId`
   * with the `{ event: payload }` override. Resolving = success (panel closes the dialog and
   * triggers a refetch); rejecting surfaces the error message inside the dialog.
   * If omitted, the dialog renders in preview-only mode (submit disabled).
   */
  onCreateCalendarEvent?: (
    actionId: string,
    payload: CreateCalendarEventInput,
  ) => Promise<void>
  /**
   * Acting on integration — when provided, Ask Fanny uses these instead of deriving its own
   * scope from `selectedMessageId`. The page calculates them from `actingOnScope`:
   *   - "selected" → anchor=selected (or null if none), mode=message
   *   - "latest"   → anchor=selected ?? lastInbound, mode=message
   *   - "all"      → anchor=null, mode=conversation
   * If both are omitted the panel preserves its legacy behaviour (selected ⇒ message,
   * otherwise conversation), so existing callers don't need to change.
   */
  askMode?: "message" | "conversation"
  askAnchorMessageId?: string | null
}

export function ContextPanel({
  selected,
  updateHandoff,
  handoffState,
  handleSuggestedAction,
  pendingActionId,
  handleConvert,
  actionState,
  members,
  assignSaving,
  onAssign,
  selectedMessageId = null,
  selectedMessageInfo = null,
  hasSuggestedDraft = false,
  onUseSuggestedDraft,
  onInsertReply,
  onCreateCalendarEvent,
  askMode,
  askAnchorMessageId,
}: ContextPanelProps) {
  const [contactExpanded, setContactExpanded] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)
  /** Phase 1 preview / Phase 2 confirm. Local state owns the dialog lifecycle; the page owns
   *  the network call via `onCreateCalendarEvent` and the post-success refetch. */
  const [calendarPreviewOpen, setCalendarPreviewOpen] = useState(false)
  const isMessageMode = Boolean(selectedMessageId && selectedMessageInfo)

  const contactName =
    selected.contact?.nombre || selected.cliente?.nombre || "Unknown contact"
  const contactType = selected.contact?.tipo || "contact"
  const contactEmail = selected.contact?.email || selected.cliente?.email || null
  const contactPhone = selected.contact?.telefono || null
  const contactCompany = selected.contact?.empresa || selected.cliente?.empresa || null

  const summary =
    selected.handoff?.summary ||
    selected.classification?.summary ||
    selected.summary ||
    null

  const nextRecommendedAction =
    selected.handoff?.nextRecommendedAction ||
    getStringValue(selected.classification?.nextBestAction, ["description", "label", "title", "action"]) ||
    null

  /**
   * Phase A: handoff signals adicionales. Todo está protegido por `safeStringList` y type guards
   * para tolerar nulls, strings sueltos o JSON sin estructurar.
   */
  const handoffHeadline =
    typeof selected.handoff?.headline === "string" ? selected.handoff.headline.trim() : ""
  const handoffConfidencePct =
    typeof selected.handoff?.confidence === "number" && Number.isFinite(selected.handoff.confidence)
      ? Math.round(Math.max(0, Math.min(1, selected.handoff.confidence)) * 100)
      : null
  const handoffFacts = safeStringList(selected.handoff?.facts).slice(0, 4)
  const handoffDecisions = safeStringList(selected.handoff?.decisions).slice(0, 4)
  const handoffPendingItems = safeStringList(selected.handoff?.pendingItems).slice(0, 6)
  const handoffRisks = safeStringList(selected.handoff?.risks).slice(0, 6)

  const moodValue = mapSentimentToMood(selected.sentiment)
  const urgencyValue = mapUrgency(selected.urgency)

  const suggestedActions = (selected.actions ?? []).filter((a) => a.status === "suggested" || a.status === "approved")

  /**
   * Phase 3: en message-mode, las acciones cuyo `sourceMessageId === selectedMessageId` saltan al
   * principio del listado y reciben un badge "For selected message". El resto se mantiene visible
   * (no se filtra) para no esconder trabajo a nivel conversación.
   */
  const orderedSuggestedActions = useMemo(() => {
    if (!isMessageMode || !selectedMessageId) return suggestedActions
    const scoped: ActionItem[] = []
    const rest: ActionItem[] = []
    for (const a of suggestedActions) {
      if (a.sourceMessageId && a.sourceMessageId === selectedMessageId) scoped.push(a)
      else rest.push(a)
    }
    return [...scoped, ...rest]
  }, [isMessageMode, selectedMessageId, suggestedActions])

  const messageScopedActionCount = useMemo(() => {
    if (!isMessageMode || !selectedMessageId) return 0
    return suggestedActions.filter(
      (a) => a.sourceMessageId && a.sourceMessageId === selectedMessageId,
    ).length
  }, [isMessageMode, selectedMessageId, suggestedActions])

  /**
   * Ask Fanny — interaction is single-shot (one question → one answer). State is intentionally
   * local: no persistence, no chat history. We reset it whenever the conversation or selected
   * message changes so the operator never sees a stale answer attached to a different scope.
   */
  /**
   * Reset the in-panel Q&A whenever the *effective* scope changes. We bake askMode and
   * askAnchorMessageId into the key so toggling Acting on between Latest / Selected / All
   * doesn't leave a stale answer attached to a different scope.
   */
  const askScopeKey = `${selected.id}::${askMode ?? (selectedMessageId ? "message" : "conv")}::${askAnchorMessageId ?? selectedMessageId ?? "none"}`
  const [askQuestion, setAskQuestion] = useState("")
  const [askAnswer, setAskAnswer] = useState<string | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [askCopied, setAskCopied] = useState(false)

  useEffect(() => {
    setAskQuestion("")
    setAskAnswer(null)
    setAskError(null)
    setAskLoading(false)
    setAskCopied(false)
  }, [askScopeKey])

  const handleAskSubmit = async () => {
    const question = askQuestion.trim()
    if (!question || askLoading) return
    setAskLoading(true)
    setAskError(null)
    setAskAnswer(null)
    setAskCopied(false)
    try {
      /**
       * Acting on takes priority when the parent provides explicit askMode/askAnchorMessageId.
       * That lets the page anchor "Latest" at the lastInbound (without changing the highlighted
       * message in the thread) and force conversation mode for "All" even if a message is
       * selected. We fall back to the legacy isMessageMode rule otherwise.
       */
      const resolvedMode: "message" | "conversation" =
        askMode ?? (isMessageMode ? "message" : "conversation")
      const resolvedMessageId =
        askAnchorMessageId !== undefined
          ? (resolvedMode === "message" ? askAnchorMessageId : null)
          : (isMessageMode ? selectedMessageId : null)

      const res = await fetch(`/api/inbox/conversations/${selected.id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          messageId: resolvedMessageId,
          mode: resolvedMode,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        const msg =
          (json && typeof json.error?.message === "string" && json.error.message)
          || "Could not get an answer. Please try again."
        setAskError(msg)
      } else {
        const answer = typeof json.data?.answer === "string" ? json.data.answer.trim() : ""
        if (!answer) {
          setAskError("Empty answer received.")
        } else {
          setAskAnswer(answer)
        }
      }
    } catch {
      setAskError("Network error. Please try again.")
    } finally {
      setAskLoading(false)
    }
  }

  const handleAskKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    /** Cmd/Ctrl + Enter envía. Enter solo deja salto de línea para preguntas largas. */
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      void handleAskSubmit()
    }
  }

  const handleAskCopy = async () => {
    if (!askAnswer) return
    try {
      await navigator.clipboard.writeText(askAnswer)
      setAskCopied(true)
      setTimeout(() => setAskCopied(false), 1500)
    } catch {
      /** Silencioso: no todos los navegadores/contextos permiten clipboard. */
    }
  }

  const handleAskInsertReply = () => {
    if (!askAnswer || !onInsertReply) return
    onInsertReply(askAnswer)
  }

  const askPlaceholder = isMessageMode
    ? "Ask Fanny about this message..."
    : "Ask Fanny about this conversation..."

  return (
    <div className="space-y-3 bg-[var(--inbox-intelligence-background)] p-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--inbox-intelligence-border)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--inbox-intelligence-accent)] to-[var(--inbox-intelligence-accent)]/80 shadow-sm">
          <Users className="h-4.5 w-4.5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-[var(--inbox-intelligence-text)]">Intelligence Hub</h2>
          <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">
            {isMessageMode ? "About this message" : "About this conversation"}
          </p>
        </div>
      </div>

      {/*
        ── Phase 3 + Phase B · "What this message means" (solo en message-mode) ──
        La card pasa de ser un eco del bubble a una lectura interpretativa:
        - prioriza shortIntent del mensaje (metadata o map ya cargado en cliente)
        - cae al snippet original solo cuando no hay intent disponible
        - chips compactos con direction + has attachments + has link
      */}
      {isMessageMode && selectedMessageInfo ? (
        <section
          className="rounded-xl border border-white/[0.08] border-l-2 border-l-[var(--inbox-accent)] bg-white/[0.05] px-3 py-2"
          aria-label="Interpretation of the selected message"
        >
          <div className="flex items-center gap-1.5">
            <CornerUpLeft className="h-3 w-3 shrink-0 text-[var(--inbox-accent)]" aria-hidden="true" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
              What this message means
            </span>
            {selectedMessageInfo.timestampLabel ? (
              <span
                suppressHydrationWarning
                className="text-[9px] tabular-nums text-[var(--inbox-intelligence-text-secondary)]"
              >
                · {selectedMessageInfo.timestampLabel}
              </span>
            ) : null}
          </div>

          {/* Author siempre visible para mantener contexto. */}
          <div className="mt-0.5 truncate text-[11px] font-semibold text-[var(--inbox-intelligence-text)]">
            {selectedMessageInfo.authorLabel}
          </div>

          {/* Lectura prominente del intent si llega. Fallback: snippet original (sin duplicar todo el bubble). */}
          {selectedMessageInfo.shortIntent ? (
            <p
              className="mt-1 text-[12px] font-medium leading-snug text-[var(--inbox-intelligence-text)]"
              title={selectedMessageInfo.shortIntent}
            >
              {selectedMessageInfo.shortIntent}
            </p>
          ) : selectedMessageInfo.snippet ? (
            <p
              className="mt-1 truncate text-[11px] leading-snug text-[var(--inbox-intelligence-text-secondary)]"
              title={selectedMessageInfo.snippet}
            >
              {selectedMessageInfo.snippet}
            </p>
          ) : null}

          {/* Lightweight chips: dirección + signals binarios. Solo se montan los que aplican. */}
          {(selectedMessageInfo.direction
            || selectedMessageInfo.hasAttachments
            || selectedMessageInfo.hasLinks) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {selectedMessageInfo.direction ? (
                <SignalChip label={directionChipLabel(selectedMessageInfo)} />
              ) : null}
              {selectedMessageInfo.hasAttachments ? (
                <SignalChip label="Has attachments" icon={Paperclip} />
              ) : null}
              {selectedMessageInfo.hasLinks ? (
                <SignalChip label="Has link" icon={Link2} />
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* ── 1. Contact ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
            <span className="text-sm font-bold">{contactName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--inbox-intelligence-text)]">{contactName}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--inbox-intelligence-text-secondary)]">
                {formatContactType(contactType)}
              </span>
              {selected.detectedLanguage && (
                <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                  {selected.detectedLanguage.toUpperCase()}
                </span>
              )}
              <span className="text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                {channelLabel(selected.channel)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setContactExpanded((v) => !v)}
            className="shrink-0 rounded-md p-1 text-[var(--inbox-intelligence-text-secondary)] hover:bg-white/8"
          >
            {contactExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {contactExpanded && (
          <div className="mt-3 space-y-2 border-t border-[var(--inbox-intelligence-border)] pt-3">
            {contactEmail && (
              <div className="flex items-center gap-2 text-xs">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
                <span className="truncate text-[var(--inbox-intelligence-text)]">{contactEmail}</span>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
                <span className="text-[var(--inbox-intelligence-text)]">{contactPhone}</span>
              </div>
            )}
            {contactCompany && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
                <span className="text-[var(--inbox-intelligence-text)]">{contactCompany}</span>
              </div>
            )}
            {selected.cliente && (
              <div className="flex items-center gap-2 text-xs">
                <User className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
                <a href={`/clientes/${selected.cliente.id}`} className="font-medium text-[var(--inbox-accent)] hover:underline">
                  {selected.cliente.nombre}
                </a>
              </div>
            )}
            {selected.proyecto && (
              <div className="flex items-center gap-2 text-xs">
                <FolderKanban className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
                <a href={`/proyectos/${selected.proyecto.id}`} className="font-medium text-[var(--inbox-accent)] hover:underline">
                  {selected.proyecto.nombre}
                </a>
                {selected.proyecto.estado && (
                  <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-[var(--inbox-intelligence-text-secondary)]">
                    {selected.proyecto.estado}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 2. Summary ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        {/* Phase A: AI headline + confidence pill — solo si vienen del handoff. */}
        {handoffHeadline ? (
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-[var(--inbox-intelligence-text)]">
              {handoffHeadline}
            </p>
            {handoffConfidencePct !== null ? (
              <span
                className="shrink-0 rounded-full bg-[var(--inbox-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--inbox-accent)]"
                title="AI confidence in this read"
                aria-label={`AI confidence ${handoffConfidencePct}%`}
              >
                {handoffConfidencePct}%
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Summary</p>
        {summary ? (
          <InlineTextarea
            value={summary}
            placeholder="Add summary..."
            className="mt-1.5 rounded-lg bg-transparent text-xs leading-relaxed text-[var(--inbox-intelligence-text)]"
            rows={2}
            onSave={(value) => updateHandoff({ summary: value })}
          />
        ) : (
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
            No summary available yet.
          </p>
        )}

        {/* Phase A: Facts / Decisions compactos. Se ocultan si están vacíos. */}
        {(handoffFacts.length > 0 || handoffDecisions.length > 0) && (
          <div className="mt-3 space-y-2 border-t border-[var(--inbox-intelligence-border)] pt-3">
            {handoffFacts.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Key facts</p>
                <ul className="mt-1 space-y-0.5">
                  {handoffFacts.map((fact, idx) => (
                    <li
                      key={idx}
                      className="flex gap-1.5 text-[11px] leading-snug text-[var(--inbox-intelligence-text)]"
                    >
                      <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--inbox-intelligence-text-secondary)]/60" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {handoffDecisions.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Decisions</p>
                <ul className="mt-1 space-y-0.5">
                  {handoffDecisions.map((decision, idx) => (
                    <li
                      key={idx}
                      className="flex gap-1.5 text-[11px] leading-snug text-[var(--inbox-intelligence-text)]"
                    >
                      <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--inbox-intelligence-text-secondary)]/60" />
                      <span>{decision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {handoffState && <p className="mt-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{handoffState}</p>}
      </section>

      {/* ── 3. Mood & Urgency ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Mood</span>
              <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">{moodValue.label}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn("h-full rounded-full transition-all duration-500", moodValue.barClass)}
                style={{ width: `${moodValue.percent}%` }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Urgency</span>
              <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">{urgencyValue.label}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn("h-full rounded-full transition-all duration-500", urgencyValue.barClass)}
                style={{ width: `${urgencyValue.percent}%` }}
              />
            </div>
          </div>
          {typeof selected.leadScore === "number" && (
            <div className="flex items-center justify-between pt-1 border-t border-[var(--inbox-intelligence-border)]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Lead score</span>
              <span className="text-xs font-semibold text-[var(--inbox-accent)]">{selected.leadScore}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Next move ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Next move</p>
        {/*
          Antes mostrábamos el texto dos veces: una como <p> de lectura y otra como `value` del
          InlineTextarea (que ya pinta el value como texto y permite click-to-edit). Lo unificamos
          igual que la sección Summary: una sola fuente de verdad, editable inline, con el peso
          visual de la recomendación principal.
        */}
        {nextRecommendedAction ? (
          <InlineTextarea
            value={nextRecommendedAction}
            placeholder="Edit recommendation..."
            className="mt-2 rounded-lg bg-transparent text-sm font-medium leading-relaxed text-[var(--inbox-intelligence-text)]"
            rows={2}
            onSave={(value) => updateHandoff({ nextRecommendedAction: value })}
          />
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
            No recommendation available yet.
          </p>
        )}

        {orderedSuggestedActions.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-[var(--inbox-intelligence-border)] pt-3">
            {isMessageMode && messageScopedActionCount > 0 ? (
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--inbox-accent)]">
                Actions based on selected message
              </p>
            ) : null}
            {orderedSuggestedActions.slice(0, 3).map((action) => {
              const title = typeof action.data?.title === "string" && action.data.title.trim()
                ? action.data.title
                : actionTypeLabel(action.type)
              const isPending = pendingActionId === action.id
              const isMessageScoped = Boolean(
                isMessageMode && selectedMessageId && action.sourceMessageId === selectedMessageId,
              )
              return (
                <div
                  key={action.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md transition-colors",
                    isMessageScoped &&
                      "border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 px-1.5 py-0.5",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ArrowRight className="h-3 w-3 shrink-0 text-[var(--inbox-accent)]" />
                    <span className="truncate text-xs font-medium text-[var(--inbox-intelligence-text)]">{title}</span>
                    {isMessageScoped ? (
                      <span
                        className="shrink-0 rounded-full border border-[var(--inbox-accent)]/40 bg-[var(--inbox-accent)]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--inbox-accent)]"
                        title="This action is anchored to the selected message"
                      >
                        For selected
                      </span>
                    ) : null}
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium", actionStatusBadge(action.status))}>
                      {actionStatusLabel(action.status)}
                    </span>
                  </div>
                  {action.status === "suggested" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSuggestedAction(action, "approve_and_execute")}
                      disabled={isPending}
                      className={cn("h-6 shrink-0 rounded-md px-2 text-[10px]", INBOX_GHOST_BUTTON)}
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
                    </Button>
                  )}
                  {action.status === "approved" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSuggestedAction(action, "execute")}
                      disabled={isPending}
                      className={cn("h-6 shrink-0 rounded-md px-2 text-[10px]", INBOX_GHOST_BUTTON)}
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Execute"}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {actionState && <p className="mt-2 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{actionState}</p>}
      </section>

      {/*
        ── Ask Fanny ──
        Single-shot Q&A grounded in the current conversation. Aparece SIEMPRE (no depende de
        message-mode) porque es útil tanto para preguntas sobre un mensaje como sobre el thread
        completo. El placeholder y el payload (`mode` + `messageId`) cambian según haya selección.
        Sin chat history, sin schema. Estado local que se resetea al cambiar de scope.
      */}
      <section
        className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4"
        aria-label="Ask Fanny"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-[var(--inbox-accent)]" aria-hidden="true" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
            Ask Fanny
          </p>
        </div>

        <div className="mt-2">
          <textarea
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            onKeyDown={handleAskKeyDown}
            placeholder={askPlaceholder}
            rows={2}
            disabled={askLoading}
            className="w-full resize-none rounded-md border border-[var(--inbox-intelligence-border)] bg-transparent px-2 py-1.5 text-xs leading-snug text-[var(--inbox-intelligence-text)] placeholder:text-[var(--inbox-intelligence-text-secondary)]/70 focus:border-[var(--inbox-accent)]/50 focus:outline-none disabled:opacity-60"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] text-[var(--inbox-intelligence-text-secondary)]/80">
              ⌘/Ctrl + Enter to send
            </span>
            <Button
              type="button"
              size="sm"
              variant="accent"
              onClick={handleAskSubmit}
              disabled={askLoading || askQuestion.trim().length === 0}
              className="h-6 shrink-0 rounded-md px-2 text-[10px]"
            >
              {askLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Send className="mr-1 h-3 w-3" /> Ask
                </>
              )}
            </Button>
          </div>
        </div>

        {askError ? (
          <p
            role="alert"
            className="mt-2 text-[10px] leading-snug text-rose-400"
          >
            {askError}
          </p>
        ) : null}

        {askAnswer ? (
          <div className="mt-2 space-y-1.5 rounded-md border border-[var(--inbox-accent)]/30 bg-white/[0.05] p-2">
            <p className="whitespace-pre-wrap text-[12px] leading-snug text-[var(--inbox-intelligence-text)]">
              {askAnswer}
            </p>
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAskCopy}
                className={cn("h-6 rounded-md px-2 text-[10px]", INBOX_GHOST_BUTTON)}
                aria-label="Copy answer"
              >
                {askCopied ? (
                  <>
                    <Check className="mr-1 h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </>
                )}
              </Button>
              {onInsertReply ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleAskInsertReply}
                  className={cn("h-6 rounded-md px-2 text-[10px]", INBOX_GHOST_BUTTON)}
                  aria-label="Insert answer into reply composer"
                >
                  <CornerDownLeft className="mr-1 h-3 w-3" /> Insert into reply
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {/*
        ── Phase C · Smart actions (solo en message-mode) ──
        Bloque visible con SOLO acciones reales wired:
        - Reply with AI draft → solo si el page.tsx detecta un draft sugerido
        - Create task / client / project → reusan handleConvert (ya envía sourceMessageId)
        Follow-up (recordatorios, calendario) queda postergado a una fase futura.
        Cuando este bloque se monta, ocultamos abajo la sección "Actions" para no duplicar.
      */}
      {isMessageMode && (
        <section
          className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4"
          aria-label="Smart actions for the selected message"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
            Smart actions
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hasSuggestedDraft && onUseSuggestedDraft ? (
              <ActionButton
                label="Reply with AI draft"
                icon={Sparkles}
                onClick={onUseSuggestedDraft}
              />
            ) : null}
            {/*
              Phase 1+2: Add to calendar appears only when the AI persisted a `create_event`
              action anchored to the selected inbound message AND that action has not yet been
              executed. Once executed, the resultId is on the action so re-clicking would just
              short-circuit through the idempotent backend path; we hide the CTA instead and
              let the existing actions list show the executed status badge.
            */}
            {selectedMessageInfo?.eventHint
              && (selectedMessageInfo.eventHint.startISO || selectedMessageInfo.eventHint.allDay)
              && !isCreateEventActionExecuted(selectedMessageInfo, selected.actions) ? (
              <ActionButton
                label="Add to calendar"
                icon={CalendarPlus}
                onClick={() => setCalendarPreviewOpen(true)}
              />
            ) : null}
            <ActionButton label="Create task" icon={CheckSquare} onClick={() => handleConvert("tarea")} />
            <ActionButton label="Create client" icon={User} onClick={() => handleConvert("cliente")} />
            <ActionButton label="Create project" icon={FolderKanban} onClick={() => handleConvert("proyecto")} />
          </div>
        </section>
      )}

      {/*
        Phase 2 calendar preview/confirm dialog — pre-fills fields from the structured
        EventHint produced by Fanny. When `onCreateCalendarEvent` is provided AND we have a
        backing actionId, submit is enabled and creates a real Evento. When the action is
        missing or already executed, the dialog falls back to preview-only.
      */}
      {calendarPreviewOpen && selectedMessageInfo?.eventHint ? (
        <CalendarEventPreviewDialog
          hint={selectedMessageInfo.eventHint}
          onClose={() => setCalendarPreviewOpen(false)}
          onCreate={
            onCreateCalendarEvent && selectedMessageInfo.eventHint.actionId
              ? async (payload) => {
                  await onCreateCalendarEvent(
                    selectedMessageInfo.eventHint!.actionId!,
                    payload,
                  )
                  /** Close on success — the page refetches actions, so re-opening the
                   *  panel would just hide the now-executed CTA anyway. */
                  setCalendarPreviewOpen(false)
                }
              : undefined
          }
        />
      ) : null}

      {/* ── Phase A · 4.5 Still needed (handoff.pendingItems) ── */}
      {handoffPendingItems.length > 0 && (
        <section
          className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4"
          aria-label="Pending items needed to move forward"
        >
          <div className="flex items-center gap-1.5">
            <ListChecks className="h-3 w-3 text-[var(--inbox-intelligence-text-secondary)]" aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Still needed
            </p>
          </div>
          <ul className="mt-1.5 space-y-1">
            {handoffPendingItems.map((item, idx) => (
              <li
                key={idx}
                className="flex gap-1.5 text-xs leading-snug text-[var(--inbox-intelligence-text)]"
              >
                <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--inbox-intelligence-text-secondary)]/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Phase A · 4.6 Watch out (handoff.risks) — subtle warning, not error ── */}
      {handoffRisks.length > 0 && (
        <section
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
          aria-label="Risks to watch in this conversation"
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500/80" aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/90">
              Watch out
            </p>
          </div>
          <ul className="mt-1.5 space-y-1">
            {handoffRisks.map((risk, idx) => (
              <li
                key={idx}
                className="flex gap-1.5 text-xs leading-snug text-[var(--inbox-intelligence-text)]"
              >
                <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-500/70" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        ── 5. Actions ──
        Phase C: en message-mode lo OCULTAMOS. El bloque "Smart actions" arriba ya elevó las
        acciones reales (Create task/client/project + Reply with AI draft) y los placeholders
        de Communication (Internal note, Attach file, Call) duplican o no están wired —
        esos quedan pendientes de cableado. El placeholder "Archive" se quitó porque la
        acción real vive en More del composer (scope-aware). Para volver a ver Assign/etc
        a nivel conversación basta con limpiar la selección de mensaje (Esc).
      */}
      {!isMessageMode && (
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)]">
        <button
          type="button"
          onClick={() => setActionsExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Actions</span>
          {actionsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />}
        </button>

        {actionsExpanded && (
          <div className="space-y-3 border-t border-[var(--inbox-intelligence-border)] px-4 py-3">
            {/* Business */}
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Business</p>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton label="Create client" icon={User} onClick={() => handleConvert("cliente")} />
                <ActionButton label="Create project" icon={FolderKanban} onClick={() => handleConvert("proyecto")} />
                <ActionButton label="Create task" icon={CheckSquare} onClick={() => handleConvert("tarea")} />
              </div>
            </div>

            {/* Communication */}
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Communication</p>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton label="Internal note" icon={MessageSquare} />
                <ActionButton label="Attach file" icon={Paperclip} />
                {(selected.channel === "whatsapp" || selected.contact?.telefono) && (
                  <ActionButton label="Call" icon={PhoneCall} />
                )}
              </div>
            </div>

            {/*
              Workflow: only the assign Select is real here (chat/portal channels with members).
              The "Archive" placeholder was removed because Archive/Close/Move to Trash live in
              More on the composer with scope semantics. We render the whole subsection only
              when the assign control will actually appear, so we don't show an empty header.
            */}
            {(selected.channel === "web_chat" || selected.channel === "portal") && members.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Workflow</p>
                <div className="flex flex-wrap gap-1.5">
                  <div className="w-full mt-1">
                    <Select
                      value={selected.assignedTo || "unassigned"}
                      onValueChange={(value) => onAssign(value === "unassigned" ? "" : value)}
                      disabled={assignSaving}
                    >
                      <SelectTrigger className="h-7 w-full text-xs">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.nombre || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assignSaving && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                        <Loader2 className="h-3 w-3 animate-spin" /> Updating...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      )}
    </div>
  )
}

/**
 * Phase B: chip compacto neutro usado dentro de la card "What this message means". El icono
 * es opcional para que el chip de dirección sea solo texto y los binarios (attachments/link)
 * lleven afordancia visual.
 */
function SignalChip({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--inbox-intelligence-border)] bg-white/6 px-1.5 py-0.5 text-[9px] font-medium text-[var(--inbox-intelligence-text-secondary)]"
    >
      {Icon ? <Icon className="h-2.5 w-2.5" aria-hidden="true" /> : null}
      {label}
    </span>
  )
}

/**
 * Phase B: deriva el label del chip de dirección priorizando los booleans específicos. Los
 * booleans son más fiables que el string de dirección (que puede llegar como cualquier valor).
 */
function directionChipLabel(info: SelectedMessageInfo): string {
  if (info.isInbound) return "Inbound"
  if (info.isOutbound) return "Outbound"
  const dir = typeof info.direction === "string" ? info.direction.toLowerCase() : ""
  if (dir === "inbound") return "Inbound"
  if (dir === "outbound") return "Outbound"
  if (dir === "internal") return "Internal"
  if (dir === "system") return "System"
  return dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : "Message"
}

function ActionButton({ label, icon: Icon, onClick }: { label: string; icon: React.ElementType; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[var(--inbox-intelligence-border)] px-2.5 py-1.5 text-[11px] font-medium transition-colors",
        onClick
          ? "text-[var(--inbox-intelligence-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
          : "text-[var(--inbox-intelligence-text-secondary)]/50 cursor-default",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function formatContactType(tipo: string) {
  const map: Record<string, string> = {
    lead: "Lead",
    cliente: "Client",
    proveedor: "Supplier",
    colega: "Colleague",
    visitante: "Visitor",
    contact: "Contact",
  }
  return map[tipo] || tipo.replace(/_/g, " ")
}

function getStringValue(value: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!value) return null
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === "string" && candidate.trim()) return candidate
  }
  return null
}

/**
 * Phase A: lectura defensiva de listas de strings provenientes del handoff (facts, decisions,
 * pendingItems, risks). El backend ya normaliza, pero si llegara `null`, un string suelto, o
 * cualquier otro shape inesperado, devolvemos `[]` para que la UI simplemente no renderice nada.
 */
/**
 * Tells whether the operator should still see the "Add to calendar" CTA. We hide it once the
 * matching `create_event` ConversationAction is in `executed` status (Evento already created),
 * to avoid implying the creation is still pending. Other states (suggested/approved/failed)
 * keep the CTA visible so the operator can confirm or retry.
 */
function isCreateEventActionExecuted(
  info: SelectedMessageInfo | null,
  actions: ActionItem[] | undefined,
): boolean {
  if (!info?.eventHint?.actionId) return false
  const actionId = info.eventHint.actionId
  const match = (actions ?? []).find((a) => a.id === actionId)
  return match?.status === "executed"
}

function safeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim()
      if (trimmed) out.push(trimmed)
    }
  }
  return out
}

function mapSentimentToMood(sentiment?: string | null) {
  switch (sentiment?.toLowerCase()) {
    case "positive":
    case "positivo":
      return { label: "Positive", percent: 85, barClass: "bg-emerald-500" }
    case "negative":
    case "negativo":
      return { label: "Negative", percent: 30, barClass: "bg-rose-500" }
    case "neutral":
      return { label: "Neutral", percent: 55, barClass: "bg-sky-400" }
    default:
      return { label: "Unknown", percent: 50, barClass: "bg-[var(--inbox-intelligence-text-secondary)]/40" }
  }
}

function mapUrgency(urgency?: string | null) {
  switch (urgency) {
    case "critica":
      return { label: "Critical", percent: 100, barClass: "bg-rose-500" }
    case "alta":
      return { label: "High", percent: 75, barClass: "bg-amber-500" }
    case "media":
      return { label: "Medium", percent: 50, barClass: "bg-sky-400" }
    case "baja":
      return { label: "Low", percent: 25, barClass: "bg-emerald-500" }
    default:
      return { label: "Normal", percent: 35, barClass: "bg-[var(--inbox-intelligence-text-secondary)]/40" }
  }
}

/**
 * Editable form payload built by the dialog and handed back to the page when the operator
 * confirms creation. ISO strings are produced by combining date + time inputs in the user's
 * local timezone (the browser does the conversion for us via `new Date(...)`).
 */
export interface CreateCalendarEventInput {
  title: string
  startISO: string
  endISO: string | null
  allDay: boolean
  location: string | null
  description: string | null
}

/**
 * Phase 2 calendar preview dialog. Renders an editable form pre-filled from the AI-extracted
 * EventHint and, when the parent provides `onCreate`, lets the operator confirm creation.
 * If `onCreate` is omitted the submit button stays disabled (preview-only fallback) so the
 * dialog also works for messages where no backing ConversationAction exists.
 *
 * The component is self-contained (no portal/Radix Dialog) to avoid pulling new deps; it
 * renders an absolutely-positioned overlay over the panel and traps Esc to close.
 */
function CalendarEventPreviewDialog({
  hint,
  onClose,
  onCreate,
}: {
  hint: SelectedEventHint
  onClose: () => void
  /** When provided, submit is enabled and calls this with the operator-confirmed payload.
   *  Returning a rejected promise surfaces the error inside the dialog without closing it. */
  onCreate?: (payload: CreateCalendarEventInput) => Promise<void>
}) {
  const initial = useMemo(() => splitEventHint(hint), [hint])
  const [title, setTitle] = useState(initial.title)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [duration, setDuration] = useState(initial.duration)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [location, setLocation] = useState(initial.location)
  const [description, setDescription] = useState(initial.description)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  /** Esc to dismiss; matches the rest of the inbox keyboard model. Disabled while submitting
   *  so a stray keypress can't kill an in-flight POST mid-network. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, submitting])

  const missingTitle = !title.trim()
  /** allDay events still need a date; we only relax the time requirement. */
  const missingDate = !date.trim()
  /** When NOT all-day we also need a real time component to build a valid startISO. */
  const missingTime = !allDay && !time.trim()
  const missingFields: string[] = []
  if (missingTitle) missingFields.push("Title")
  if (missingDate) missingFields.push("Date")
  if (missingTime) missingFields.push("Time")
  const isValid = missingFields.length === 0
  const canSubmit = Boolean(onCreate) && isValid && !submitting

  async function handleCreate() {
    if (!onCreate || !isValid || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const payload = buildCreateEventInput({
        title: title.trim(),
        date: date.trim(),
        time: allDay ? "" : time.trim(),
        durationMinutes: allDay ? null : Number.parseInt(duration, 10),
        allDay,
        location: location.trim() || null,
        description: description.trim() || null,
      })
      await onCreate(payload)
      /** Parent decides whether to close on success — we don't auto-close here so the
       *  parent can show a "saved" state momentarily if it wants. */
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create event")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to calendar — preview"
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-surface)] p-4 shadow-lg">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Add to calendar
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--inbox-intelligence-text-secondary)]">
              {onCreate
                ? "Review the details extracted from this message before creating the event."
                : "Preview only — calendar action is missing."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--inbox-intelligence-text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--inbox-intelligence-text)] disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="mt-3 grid grid-cols-1 gap-2.5">
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 py-1.5 text-xs text-[var(--inbox-intelligence-text)] placeholder:text-[var(--inbox-intelligence-text-secondary)]/70 focus:border-[var(--inbox-accent)] focus:outline-none"
              placeholder="Meeting title"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 py-1.5 text-xs text-[var(--inbox-intelligence-text)] focus:border-[var(--inbox-accent)] focus:outline-none"
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={allDay}
                className="w-full rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 py-1.5 text-xs text-[var(--inbox-intelligence-text)] focus:border-[var(--inbox-accent)] focus:outline-none disabled:opacity-50"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Duration">
              <select
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                disabled={allDay}
                className="w-full rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 py-1.5 text-xs text-[var(--inbox-intelligence-text)] focus:border-[var(--inbox-accent)] focus:outline-none disabled:opacity-50"
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
            </Field>
            <Field label="All day">
              <label className="inline-flex h-[30px] items-center gap-2 rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 text-xs text-[var(--inbox-intelligence-text)]">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
                  className="h-3 w-3 accent-[var(--inbox-accent)]"
                />
                Mark as all-day
              </label>
            </Field>
          </div>

          <Field label="Location">
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 py-1.5 text-xs text-[var(--inbox-intelligence-text)] placeholder:text-[var(--inbox-intelligence-text-secondary)]/70 focus:border-[var(--inbox-accent)] focus:outline-none"
              placeholder="Address, room, or video link"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-[var(--inbox-intelligence-border)] bg-black/35 px-2 py-1.5 text-xs text-[var(--inbox-intelligence-text)] placeholder:text-[var(--inbox-intelligence-text-secondary)]/70 focus:border-[var(--inbox-accent)] focus:outline-none"
              placeholder="What is this event about?"
            />
          </Field>
        </div>

        {missingFields.length > 0 ? (
          <p className="mt-2 text-[11px] text-amber-400/80" role="status">
            Missing: {missingFields.join(", ")}
          </p>
        ) : null}

        {!onCreate ? (
          <p className="mt-2 text-[11px] text-amber-400/80" role="status">
            Calendar action is missing. Please refresh and try again.
          </p>
        ) : null}

        {submitError ? (
          <p className="mt-2 text-[11px] text-rose-400" role="alert">
            {submitError}
          </p>
        ) : null}

        <footer className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-[11px] font-medium text-[var(--inbox-intelligence-text-secondary)] hover:text-[var(--inbox-intelligence-text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            title={
              !onCreate
                ? "Calendar action is missing. Please refresh and try again."
                : !isValid
                  ? `Missing: ${missingFields.join(", ")}`
                  : submitting
                    ? "Creating event…"
                    : "Create the event in the internal 7F calendar"
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
              canSubmit
                ? "border border-[var(--inbox-accent)] bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent)]/25"
                : "border border-[var(--inbox-intelligence-border)] bg-black/35 text-[var(--inbox-intelligence-text-secondary)] opacity-70",
            )}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            {submitting ? "Creating…" : "Create event"}
          </button>
        </footer>
      </div>
    </div>
  )
}

/**
 * Build the API-bound CreateCalendarEventInput from the dialog's form fields. We rely on
 * the browser to interpret `YYYY-MM-DDTHH:mm` in the user's local timezone, then re-emit
 * as ISO so the backend stores a consistent UTC instant. For all-day events we anchor at
 * local midnight; durationMinutes is honored only for timed events.
 */
function buildCreateEventInput(input: {
  title: string
  date: string
  time: string
  durationMinutes: number | null
  allDay: boolean
  location: string | null
  description: string | null
}): CreateCalendarEventInput {
  const dateForStart = input.allDay ? `${input.date}T00:00` : `${input.date}T${input.time}`
  const start = new Date(dateForStart)
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid date or time")
  }

  let end: Date | null = null
  if (!input.allDay && input.durationMinutes && input.durationMinutes > 0) {
    end = new Date(start.getTime() + input.durationMinutes * 60_000)
  }

  return {
    title: input.title,
    startISO: start.toISOString(),
    endISO: end ? end.toISOString() : null,
    allDay: input.allDay,
    location: input.location,
    description: input.description,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Project the AI-derived EventHint into the form's local string fields. We split startISO into
 * a date + time pair (HTML `<input type="date|time">` need separate strings) and pick a default
 * duration from endISO when present. All paths default to safe empty strings; the form never
 * crashes on a malformed hint.
 */
function splitEventHint(hint: SelectedEventHint): {
  title: string
  date: string
  time: string
  duration: string
  allDay: boolean
  location: string
  description: string
} {
  const allDay = hint.allDay === true
  let date = ""
  let time = ""
  if (hint.startISO) {
    const d = new Date(hint.startISO)
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      date = `${yyyy}-${mm}-${dd}`
      if (!allDay) {
        const hh = String(d.getHours()).padStart(2, "0")
        const mi = String(d.getMinutes()).padStart(2, "0")
        time = `${hh}:${mi}`
      }
    }
  }

  let duration = "60"
  if (hint.startISO && hint.endISO) {
    const start = new Date(hint.startISO)
    const end = new Date(hint.endISO)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
      if (minutes >= 15 && minutes <= 24 * 60) {
        duration = String(minutes)
      }
    }
  }

  return {
    title: hint.title?.trim() ?? "",
    date,
    time,
    duration,
    allDay,
    location: hint.location?.trim() ?? "",
    description: hint.purpose?.trim() ?? "",
  }
}
