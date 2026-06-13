"use client"

import { useEffect, useMemo, useState } from "react"
import { InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users, ChevronDown, ChevronUp, ChevronRight, Loader2,
  Phone, Building2, CornerUpLeft,
  User, FolderKanban,
  Paperclip, AlertTriangle, Link2, Sparkles,
  MessageCircle, CalendarPlus, X,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"
import { actionTypeLabel, channelLabel } from "@/lib/inbox-labels"

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
   * Current operator's user id — used ONLY to label the read-only handling strip
   * ("Assigned to me" vs a teammate name). Optional; when absent the strip falls back
   * to the resolved member name or a generic "Assigned" label. No write behavior.
   */
  currentUserId?: string | null
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
  currentUserId = null,
  selectedMessageId = null,
  selectedMessageInfo = null,
  hasSuggestedDraft = false,
  onUseSuggestedDraft,
  onCreateCalendarEvent,
  onCreateTodoFromPendingItem,
  conversationTodoCount,
}: ContextPanelProps) {
  const { openAsk } = useAskFanny()
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
  const contactEmail = selected.contact?.email || selected.cliente?.email || null
  const contactPhone = selected.contact?.telefono || null
  const contactCompany = selected.contact?.empresa || selected.cliente?.empresa || null

  const summary =
    selected.handoff?.summary ||
    selected.classification?.summary ||
    selected.summary ||
    null

  const nextRecommendedAction = getRecommendationText(selected)

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

  /**
   * Counters in the expanded Details footer. Risks are intentionally NOT counted here —
   * they already render as visible "Needs attention" notes, and showing them twice
   * (note + counter) was exactly the kind of repetition this panel is trying to kill.
   */
  const triageHasCounters =
    triageDraftsOpen > 0
    || triageActionsOpen > 0

  const headerSection = (
    <div className="flex items-center gap-3 pb-3 border-b border-[var(--inbox-intelligence-border)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--inbox-intelligence-accent)] to-[var(--inbox-intelligence-accent)]/80 shadow-sm">
        <Users className="h-4.5 w-4.5 text-white" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-[var(--inbox-intelligence-text)]">Fanny</h2>
        <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">
          {isMessageMode ? "Message insight" : "Conversation overview"}
        </p>
      </div>
    </div>
  )

  /**
   * Handling strip — a compact, READ-ONLY row of responsibility/status chips, derived only
   * from real persisted data. It never writes and never invents states; in particular it
   * NEVER shows "Handled by Fanny" at the conversation level because no such ownership
   * exists in the data model (Conversation.assignedTo is a human userId).
   *
   * Sources (all already on `selected` / props):
   *   - Assignment → `selected.assignedTo` + `currentUserId` + `members`.
   *   - "Waiting on client" → `selected.status === "awaiting_response"`.
   *   - "Done" → `selected.status ∈ {resolved, closed}`.
   *   - "Needs review" → at least one proposed WorkspaceTask OR one suggested ConversationAction.
   * It stays visually quieter than Pending decisions / Actions (small muted pills).
   */
  const assignedMember = selected.assignedTo
    ? members.find((m) => m.userId === selected.assignedTo)
    : null
  const assignmentChip: { label: string; tone: "neutral" | "muted" } =
    selected.assignedTo
      ? currentUserId && selected.assignedTo === currentUserId
        ? { label: "Assigned to me", tone: "neutral" }
        : {
            label: assignedMember
              ? `Assigned to ${assignedMember.nombre?.trim() || assignedMember.email.trim()}`
              : "Assigned",
            tone: "neutral",
          }
      : { label: "Unassigned", tone: "muted" }
  const isWaitingOnClient = selected.status === "awaiting_response"
  const isDone = selected.status === "resolved" || selected.status === "closed"
  const needsReview =
    (selected.proposedTasks?.length ?? 0) > 0
    || (selected.actions ?? []).some((a) => a.status === "suggested")

  const handlingSection = (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Handling">
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
          assignmentChip.tone === "neutral"
            ? "border-[var(--inbox-intelligence-border)] bg-white/[0.06] text-[var(--inbox-intelligence-text)]"
            : "border-[var(--inbox-intelligence-border)] bg-transparent text-[var(--inbox-intelligence-text-secondary)]",
        )}
        title={assignmentChip.label}
      >
        {assignmentChip.label}
      </span>
      {isWaitingOnClient ? (
        <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400/90 whitespace-nowrap">
          Waiting on client
        </span>
      ) : isDone ? (
        <span className="inline-flex items-center rounded-md border border-[var(--inbox-success)]/30 bg-[var(--inbox-success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-success)] whitespace-nowrap">
          Done
        </span>
      ) : null}
      {needsReview ? (
        <span className="inline-flex items-center rounded-md border border-[var(--inbox-accent)]/30 bg-[var(--inbox-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-accent)] whitespace-nowrap">
          Needs review
        </span>
      ) : null}
    </div>
  )

  /**
   * Request text — the message objective. Computed up-front because the contact card's
   * expanded details dedupe against it (summary / headline shown there only when they add
   * something the Request doesn't already say).
   */
  const messageNeedText = getMessageNeedText(selected, isMessageMode ? selectedMessageInfo : null)

  /**
   * Opportunity (human label, no raw metric). Only meaningful scores produce a row in the
   * expanded details; the numeric score stays in the tooltip for the curious operator.
   */
  const opportunityLabel =
    typeof selected.leadScore === "number"
      ? selected.leadScore >= 70
        ? "High"
        : selected.leadScore >= 40
          ? "Moderate"
          : null
      : null

  /**
   * Dedup gates for the expanded details: the editable Summary (and the AI headline) only
   * render there when they say something the Request block doesn't already show. Rule:
   * never the same paragraph twice on the first screen. `similarText` catches near-identical
   * variants (truncations, punctuation drift) — exact equality was not enough in practice.
   * A headline that is only a status label ("Recommended manual review") is also dropped,
   * which keeps the AI-confidence pill from ever rendering next to a status string.
   */
  const showSummaryInDetails = Boolean(summary) && !similarText(summary, messageNeedText)
  const headlineForDetails =
    handoffHeadline
    && !similarText(handoffHeadline, messageNeedText)
    && !isStatusLabelText(handoffHeadline)
      ? handoffHeadline
      : ""
  /** Message type row hides when the classifier intent just restates the Request text. */
  const messageTypeForDetails =
    triageIntent && !similarText(triageIntent, messageNeedText) ? triageIntent : null

  /**
   * Editable conversation summary — lives ONLY inside the expanded contact card details and
   * only when it adds something beyond the Request text (see dedup gates above). The AI
   * headline + confidence pill render with it when they differ from the Request too.
   */
  const summaryBlock = (
    <>
      {headlineForDetails ? (
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug text-[var(--inbox-intelligence-text)]">
            {headlineForDetails}
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
      {showSummaryInDetails ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
            Summary
          </p>
          <InlineTextarea
            value={summary ?? ""}
            placeholder="Add summary..."
            className="mt-1.5 rounded-lg bg-transparent text-xs leading-relaxed text-[var(--inbox-intelligence-text)]"
            rows={2}
            onSave={(value) => updateHandoff({ summary: value })}
          />
        </>
      ) : null}
      {handoffState && <p className="mt-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{handoffState}</p>}
    </>
  )

  /**
   * Facts + Decisions block — general background context, rendered only inside the expanded
   * top contact card. Renders nothing when both lists are empty.
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

  /**
   * Top client/contact card — the single home for client context. Compact by default
   * (name, relationship, channel, category, email); the "Details" affordance expands the
   * full context: client profile state, company/phone, linked client/project, message
   * type, priority, opportunity, language, editable summary, facts/decisions and open-work
   * counters. There is intentionally NO second context block lower in the panel.
   */
  const clientProfileState = getClientProfileState(selected)
  const contactSection = (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
          <span className="text-sm font-bold">{contactName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--inbox-intelligence-text)]">{contactName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--inbox-intelligence-text-secondary)]">
              {getRelationshipLabel(selected)}
            </span>
            <span className="text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
              {channelLabel(selected.channel)}
            </span>
            {triageCategory && (
              <span className="truncate text-[10px] font-medium text-[var(--inbox-accent)]" title={triageCategory}>
                {triageCategory}
              </span>
            )}
          </div>
          {contactEmail && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--inbox-intelligence-text-secondary)]">
              {contactEmail}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setContactExpanded((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)] transition-colors hover:bg-white/8 hover:text-[var(--inbox-intelligence-text)]"
          aria-expanded={contactExpanded}
          aria-label={contactExpanded ? "Hide details" : "Show details"}
        >
          Details
          {contactExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {contactExpanded && (
        <div className="mt-3 space-y-3 border-t border-[var(--inbox-intelligence-border)] pt-3">
          {/* Client profile state + direct profile link. */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <User
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  clientProfileState === "linked"
                    ? "text-[var(--inbox-accent)]"
                    : "text-[var(--inbox-intelligence-text-secondary)]",
                )}
              />
              <span
                className={cn(
                  clientProfileState === "linked"
                    ? "text-[var(--inbox-intelligence-text)]"
                    : "italic text-[var(--inbox-intelligence-text-secondary)]",
                )}
              >
                {clientProfileState === "linked" ? "Client profile linked" : "No client profile yet"}
              </span>
            </span>
            {selected.cliente && (
              <a
                href={`/clientes/${selected.cliente.id}`}
                className="shrink-0 text-[11px] font-medium text-[var(--accent-on-dark)] hover:underline"
              >
                View client profile
              </a>
            )}
          </div>
          {selected.proyecto && (
            <div className="flex items-center gap-2 text-xs">
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
              {/* Single truncated line, always: some projects carry a whole AI summary as
                  their `nombre`, and rendering it in full duplicated the Summary paragraph
                  right above it. The full name stays available via the title tooltip. */}
              <a
                href={`/proyectos/${selected.proyecto.id}`}
                className="min-w-0 flex-1 truncate font-medium text-[var(--accent-on-dark)] hover:underline"
                title={selected.proyecto.nombre}
              >
                {selected.proyecto.nombre}
              </a>
              {selected.proyecto.estado && (
                <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-[var(--inbox-intelligence-text-secondary)]">
                  {selected.proyecto.estado}
                </span>
              )}
            </div>
          )}
          {contactCompany && (
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
              <span className="truncate text-[var(--inbox-intelligence-text)]">{contactCompany}</span>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
              <span className="text-[var(--inbox-intelligence-text)]">{contactPhone}</span>
            </div>
          )}

          {(messageTypeForDetails || triagePriorityIsExplicit || opportunityLabel || selected.detectedLanguage) ? (
            <div className="space-y-2 border-t border-[var(--inbox-intelligence-border)] pt-3">
              {messageTypeForDetails ? (
                <TriageRow label="Message type">
                  <span
                    className="block truncate text-[12px] font-medium text-[var(--inbox-intelligence-text)]"
                    title={messageTypeForDetails}
                  >
                    {messageTypeForDetails}
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
              {opportunityLabel ? (
                <TriageRow label="Opportunity">
                  <span
                    className="text-[12px] font-medium text-[var(--inbox-intelligence-text)]"
                    title={typeof selected.leadScore === "number" ? `Lead score ${selected.leadScore}` : undefined}
                  >
                    {opportunityLabel}
                  </span>
                </TriageRow>
              ) : null}
              {selected.detectedLanguage ? (
                <TriageRow label="Language">
                  <span className="text-[12px] uppercase text-[var(--inbox-intelligence-text)]">
                    {selected.detectedLanguage}
                  </span>
                </TriageRow>
              ) : null}
            </div>
          ) : null}

          {(showSummaryInDetails || headlineForDetails) ? (
            <div className="border-t border-[var(--inbox-intelligence-border)] pt-3">
              {summaryBlock}
            </div>
          ) : null}
          {factsAndDecisionsBlock ? (
            <div className="border-t border-[var(--inbox-intelligence-border)] pt-3">
              {factsAndDecisionsBlock}
            </div>
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
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
  const messageNeedSection = (
    <section
      className="rounded-xl border border-white/[0.08] border-l-2 border-l-[var(--inbox-accent)] bg-white/[0.05] px-3 py-2.5"
      aria-label="Request"
    >
      <div className="flex items-center gap-1.5">
        <CornerUpLeft className="h-3 w-3 shrink-0 text-[var(--inbox-accent)]" aria-hidden="true" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--inbox-accent)]">
          Request
        </span>
        {isMessageMode && selectedMessageInfo?.timestampLabel ? (
          <span
            suppressHydrationWarning
            className="text-[9px] tabular-nums text-[var(--inbox-intelligence-text-secondary)]"
          >
            · {selectedMessageInfo.timestampLabel}
          </span>
        ) : null}
      </div>
      {/* Sender name renders here ONLY when it differs from the contact card directly above
          (e.g. an internal teammate note inside a client conversation). Same name twice in a
          row was pure noise. */}
      {isMessageMode && selectedMessageInfo
        && !sameText(selectedMessageInfo.authorLabel, contactName) ? (
        <div className="mt-0.5 truncate text-[11px] font-semibold text-[var(--inbox-intelligence-text)]">
          {selectedMessageInfo.authorLabel}
        </div>
      ) : null}
      {messageNeedText ? (
        <p
          className="mt-1 text-[12px] font-medium leading-snug text-[var(--inbox-intelligence-text)]"
          title={messageNeedText}
        >
          {messageNeedText}
        </p>
      ) : (
        <p className="mt-1 text-[11px] italic leading-snug text-[var(--inbox-intelligence-text-secondary)]">
          Fanny hasn&apos;t summarised this message yet.
        </p>
      )}
      {isMessageMode && selectedMessageInfo
        && (selectedMessageInfo.direction
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
  )

  /**
   * Needs attention — practical care before replying: missing information (handoff pending
   * items), risks, and urgency. Urgency is carried by the tone guidance below (so it isn't
   * repeated as a bullet AND a tone note). Renders only when there is something useful.
   */
  const attentionNotes: string[] = [...handoffRisks, ...handoffPendingItems]

  /**
   * Subtle tone strip — restores the visual tone signal the operators liked, without the
   * old analytics-style Mood/Urgency/Lead score block. One label, one decorative colored
   * strip, one practical sentence. Hidden when sentiment is missing/neutral and nothing
   * (urgency) makes it useful. See `getToneGuidance`.
   */
  const toneGuidance = getToneGuidance(selected)

  const needsAttentionSection = (attentionNotes.length > 0 || toneGuidance) ? (
    <section
      className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4"
      aria-label="Needs attention"
    >
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 text-amber-500/80" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
          Needs attention
        </p>
      </div>
      {attentionNotes.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {attentionNotes.map((note, idx) => (
            <li
              key={idx}
              className="flex gap-1.5 text-xs leading-snug text-[var(--inbox-intelligence-text)]"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-500/70"
              />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {toneGuidance ? (
        <div
          className={cn(
            "mt-2.5",
            attentionNotes.length > 0 && "border-t border-[var(--inbox-intelligence-border)] pt-2.5",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
            Tone
          </span>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8" aria-hidden="true">
            <div className={cn("h-full w-full rounded-full", toneGuidance.barClass)} />
          </div>
          <p className="mt-1.5 text-xs leading-snug text-[var(--inbox-intelligence-text)]">
            {toneGuidance.note}
          </p>
        </div>
      ) : null}
    </section>
  ) : null

  /**
   * Fanny recommends — the single recommended next step in plain work language. The text
   * stays operator-editable (same `updateHandoff` flow as before). The actionable cards
   * moved to `actionsSection` below so this block reads as advice, not as a control list.
   * Dedup: if the stored recommendation merely repeats the Request text, we show the
   * honest "still preparing" state instead of the same paragraph twice.
   */
  const storedRecommendationIsStatusLabel = Boolean(
    nextRecommendedAction && isStatusLabelText(nextRecommendedAction),
  )
  const recommendationText =
    nextRecommendedAction
    && !storedRecommendationIsStatusLabel
    && !similarText(nextRecommendedAction, messageNeedText)
      ? nextRecommendedAction
      : null
  /**
   * Fallback shown when no REAL recommendation exists. A stored status label ("Needs human
   * review") still means Fanny flagged this for a human, so the fallback turns that signal
   * into practical advice instead of echoing the status. Plain paragraph on purpose — a
   * status must never look like an editable recommendation.
   */
  const recommendationFallback = storedRecommendationIsStatusLabel
    ? handoffPendingItems.length > 0
      ? "Ask for the missing details before preparing your reply."
      : "Review before replying and send a clear next step."
    : "Fanny is still preparing the best next step."
  const recommendsSection = (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-[var(--inbox-accent)]" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
          Fanny recommends
        </p>
      </div>
      {recommendationText ? (
        <InlineTextarea
          value={recommendationText}
          placeholder="Edit recommendation..."
          className="mt-2 rounded-lg bg-transparent text-sm font-medium leading-relaxed text-[var(--inbox-intelligence-text)]"
          rows={2}
          onSave={(value) => updateHandoff({ nextRecommendedAction: value })}
        />
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
          {recommendationFallback}
        </p>
      )}
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
  /**
   * TODO(inbox-tasks): the `handleConvert` prop is preserved on the panel
   * surface for now — composer / message-action paths still call it via
   * other mounts. Once those entry points migrate to the approve/dismiss
   * next-step flow, this prop and the Convert CTAs can go away entirely.
   */
  void handleConvert
  /**
   * Actions — visible work cards (Today-style): one card per thing the operator can do
   * right now. No dropdowns, no tiny rows, no technical labels. Every card keeps its
   * existing backend route:
   *   - "Review draft"     → `onUseSuggestedDraft` (same draft pipeline as before).
   *   - "Add to calendar"  → opens the existing preview dialog → approve+execute.
   *   - suggested actions  → `handleSuggestedAction(action, "approve_and_execute")`.
   *   - approved actions   → `handleSuggestedAction(action, "execute")` with a
   *     "Continue" label (approval already happened; we're finishing the work).
   * Hidden entirely when there is nothing actionable — we never fake actions.
   */
  const hasAnyActionCard =
    showSuggestedDraftCta || showAddToCalendarCta || orderedSuggestedActions.length > 0
  const actionsSection = hasAnyActionCard ? (
    <section aria-label="Actions" className="space-y-1.5">
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
        Actions
      </p>
      {showSuggestedDraftCta ? (
        <WorkActionCard
          title="Review draft"
          description="Fanny prepared a reply for this message. Review it before sending."
          ctaLabel="Review draft"
          icon={Sparkles}
          onAction={onUseSuggestedDraft}
        />
      ) : null}
      {showAddToCalendarCta ? (
        <WorkActionCard
          title="Add to calendar"
          description={
            selectedMessageInfo?.eventHint?.title
              ? `Fanny detected an event: ${selectedMessageInfo.eventHint.title}`
              : "Fanny detected an event in this message."
          }
          ctaLabel="Add to calendar"
          icon={CalendarPlus}
          onAction={() => setCalendarPreviewOpen(true)}
        />
      ) : null}
      {orderedSuggestedActions.slice(0, 4).map((action) => {
        const title = typeof action.data?.title === "string" && action.data.title.trim()
          ? action.data.title
          : actionTypeLabel(action.type)
        const isPending = pendingActionId === action.id
        const isMessageScoped = Boolean(
          isMessageMode && selectedMessageId && action.sourceMessageId === selectedMessageId,
        )
        return (
          <WorkActionCard
            key={action.id}
            title={title}
            description={getActionDescription(action)}
            ctaLabel={getBusinessActionLabel(action)}
            badge={isMessageScoped ? "For this message" : null}
            pending={isPending}
            onAction={() =>
              handleSuggestedAction(
                action,
                action.status === "approved" ? "execute" : "approve_and_execute",
              )
            }
          />
        )
      })}
      {actionState ? (
        <p className="px-0.5 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{actionState}</p>
      ) : null}
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
           *   - approved  → "Continue" (approve already happened, e.g. a
           *     prior execute failed and we're finishing the run).
           * Both routes call `approve_and_execute`; `approveConversationAction`
           * is idempotent on `approved` so the re-approve is a no-op write
           * and the execute is what does the real work.
           */
          const primaryCtaLabel =
            linkedAction?.status === "approved" ? "Continue" : "Create task"
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
  /**
   * Ask Fanny — consolidation (PR2): the embedded single-shot Q&A box was
   * removed. There is now ONE Ask Fanny experience (the global top-row panel),
   * so the right panel only keeps a compact shortcut that opens it. The global
   * panel already receives this conversation/message scope via AskFannyProvider
   * (published by app/inbox/page.tsx), so no scope is wired here.
   */
  const askFannySection = (
    <section aria-label="Ask Fanny">
      <button
        type="button"
        onClick={() => openAsk()}
        className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--inbox-accent)]/40 hover:bg-white/[0.04]"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)]">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-[var(--inbox-intelligence-text)]">
            Ask Fanny
          </span>
          <span className="block truncate text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
            Ask about this conversation.
          </span>
        </span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]"
          aria-hidden="true"
        />
      </button>
    </section>
  )

  return (
    <div className="space-y-3 bg-[var(--inbox-intelligence-background)] p-4">
      {/*
        ── Section ordering ──
        Three zones, top-down, matching how an operator reads a request:
          ZONE 1 — Who & how: who wrote + their data + handling + tone/mood.
            1. Client/contact card    (sender name, data; expanded = ALL client context)
            2. Handling strip         (read-only assignment / status chips)
            3. Needs attention        (tone/mood strip + missing info / risks)
          ZONE 2 — What the message says:
            4. Request                (the message objective)
          ZONE 3 — Actions:
            5. Fanny recommends       (advised next step — bridges into the decisions)
            6. Pending decisions      (approve / dismiss proposed WorkspaceTasks)
            7. Actions                (review draft, add to calendar, action cards)
          Then: Ask Fanny, Workflow.
        Header chrome (the "Fanny" title) stays on top. Each atom keeps its own data
        gating, so empty cards never render and we never fabricate content. Client
        context lives ONLY inside the expanded top card — no duplicate block lower.

        Trashed selected message ⇒ page nullifies effectiveSelectedMessageId, so the panel
        receives `selectedMessageInfo: null` and message-specific affordances fall back to
        conversation-level data automatically. No extra logic needed here.
      */}
      {headerSection}
      {contactSection}
      {handlingSection}
      {needsAttentionSection}
      {messageNeedSection}
      {recommendsSection}
      {pendingDecisionsSection}
      {actionsSection}
      {askFannySection}
      {workflowSection}

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
 * Phase B: chip compacto neutro usado dentro de la card "Request". El icono es opcional
 * para que el chip de dirección sea solo texto y los binarios (attachments/link) lleven
 * afordancia visual.
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

/**
 * Visible work card (Today-style) used by the Actions section. One card = one piece of real
 * work the operator can do now: a title in business language, an optional one-line
 * description, and a single always-visible CTA. No dropdowns, no hidden rows.
 */
function WorkActionCard({
  title,
  description,
  ctaLabel,
  onAction,
  pending = false,
  badge = null,
  icon: Icon,
}: {
  title: string
  description?: string | null
  ctaLabel: string
  onAction?: () => void
  pending?: boolean
  badge?: string | null
  icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-3">
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--inbox-accent)]/12 text-[var(--inbox-accent)]">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold text-[var(--inbox-intelligence-text)]">{title}</p>
            {badge ? (
              <span
                className="shrink-0 rounded-full border border-[var(--inbox-accent)]/40 bg-[var(--inbox-accent)]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--inbox-accent)]"
                title="This action is anchored to the selected message"
              >
                {badge}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--inbox-intelligence-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={onAction}
          disabled={!onAction || pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
            onAction && !pending
              ? "border-[var(--inbox-accent)]/50 bg-[var(--inbox-accent)]/12 text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent)]/22"
              : "border-[var(--inbox-intelligence-border)] bg-black/25 text-[var(--inbox-intelligence-text-secondary)] opacity-70",
          )}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}

/**
 * Business label for the primary CTA of a suggested / approved ConversationAction. Replaces
 * the old technical "Run" / "Execute" copy. For `approved` actions the approval already
 * happened (e.g. a prior execute failed), so "Continue" tells the operator we're finishing
 * the same piece of work rather than starting a new one.
 */
function getBusinessActionLabel(action: ActionItem): string {
  if (action.status === "approved") return "Continue"
  switch (action.type) {
    case "create_client":
      return "Create client profile"
    case "create_project":
      return "Create project"
    case "create_task":
      return "Create task"
    case "schedule_followup":
      return "Create follow-up"
    case "assign_operator":
      return "Assign owner"
    case "generate_proposal":
      return "Prepare proposal"
    case "create_event":
      return "Add to calendar"
    default:
      return actionTypeLabel(action.type)
  }
}

/**
 * One-line human description of what the action will actually do. Prefers the AI-provided
 * `data.description` when present; otherwise falls back to a generic per-type sentence that
 * only describes behaviour the backend really implements (no overpromising).
 */
function getActionDescription(action: ActionItem): string | null {
  const desc = action.data?.description
  if (typeof desc === "string" && desc.trim()) return desc.trim()
  switch (action.type) {
    case "create_client":
      return "Create a client profile for this contact in your workspace."
    case "create_project":
      return "Start a project linked to this conversation."
    case "create_task":
      return "Add this as a task so it shows up in your work."
    case "schedule_followup":
      return "Set a follow-up so this doesn't slip."
    case "assign_operator":
      return "Hand this conversation to a teammate."
    case "generate_proposal":
      return "Prepare a proposal based on this conversation."
    case "create_event":
      return "Add the detected meeting to your calendar."
    default:
      return null
  }
}

/**
 * Request text — what the sender is asking for in this specific message. Source priority
 * (per product spec): message-scoped short intent → AI headline → conversation summary →
 * message snippet → handoff summary → classifier summary. Returns null when no real signal
 * exists so the UI can render an honest empty state instead of fabricated content.
 */
function getMessageNeedText(
  selected: ContextPanelProps["selected"],
  selectedMessageInfo: SelectedMessageInfo | null,
): string | null {
  if (selectedMessageInfo?.shortIntent?.trim()) return selectedMessageInfo.shortIntent.trim()
  const headline = selected.handoff?.headline
  if (typeof headline === "string" && headline.trim()) return headline.trim()
  if (typeof selected.summary === "string" && selected.summary.trim()) return selected.summary.trim()
  if (selectedMessageInfo?.snippet?.trim()) return selectedMessageInfo.snippet.trim()
  const handoffSummary = selected.handoff?.summary
  if (typeof handoffSummary === "string" && handoffSummary.trim()) return handoffSummary.trim()
  const classificationSummary = selected.classification?.summary
  if (typeof classificationSummary === "string" && classificationSummary.trim()) {
    return classificationSummary.trim()
  }
  return null
}

/**
 * Exact (case/whitespace-insensitive) text equality. Used for cheap identity checks like
 * "is the message author the same person as the contact card above?".
 */
function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Near-duplicate detection for the dedup rules (Request vs Summary vs headline vs
 * recommendation): the same paragraph must never appear twice on the first screen.
 * Normalises case / whitespace / punctuation, then treats the texts as duplicates when
 * they are equal OR when one contains the other and their lengths are close (covers
 * truncated snippets and "same sentence plus a trailing word"). Genuinely different
 * texts — even on the same topic — stay visible.
 */
function similarText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.,;:!?…"'«»()\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  /** Containment only counts as duplication when the shorter text is a meaningful chunk
   *  (>= 70%) of the longer one — a short phrase quoted inside a long paragraph is fine. */
  return longer.includes(shorter) && shorter.length / longer.length >= 0.7
}

/**
 * Detects stored strings that are pipeline STATUS labels, not actual recommendations or
 * headlines ("Needs human review", "Recommended manual review", "revisión manual", ...).
 * These are signals for the operator, and must never render as the main recommendation,
 * as an editable field, or as a large heading in the details area.
 */
function isStatusLabelText(text: string | null | undefined): boolean {
  if (!text) return false
  const trimmed = text.trim()
  /** Real recommendations are sentences; status labels are short. The length cap keeps a
   *  legitimate long recommendation that merely MENTIONS a review from being filtered. */
  if (trimmed.length > 60) return false
  return /\b(human review|manual review|needs review|review (recommended|required|needed)|recommended manual|revisi[oó]n (manual|humana)|requiere revisi[oó]n)\b/i.test(
    trimmed,
  )
}

/**
 * Client profile state for the expanded contact card. "linked" when the conversation has a
 * `cliente` record behind it; "none" otherwise. (Linking an existing client is not an action
 * the panel offers today, so there is deliberately no third state.)
 */
function getClientProfileState(selected: ContextPanelProps["selected"]): "linked" | "none" {
  return selected.cliente ? "linked" : "none"
}

/**
 * Tone guidance for the subtle strip inside "Needs attention". Human, work-oriented — never
 * a raw sentiment enum or a percentage. Derivation:
 *   1. `selected.sentiment` decides the base tone (positive / negative).
 *   2. Urgency (`alta`/`critica`) strengthens the note, or carries it alone when sentiment
 *      is missing/neutral.
 *   3. A high lead score upgrades the positive note to an opportunity framing.
 *   4. Neutral/unknown sentiment with no urgency → null (the strip hides; no fabricated
 *      emotional states).
 */
function getToneGuidance(selected: ContextPanelProps["selected"]): {
  note: string
  tone: "positive" | "neutral" | "warning" | "danger"
  barClass: string
} | null {
  const sentiment = selected.sentiment?.toLowerCase() ?? ""
  const isPositive = sentiment === "positive" || sentiment === "positivo"
  const isNegative = sentiment === "negative" || sentiment === "negativo"
  const isUrgent = selected.urgency === "alta" || selected.urgency === "critica"
  const isHighOpportunity = typeof selected.leadScore === "number" && selected.leadScore >= 70

  if (isNegative) {
    return {
      note: isUrgent
        ? "Tense and urgent. Acknowledge their concern and reply today with a concrete next step."
        : "Tense. Acknowledge their concern and give a clear next step.",
      tone: "danger",
      barClass: "bg-gradient-to-r from-rose-500/70 via-rose-400/40 to-transparent",
    }
  }
  if (isPositive) {
    if (isUrgent) {
      return {
        note: "Interested and waiting. Reply today with a concrete answer.",
        tone: "warning",
        barClass: "bg-gradient-to-r from-amber-500/70 via-emerald-400/40 to-transparent",
      }
    }
    return {
      note: isHighOpportunity
        ? "Interested. Good opportunity for a helpful, direct reply."
        : "Cordial. A clear, direct answer will land well.",
      tone: "positive",
      barClass: "bg-gradient-to-r from-emerald-500/70 via-teal-400/40 to-transparent",
    }
  }
  if (isUrgent) {
    return {
      note: "Urgent. Reply with a concrete next step today.",
      tone: "warning",
      barClass: "bg-gradient-to-r from-amber-500/70 via-amber-400/40 to-transparent",
    }
  }
  return null
}

/** Fanny's recommended next step, from the handoff first and the classifier as fallback. */
function getRecommendationText(selected: ContextPanelProps["selected"]): string | null {
  return (
    selected.handoff?.nextRecommendedAction ||
    getStringValue(selected.classification?.nextBestAction, ["description", "label", "title", "action"]) ||
    null
  )
}

/**
 * Relationship label for the sender chip. A linked `cliente` record is the strongest signal
 * ("Client"); otherwise we fall back to the contact's own type (Lead / Supplier / ...).
 */
function getRelationshipLabel(selected: ContextPanelProps["selected"]): string {
  if (selected.cliente) return "Client"
  return formatContactType(selected.contact?.tipo || "contact")
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
