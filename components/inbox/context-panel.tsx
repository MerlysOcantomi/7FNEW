"use client"

import { useState } from "react"
import { InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Phone,
  Building2,
  ArrowRight,
  User,
  FolderKanban,
  CheckSquare,
  Archive,
  MessageSquare,
  Paperclip,
  PhoneCall,
  Crosshair,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { actionTypeLabel, actionStatusBadge, actionStatusLabel, channelLabel } from "@/lib/inbox-labels"
import {
  type IntentOperationalStatus,
  deriveMessageSummaryPlain,
  filterActionsBySourceMessage,
  intentStatusLabel,
} from "@/lib/inbox/context-panel-helpers"

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

/** When focusing a message, pass structured preview from the inbox page (derived from thread). */
export interface FocusedMessageDetail {
  id: string
  shortIntent: string | null
  content: string
  direction: string
  isInternal: boolean
  timestampLabel: string
  metaLabel: string
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
    handoff?: {
      status: string
      summary?: string | null
      nextRecommendedAction?: string | null
      confidence?: number | null
    } | null
    actions?: ActionItem[]
    drafts?: Array<{
      id: string
      type: string
      status: string
      title?: string | null
      content: string
      tone?: string | null
      targetChannel?: string | null
      sourceMessageId?: string | null
      reviewedBy?: string | null
      reviewedAt?: string | null
      generatedFrom?: Record<string, unknown> | null
      createdAt: string
    }>
    contact: {
      nombre?: string | null
      email: string | null
      empresa: string | null
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
  handleConvert: (action: "cliente" | "proyecto" | "tarea" | "todo") => void | Promise<void>
  actionState: string | null
  members: Array<{ userId: string; nombre: string | null; email: string }>
  assignSaving: boolean
  onAssign: (value: string) => void
  /** Focused message mode — set when user selects a message in the thread */
  focusedMessageId?: string | null
  onClearMessageFocus?: () => void
  /** Resolved row for `focusedMessageId`; omit if stale */
  focusedMessageDetail?: FocusedMessageDetail | null
  /** Operational intent status when available (e.g. MessageIntent) */
  messageIntentStatus?: IntentOperationalStatus | null
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
  focusedMessageId = null,
  onClearMessageFocus,
  focusedMessageDetail = null,
  messageIntentStatus = null,
}: ContextPanelProps) {
  const [contactExpanded, setContactExpanded] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const [backgroundExpanded, setBackgroundExpanded] = useState(true)

  const contactName = selected.contact.nombre || selected.cliente?.nombre || "Unknown contact"
  const contactType = selected.contact.tipo || "contact"
  const contactEmail = selected.contact.email || selected.cliente?.email || null
  const contactPhone = selected.contact.telefono || null
  const contactCompany = selected.contact.empresa || selected.cliente?.empresa || null

  const summary =
    selected.handoff?.summary ||
    selected.classification?.summary ||
    selected.summary ||
    null

  const nextRecommendedAction =
    selected.handoff?.nextRecommendedAction ||
    getStringValue(selected.classification?.nextBestAction, ["description", "label", "title", "action"]) ||
    null

  const moodValue = mapSentimentToMood(selected.sentiment)
  const urgencyValue = mapUrgency(selected.urgency)

  const suggestedActions = (selected.actions ?? []).filter((a) => a.status === "suggested" || a.status === "approved")

  const isMessageMode = Boolean(
    focusedMessageId &&
      focusedMessageDetail &&
      focusedMessageDetail.id === focusedMessageId,
  )

  const messageScopedActions = isMessageMode
    ? filterActionsBySourceMessage(suggestedActions, focusedMessageId)
    : []

  const conversationLevelActions = isMessageMode
    ? suggestedActions.filter((a) => a.sourceMessageId !== focusedMessageId)
    : suggestedActions

  const focusedDraft = isMessageMode
    ? selected.drafts?.find((d) => d.sourceMessageId === focusedMessageId) ?? null
    : null

  const messageSummaryText = isMessageMode && focusedMessageDetail
    ? deriveMessageSummaryPlain(focusedMessageDetail.content)
    : ""

  const displayIntent =
    isMessageMode && focusedMessageDetail?.shortIntent?.trim()
      ? focusedMessageDetail.shortIntent.trim()
      : isMessageMode && focusedMessageDetail
        ? null
        : null

  return (
    <div className="space-y-3 bg-[var(--inbox-intelligence-background)] p-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-[var(--inbox-intelligence-border)] pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--inbox-intelligence-accent)] to-[var(--inbox-intelligence-accent)]/80 shadow-sm">
          <Users className="h-4.5 w-4.5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold tracking-tight text-[var(--inbox-intelligence-text)]">Intelligence Hub</h2>
          <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">
            {isMessageMode ? "Working on selected message" : "AI-powered insights"}
          </p>
        </div>
        {isMessageMode ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--inbox-accent)]/35 bg-[var(--inbox-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--inbox-accent)]">
            <Crosshair className="h-3 w-3" aria-hidden />
            Selected message
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
            Conversation
          </span>
        )}
      </div>

      {!isMessageMode ? (
        <>
          <HubContactCard
            selected={selected}
            contactName={contactName}
            contactType={contactType}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            contactCompany={contactCompany}
            expanded={contactExpanded}
            onToggleExpanded={() => setContactExpanded((v) => !v)}
          />

          <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Summary
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
            {handoffState && (
              <p className="mt-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{handoffState}</p>
            )}
          </section>

          <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                    Mood
                  </span>
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
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                    Urgency
                  </span>
                  <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                    {urgencyValue.label}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", urgencyValue.barClass)}
                    style={{ width: `${urgencyValue.percent}%` }}
                  />
                </div>
              </div>
              {typeof selected.leadScore === "number" && (
                <div className="flex items-center justify-between border-t border-[var(--inbox-intelligence-border)] pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                    Lead score
                  </span>
                  <span className="text-xs font-semibold text-[var(--inbox-accent)]">{selected.leadScore}</span>
                </div>
              )}
            </div>
          </section>

          <RecommendedNextSection
            nextRecommendedAction={nextRecommendedAction}
            attribution="conversation"
            updateHandoff={updateHandoff}
            suggestedActions={conversationLevelActions}
            pendingActionId={pendingActionId}
            handleSuggestedAction={handleSuggestedAction}
            actionState={actionState}
          />

          <WorkflowActionsSection
            expanded={actionsExpanded}
            onToggle={() => setActionsExpanded((v) => !v)}
            selected={selected}
            members={members}
            assignSaving={assignSaving}
            onAssign={onAssign}
            handleConvert={handleConvert}
          />
        </>
      ) : (
        <>
          {/* Message mode — primary */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Selected message
            </p>
            {onClearMessageFocus ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-[10px] text-[var(--inbox-intelligence-text-secondary)]"
                onClick={onClearMessageFocus}
              >
                <X className="h-3 w-3" />
                Clear focus
              </Button>
            ) : null}
          </div>

          <section className="rounded-xl border border-[var(--inbox-accent)]/25 bg-[var(--inbox-intelligence-surface)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                {focusedMessageDetail?.metaLabel ?? "Message"}
              </span>
              <span className="text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                {focusedMessageDetail?.timestampLabel}
              </span>
              {messageIntentStatus ? (
                <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[var(--inbox-intelligence-text)]">
                  {intentStatusLabel(messageIntentStatus)}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-[var(--inbox-accent)]">
              {displayIntent ?? "No short intent extracted for this message yet."}
            </p>
          </section>

          <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Message summary
            </p>
            {messageSummaryText ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text)]">{messageSummaryText}</p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
                This message is focused. A detailed AI summary for this message is not available yet — showing plain text
                excerpt only.
              </p>
            )}
          </section>

          <RecommendedNextSection
            nextRecommendedAction={nextRecommendedAction}
            attribution="fallback"
            updateHandoff={updateHandoff}
            suggestedActions={messageScopedActions}
            pendingActionId={pendingActionId}
            handleSuggestedAction={handleSuggestedAction}
            actionState={actionState}
            messageFallbackHint
          />

          <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Draft for selected message
            </p>
            {focusedDraft?.content?.trim() ? (
              <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-[var(--inbox-intelligence-text)]">{focusedDraft.content}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--inbox-intelligence-text-secondary)]">
                No draft linked to this message (empty or not created for this thread item).
              </p>
            )}
          </section>

          {conversationLevelActions.length > 0 ? (
            <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                Conversation-level suggestions
              </p>
              <p className="mt-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                Not tied to the selected message — shown for visibility.
              </p>
              <SuggestedActionList
                actions={conversationLevelActions.slice(0, 5)}
                pendingActionId={pendingActionId}
                handleSuggestedAction={handleSuggestedAction}
              />
            </section>
          ) : null}

          {/* Client & conversation — secondary */}
          <div className="rounded-xl border border-dashed border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)]/80">
            <button
              type="button"
              onClick={() => setBackgroundExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                Client & conversation context
              </span>
              {backgroundExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />
              )}
            </button>
            {backgroundExpanded ? (
              <div className="space-y-3 border-t border-[var(--inbox-intelligence-border)] px-4 pb-4 pt-2">
                <HubContactCard
                  selected={selected}
                  contactName={contactName}
                  contactType={contactType}
                  contactEmail={contactEmail}
                  contactPhone={contactPhone}
                  contactCompany={contactCompany}
                  expanded={contactExpanded}
                  onToggleExpanded={() => setContactExpanded((v) => !v)}
                />
                {summary ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
                      Case summary
                    </p>
                    <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">{summary}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                  <span>Mood: {moodValue.label}</span>
                  <span>Urgency: {urgencyValue.label}</span>
                </div>
              </div>
            ) : null}
          </div>

          <WorkflowActionsSection
            expanded={actionsExpanded}
            onToggle={() => setActionsExpanded((v) => !v)}
            selected={selected}
            members={members}
            assignSaving={assignSaving}
            onAssign={onAssign}
            handleConvert={handleConvert}
          />
        </>
      )}
    </div>
  )
}

function HubContactCard({
  selected,
  contactName,
  contactType,
  contactEmail,
  contactPhone,
  contactCompany,
  expanded,
  onToggleExpanded,
}: {
  selected: ContextPanelProps["selected"]
  contactName: string
  contactType: string
  contactEmail: string | null
  contactPhone: string | null
  contactCompany: string | null
  expanded: boolean
  onToggleExpanded: () => void
}) {
  return (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
          <span className="text-sm font-bold">{contactName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--inbox-intelligence-text)]">{contactName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--inbox-intelligence-text-secondary)]">
              {formatContactType(contactType)}
            </span>
            {selected.detectedLanguage && (
              <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                {selected.detectedLanguage.toUpperCase()}
              </span>
            )}
            <span className="text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{channelLabel(selected.channel)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="shrink-0 rounded-md p-1 text-[var(--inbox-intelligence-text-secondary)] hover:bg-white/8"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
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
}

function RecommendedNextSection({
  nextRecommendedAction,
  attribution,
  updateHandoff,
  suggestedActions,
  pendingActionId,
  handleSuggestedAction,
  actionState,
  messageFallbackHint,
}: {
  nextRecommendedAction: string | null
  attribution: "conversation" | "fallback"
  updateHandoff: ContextPanelProps["updateHandoff"]
  suggestedActions: ActionItem[]
  pendingActionId: string | null
  handleSuggestedAction: ContextPanelProps["handleSuggestedAction"]
  actionState: string | null
  messageFallbackHint?: boolean
}) {
  return (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
          Recommended next move
        </p>
        {messageFallbackHint ? (
          <span className="text-[9px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
            No message-specific step yet — showing conversation-level recommendation.
          </span>
        ) : null}
      </div>
      {!messageFallbackHint && attribution === "conversation" && nextRecommendedAction ? (
        <div className="mt-2">
          <p className="text-sm font-medium leading-relaxed text-[var(--inbox-intelligence-text)]">{nextRecommendedAction}</p>
          <InlineTextarea
            value={nextRecommendedAction}
            placeholder="Edit recommendation..."
            className="mt-2 rounded-lg bg-white/6 text-xs text-[var(--inbox-intelligence-text)]"
            rows={2}
            onSave={(value) => updateHandoff({ nextRecommendedAction: value })}
          />
        </div>
      ) : messageFallbackHint && nextRecommendedAction ? (
        <div className="mt-2">
          <p className="mb-1 text-[9px] uppercase tracking-wide text-[var(--inbox-intelligence-text-secondary)]">
            Conversation-level (fallback)
          </p>
          <p className="text-sm font-medium leading-relaxed text-[var(--inbox-intelligence-text)]">{nextRecommendedAction}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
          No recommendation available yet.
        </p>
      )}

      {suggestedActions.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-[var(--inbox-intelligence-border)] pt-3">
          <SuggestedActionList
            actions={suggestedActions.slice(0, 8)}
            pendingActionId={pendingActionId}
            handleSuggestedAction={handleSuggestedAction}
          />
        </div>
      ) : null}
      {actionState && <p className="mt-2 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{actionState}</p>}
    </section>
  )
}

function SuggestedActionList({
  actions,
  pendingActionId,
  handleSuggestedAction,
}: {
  actions: ActionItem[]
  pendingActionId: string | null
  handleSuggestedAction: ContextPanelProps["handleSuggestedAction"]
}) {
  return (
    <>
      {actions.map((action) => {
        const title =
          typeof action.data?.title === "string" && action.data.title.trim() ? action.data.title : actionTypeLabel(action.type)
        const isPending = pendingActionId === action.id
        return (
          <div key={action.id} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ArrowRight className="h-3 w-3 shrink-0 text-[var(--inbox-accent)]" />
              <span className="truncate text-xs font-medium text-[var(--inbox-intelligence-text)]">{title}</span>
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
                className="h-6 shrink-0 rounded-md px-2 text-[10px]"
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
                className="h-6 shrink-0 rounded-md px-2 text-[10px]"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Execute"}
              </Button>
            )}
          </div>
        )
      })}
    </>
  )
}

function WorkflowActionsSection({
  expanded,
  onToggle,
  selected,
  members,
  assignSaving,
  onAssign,
  handleConvert,
}: {
  expanded: boolean
  onToggle: () => void
  selected: ContextPanelProps["selected"]
  members: ContextPanelProps["members"]
  assignSaving: boolean
  onAssign: ContextPanelProps["onAssign"]
  handleConvert: ContextPanelProps["handleConvert"]
}) {
  return (
    <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
          Actions
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[var(--inbox-intelligence-border)] px-4 py-3">
          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Business</p>
            <div className="flex flex-wrap gap-1.5">
              <ActionButton label="Create client" icon={User} onClick={() => handleConvert("cliente")} />
              <ActionButton label="Create project" icon={FolderKanban} onClick={() => handleConvert("proyecto")} />
              <ActionButton label="Create task" icon={CheckSquare} onClick={() => handleConvert("tarea")} />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">
              Communication
            </p>
            <div className="flex flex-wrap gap-1.5">
              <ActionButton label="Internal note" icon={MessageSquare} />
              <ActionButton label="Attach file" icon={Paperclip} />
              {(selected.channel === "whatsapp" || selected.contact.telefono) && (
                <ActionButton label="Call" icon={PhoneCall} />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Workflow</p>
            <div className="flex flex-wrap gap-1.5">
              <ActionButton label="Archive" icon={Archive} />
              {(selected.channel === "web_chat" || selected.channel === "portal") && members.length > 0 && (
                <div className="mt-1 w-full">
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
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
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
          : "cursor-default text-[var(--inbox-intelligence-text-secondary)]/50",
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
