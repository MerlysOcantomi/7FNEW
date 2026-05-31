"use client"

import { useEffect, useMemo, useState } from "react"
import { InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users, ChevronDown, ChevronUp, Loader2,
  Mail, Phone, Building2, ArrowRight, CornerUpLeft,
  User, FolderKanban,
  Paperclip, AlertTriangle, ListChecks, Link2, Sparkles,
  Send, Copy, Check, CornerDownLeft, CalendarPlus, X,
  BookOpen, Target,
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
    /**
     * Triage Summary inputs. `intent` is the AI classifier output (semantic);
     * `category` is the operator-assigned label drawn from the workspace
     * taxonomy. They are intentionally separate concepts and the panel renders
     * them as two distinct rows. Both are optional so callers that already
     * built `selected` from a partial detail payload don't break.
     */
    intent?: string | null
    category?: string | null
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
    /**
     * PR 9 — Fanny-suggested `WorkspaceTask` rows still in `proposed` status
     * for this conversation. Provided by the conversation detail endpoint
     * (see `getConversationById` in `modules/inbox/service.ts`). The Smart
     * Hub renders them as approve/dismiss cards backed by the linked
     * `ConversationAction` (via `conversationActionId`).
     */
    proposedTasks?: ProposedFannyTaskItem[]
    /**
     * Open drafts counted by the Triage Summary. Each draft carries the
     * same `status` shape as `ConversationDraft` ("draft" | "edited" |
     * "approved" | "discarded" | "superseded"); we count "draft" + "edited"
     * as the operator-actionable open set.
     */
    drafts?: Array<{ status?: string | null }>
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
  /**
   * Phase 3 To-do capture — Smart Hub "Still needed" items become explicit converters. Each
   * pending item gets a "Convert" affordance that calls this prop with the item's text and an
   * optional `sourceMessageId` (only set in message mode). The page is responsible for the
   * actual `POST /api/inbox/todos` and any list refresh; the panel just owns the click and the
   * "already converted" disabled state for the session.
   *
   * Returns a boolean: `true` = success (panel marks the item converted), `false` = failure
   * (panel re-enables the button so the operator can retry). Omit the prop to hide the
   * affordance entirely (legacy behaviour).
   */
  onCreateTodoFromPendingItem?: (input: {
    text: string
    sourceMessageId: string | null
  }) => Promise<boolean>
  /**
   * Number of `InboxTodo` rows for the active conversation that are still in
   * `open` or `waiting` status (the human-actionable subset). The page is the
   * source of truth — it owns the todo state — and passes a derived integer
   * here so the panel never has to fetch its own list. `undefined` means "the
   * page hasn't computed it yet" (initial load) and the Triage Summary treats
   * it as 0 for rendering purposes.
   */
  conversationTodoCount?: number
}

/**
 * PR 9 — UI projection of a Fanny-suggested `WorkspaceTask` (status=proposed).
 *
 * Mirrors `ProposedFannyTaskRecord` from `modules/inbox/inbox-tasks-read.ts`
 * but with `Date` fields serialised to ISO strings (the wire format from
 * `successResponse`/JSON). Kept inline in the panel module so the import
 * surface stays UI-only — the detail payload is structurally typed in
 * `app/inbox/page.tsx`.
 */
export interface ProposedFannyTaskItem {
  id: string
  title: string
  description: string | null
  priority: "low" | "normal" | "high" | "urgent"
  sourceLabel: string | null
  conversationActionId: string | null
  messageId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
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
  onCreateTodoFromPendingItem,
  conversationTodoCount,
}: ContextPanelProps) {
  const [contactExpanded, setContactExpanded] = useState(false)
  /**
   * Phase 3 — local set of pending-item identifiers already converted to To-dos in this
   * session. Identifier is `${index}::${text}` so that the same text appearing twice (rare
   * but possible) can still be tracked independently. Resets when the conversation changes
   * because `selected.id` is part of the dependency. Intentionally session-only: there is no
   * persistent "this pending item became a To-do" backend link, so reloading the panel will
   * re-enable the buttons. That's an acceptable trade-off — the backend already accepts
   * duplicates and the To-do view is the source of truth for what exists.
   */
  const [convertedPendingItemKeys, setConvertedPendingItemKeys] = useState<Set<string>>(() => new Set())
  const [convertingPendingItemKey, setConvertingPendingItemKey] = useState<string | null>(null)
  useEffect(() => {
    setConvertedPendingItemKeys(new Set())
    setConvertingPendingItemKey(null)
  }, [selected.id])
  /**
   * Message-mode only: secondary "Conversation context" block (summary + facts + decisions)
   * is collapsed by default so the operator's eyes go to message-level insight first. We keep
   * the collapsible state local because it's purely presentational and reset is implicit when
   * the panel re-renders for a new message.
   */
  const [contextDetailsOpen, setContextDetailsOpen] = useState(false)
  /** Phase 1 preview / Phase 2 confirm. Local state owns the dialog lifecycle; the page owns
   *  the network call via `onCreateCalendarEvent` and the post-success refetch. */
  const [calendarPreviewOpen, setCalendarPreviewOpen] = useState(false)
  /**
   * Message mode requires both an effective (non-trashed) selected message id AND the matching
   * info payload from the page. The page already nullifies `effectiveSelectedMessageId` when
   * the selected bubble is soft-trashed, and `replyTarget` (the source of `selectedMessageInfo`)
   * is gated by `actingOnScope === "selected"` — so trashed selection AND "Acting on: All"
   * both fall back to conversation mode automatically without any extra logic here.
   */
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

  /**
   * Shared "atoms" — small JSX fragments used by both message and conversation orderings. We
   * declare them up front so the two mode branches below stay focused on hierarchy/order
   * rather than duplicating layout. Each one is gated internally so it renders nothing when
   * its data is empty (no fabricated content per spec rule "show clean empty states").
   */

  /**
   * ── Triage Summary ──────────────────────────────────────────────────────
   * Read-only one-glance answer to "what is this thread and what's next?".
   * The block is intentionally NOT a source of new state: it derives every
   * value from `selected` (already loaded by the page) plus a single integer
   * `conversationTodoCount` that the page passes in. No fetches, no schema
   * change, no new endpoints.
   *
   * Field separation contract:
   *   - `intent`   = AI classifier output (semantic).
   *   - `category` = operator-assigned label from the workspace taxonomy
   *                  (`Workspace.config.taxonomies.inbox`). They are
   *                  rendered on two separate rows on purpose.
   *
   * Suggested category requires persisting AI category output and is
   * intentionally handled in a follow-up PR.
   */
  const triageIntent =
    pickTriageString(selected.classification?.intent) ?? pickTriageString(selected.intent)
  const triageCategory = pickTriageString(selected.category)
  const triageNextAction =
    pickTriageString(selected.handoff?.nextRecommendedAction)
    ?? getStringValue(selected.classification?.nextBestAction, [
      "description",
      "label",
      "title",
      "action",
    ])

  /**
   * Drafts count: only the operator-actionable subset. `superseded` /
   * `approved` / `discarded` drafts already had their moment in the
   * pipeline and are excluded so the counter never invites the operator
   * to act on something that's already resolved.
   */
  const triageDraftsOpen = (selected.drafts ?? []).filter((draft) => {
    const s = typeof draft?.status === "string" ? draft.status.toLowerCase() : ""
    return s === "draft" || s === "edited"
  }).length

  /**
   * Actions count: same idea — only `suggested` and `approved` need the
   * operator's attention. `executed`, `dismissed`, `failed` are terminal
   * for triage purposes (the row already shows its outcome elsewhere).
   */
  const triageActionsOpen = (selected.actions ?? []).filter(
    (action) => action.status === "suggested" || action.status === "approved",
  ).length

  /**
   * TODO(inbox-tasks): To-dos count is no longer rendered in Triage. We keep
   * the value derived (and the prop) so the rest of the meaningfulness gate
   * keeps the same shape; the counter pill itself was removed from the
   * footer below. Tasks live in `/tareas` (global) and `/today`.
   */
  const _triageTodosOpen = typeof conversationTodoCount === "number" ? conversationTodoCount : 0
  void _triageTodosOpen

  /**
   * Risks count from the handoff payload (best-effort). We do NOT pull
   * from `classification.risks` because the panel already presents that
   * stream via `watchOutSection`; counting both would double-count.
   */
  const triageRisksOpen = safeStringList(selected.handoff?.risks).length

  /**
   * Priority semantics. We treat `media` (the schema default for a brand
   * new conversation that the AI hasn't analysed) as "no signal" — it
   * shouldn't on its own keep the Triage block visible. Any other value
   * — `baja`, `alta`, `critica` — is an explicit triage signal.
   */
  const triagePriorityIsExplicit =
    typeof selected.urgency === "string"
    && selected.urgency.length > 0
    && selected.urgency !== "media"
  const triagePriority = mapUrgency(selected.urgency)

  const triageHasCounters =
    triageDraftsOpen > 0
    || triageActionsOpen > 0
    || triageRisksOpen > 0

  /**
   * Meaningfulness gate. The block hides itself entirely on a brand-new
   * conversation with nothing to summarise so we don't show a noisy empty
   * card to the operator. Show as soon as ONE genuinely useful signal
   * exists.
   */
  const triageHasMeaningfulData = Boolean(
    triageIntent
    || triageCategory
    || triageNextAction
    || triagePriorityIsExplicit
    || triageHasCounters,
  )

  /**
   * Default-open in conversation mode (operator wants the overview),
   * default-collapsed in message mode (the operator's eyes are on the
   * selected bubble first; one click reveals the bigger picture). Initial
   * value only — once the operator toggles it, we keep their choice for
   * the lifetime of this conversation. Switching to a different
   * conversation does NOT reset this on purpose: it preserves the user's
   * "I always want this open/closed" preference within the session.
   */
  const [triageOpen, setTriageOpen] = useState(!isMessageMode)

  const triageSummarySection = triageHasMeaningfulData ? (
    <section
      role="group"
      aria-label="Triage summary"
      className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)]"
    >
      <button
        type="button"
        onClick={() => setTriageOpen((value) => !value)}
        aria-expanded={triageOpen}
        aria-controls="context-panel-triage-summary"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-1.5">
          <Target
            className="h-3 w-3 text-[var(--inbox-accent)]"
            aria-hidden="true"
          />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
            Triage
          </span>
        </span>
        {triageOpen ? (
          <ChevronUp
            className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]"
            aria-hidden="true"
          />
        )}
      </button>
      {triageOpen ? (
        <div
          id="context-panel-triage-summary"
          className="space-y-2 border-t border-[var(--inbox-intelligence-border)] px-4 py-3"
        >
          {triageIntent ? (
            <TriageRow label="Intent">
              <span
                className="block truncate text-[12px] font-medium text-[var(--inbox-intelligence-text)]"
                title={triageIntent}
              >
                {triageIntent}
              </span>
            </TriageRow>
          ) : null}

          {/*
            Category row: shows the active workspace category exactly as the
            operator chose it. Falls back to "Uncategorised" only when the
            block is already meaningful for other reasons (intent, next
            action, counters); we never invent a category when nothing else
            justifies the row.
          */}
          {triageCategory ? (
            <TriageRow label="Category">
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--inbox-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--inbox-accent)]"
                title={triageCategory}
              >
                <span className="truncate">{triageCategory}</span>
              </span>
            </TriageRow>
          ) : (triageIntent || triageNextAction || triagePriorityIsExplicit || triageHasCounters) ? (
            <TriageRow label="Category">
              <span className="text-[11px] italic text-[var(--inbox-intelligence-text-secondary)]">
                Uncategorised
              </span>
            </TriageRow>
          ) : null}

          {triagePriorityIsExplicit ? (
            <TriageRow label="Priority">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--inbox-intelligence-text)]"
                aria-label={`Priority ${triagePriority.label}`}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full",
                    triagePriority.barClass,
                  )}
                />
                <span>{triagePriority.label}</span>
              </span>
            </TriageRow>
          ) : null}

          {triageNextAction ? (
            <TriageRow label="Next">
              <span
                className="block line-clamp-2 text-[12px] leading-snug text-[var(--inbox-intelligence-text)]"
                title={triageNextAction}
              >
                {triageNextAction}
              </span>
            </TriageRow>
          ) : null}

          {triageHasCounters ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--inbox-intelligence-border)] pt-2 text-[11px] text-[var(--inbox-intelligence-text-secondary)]">
              {triageDraftsOpen > 0 ? (
                <CounterPill
                  label={`${triageDraftsOpen} ${triageDraftsOpen === 1 ? "draft" : "drafts"} open`}
                />
              ) : null}
              {triageActionsOpen > 0 ? (
                <CounterPill
                  label={`${triageActionsOpen} ${triageActionsOpen === 1 ? "action" : "actions"} open`}
                />
              ) : null}
              {/*
                TODO(inbox-tasks): The Inbox-specific "to-do" counter was retired
                — Inbox is conversation triage, not a task store. Tasks live in
                `/tareas` (global Tasks) and the daily view is `/today`. The
                `triageTodosOpen` derivation and `conversationTodoCount` prop
                stay for now to avoid breaking the panel signature; remove in a
                follow-up cleanup once we drop the legacy plumbing.
              */}
              {triageRisksOpen > 0 ? (
                <CounterPill
                  label={`${triageRisksOpen} ${triageRisksOpen === 1 ? "risk" : "risks"}`}
                  tone="warning"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  ) : null

  const headerSection = (
    <div className="flex items-center gap-3 pb-3 border-b border-[var(--inbox-intelligence-border)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--inbox-intelligence-accent)] to-[var(--inbox-intelligence-accent)]/80 shadow-sm">
        <Users className="h-4.5 w-4.5 text-white" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-[var(--inbox-intelligence-text)]">Intelligence Hub</h2>
        <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">
          {isMessageMode ? "Message insight" : "Conversation overview"}
        </p>
      </div>
    </div>
  )

  /** Always-visible contact card. Initial = avatar + name + small chip line. Expand reveals
   *  email/phone/company/cliente/proyecto links. Per spec "Always visible at the top". */
  const contactSection = (
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
          aria-expanded={contactExpanded}
          aria-label={contactExpanded ? "Collapse contact details" : "Expand contact details"}
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
  )

  /** Message-mode only: short interpretation of the *selected* bubble. Renders nothing when
   *  not in message mode (the caller branches between this and `summarySection`). */
  const whatThisMeansSection = isMessageMode && selectedMessageInfo ? (
    <section
      className="rounded-xl border border-white/[0.08] border-l-2 border-l-[var(--inbox-accent)] bg-white/[0.05] px-3 py-2"
      aria-label="What this message means"
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
      <div className="mt-0.5 truncate text-[11px] font-semibold text-[var(--inbox-intelligence-text)]">
        {selectedMessageInfo.authorLabel}
      </div>
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
      ) : (
        <p className="mt-1 text-[11px] italic leading-snug text-[var(--inbox-intelligence-text-secondary)]">
          No interpretation available for this message yet.
        </p>
      )}
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
  ) : null

  /**
   * Conversation summary block — used as the conversation-mode "what does this mean" answer
   * AND as the body of the collapsible "Conversation context" panel in message mode. We keep
   * the AI headline + confidence pill here since they describe the whole thread, not a single
   * message. Facts/Decisions are intentionally NOT mixed into this block: the spec calls them
   * out as separate questions ("what facts? / what decisions?") so they live in their own
   * sub-sections rendered after the summary in conversation mode and inside the collapsible
   * in message mode.
   */
  const summaryBlock = (
    <>
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
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
        {isMessageMode ? "Conversation summary" : "Summary"}
      </p>
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
      {handoffState && <p className="mt-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{handoffState}</p>}
    </>
  )

  /**
   * Facts + Decisions block. In conversation mode this renders right after the summary as its
   * own "answer" card. In message mode it lives inside the collapsible "Conversation context"
   * panel. Renders nothing when both lists are empty.
   */
  const factsAndDecisionsBlock = (handoffFacts.length > 0 || handoffDecisions.length > 0) ? (
    <div className="space-y-2">
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
  ) : null

  /** Signal bars: mood + urgency + lead score. The lead score row only renders when present. */
  const signalsSection = (
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
  )

  /**
   * Recommended next step — single CTA-style card with editable text +
   * ranked actions list. Title is intentionally identical across
   * message-mode and conversation-mode (PR 11) so the operator's IA
   * stays stable when toggling between views.
   */
  const nextMoveSection = (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
        Smart Action
      </p>
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
          Fanny is still preparing the best next action.
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
  )

  /**
   * Suggested actions block — only contextual approvals tied to a specific AI
   * suggestion remain:
   *   - "Reply with AI draft" (when Fanny has a draft scoped to the selected
   *     message / conversation).
   *   - "Add to calendar" (when an inbound message carries a parsed
   *     `create_event` EventHint).
   *
   * The previous generic "Create task / Create client / Create project"
   * buttons were removed: the Inbox is conversation triage, not a global
   * creation menu. Tasks live in `/tareas` (global Tasks/WorkspaceTask),
   * clients in `/clientes`, and projects in `/proyectos`. When the operator
   * needs to spawn one of those records, the AI's "Pending decisions"
   * (approve / dismiss) and the global "New" command are the canonical
   * paths.
   *
   * If neither contextual CTA applies, the section is hidden entirely so the
   * panel doesn't render an empty card. The section title is dropped to
   * avoid the "Smart actions" naming the new product spec wants to retire;
   * if a title is still needed visually we surface "Suggested" only when at
   * least one CTA is rendered.
   */
  const showSuggestedDraftCta = Boolean(hasSuggestedDraft && onUseSuggestedDraft)
  const showAddToCalendarCta = Boolean(
    isMessageMode
    && selectedMessageInfo?.eventHint
    && (selectedMessageInfo.eventHint.startISO || selectedMessageInfo.eventHint.allDay)
    && !isCreateEventActionExecuted(selectedMessageInfo, selected.actions),
  )
  const hasSuggestedActionCta = showSuggestedDraftCta || showAddToCalendarCta
  /**
   * TODO(inbox-tasks): the `handleConvert` prop is preserved on the panel
   * surface for now — composer / message-action paths still call it via
   * other mounts. Once those entry points migrate to the approve/dismiss
   * next-step flow, this prop and the Convert CTAs can go away entirely.
   */
  void handleConvert
  const smartActionsSection = hasSuggestedActionCta ? (
    <section
      className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4"
      aria-label="Suggested"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
        Suggested
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {showSuggestedDraftCta ? (
          <ActionButton
            label="Reply with AI draft"
            icon={Sparkles}
            onClick={onUseSuggestedDraft}
          />
        ) : null}
        {showAddToCalendarCta ? (
          <ActionButton
            label="Add to calendar"
            icon={CalendarPlus}
            onClick={() => setCalendarPreviewOpen(true)}
          />
        ) : null}
      </div>
    </section>
  ) : null

  /**
   * PR 9 — Fanny suggested tasks (proposed `WorkspaceTask` rows backed by a
   * `create_task` ConversationAction). Hidden when empty (no noise on
   * conversations the AI didn't propose tasks for).
   *
   * Each card surfaces title, description, priority, and an optional
   * confidence pill (when the Fanny pipeline persisted a numeric
   * `metadata.confidence` between 0 and 1). The approve / dismiss CTAs
   * reuse the existing ConversationAction flow via `handleSuggestedAction`:
   *   - Approve → operation `approve_and_execute`. PR 7's
   *     `convertConversationToRecords` promotes the linked proposed
   *     WorkspaceTask to `"open"` instead of duplicating it.
   *   - Dismiss → operation `dismiss`. PR 7's `dismissConversationAction`
   *     cascades to mark the linked proposed WorkspaceTask `"dismissed"`.
   *
   * Defensive fallbacks:
   *   - If a proposed task arrives without `conversationActionId`, or the
   *     linked action can't be found in `selected.actions` (already
   *     promoted / dismissed by another tab), the card renders read-only
   *     with disabled buttons. The operator can refresh to re-sync.
   */
  const proposedFannyTasks = (selected.proposedTasks ?? []).filter(
    (task): task is ProposedFannyTaskItem => Boolean(task && task.id && task.title),
  )
  /**
   * PR 11 — section renamed from "Fanny suggested tasks" to
   * "Pending decisions". Rationale: the panel's IA puts decisions
   * (approve / dismiss) above execution (Smart actions, Today). The
   * section currently only renders proposed `WorkspaceTask` rows that
   * are awaiting human decision, so "Pending decisions" is precise.
   * The caption keeps Fanny's branding context without making the
   * title compete with `Today`'s execution language.
   */
  const pendingDecisionsSection = proposedFannyTasks.length > 0 ? (
    <section
      className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4"
      aria-label="Pending decisions"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-[var(--inbox-accent)]" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
          Pending decisions
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[var(--inbox-intelligence-text-secondary)]/85">
        Fanny suggestions awaiting your approval before becoming workspace tasks.
      </p>
      <ul className="mt-2 space-y-2">
        {proposedFannyTasks.map((task) => {
          /**
           * Resolve the linked ConversationAction so approve/dismiss can
           * route through the existing flow.
           *
           * Hardening (PR 9 follow-up):
           *   1. Must be the same id as the task's `conversationActionId`.
           *   2. Must be `type === "create_task"`. PR 7 only ever creates
           *      proposed `WorkspaceTask` rows for `create_task` actions,
           *      so any other type linked here is data-corruption / an
           *      unexpected upstream change. Routing approve+execute to
           *      the wrong type would either no-op (e.g. assign_operator
           *      requires `assignedTo`) or fire a different side-effect.
           *      We refuse to act on it.
           *   3. Status must be `"suggested"` or `"approved"` — anything
           *      else means the action has already been executed or
           *      dismissed (likely from another tab) and the panel is
           *      momentarily stale. The "View only" pill signals this
           *      until the next detail refetch flushes the row.
           */
          const linkedAction = task.conversationActionId
            ? (selected.actions ?? []).find(
                (a) =>
                  a.id === task.conversationActionId &&
                  a.type === "create_task" &&
                  (a.status === "suggested" || a.status === "approved"),
              )
            : null
          const canAct = Boolean(linkedAction)
          const isPending = canAct && linkedAction?.id === pendingActionId
          const confidencePct = readConfidencePct(task.metadata)
          const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
          /**
           * Primary CTA label tracks the linked action's lifecycle so the
           * operator always sees the next concrete step:
           *   - suggested → "Create task" (approve + execute will run).
           *   - approved  → "Execute" (approve already happened, e.g. a
           *     prior execute failed and we're retrying just the run).
           * Both routes call `approve_and_execute`; `approveConversationAction`
           * is idempotent on `approved` so the re-approve is a no-op write
           * and the execute is what does the real work.
           */
          const primaryCtaLabel =
            linkedAction?.status === "approved" ? "Execute" : "Create task"
          return (
            <li
              key={task.id}
              className="rounded-md border border-[var(--inbox-intelligence-border)] bg-white/4 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--inbox-intelligence-text)]">
                    {task.title}
                  </p>
                  {task.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--inbox-intelligence-text-secondary)]">
                      {task.description}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--inbox-intelligence-border)] bg-white/6 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--inbox-intelligence-text-secondary)]">
                      <Target className="h-2.5 w-2.5" aria-hidden="true" />
                      {priorityLabel}
                    </span>
                    {confidencePct !== null ? (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--inbox-accent)]"
                        title="Fanny's confidence in this suggestion"
                      >
                        {confidencePct}% confidence
                      </span>
                    ) : null}
                    {!canAct ? (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-400/90"
                        title="The linked action is no longer pending — refresh to resync."
                      >
                        View only
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canAct || isPending}
                  onClick={() => {
                    if (!linkedAction) return
                    handleSuggestedAction(linkedAction, "dismiss")
                  }}
                  className={cn(
                    "h-6 rounded-md px-2 text-[10px]",
                    INBOX_GHOST_BUTTON,
                  )}
                  aria-label={`Dismiss suggested task: ${task.title}`}
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canAct || isPending}
                  onClick={() => {
                    if (!linkedAction) return
                    handleSuggestedAction(linkedAction, "approve_and_execute")
                  }}
                  className={cn(
                    "h-6 rounded-md px-2 text-[10px]",
                    INBOX_GHOST_BUTTON,
                  )}
                  aria-label={`${primaryCtaLabel} for suggested task: ${task.title}`}
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    primaryCtaLabel
                  )}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  ) : null

  /**
   * Pending items — "what's missing to act?". Hidden when empty so we never
   * render an empty card.
   *
   * TODO(inbox-tasks): direct "convert pending item to Inbox To-do" was
   * retired — the panel must not spawn task-shaped records as a side effect
   * of pure read-only reasoning. Promotion to a `WorkspaceTask` should
   * happen through the AI's approve/dismiss next-step flow (see
   * `pendingDecisionsSection` below) so a human explicitly authorises the
   * write. The `onCreateTodoFromPendingItem` prop and the per-item session
   * state (`convertedPendingItemKeys`, `convertingPendingItemKey`) are kept
   * in the component signature for now to avoid breaking callers; they are
   * intentionally unused below and will be removed in a follow-up cleanup.
   */
  void onCreateTodoFromPendingItem
  void convertedPendingItemKeys
  void convertingPendingItemKey
  void setConvertedPendingItemKeys
  void setConvertingPendingItemKey
  const stillNeededSection = handoffPendingItems.length > 0 ? (
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
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null

  /** Risks — "what to watch?" Hidden when empty so we don't show an empty warning card. */
  const watchOutSection = handoffRisks.length > 0 ? (
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
  ) : null

  /**
   * Workflow (assign select). Only rendered when the channel supports it (web_chat | portal)
   * AND the workspace has assignable members. We always show this in conversation mode; in
   * message mode the operator first cares about the message itself, so we skip it there to
   * avoid noise (clear selection with Esc to reach it).
   */
  const showWorkflow = !isMessageMode
    && (selected.channel === "web_chat" || selected.channel === "portal")
    && members.length > 0

  const workflowSection = showWorkflow ? (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Workflow</p>
      <div className="mt-2">
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
    </section>
  ) : null

  /** Ask Fanny — single-shot Q&A. Aparece SIEMPRE; el placeholder y el payload (mode + messageId)
   *  cambian según haya selección. Estado local; reset al cambiar de scope (askScopeKey effect). */
  const askFannySection = (
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
  )

  /**
   * Narrative reorder (right-column polish). The panel now reads top-down as a
   * single story: Who is writing → What is happening → Smart Action → More
   * context → Ask Fanny. We only REGROUP + reorder the existing section atoms
   * (no data/contract changes); each atom keeps its own data gating so empty
   * cards still never render.
   *
   * - Smart Action and Ask Fanny are NOT given an extra group heading: their
   *   cards already carry self-titles ("Smart Action" / "Ask Fanny"), so a
   *   duplicate label would be noise.
   * - "More context" is gated on having at least one child (risks / facts /
   *   decisions / workflow / conversation-context) so we never render a lonely
   *   heading. Ask Fanny still sits right after it, easy to reach.
   */
  const narrativeHeadingClass =
    "px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--inbox-intelligence-text-secondary)]/75"
  const hasMoreContextConversation =
    handoffRisks.length > 0 ||
    handoffFacts.length > 0 ||
    handoffDecisions.length > 0 ||
    showWorkflow
  const hasMoreContextMessage =
    handoffRisks.length > 0 ||
    Boolean(summary) ||
    handoffFacts.length > 0 ||
    handoffDecisions.length > 0 ||
    Boolean(handoffHeadline)

  return (
    <div className="space-y-3 bg-[var(--inbox-intelligence-background)] p-4">
      {/*
        ── Section ordering ──
        Two distinct top-down sequences depending on mode. Each "atom" above is gated on its
        own data, so empty cards never render — that's how we honor the spec rule "If no AI
        data exists: show clean empty states, do NOT fabricate content".

        Message mode  → message insight first, conversation context as a collapsible at the end.
        Conversation  → summary + facts/decisions up front, no message-specific cards.

        Trashed selected message ⇒ page nullifies effectiveSelectedMessageId, so the panel
        receives `selectedMessageInfo: null` and the message-mode branch falls back to the
        conversation branch automatically. No extra logic needed here.
      */}
      {headerSection}

      {isMessageMode ? (
        <>
          {/* 1. Who is writing — stable sender/contact identity. */}
          <div className="space-y-2">
            <p className={narrativeHeadingClass}>Who is writing</p>
            {contactSection}
          </div>

          {/*
            2. What is happening — dynamic conversation state: triage overview
            (intent / category / priority), what the selected message means,
            mood / urgency / lead signals, and what's still needed to move
            forward. Mood lives HERE (current state), not under the sender.
          */}
          <div className="space-y-2">
            <p className={narrativeHeadingClass}>What is happening</p>
            {triageSummarySection}
            {whatThisMeansSection}
            {signalsSection}
            {stillNeededSection}
          </div>

          {/*
            3. Smart Action — Fanny's main recommended next step (self-titled
            card, so no extra group heading). Pending decisions + suggested
            shortcuts follow as secondary execution affordances.
          */}
          <div className="space-y-2">
            {nextMoveSection}
            {pendingDecisionsSection}
            {smartActionsSection}
          </div>

          {/*
            4. More context — risks to watch + the collapsible Conversation
            context (summary + facts + decisions of the whole thread). Gated
            so the heading never renders alone.
          */}
          {hasMoreContextMessage ? (
            <div className="space-y-2">
              <p className={narrativeHeadingClass}>More context</p>
              {watchOutSection}
              {(summary || handoffFacts.length > 0 || handoffDecisions.length > 0 || handoffHeadline) ? (
                <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)]">
                  <button
                    type="button"
                    onClick={() => setContextDetailsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    aria-expanded={contextDetailsOpen}
                    aria-controls="context-panel-conversation-context"
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-[var(--inbox-intelligence-text-secondary)]" aria-hidden="true" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                        Conversation context
                      </span>
                    </span>
                    {contextDetailsOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />
                    )}
                  </button>
                  {contextDetailsOpen ? (
                    <div
                      id="context-panel-conversation-context"
                      className="space-y-3 border-t border-[var(--inbox-intelligence-border)] px-4 py-3"
                    >
                      {summaryBlock}
                      {factsAndDecisionsBlock ? (
                        <div className="border-t border-[var(--inbox-intelligence-border)] pt-3">
                          {factsAndDecisionsBlock}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}

          {/* 5. Ask Fanny — free-form Q&A, self-titled, always last. */}
          {askFannySection}
        </>
      ) : (
        <>
          {/* 1. Who is writing — stable sender/contact identity. */}
          <div className="space-y-2">
            <p className={narrativeHeadingClass}>Who is writing</p>
            {contactSection}
          </div>

          {/*
            2. What is happening — dynamic conversation state: triage overview,
            thread summary, mood / urgency / lead signals, and what's still
            needed. Mood lives HERE (current state), not under the sender.
          */}
          <div className="space-y-2">
            <p className={narrativeHeadingClass}>What is happening</p>
            {triageSummarySection}
            <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
              {summaryBlock}
            </section>
            {signalsSection}
            {stillNeededSection}
          </div>

          {/*
            3. Smart Action — Fanny's main recommended next step (self-titled
            card). Pending decisions + suggested shortcuts follow as secondary.
          */}
          <div className="space-y-2">
            {nextMoveSection}
            {pendingDecisionsSection}
            {smartActionsSection}
          </div>

          {/*
            4. More context — risks to watch, facts / decisions, and workflow
            (assign). Gated so the heading never renders alone.
          */}
          {hasMoreContextConversation ? (
            <div className="space-y-2">
              <p className={narrativeHeadingClass}>More context</p>
              {watchOutSection}
              {factsAndDecisionsBlock ? (
                <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
                  {factsAndDecisionsBlock}
                </section>
              ) : null}
              {workflowSection}
            </div>
          ) : null}

          {/* 5. Ask Fanny — free-form Q&A, self-titled, always last. */}
          {askFannySection}
        </>
      )}

      {/*
        Phase 2 calendar preview/confirm dialog — pre-fills fields from the structured
        EventHint produced by Fanny. Mounted at the panel root so it can overlay everything
        regardless of which mode branch is active.
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
                  setCalendarPreviewOpen(false)
                }
              : undefined
          }
        />
      ) : null}
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

/**
 * Triage helpers. Kept tiny and local to this file because they exist only to
 * normalise inputs for the Triage Summary block — exporting them would invite
 * accidental reuse in places that have different empty-string conventions.
 */
function pickTriageString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function TriageRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2">
      <span className="pt-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * Counter chip used in the Triage Summary footer row. Defaults to a neutral
 * tone; warning is reserved for risks so the operator can pick out "things to
 * watch" at a glance without relying on color alone — the label always
 * spells out the count.
 */
function CounterPill({
  label,
  tone = "neutral",
}: {
  label: string
  tone?: "neutral" | "warning"
}) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-[var(--inbox-intelligence-border)] bg-white/[0.04] text-[var(--inbox-intelligence-text)]",
      )}
    >
      {label}
    </span>
  )
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

/**
 * PR 9 — derive a UI-displayable confidence percentage from a parsed
 * `WorkspaceTask.metadata` blob. Tolerates the values Fanny historically
 * persists:
 *   - 0..1 (canonical) — multiplied by 100 and rounded.
 *   - 0..100 (already a percentage) — passed through and rounded.
 * Returns `null` for anything unrecognisable so the UI can hide the chip
 * rather than render misleading numbers.
 */
function readConfidencePct(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata) return null
  const raw = metadata.confidence
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null
  if (raw <= 1 && raw >= 0) return Math.round(raw * 100)
  if (raw > 1 && raw <= 100) return Math.round(raw)
  return null
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
