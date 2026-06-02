"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ConversationList } from "@/components/inbox/conversation-list"
import { InboxToolbar } from "@/components/inbox/inbox-toolbar"
import { InboxTaxonomyChips } from "@/components/inbox/inbox-taxonomy-chips"
import { ConversationCategoryEditor } from "@/components/inbox/conversation-category-editor"
/**
 * TODO(inbox-tasks): Inbox no longer owns a visible To-do mode. Keep
 * legacy task plumbing for now because Smart Hub / pending items may
 * still convert suggestions into WorkspaceTask behind the scenes. The
 * `<InboxTodoList>` JSX branch below is gated on `isTodoMode`, which is
 * now hard-wired to `false`, so the import survives only to keep the
 * unreachable branch type-checking. Cleanup (remove branch + handlers
 * + import) belongs to a follow-up PR.
 */
import { InboxTodoList } from "@/components/inbox/inbox-todo-list"
import type { ClientInboxTodo } from "@/components/inbox/inbox-todo-list-item"
import {
  ContextPanel,
  type SelectedMessageInfo,
  type CreateCalendarEventInput,
} from "@/components/inbox/context-panel"
import { ReplyComposer, type ComposerAttachment, type EmailSendMode } from "@/components/inbox/reply-composer"
import { ConversationThread } from "@/components/inbox/conversation-thread"
import { TalkToFanny } from "@/components/inbox/talk-to-fanny"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useFetch } from "@/hooks/use-fetch"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { cn } from "@/lib/utils"
import {
  formatRelativeDate,
  formatRelativeDateCompact,
  statusBadgeDisplay,
  statusLabel,
  statusLabelDisplay,
  urgencyBadge,
  urgencyLabel,
  channelLabel,
  formatRoleLabel,
} from "@/lib/inbox-labels"
import { parseLocale, type SupportedLocale } from "@core/i18n"
import { pickExpandedIntents } from "@/lib/inbox/pick-expanded-intents"
import {
  createTodoOnServer,
  detectInternalNoteTodo,
  priorityFromUrgency,
  truncateForTitle,
} from "@/lib/inbox/client-todos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Send, Loader2, ListPlus, X } from "lucide-react"

interface WorkspaceMemberOption {
  userId: string
  nombre: string | null
  email: string
  avatar: string | null
  role: string
}

type AssignmentFilter = "all" | "mine" | "unassigned"

interface PendingActionInput {
  action: { id: string; type: string; status: string }
  operation: "approve_and_execute" | "execute" | "dismiss"
  dialogType: "assign" | "dismiss"
}

interface ConversationListItem {
  id: string
  channel: string
  status: string
  subject: string | null
  summary: string | null
  intent: string | null
  /**
   * Operator-assigned category drawn from `Workspace.config.taxonomies.inbox`.
   * Independent of `intent` (AI classifier output) — `category` is set manually
   * via the chip bar / category editor. `null` means "uncategorised".
   */
  category: string | null
  urgency: string
  leadScore: number | null
  assignedTo: string | null
  lastMessageAt: string
  messageCount: number
  /**
   * PR 10 — number of Fanny-suggested `WorkspaceTask` rows still in
   * `proposed` status for this conversation. Attached server-side by
   * `/api/inbox/conversations` so the list can render a discreet
   * "Fanny suggestion(s)" badge without an extra round-trip. Defaults
   * to `0` when missing or when the aggregation degraded silently.
   */
  proposedTaskCount?: number
  contact: {
    id: string
    nombre: string | null
    email: string | null
    empresa: string | null
    tipo: string
  }
  classification?: {
    summary?: string | null
    intent?: string | null
    sector?: string | null
  } | null
  messages?: Array<{
    id?: string
    content: string
    role: string
    direction?: string
    isInternal?: boolean
    createdAt?: string
    /** Tras `parseConversationJsonFields` en el listado API suele ser objeto; en bruto, string JSON. */
    metadata?: string | Record<string, unknown> | null
  }>
}

interface ConversationDetail extends ConversationListItem {
  sector: string | null
  sentiment: string | null
  detectedLanguage: string | null
  clienteId: string | null
  proyectoId: string | null
  cliente?: { id: string; nombre: string; email: string | null; empresa: string | null } | null
  proyecto?: { id: string; nombre: string; estado: string } | null
  classification?: {
    intent?: string | null
    urgency?: string | null
    leadScore?: number | null
    summary?: string | null
    suggestedTags?: string[] | null
    briefData?: Record<string, unknown> | null
    nextBestAction?: Record<string, unknown> | null
  } | null
  handoff?: {
    id: string
    status: string
    headline?: string | null
    summary?: string | null
    facts?: string[] | null
    decisions?: string[] | null
    pendingItems?: string[] | null
    risks?: string[] | null
    nextRecommendedAction?: string | null
    confidence?: number | null
    reviewedBy?: string | null
    reviewedAt?: string | null
    sourceMessageId?: string | null
  } | null
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
  actions?: Array<{
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
    approvedAt?: string | null
    dismissedAt?: string | null
    createdAt: string
  }>
  messages: Array<{
    id: string
    role: string
    direction: string
    content: string
    isInternal: boolean
    createdAt: string
    metadata?: string | null
  }>
  inboxEntries?: Array<{
    id: string
    clienteId?: string | null
    proyectoId?: string | null
    tareaId?: string | null
  }>
  /**
   * PR 9 — Fanny-suggested `WorkspaceTask` rows for this conversation that
   * are still in `proposed` status. The detail endpoint
   * (`getConversationById`) attaches them so the Smart Hub renders the
   * suggestions section without an extra round-trip. Approve / dismiss go
   * through the linked `ConversationAction` (via `conversationActionId`),
   * not a new task-mutation API.
   */
  proposedTasks?: Array<{
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
  }>
}

const STATUS_OPTIONS = [
  "all",
  "new",
  "triaged",
  "assigned",
  "awaiting_response",
  "lead_detected",
  "resolved",
  "converted",
  "closed",
  "archived",
  "trashed",
]
const CHANNEL_OPTIONS = ["all", "manual", "web_chat", "email", "portal", "whatsapp"]
/**
 * Desktop column matrix (xl+):
 *  - left   → minmax(260px, 300px): tight sender list. Was minmax(288px, 30%)
 *    which let the column eat ~450px on wide screens, starving the thread.
 *  - center → minmax(0, 1fr): absorbs all remaining width.
 *  - right  → minmax(300px, 360px): Smart Hub. Was 30% (same problem as left).
 *
 * The capped maxes are the key change: 30% of a 1500px main area = 450px each
 * for left/right and only 600px for the thread; with fixed caps the thread
 * gets ≥840px on the same viewport. `minmax(0, 1fr)` on the center keeps grid
 * children allowed to truncate (otherwise long subjects would force the grid
 * to overflow horizontally).
 */
const DESKTOP_INBOX_GRID =
  "xl:grid xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,360px)] xl:grid-rows-[minmax(0,1fr)]"

/**
 * Infer the intent status of a conversation as a whole, based on the most recent inbound
 * (non-internal) message's `metadata.intentStatus`. Returns "done" when explicitly marked,
 * "open" otherwise (including "no metadata" / "no inbound" — the default before any operator
 * action is open work).
 *
 * The helper is shared by the Work filter and could be reused server-side later. We read
 * messages defensively because the list endpoint returns `messages` newest-first (top 5).
 */
interface IntentStatusMessage {
  direction?: string | null
  isInternal?: boolean | null
  metadata?: string | Record<string, unknown> | null
  createdAt?: string | Date | null
}

/**
 * Best-effort metadata parser for client-side reads. Returns an object form regardless of
 * whether the source already pre-parsed it or left it as a JSON string. We never throw — a
 * corrupted blob is treated as "no metadata", which keeps the UI in a safe default state.
 */
function readMessageMetadata(
  raw: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== "string" || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** True when a message has been soft-trashed via Message.metadata.trashedAt. */
function isMessageTrashed(meta: string | Record<string, unknown> | null | undefined): boolean {
  const parsed = readMessageMetadata(meta)
  if (!parsed) return false
  return typeof parsed.trashedAt === "string" && parsed.trashedAt.length > 0
}

function inferConversationIntentStatus(
  conversation: { messages?: ReadonlyArray<IntentStatusMessage> | null },
): "open" | "done" {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : []
  if (messages.length === 0) return "open"

  /** The list endpoint returns messages ordered by createdAt desc, so the first inbound match
   *  is also the latest one. We tolerate either ordering by tie-breaking on createdAt when
   *  available — defensive in case some caller passes ascending arrays. Trashed messages are
   *  skipped: they're invisible to Fanny and the operator's mental model treats them as if
   *  they were never sent. */
  let candidate: IntentStatusMessage | null = null
  let candidateTs = -Infinity
  for (const m of messages) {
    if (m.direction !== "inbound") continue
    if (m.isInternal === true) continue
    if (isMessageTrashed(m.metadata)) continue
    const ts = m.createdAt ? new Date(m.createdAt as string | Date).getTime() : 0
    if (ts > candidateTs) {
      candidate = m
      candidateTs = ts
    }
  }
  if (!candidate) return "open"

  const parsed = readMessageMetadata(candidate.metadata)
  if (!parsed) return "open"
  return parsed.intentStatus === "done" ? "done" : "open"
}

/**
 * Map sidebar `?filter=` URL values to the API query shape (`status` + `urgency`). The new
 * operational sidebar (Smart Inbox / Work / Smart views / Storage) drives the labels below;
 * legacy keys (`new`, `in_progress`, `urgent`, `needs_reply`, `leads`) are kept as aliases
 * so existing bookmarks, notifications, and links don't 404 silently. Unknown filters fall
 * through to `{}` (default Inbox view) which is also what `todo` and `scheduled` use today —
 * those are placeholder nav entries for future engines (To-do queue, Scheduled-by-EventHint).
 */
function mapSidebarFilter(filter: string | null): { status?: string; urgency?: string } {
  switch (filter) {
    /** ─ Storage ─ */
    case "archived": return { status: "archived" }
    case "closed": return { status: "closed" }
    case "trash": return { status: "trashed" }
    /** ─ Work ─ */
    /**
     * "Needs action" = conversations where someone on our side has to do something next.
     * `new` (untouched), `assigned` (operator owns it), `triaged` (AI classified, waiting
     * for human), `lead_detected` (qualified opportunity that needs follow-up). We
     * intentionally exclude `awaiting_response` here because that's "we replied, waiting on
     * them" — surfaced in the Waiting bucket instead.
     */
    case "needs_action": return { status: "new,assigned,triaged,lead_detected" }
    /** "Waiting" = we're waiting on the customer / external party to respond. */
    case "waiting": return { status: "awaiting_response" }
    /**
     * "Done" = work that's finished from the operator's perspective. Includes the new
     * `resolved` (work done, conversation stays active for follow-ups), `closed` (terminal),
     * and `converted` (turned into Cliente / Proyecto / Tarea). Storage's "Closed" sub-link
     * narrows this further to just `closed` for archival browsing.
     */
    case "done": return { status: "resolved,closed,converted" }
    /**
     * "To-do" is a placeholder for the future action queue. Routes to /inbox so the active
     * highlight works; `{}` returned here means no extra status filter is applied — the
     * page falls back to the default Inbox view. Replacing this single arm is all that's
     * needed when the To-do engine ships.
     */
    case "todo": return {}
    /** ─ Smart views ─ */
    case "opportunities": return { status: "lead_detected" }
    /**
     * "Scheduled" placeholder — will eventually filter by Message.metadata EventHint or by
     * ConversationAction.type === "create_event". Returning `{}` keeps the active highlight
     * working without breaking the list.
     */
    case "scheduled": return {}
    /** ─ Legacy aliases (preserve external bookmarks) ─ */
    case "new": return { status: "new" }
    case "in_progress": return { status: "assigned,awaiting_response,triaged" }
    case "urgent": return { urgency: "alta,critica" }
    case "needs_reply": return { status: "awaiting_response" }
    case "leads": return { status: "lead_detected" }
    default: return {}
  }
}

function InboxPageContent() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [channel, setChannel] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null)
  const [messageShortIntentsById, setMessageShortIntentsById] = useState<
    Record<string, Array<{ messageId: string; text: string }>>
  >({})
  const [messageIntentsLoadingId, setMessageIntentsLoadingId] = useState<string | null>(null)
  const loadedShortIntentIdsRef = useRef<Set<string>>(new Set())
  /** Mensaje seleccionado dentro del hilo activo (Phase 1: per-message selection plumbing). */
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  /** Marca el último `?messageId=` que aplicamos a `selectedMessageId` para no re-aplicar en bucle. */
  const lastAppliedMessageIdRef = useRef<string | null>(null)
  /**
   * Email reading mode (`chat` | `email`). Persisted in localStorage so the operator's
   * preference survives navigation and reloads. Default is `chat` to match the existing
   * behavior — flipping the default would surprise users with a single-email reader the
   * first time they open the inbox after deploy. Only consulted for email-channel
   * conversations; non-email channels always render the chat thread.
   */
  type EmailViewMode = "chat" | "email"
  const EMAIL_VIEW_MODE_STORAGE_KEY = "smart-inbox-email-view-mode"
  const [emailViewMode, setEmailViewMode] = useState<EmailViewMode>("chat")
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(EMAIL_VIEW_MODE_STORAGE_KEY)
      if (stored === "email" || stored === "chat") setEmailViewMode(stored)
    } catch { /* localStorage may be unavailable (private mode) — fall back to default */ }
  }, [])
  const handleEmailViewModeChange = useCallback((mode: EmailViewMode) => {
    setEmailViewMode(mode)
    if (typeof window === "undefined") return
    try { window.localStorage.setItem(EMAIL_VIEW_MODE_STORAGE_KEY, mode) }
    catch { /* swallow — toggle still works in-memory for this session */ }
  }, [])
  /**
   * Acting on scope: controla qué mensaje/contexto usan los tools del composer.
   *  - "latest": último mensaje relevante (default)
   *  - "selected": mensaje actualmente seleccionado (requiere selectedMessageId)
   *  - "all": toda la conversación
   * Se mantiene **ortogonal** a `selectedMessageId` para no perder el highlight.
   */
  type ActingOnScope = "latest" | "selected" | "all"
  const [actingOnScope, setActingOnScope] = useState<ActingOnScope>("latest")
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionState, setActionState] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [handoffState, setHandoffState] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replyIsInternal, setReplyIsInternal] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [replyStatus, setReplyStatus] = useState<string | null>(null)
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")
  /**
   * Work / intent filter (Phase 4 — companion of scope-aware More actions). Reads
   * Message.metadata.intentStatus persisted by the "Mark as done" action; we don't store any
   * second source of truth. Filtering runs client-side on the loaded page (the list endpoint
   * already returns the most recent messages per conversation, which is enough to evaluate
   * the latest inbound's intent status). A future phase can move this server-side without
   * changing the UI contract.
   */
  const [intentStatusFilter, setIntentStatusFilter] = useState<"all" | "open" | "done">("all")
  /**
   * Sender / remitente filter. Value is `"all"` or `contact.id`. Options are derived from the
   * loaded list — when the loaded page has no contacts (empty inbox), the select is hidden
   * by the ConversationList component to keep the bar uncrowded.
   */
  const [senderFilter, setSenderFilter] = useState<string>("all")
  /**
   * Workspace category filter (controlled by `<InboxTaxonomyChips>`).
   * `null` means "all categories"; otherwise the value is one of the
   * labels from `Workspace.config.taxonomies.inbox` (sanitised by
   * `core/workspace-taxonomies.ts`). Filtering runs CLIENT-SIDE on the
   * already loaded page — same pattern as `intentStatusFilter` and
   * `senderFilter` — to avoid a backend round-trip and to keep the
   * existing `/api/inbox/conversations` contract unchanged.
   */
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [autoPopulated, setAutoPopulated] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "thread">("list")
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [cannedOpen, setCannedOpen] = useState(false)
  const [pendingActionInput, setPendingActionInput] = useState<PendingActionInput | null>(null)
  const [dialogAssignValue, setDialogAssignValue] = useState("")
  const [dialogDismissReason, setDialogDismissReason] = useState("")
  const [fetchingEmails, setFetchingEmails] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTo, setComposeTo] = useState("")
  const [composeSubject, setComposeSubject] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [composeSending, setComposeSending] = useState(false)
  const [replyAttachments, setReplyAttachments] = useState<ComposerAttachment[]>([])
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [emailMode, setEmailMode] = useState<EmailSendMode>("reply")
  const [emailCc, setEmailCc] = useState("")
  const [emailBcc, setEmailBcc] = useState("")
  const [emailForwardTo, setEmailForwardTo] = useState("")
  /**
   * Phase 3: per-message receipt confirmation toggle. Lives in the page so it survives
   * composer re-renders (e.g. textarea grows, attachments change) and is cleared after each
   * send and on conversation switches just like CC/BCC/forward fields.
   */
  const [requestConfirmation, setRequestConfirmation] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  /**
   * Structured fetch feedback. Replaces the previous "silent toast" behaviour where a
   * `NO_CONNECTION` error or a stale IMAP cursor was indistinguishable from a successful
   * "0 new" sync. Levels:
   *  - "success" → ingested ≥ 1, banner auto-clears.
   *  - "info"    → ingested = 0 (no new email). Sticky-on-empty so the operator knows the
   *                request did run; auto-clears after a short delay.
   *  - "warning" → connection inactive / push-only provider / cursor reset. Sticky until the
   *                operator dismisses it or runs another fetch.
   *  - "error"   → no connection, transport error, IMAP error count > 0. Sticky.
   */
  type FetchFeedbackLevel = "success" | "info" | "warning" | "error"
  interface FetchFeedback {
    level: FetchFeedbackLevel
    message: string
    detail?: string | null
    /** Hint shown when ingested>0 but the operator is in a filter that hides new mail. */
    visibilityHint?: string | null
  }
  const [fetchFeedback, setFetchFeedback] = useState<FetchFeedback | null>(null)
  /** Auto-clear successful / info feedback after ~5s; sticky levels survive. */
  useEffect(() => {
    if (!fetchFeedback) return
    if (fetchFeedback.level !== "success" && fetchFeedback.level !== "info") return
    const tid = setTimeout(() => setFetchFeedback(null), 5000)
    return () => clearTimeout(tid)
  }, [fetchFeedback])
  const initialSyncDoneRef = useRef(false)
  const lastAutoPopulatedDraftRef = useRef<string | null>(null)
  const activeDraftIdRef = useRef<string | null>(null)
  const replyContentRef = useRef("")
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [extraConversations, setExtraConversations] = useState<ConversationListItem[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pendingComposerFocusRef = useRef(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const deepLinkId = searchParams.get("id")
  const deepLinkMessageId = searchParams.get("messageId")
  const sidebarFilter = searchParams.get("filter")
  const filterParams = useMemo(() => mapSidebarFilter(sidebarFilter), [sidebarFilter])
  /**
   * TODO(inbox-tasks): Inbox no longer owns a visible To-do mode. Even when a
   * legacy URL still carries `?filter=todo`, the page falls back to the normal
   * Inbox conversation list so the right-hand panel stays focused on triage and
   * the global Tasks/WorkspaceTask + Today surfaces own all task UI.
   *
   * `isTodoMode` is forced to `false` so the `<InboxTodoList>` branch never
   * mounts. We deliberately keep the surrounding state, fetchers, and handlers
   * (`todos`, `todosLoading`, `setTodosRefreshKey`, `handleSelectTodo`,
   * `handleToggleTodoDone`, `handleDismissTodo`, `handleRefreshTodos`,
   * `handleCreateTodoFromPendingItem`, etc.) because Smart Hub pending-item
   * conversion, the composer's More-actions "add to To-do", and the per-
   * conversation triage refresh keys still rely on them to write
   * `WorkspaceTask` rows behind the scenes. Removing those is a follow-up PR.
   */
  const isTodoMode = false
  const lastDeepLinkRef = useRef<string | null>(null)

  /**
   * Primary work filter (chip strip on top of ConversationList) — derived from the URL
   * `?filter=` so the chips and the sidebar Work group are always the same source of
   * truth. Anything outside the four daily values (Inbox, Trash, Archived, Opportunities,
   * To-do, Scheduled, Closed, etc.) maps to "other" so no chip is highlighted; the
   * sidebar already shows the operator where they are.
   */
  type PrimaryWorkFilter = "all" | "needs_action" | "waiting" | "done" | "other"
  const primaryWorkFilter: PrimaryWorkFilter = useMemo(() => {
    if (!sidebarFilter || sidebarFilter === "inbox") return "all"
    if (sidebarFilter === "needs_action") return "needs_action"
    if (sidebarFilter === "waiting") return "waiting"
    if (sidebarFilter === "done") return "done"
    return "other"
  }, [sidebarFilter])

  /**
   * Chip click → URL change. Preserve all other search params (e.g. `?id=`, `?messageId=`)
   * so deep links survive a chip click. Using `router.replace` keeps the back button
   * sane: chip changes are not separate history entries, the operator can still go
   * back to where they came from.
   */
  const handlePrimaryWorkFilterChange = useCallback(
    (value: "all" | "needs_action" | "waiting" | "done") => {
      const next = new URLSearchParams(searchParams.toString())
      if (value === "all") next.delete("filter")
      else next.set("filter", value)
      const qs = next.toString()
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams],
  )

  /**
   * To-do list state. Held locally instead of via `useFetch` because we need optimistic
   * mutations (mark done / dismiss) and a simple `refresh` trigger. Filter is fixed to
   * `open,waiting` for the MVP — Phase 5 will surface "All / Today / Overdue" sub-tabs.
   */
  const [todos, setTodos] = useState<ClientInboxTodo[]>([])
  const [todosLoading, setTodosLoading] = useState(false)
  const [todosError, setTodosError] = useState<string | null>(null)
  const [todosRefreshKey, setTodosRefreshKey] = useState(0)
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [busyTodoId, setBusyTodoId] = useState<string | null>(null)
  /**
   * Triage Summary: open To-do count for the *currently selected* conversation. We keep this
   * separate from `todos` (which is only loaded in `isTodoMode`) so the counter stays fresh
   * regardless of the current view. The fetch is scoped server-side (`?conversationId=...&
   * status=open,waiting`) so we never load the workspace-wide list just to render a number.
   * Reset to `0` when no conversation is selected and re-run when `todosRefreshKey` bumps so
   * creating a To-do from the panel updates the chip without a full refetch.
   */
  const [conversationTodoCount, setConversationTodoCount] = useState(0)
  /**
   * Phase 3 To-do capture — transient state used by the three capture surfaces:
   *  - `creatingTodoFromMessage`: lock guard against double-click on the More menu entries.
   *  - `internalNoteTodoSuggestion`: holds the candidate To-do parsed from a just-saved internal
   *    note when its content matches `TODO:` / `To-do:` / `Pendiente:`. The banner clears on
   *    accept, dismiss, conversation switch, or the next internal note. Storing it as a small
   *    object (rather than booleans) keeps the banner stateless re-render-wise.
   */
  const [creatingTodoFromMessage, setCreatingTodoFromMessage] = useState(false)
  const [internalNoteTodoSuggestion, setInternalNoteTodoSuggestion] = useState<
    | {
        conversationId: string
        noteMessageId: string | null
        title: string
      }
    | null
  >(null)
  const [internalNoteTodoBusy, setInternalNoteTodoBusy] = useState(false)
  /** Generic transient banner for "✓ To-do created" feedback after capture from any surface. */
  const [todoCaptureFeedback, setTodoCaptureFeedback] = useState<string | null>(null)
  /** Auto-clear the feedback after ~3.5s so it doesn't linger across the operator's eye. */
  useEffect(() => {
    if (!todoCaptureFeedback) return
    const tid = setTimeout(() => setTodoCaptureFeedback(null), 3500)
    return () => clearTimeout(tid)
  }, [todoCaptureFeedback])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.authenticated && json.user?.userId) setCurrentUserId(json.user.userId)
        if (json.authenticated && typeof json.user?.email === "string") {
          setCurrentUserEmail(json.user.email)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    fetch("/api/inbox/workspace-members")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) setMembers(json.data)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (initialSyncDoneRef.current) return
    initialSyncDoneRef.current = true
    fetch("/api/inbox/fetch", { method: "POST" })
      .then((r) => r.json())
      .then((json) => {
        setLastSyncedAt(new Date())
        if (json.data?.count > 0) {
          setRefreshKey((v) => v + 1)
        }
      })
      .catch(() => null)
  }, [])

  const PAGE_SIZE = 50

  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (status === "triaged") setStatus("all")
  }, [status])

  /** Desplegable "All statuses" gana frente a `?filter=` en la URL (no forzar status desde sidebar en la API). */
  const handleListStatusFilterChange = useCallback(
    (value: string) => {
      setStatus(value)
      if (value === "all") {
        const p = new URLSearchParams(searchParams.toString())
        p.delete("filter")
        const qs = p.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      }
    },
    [router, pathname, searchParams],
  )

  const params = new URLSearchParams()
  params.set("pageSize", String(PAGE_SIZE))
  if (debouncedSearch) params.set("q", debouncedSearch)
  /**
   * Status precedence: the explicit top filter wins over the sidebar URL filter. If the
   * operator leaves the dropdown on "all" we fall through to whatever the sidebar declares
   * (`?filter=archived` → status=archived, `?filter=trash` → status=trashed, etc.). This is
   * what makes sidebar entries actually filter the list — before this they only set the URL
   * but the query never picked up `filterParams.status`, so e.g. clicking "Archived" looked
   * decorative.
   */
  if (status !== "all") {
    params.set("status", status)
  } else if (filterParams.status) {
    params.set("status", filterParams.status)
  }
  if (filterParams.urgency) params.set("urgency", filterParams.urgency)
  if (channel !== "all") params.set("channel", channel)
  if (assignmentFilter === "mine" && currentUserId) params.set("assignedTo", currentUserId)
  if (assignmentFilter === "unassigned") params.set("assignedTo", "unassigned")
  /**
   * Workspace category filter (selected via `<InboxTaxonomyChips>`). Sent to
   * the server so filtering + counts + pagination all operate on the full
   * result set — the previous client-side filter only saw the loaded page and
   * silently hid matches living on later pages. `null` = "all" (no param).
   */
  if (categoryFilter) params.set("category", categoryFilter)

  const LIST_POLL_INTERVAL = 60_000

  const {
    data: conversationsData,
    meta: conversationsMeta,
    loading,
    error,
    errorCode,
    refetch,
  } = useFetch<ConversationListItem[]>(`/api/inbox/conversations?${params.toString()}`, { refreshKey, pollInterval: LIST_POLL_INTERVAL })

  const baseConversations = useMemo(
    () => (Array.isArray(conversationsData) ? conversationsData : []),
    [conversationsData],
  )
  const conversations = useMemo(
    () => [...baseConversations, ...extraConversations],
    [baseConversations, extraConversations],
  )

  /**
   * Vista “All statuses”: ocultar cerradas/archivadas/papelera en la lista principal.
   * Rescate: si ese filtro deja 0 filas pero la API sí devolvió conversaciones (p. ej. todas archivadas),
   * mostrar la lista completa para no vaciar el inbox.
   *
   * Excepción: si la sidebar está pidiendo explícitamente un status (?filter=archived|trash|...),
   * ya hicimos pasar ese status al backend, así que confiamos en lo que devolvió y no aplicamos
   * el strip cliente — si no, el operador haría click en "Trash" y vería 0 filas porque
   * estaríamos re-ocultando justo lo que la API acaba de filtrar.
   */
  const conversationsForSidebar = useMemo(() => {
    if (status !== "all") return conversations
    if (filterParams.status) return conversations
    const filtered = conversations.filter(
      (c) => c.status !== "archived" && c.status !== "closed" && c.status !== "trashed",
    )
    if (filtered.length === 0 && conversations.length > 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[inbox] sidebar rescue: todas las conversaciones son archived/closed/trashed — mostrando lista completa", {
          total: conversations.length,
          statuses: [...new Set(conversations.map((c) => c.status))],
        })
      }
      return conversations
    }
    return filtered
  }, [conversations, status, filterParams.status])

  /**
   * Lista única para pintar/seleccionar/navegar: mismo filtro que `conversationsForSidebar`,
   * pero si ese filtro deja 0 filas y la API sí devolvió datos, degradamos a `conversations`.
   */
  const conversationsForList = useMemo(() => {
    if (conversations.length === 0) return []
    if (conversationsForSidebar.length > 0) return conversationsForSidebar
    return conversations
  }, [conversations, conversationsForSidebar])

  /**
   * Sender options for the Sender / remitente filter — derived from the *currently loaded*
   * list (no extra fetch). We dedupe by `contact.id` and prefer name → email → "Unknown" for
   * the visible label. Hidden when the list yields none, so the filter bar stays compact.
   */
  const senderOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string; sortKey: string }>()
    for (const c of conversations) {
      const contact = (c as { contact?: { id?: string | null; nombre?: string | null; email?: string | null } | null }).contact
      const id = contact?.id ? String(contact.id) : null
      if (!id) continue
      if (seen.has(id)) continue
      const name = typeof contact?.nombre === "string" && contact.nombre.trim() ? contact.nombre.trim() : null
      const email = typeof contact?.email === "string" && contact.email.trim() ? contact.email.trim() : null
      const label = name ?? email ?? "Unknown sender"
      seen.set(id, { value: id, label, sortKey: label.toLowerCase() })
    }
    return [...seen.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ value, label }) => ({ value, label }))
  }, [conversations])

  /**
   * Apply the client-side Work + Sender filters on top of the existing server-side filters.
   * Both are intentionally client-side: the Work filter depends on `Message.metadata.intentStatus`
   * (a JSON sub-field that SQLite cannot index efficiently), and Sender filtering is trivially
   * cheap on the loaded page. A future phase can lift either to the server without breaking
   * this UI contract.
   */
  const conversationsAfterUserFilters = useMemo(() => {
    if (intentStatusFilter === "all" && senderFilter === "all") {
      return conversationsForList
    }

    return conversationsForList.filter((c) => {
      if (senderFilter !== "all") {
        const contactId = (c as { contact?: { id?: string | null } | null }).contact?.id ?? null
        if (contactId !== senderFilter) return false
      }
      if (intentStatusFilter !== "all") {
        const status = inferConversationIntentStatus(c)
        if (intentStatusFilter === "done" && status !== "done") return false
        if (intentStatusFilter === "open" && status === "done") return false
      }
      return true
    })
  }, [conversationsForList, intentStatusFilter, senderFilter])

  /** True cuando en "All" ninguna fila pasa el filtro activo (todo archivo/cerrado/papelera) y el rescate muestra la lista completa. */
  const inboxTerminalRescueActive = useMemo(() => {
    if (status !== "all" || conversations.length === 0) return false
    const activeRows = conversations.filter(
      (c) => c.status !== "archived" && c.status !== "closed" && c.status !== "trashed",
    )
    return activeRows.length === 0
  }, [conversations, status])

  /** Temporal (solo dev): distribución real de status en la respuesta de lista cuando la vista es "All". */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    if (status !== "all") return
    const counts: Record<string, number> = {}
    for (const c of conversations) {
      counts[c.status] = (counts[c.status] ?? 0) + 1
    }
    console.log("[inbox:status-distribution]", {
      total: conversations.length,
      counts,
      terminalRescueActive: inboxTerminalRescueActive,
      sidebarFilterFromUrl: sidebarFilter,
    })
  }, [status, conversations, inboxTerminalRescueActive, sidebarFilter])

  const filterKey = `${debouncedSearch}|${status}|${channel}|${assignmentFilter}|${currentUserId}|${sidebarFilter}|${refreshKey}`
  const filterKeyRef = useRef(filterKey)
  useEffect(() => {
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey
      setExtraConversations([])
      setCurrentPage(1)
    }
  }, [filterKey])

  const serverTotal = typeof conversationsMeta?.total === "number" ? conversationsMeta.total : null
  const hasMore = serverTotal !== null && conversations.length < serverTotal

  const isWorkspaceUnavailable = errorCode === "NO_WORKSPACE"
  const isGenericListFailure = errorCode === "INTERNAL_ERROR"
  const listErrorMessage =
    isWorkspaceUnavailable
      ? "Inbox is not available yet for this workspace."
      : isGenericListFailure
        ? "Inbox could not load conversations right now."
      : error

  const activeSelectedId = useMemo(() => {
    if (deepLinkId && conversations.some((item) => item.id === deepLinkId)) {
      return deepLinkId
    }
    if (selectedId && conversationsForList.some((item) => item.id === selectedId)) {
      return selectedId
    }

    return conversationsForList[0]?.id ?? null
  }, [conversations, conversationsForList, deepLinkId, selectedId])

  /** Logs temporales (dev): origen del vacío — API vs filtro vs selección */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    console.log("[inbox:client]", {
      listLength: conversations.length,
      sidebarLength: conversationsForSidebar.length,
      statusFilter: status,
      deepLinkId,
      selectedId,
      activeSelectedId,
      assignmentFilter,
      sidebarFilterParam: sidebarFilter,
    })
  }, [
    conversations.length,
    conversationsForSidebar.length,
    status,
    deepLinkId,
    selectedId,
    activeSelectedId,
    assignmentFilter,
    sidebarFilter,
  ])

  /** Quitar ?id= / ?messageId= inválidos cuando la lista ya cargó (evita estado stale). */
  useEffect(() => {
    if (loading) return
    const cid = searchParams.get("id")?.trim()
    if (!cid) return
    if (conversations.length === 0) return
    if (conversations.some((c) => c.id === cid)) return
    const p = new URLSearchParams(searchParams.toString())
    p.delete("id")
    p.delete("messageId")
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    if (process.env.NODE_ENV === "development") {
      console.warn("[inbox] removed stale conversation id from URL", { cid })
    }
  }, [loading, conversations, searchParams, pathname, router])

  useEffect(() => {
    if (deepLinkId && deepLinkId !== lastDeepLinkRef.current) {
      lastDeepLinkRef.current = deepLinkId
      if (conversations.some((c) => c.id === deepLinkId)) {
        setSelectedId(deepLinkId)
        setMobileView("thread")
        return
      }
    }

    /**
     * Skip the conversation-driven auto-select while in To-do mode: selection is driven by the
     * todo list there, and snapping to the first conversation in the loaded list would fight the
     * operator's todo click. The deep-link branch above still resolves `?id=` set by todo clicks.
     */
    if (isTodoMode) return

    if (!selectedId && conversationsForList.length > 0) {
      setSelectedId(conversationsForList[0].id)
    }
    if (selectedId && !conversationsForList.some((item) => item.id === selectedId)) {
      setSelectedId(conversationsForList[0]?.id ?? null)
    }
  }, [conversationsForList, selectedId, deepLinkId, isTodoMode, conversations])

  useEffect(() => {
    setReplyContent("")
    setReplyIsInternal(false)
    setReplyStatus(null)
    setAutoPopulated(false)
    setContextSheetOpen(false)
    setCannedOpen(false)
    setRequestConfirmation(false)
    lastAutoPopulatedDraftRef.current = null
    /** Reset de selección por-mensaje al cambiar de conversación. El siguiente effect re-aplica `?messageId=` si sigue siendo válido. */
    setSelectedMessageId(null)
    lastAppliedMessageIdRef.current = null
    if (!activeSelectedId) {
      setMobileView("list")
    }
    if (activeSelectedId) {
      fetch(`/api/inbox/conversations/${activeSelectedId}/read`, { method: "POST" }).catch(() => null)
    }
  }, [activeSelectedId])

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    errorCode: detailErrorCode,
    meta: detailMeta,
    refetch: refetchDetail,
  } = useFetch<ConversationDetail>(
    activeSelectedId ? `/api/inbox/conversations/${activeSelectedId}` : null,
    { refreshKey },
  )

  const uiLocale: SupportedLocale = parseLocale(
    (typeof conversationsMeta?.locale === "string" && conversationsMeta.locale)
      ? conversationsMeta.locale
      : typeof detailMeta?.locale === "string"
        ? detailMeta.locale
        : undefined,
  )

  const isDetailWorkspaceUnavailable = detailErrorCode === "NO_WORKSPACE"
  const isGenericDetailFailure = detailErrorCode === "INTERNAL_ERROR"
  const detailErrorMessage =
    isDetailWorkspaceUnavailable
      ? "This conversation is not available until a workspace is active."
      : isGenericDetailFailure
        ? "This conversation could not be loaded right now."
        : detailError
  /** Solo usar detalle si coincide con la selección (evita mensajes vacíos / datos de otra conversación durante la carga). */
  const selected =
    activeSelectedId &&
    detailData &&
    detailData.id === activeSelectedId
      ? detailData
      : null

  /**
   * URL → state: aplica `?messageId=` cuando llega el detalle, una sola vez por valor de URL,
   * y solo si pertenece al hilo cargado (evita resaltar un mensaje fantasma).
   */
  useEffect(() => {
    if (!selected) return
    if (!deepLinkMessageId) {
      lastAppliedMessageIdRef.current = null
      return
    }
    if (lastAppliedMessageIdRef.current === deepLinkMessageId) return
    if (!selected.messages?.some((m) => m.id === deepLinkMessageId)) return
    lastAppliedMessageIdRef.current = deepLinkMessageId
    setSelectedMessageId(deepLinkMessageId)
  }, [selected, deepLinkMessageId])

  /**
   * state → URL: mantiene `?messageId=` sincronizado con `selectedMessageId`.
   * Es idempotente: si la URL ya tiene el mismo valor, no hace nada.
   */
  useEffect(() => {
    const current = searchParams.get("messageId")
    if ((selectedMessageId ?? null) === (current ?? null)) return
    const params = new URLSearchParams(searchParams.toString())
    if (selectedMessageId) params.set("messageId", selectedMessageId)
    else params.delete("messageId")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [selectedMessageId, searchParams, pathname, router])

  /**
   * Acting on auto-tracking:
   *  - Si el usuario tiene scope "latest" y selecciona un mensaje → cambiamos a "selected" (UX intuitiva).
   *  - Si el usuario tiene scope "selected" y se queda sin mensaje seleccionado → fallback a "latest".
   *  - "all" siempre permanece manual hasta que el usuario lo cambie de nuevo.
   */
  useEffect(() => {
    if (selectedMessageId && actingOnScope === "latest") {
      setActingOnScope("selected")
    } else if (!selectedMessageId && actingOnScope === "selected") {
      setActingOnScope("latest")
    }
  }, [selectedMessageId, actingOnScope])

  replyContentRef.current = replyContent

  useEffect(() => {
    if (!selected?.drafts?.length || !selected?.messages?.length) return
    if (replyContentRef.current.trim()) return

    /**
     * Anchor de auto-populate:
     *  - Si hay `selectedMessageId` válido → usamos ESE messageId (Phase 2: respuesta scoped al mensaje activo).
     *  - Si no, fallback al comportamiento previo: solo auto-populate cuando el ÚLTIMO mensaje sea inbound.
     */
    let anchorMessageId: string | null = null
    if (selectedMessageId && selected.messages.some((m) => m.id === selectedMessageId)) {
      anchorMessageId = selectedMessageId
    } else {
      const lastMsg = selected.messages[selected.messages.length - 1]
      if (lastMsg.direction === "inbound") anchorMessageId = lastMsg.id
    }
    if (!anchorMessageId) return

    const draft = selected.drafts.find(
      (d) =>
        d.type === "ghost_reply" &&
        ["draft", "edited"].includes(d.status) &&
        d.sourceMessageId === anchorMessageId &&
        d.content?.trim(),
    )
    if (!draft) return
    if (lastAutoPopulatedDraftRef.current === draft.id) return

    const confidence = selected.handoff?.confidence ?? 0
    if (confidence < 0.75) return

    lastAutoPopulatedDraftRef.current = draft.id
    activeDraftIdRef.current = draft.id
    setReplyContent(draft.content)
    setAutoPopulated(true)
  }, [selected, selectedMessageId])

  /**
   * Inbox-level aggregate stats (`leads`, `urgent`, `done`, `trash`, …) used to be
   * computed here and passed down to `<ConversationList stats={…}>` for header
   * counters. After lifting filters/search/fetch into `<InboxToolbar>` and reducing
   * the list to a pure listing surface, no surface consumes these counts anymore.
   * The block was removed (along with `serverLeads` / `serverUrgent`) instead of
   * being kept as dead code; if a future feature needs the counters they can be
   * re-derived from `conversations` at the call site.
   */

  /**
   * Phase 2 — confirm-and-create internal Evento from a Smart Inbox `create_event` action.
   *
   * Reuses the existing approve+execute pipeline so we don't proliferate inbox-specific
   * endpoints. The override payload is sent under `event` so `executeConversationAction`
   * can merge it on top of the persisted EventHint.
   *
   * Resolves on success / rejects with a human-readable message that the dialog displays
   * inline. We also refetch the conversation detail so the executed action's status badge
   * updates and the Smart action CTA hides itself via the `isCreateEventActionExecuted`
   * guard.
   */
  const handleCreateCalendarEvent = useCallback(
    async (actionId: string, payload: CreateCalendarEventInput) => {
      if (!selectedId) {
        throw new Error("No conversation selected")
      }

      setPendingActionId(actionId)
      setActionState("Creating event…")

      try {
        const approveRes = await fetch(
          `/api/inbox/conversations/${selectedId}/actions/${actionId}/approve`,
          { method: "POST" },
        )
        const approveJson = await approveRes.json()
        /**
         * The approve route refuses to re-approve `executed`/`failed` actions. For an action
         * that is already executed (idempotent re-click), we still want to surface the
         * existing event — `executeConversationAction` short-circuits in that case — so we
         * skip the approve guard's error and fall through to execute.
         */
        if (!approveJson.success) {
          const reason: string = approveJson.error?.message ?? ""
          const looksLikeAlreadyAdvanced = /no puede aprobarse/i.test(reason)
          if (!looksLikeAlreadyAdvanced) {
            throw new Error(reason || "Could not approve calendar action")
          }
        }

        const execRes = await fetch(
          `/api/inbox/conversations/${selectedId}/actions/${actionId}/execute`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: payload }),
          },
        )
        const execJson = await execRes.json()
        if (!execJson.success) {
          throw new Error(execJson.error?.message || "Could not create event")
        }

        const alreadyExecuted = (execJson.data?.results as { alreadyExecuted?: boolean } | undefined)
          ?.alreadyExecuted === true
        setActionState(alreadyExecuted ? "Event already created" : "Event created")
        setRefreshKey((value) => value + 1)
        refetch()
        refetchDetail()
      } finally {
        setPendingActionId(null)
      }
    },
    [selectedId, refetch, refetchDetail],
  )

  async function handleConvert(action: "cliente" | "proyecto" | "tarea" | "todo") {
    if (!selectedId) return

    setActionState("Processing...")
    try {
      /**
       * Acting on integration:
       * - "all"     → omit sourceMessageId so the backend uses conversation-level behaviour
       *               (its existing "first inbound" fallback). The operator explicitly opted
       *               into whole-conversation context, so we do NOT bias by selection.
       * - "selected"→ pass the operator's selected message as anchor.
       * - "latest"  → also pass selected if any (covers the auto-track case where selecting
       *               a message bumped scope to "selected"); otherwise omit and let the
       *               service fall back to first inbound, same as before.
       */
      const scopedMessageId = actingOnScope === "all" ? null : (effectiveSelectedMessageId ?? null)
      const res = await fetch(`/api/inbox/conversations/${selectedId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(scopedMessageId ? { sourceMessageId: scopedMessageId } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Action failed")

      setActionState("Action applied")
      setRefreshKey((value) => value + 1)
      refetch()
      refetchDetail()
    } catch (err) {
      setActionState(err instanceof Error ? err.message : "Unknown error")
    }
  }

  function openActionDialog(action: { id: string; type: string; status: string }, operation: "approve_and_execute" | "execute" | "dismiss", dialogType: "assign" | "dismiss") {
    setDialogAssignValue("")
    setDialogDismissReason("")
    setPendingActionInput({ action, operation, dialogType })
  }

  async function executeActionWithPayload(action: { id: string; type: string; status: string }, operation: "approve" | "dismiss" | "execute" | "approve_and_execute", payload: Record<string, unknown>) {
    if (!selectedId) return

    if (operation === "approve_and_execute") {
      setPendingActionId(action.id)
      setActionState("Approving...")
      try {
        const approveRes = await fetch(`/api/inbox/conversations/${selectedId}/actions/${action.id}/approve`, { method: "POST" })
        const approveJson = await approveRes.json()
        if (!approveJson.success) throw new Error(approveJson.error?.message || "Could not approve action")

        setActionState("Executing...")
        const execRes = await fetch(`/api/inbox/conversations/${selectedId}/actions/${action.id}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
        })
        const execJson = await execRes.json()
        if (!execJson.success) throw new Error(execJson.error?.message || "Could not execute action")

        setActionState("Action approved and executed")
        setRefreshKey((v) => v + 1)
        refetch()
        refetchDetail()
      } catch (err) {
        setActionState(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setPendingActionId(null)
      }
      return
    }

    setPendingActionId(action.id)
    setActionState("Processing action...")

    try {
      const endpoint =
        operation === "approve"
          ? `/api/inbox/conversations/${selectedId}/actions/${action.id}/approve`
          : operation === "dismiss"
            ? `/api/inbox/conversations/${selectedId}/actions/${action.id}/dismiss`
            : `/api/inbox/conversations/${selectedId}/actions/${action.id}/execute`

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not perform the action")

      setActionState(
        operation === "approve"
          ? "Action approved"
          : operation === "dismiss"
            ? "Action dismissed"
            : "Action executed",
      )
      setRefreshKey((value) => value + 1)
      refetch()
      refetchDetail()
    } catch (err) {
      setActionState(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleSuggestedAction(action: { id: string; type: string; status: string }, operation: "approve" | "dismiss" | "execute" | "approve_and_execute") {
    if (!selectedId) return

    if (operation === "approve_and_execute" && action.type === "assign_operator") {
      openActionDialog(action, operation, "assign")
      return
    }

    if (operation === "execute" && action.type === "assign_operator") {
      openActionDialog(action, operation, "assign")
      return
    }

    if (operation === "dismiss") {
      openActionDialog(action, operation, "dismiss")
      return
    }

    await executeActionWithPayload(action, operation, {})
  }

  function handleDialogConfirm() {
    if (!pendingActionInput) return
    const { action, operation, dialogType } = pendingActionInput

    if (dialogType === "assign") {
      if (!dialogAssignValue.trim()) return
      executeActionWithPayload(action, operation, { assignedTo: dialogAssignValue.trim() })
    } else {
      const payload = dialogDismissReason.trim() ? { executionNotes: dialogDismissReason.trim() } : {}
      executeActionWithPayload(action, operation, payload)
    }

    setPendingActionInput(null)
  }

  async function updateHandoff(payload: Record<string, unknown>, successMessage = "Handoff updated") {
    if (!selectedId) return
    setHandoffState("Saving handoff...")
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/handoff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not save the handoff")
      setHandoffState(successMessage)
      setRefreshKey((value) => value + 1)
      refetchDetail()
    } catch (err) {
      setHandoffState(err instanceof Error ? err.message : "Unknown error")
      throw err
    }
  }

  async function updateDraft(draftId: string, payload: Record<string, unknown>, successMessage = "Draft updated") {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not save the draft")
      setRefreshKey((value) => value + 1)
      refetchDetail()
    } catch (err) {
      throw err
    }
  }

  async function sendReply() {
    if (!activeSelectedId || !replyContent.trim() || replySending) return

    const draftIdToMark = activeDraftIdRef.current

    setReplySending(true)
    setReplyStatus(null)
    try {
      const res = await fetch(`/api/inbox/conversations/${activeSelectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          direction: "outbound",
          isInternal: replyIsInternal,
          role: "operator",
          mode: replyIsInternal ? "reply" : emailMode,
          /** Phase 2: ata la respuesta al mensaje real (seleccionado o último inbound). */
          ...(effectiveSourceMessageId ? { sourceMessageId: effectiveSourceMessageId } : {}),
          ...(replyAttachments.length > 0 ? { attachments: replyAttachments } : {}),
          ...(!replyIsInternal && emailCc.trim() ? { cc: parseEmailList(emailCc) } : {}),
          ...(!replyIsInternal && emailBcc.trim() ? { bcc: parseEmailList(emailBcc) } : {}),
          ...(!replyIsInternal && emailMode === "forward" && emailForwardTo.trim() ? { to: parseEmailList(emailForwardTo) } : {}),
          /** Phase 3 receipt confirmation. Server ignores the flag for internal notes / non-email channels defensively. */
          ...(!replyIsInternal && requestConfirmation ? { requestConfirmation: true } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not send message")

      if (draftIdToMark) {
        updateDraft(draftIdToMark, { status: "sent" }).catch(() => null)
        activeDraftIdRef.current = null
      }

      /**
       * Phase 3 — internal note TODO suggestion. Only triggers when the just-saved message
       * was an internal note AND its body starts with `TODO:` / `To-do:` / `Pendiente:`.
       * We don't auto-create the To-do silently: instead we surface a small banner above the
       * composer with a "Create To-do" CTA so the operator can opt in. Storing the noteMessageId
       * (when the API returns it) lets us pass `sourceNoteId` for traceability; if the response
       * doesn't include an id we still proceed but only attach `conversationId`.
       */
      if (replyIsInternal && activeSelectedId) {
        const todoTitle = detectInternalNoteTodo(replyContent.trim())
        if (todoTitle) {
          const noteMessageId =
            (typeof json?.data?.id === "string" && json.data.id) ||
            (typeof json?.message?.id === "string" && json.message.id) ||
            null
          setInternalNoteTodoSuggestion({
            conversationId: activeSelectedId,
            noteMessageId,
            title: truncateForTitle(todoTitle, 200),
          })
        }
      }

      setReplyContent("")
      setReplyIsInternal(false)
      setAutoPopulated(false)
      setReplyAttachments([])
      setEmailMode("reply")
      setEmailCc("")
      setEmailBcc("")
      setEmailForwardTo("")
      setRequestConfirmation(false)
      setRefreshKey((value) => value + 1)
      refetch()
      refetchDetail()

      if (replyIsInternal) {
        setReplyStatus("Note saved")
      } else if (json.meta?.emailSent === false) {
        setReplyStatus(`Reply saved — email failed: ${json.meta.emailError || "unknown error"}`)
      } else if (json.meta?.emailSent === true) {
        setReplyStatus("Reply sent — email delivered")
      } else {
        setReplyStatus("Reply sent")
      }
    } catch (err) {
      setReplyStatus(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setReplySending(false)
    }
  }

  async function handleAttachFiles(files: File[]) {
    setAttachmentUploading(true)
    const errors: string[] = []

    try {
      const uploads = await Promise.allSettled(
        files.map(async (file) => {
          const formData = new FormData()
          formData.append("file", file)
          const res = await fetch("/api/inbox/attachments/upload", { method: "POST", body: formData })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || `Upload failed: ${file.name}`)
          return { url: json.url, filename: json.filename, contentType: json.contentType, size: json.size } as ComposerAttachment
        }),
      )

      const succeeded: ComposerAttachment[] = []
      for (const result of uploads) {
        if (result.status === "fulfilled") succeeded.push(result.value)
        else errors.push(result.reason?.message || "Upload failed")
      }

      if (succeeded.length > 0) {
        setReplyAttachments((prev) => [...prev, ...succeeded])
      }
      if (errors.length > 0) {
        setReplyStatus(`${errors.length} file(s) failed: ${errors[0]}`)
      }
    } catch (err) {
      setReplyStatus(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setAttachmentUploading(false)
    }
  }

  function handleRemoveAttachment(url: string) {
    setReplyAttachments((prev) => prev.filter((a) => a.url !== url))
  }

  function parseEmailList(raw: string): string[] {
    return raw.split(",").map((s) => s.trim()).filter((s) => s.includes("@"))
  }

  const sendReplyRef = useRef(sendReply)
  sendReplyRef.current = sendReply

  async function loadMore() {
    if (loadingMore || !hasMore) return
    const nextPage = currentPage + 1
    const loadParams = new URLSearchParams(params.toString())
    loadParams.set("page", String(nextPage))
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/inbox/conversations?${loadParams.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && filterKeyRef.current === filterKey) {
        setExtraConversations((prev) => [...prev, ...json.data])
        setCurrentPage(nextPage)
      }
    } catch {
      // silent — user can retry via button
    } finally {
      setLoadingMore(false)
    }
  }

  const statusFilterOptions = useMemo(
    () =>
      STATUS_OPTIONS.filter((s) => s !== "triaged").map((s) => ({
        value: s,
        label: s === "all" ? "All statuses" : statusLabel(s, uiLocale),
      })),
    [uiLocale],
  )

  const statusEditOptions = useMemo(() => {
    if (selected?.status === "trashed") {
      return [{ value: "triaged", label: statusLabelDisplay("triaged", uiLocale) }]
    }
    const base = STATUS_OPTIONS.filter((s) => s !== "all" && s !== "triaged").map((s) => ({
      value: s,
      label: statusLabel(s, uiLocale),
    }))
    if (selected?.status === "triaged") {
      return [{ value: "triaged", label: statusLabelDisplay("triaged", uiLocale) }, ...base]
    }
    return base
  }, [selected?.status, uiLocale])

  const channelSelectOptions = CHANNEL_OPTIONS.map((option) => ({
    value: option,
    label: option === "all" ? "All channels" : channelLabel(option, uiLocale),
  }))

  const handleAssign = useCallback(async (newAssignedTo: string) => {
    if (!activeSelectedId) return
    const value = newAssignedTo === "" ? null : newAssignedTo
    setAssignSaving(true)
    try {
      const res = await fetch(`/api/inbox/conversations/${activeSelectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: value }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not assign")
      setRefreshKey((v) => v + 1)
      refetch()
      refetchDetail()
    } catch {
      // revert handled by refetch
    } finally {
      setAssignSaving(false)
    }
  }, [activeSelectedId, refetch, refetchDetail])

  async function handleStatusChange(newStatus: string) {
    if (!activeSelectedId) return
    try {
      const res = await fetch(`/api/inbox/conversations/${activeSelectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not update status")
      setRefreshKey((value) => value + 1)
      refetch()
      refetchDetail()
    } catch (err) {
      throw err
    }
  }

  const displayedMembers =
    selected?.assignedTo && !members.some((member) => member.userId === selected.assignedTo)
      ? [
          ...members,
          {
            userId: selected.assignedTo,
            nombre: "Unknown assignee",
            /** `assignedTo` es userId, no email — no mostrarlo como correo. */
            email: "",
            avatar: null,
            role: "unknown",
          },
        ]
      : members

  /**
   * Lookup map for the To-do view — `<InboxTodoList>` resolves contact + channel labels for each
   * todo's source conversation. Built off the same loaded conversations so we get full benefit of
   * the existing fetch and don't double-query. When a todo references a conversation that's not
   * in the loaded list (rare; archived/closed/trashed) the lookup returns undefined and the row
   * gracefully degrades to "Linked to a conversation" via the source icon tooltip.
   */
  const contactsByConversationId = useMemo(() => {
    const map: Record<string, { label: string | null; channelLabel: string | null }> = {}
    for (const conversation of conversations) {
      const contact = conversation.contact
      const label =
        contact?.nombre?.trim()
        || contact?.empresa?.trim()
        || contact?.email?.trim()
        || null
      map[conversation.id] = {
        label,
        channelLabel: channelLabel(conversation.channel, uiLocale),
      }
    }
    return map
  }, [conversations, uiLocale])

  const conversationItems = useMemo(() =>
    conversationsAfterUserFilters.map((conversation) => {
      try {
        const contact = conversation.contact
        const primaryTitle =
          contact?.nombre?.trim() ||
          contact?.empresa?.trim() ||
          contact?.email?.trim() ||
          "Contact"

        /**
         * Collapsed-row label refactor: dropped the AI-derived `senderIntent` here on purpose.
         * Per the new model the collapsed row only shows "who + what is this thread about", so
         * the secondary line is the structural Subject (when present) — short, fast to scan,
         * and never repeats the AI summary already visible in the expanded panel + the right
         * ContextPanel. The `firstShortIntentFromRecentMessages`/`formatSenderIntentPhrase`
         * helpers no longer feed this surface; they remain available in their modules for
         * other callers (Ask Fanny, intelligence) that still need the AI text.
         */
        const subject = conversation.subject?.trim() || null

        return {
          id: conversation.id,
          channel: conversation.channel,
          title: primaryTitle,
          subject,
          sectorLabel: conversation.classification?.sector?.trim() || null,
          timeLabel: formatRelativeDateCompact(conversation.lastMessageAt || new Date().toISOString(), uiLocale),
          isUnread: conversation.status === "new",
          conversationStatus: conversation.status,
          statusLabel: statusLabelDisplay(conversation.status, uiLocale),
          statusClassName: statusBadgeDisplay(conversation.status),
          channelLabel: channelLabel(conversation.channel, uiLocale),
          urgencyLabel: urgencyLabel(conversation.urgency, uiLocale),
          urgencyClassName: urgencyBadge(conversation.urgency),
          leadScore: conversation.leadScore,
          messageCount: conversation.messageCount ?? (conversation.messages?.length || 0),
          category: conversation.category ?? null,
          proposedTaskCount: conversation.proposedTaskCount ?? 0,
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[inbox:audit:render] conversationItems row failed", conversation?.id, e)
        }
        return {
          id: conversation.id,
          channel: conversation.channel,
          title: "Conversation",
          subject: null as string | null,
          sectorLabel: null as string | null,
          timeLabel: formatRelativeDateCompact(conversation.lastMessageAt || new Date().toISOString(), uiLocale),
          isUnread: conversation.status === "new",
          conversationStatus: conversation.status,
          statusLabel: statusLabelDisplay(conversation.status, uiLocale),
          statusClassName: statusBadgeDisplay(conversation.status),
          channelLabel: channelLabel(conversation.channel, uiLocale),
          urgencyLabel: urgencyLabel(conversation.urgency, uiLocale),
          urgencyClassName: urgencyBadge(conversation.urgency),
          leadScore: conversation.leadScore,
          messageCount: conversation.messageCount ?? (conversation.messages?.length || 0),
          category: conversation.category ?? null,
          proposedTaskCount: conversation.proposedTaskCount ?? 0,
        }
      }
    }),
    [conversationsAfterUserFilters, uiLocale],
  )

  const threadMessages =
    selected?.messages?.map((message) => {
      const isOutbound = message.direction === "outbound" && !message.isInternal
      const isInbound = message.direction === "inbound" && !message.isInternal
      const isInternal = message.isInternal
      const tone: "internal" | "outbound" | "inbound" | "system" = isInternal
        ? "internal"
        : isOutbound
          ? "outbound"
          : isInbound
            ? "inbound"
            : "system"

      let msgAttachments: Array<{ filename: string; url: string; contentType: string; size?: number }> | undefined
      let msgEmailMeta: { cc?: string[]; bcc?: string[]; to?: string[]; mode?: "reply" | "reply_all" | "forward" } | undefined
      let msgFromAddress: string | null = null
      /** Phase 2 open tracking — derived from Message.metadata only; no schema/joins required. */
      let msgEmailStatus: string | null = null
      let msgOpenedAt: string | null = null
      let msgLastOpenedAt: string | null = null
      let msgOpenProxy = false
      let msgOpenSuspect = false
      /** Phase 3 manual confirmation — only ever set when the customer clicked the CTA. */
      let msgConfirmedReadAt: string | null = null
      /** Soft-trash flag (Message.metadata.trashedAt). Drives the placeholder bubble + Restore. */
      let msgTrashed = false
      try {
        if (message.metadata) {
          const parsed = typeof message.metadata === "string" ? JSON.parse(message.metadata) : message.metadata
          if (Array.isArray(parsed?.attachments) && parsed.attachments.length > 0) {
            msgAttachments = parsed.attachments
          }
          const hasMeta = parsed?.cc || parsed?.bcc || parsed?.to || parsed?.mode ||
            parsed?.emailCc || parsed?.emailTo
          if (hasMeta) {
            msgEmailMeta = {
              cc: parsed.cc || parsed.emailCc || undefined,
              to: parsed.to || parsed.emailTo || undefined,
              mode: parsed.mode || undefined,
            }
          }
          if (typeof parsed?.fromAddress === "string" && parsed.fromAddress.trim()) {
            msgFromAddress = parsed.fromAddress.trim()
          }
          if (typeof parsed?.emailStatus === "string") msgEmailStatus = parsed.emailStatus
          if (typeof parsed?.openedAt === "string") msgOpenedAt = parsed.openedAt
          if (typeof parsed?.lastOpenedAt === "string") msgLastOpenedAt = parsed.lastOpenedAt
          if (parsed?.openProxy === true) msgOpenProxy = true
          if (parsed?.openSuspect === true) msgOpenSuspect = true
          if (typeof parsed?.confirmedReadAt === "string") msgConfirmedReadAt = parsed.confirmedReadAt
          if (typeof parsed?.trashedAt === "string" && parsed.trashedAt.length > 0) msgTrashed = true
        }
      } catch { /* ignore parse errors */ }

      const authorLabel = isInternal
        ? "Internal note"
        : isOutbound
          ? "Team"
          : selected?.contact?.nombre || selected?.contact?.email || "Contact"

      /**
       * Phase 2.5: cabecera "email-style" derivada con safety-first — cualquier campo ausente
       * se omite en el render del detail card; nunca asumimos estructura completa.
       */
      const contactNombre = selected?.contact?.nombre?.trim() || null
      const contactEmail = selected?.contact?.email?.trim() || null
      let fromLabel: string | null = null
      if (isInbound) {
        if (contactNombre && contactEmail) fromLabel = `${contactNombre} <${contactEmail}>`
        else fromLabel = contactNombre || contactEmail || authorLabel
      } else if (isOutbound) {
        fromLabel = msgFromAddress ? `${authorLabel} <${msgFromAddress}>` : authorLabel
      }

      let recipientsLabel: string | null = null
      const metaToList = msgEmailMeta?.to?.filter(Boolean) ?? []
      if (metaToList.length > 0) {
        recipientsLabel = metaToList.join(", ")
      } else if (isOutbound && contactEmail) {
        recipientsLabel = contactEmail
      }

      const subject = selected?.subject?.trim() || null

      let timestampFull: string | null = null
      try {
        const d = new Date(message.createdAt)
        if (!Number.isNaN(d.getTime())) {
          timestampFull = d.toLocaleString(uiLocale, { dateStyle: "long", timeStyle: "short" })
        }
      } catch { /* ignore date parse errors */ }

      /**
       * Outbound meta label honest-by-design (priority order):
       *  - "Send failed"            emailStatus=failed
       *  - "Confirmed received"     customer explicitly clicked the confirmation CTA — strongest
       *                             signal we have, overrides pixel-based heuristics.
       *  - "Opened · {time}"        openedAt set, no proxy/suspect heuristics fired
       *  - "Possibly opened"        openedAt set + proxy or suspect flag (prefetch / image proxy)
       *  - "Sent"                   default outbound — anything else
       * We deliberately avoid the word "Read" because pixel tracking can't prove the human read it.
       */
      let outboundLabel = "Sent"
      if (isOutbound) {
        if (msgEmailStatus === "failed") {
          outboundLabel = "Send failed"
        } else if (msgConfirmedReadAt) {
          const when = formatRelativeDate(msgConfirmedReadAt, uiLocale)
          outboundLabel = `Confirmed received · ${when}`
        } else if (msgOpenedAt) {
          const opened = msgLastOpenedAt ?? msgOpenedAt
          const when = formatRelativeDate(opened, uiLocale)
          outboundLabel = msgOpenProxy || msgOpenSuspect
            ? `Possibly opened · ${when}`
            : `Opened · ${when}`
        }
      }

      return {
        id: message.id,
        authorLabel,
        roleLabel: formatRoleLabel(message.role),
        metaLabel: isInternal
          ? "Internal note · Not sent to customer"
          : isOutbound
            ? outboundLabel
            : isInbound
              ? "Inbound"
              : "System",
        timestampLabel: formatRelativeDate(message.createdAt, uiLocale),
        content: message.content,
        tone,
        attachments: msgAttachments,
        emailMeta: msgEmailMeta,
        fromLabel,
        recipientsLabel,
        subject,
        timestampFull,
        trashed: msgTrashed,
      }
    }) ?? []

  const suggestedDraft =
    selected?.drafts?.find(
      (draft) => ["draft", "edited", "approved"].includes(draft.status) && draft.content?.trim(),
    ) ?? null

  /**
   * Último mensaje inbound (anchor por defecto si no hay selección por-mensaje). Se saltan
   * los mensajes soft-trasheados — el operador los hizo invisibles y no queremos que el
   * "Reply to latest" / "Mark latest as done" caiga sobre un placeholder.
   */
  const lastInboundMessageId = useMemo(() => {
    if (!selected?.messages?.length) return null
    for (let i = selected.messages.length - 1; i >= 0; i--) {
      const m = selected.messages[i]
      if (m.direction !== "inbound") continue
      if (isMessageTrashed(m.metadata)) continue
      return m.id
    }
    return null
  }, [selected])

  /**
   * `selectedMessageId` validado contra el detalle activo. Si no pertenece a la conversación
   * actualmente cargada, lo ignoramos (evita enviar un `sourceMessageId` inválido por race
   * entre el cambio de conversación y la llegada del nuevo detalle). Además, si el mensaje
   * existe pero está soft-trasheado, lo descartamos como anchor de envío — el bubble ya
   * muestra placeholder y el composer no debe apuntar a algo oculto. La selección visual la
   * limpia un effect aparte para mantener el estado y el efecto separados.
   */
  const effectiveSelectedMessageId = useMemo(() => {
    if (!selectedMessageId || !selected?.messages?.length) return null
    const msg = selected.messages.find((m) => m.id === selectedMessageId)
    if (!msg) return null
    if (isMessageTrashed(msg.metadata)) return null
    return selectedMessageId
  }, [selectedMessageId, selected])

  /** Prioridad: mensaje seleccionado válido → último inbound → null. */
  const effectiveSourceMessageId = effectiveSelectedMessageId ?? lastInboundMessageId

  /**
   * Ask Fanny / Talk to Fanny — anchor + mode derived from `actingOnScope`.
   *  - "selected" → message mode anchored at the operator's selection (when present).
   *  - "latest"   → message mode anchored at the latest inbound (typed-down auto-track keeps
   *                 selectedMessageId in sync, so we still prefer it when present).
   *  - "all"      → conversation mode, no anchor (Fanny weighs the recent message itself).
   * If there's no usable anchor (empty thread, etc.) we degrade to conversation mode.
   */
  const askAnchorMessageId: string | null = (() => {
    if (actingOnScope === "all") return null
    if (actingOnScope === "selected") return effectiveSelectedMessageId
    return effectiveSelectedMessageId ?? lastInboundMessageId
  })()
  const askMode: "message" | "conversation" = askAnchorMessageId ? "message" : "conversation"

  /**
   * Compute the message id the More panel's message-level actions should target. Mirrors the
   * Acting on rules but drops the "all" case (handled by the conversation panel instead). We
   * also reach into Message.metadata.intentStatus so the button can render disabled when the
   * target is already done — no extra fetch.
   */
  const moreActionsTargetMessageId: string | null = (() => {
    if (actingOnScope === "all") return null
    if (actingOnScope === "selected") return effectiveSelectedMessageId
    return lastInboundMessageId
  })()

  const moreActionsTargetIntentStatus: "done" | "open" | null = useMemo(() => {
    if (!moreActionsTargetMessageId) return null
    const raw = selected?.messages?.find((m) => m.id === moreActionsTargetMessageId) ?? null
    if (!raw?.metadata) return null
    try {
      const parsed = typeof raw.metadata === "string" ? JSON.parse(raw.metadata) : raw.metadata
      const value = (parsed as { intentStatus?: unknown } | null | undefined)?.intentStatus
      return value === "done" || value === "open" ? value : null
    } catch {
      return null
    }
  }, [moreActionsTargetMessageId, selected])

  /**
   * Vista compacta del target de la respuesta. Phase B: además del autor/snippet/hora, derivamos
   * signals client-side (shortIntent, direction booleana, has attachments, has link) que el panel
   * usa para "What this message means". Sin AI extra, sin endpoints nuevos.
   */
  const replyTarget = useMemo(() => {
    /** Acting on gate: solo poblar replyTarget cuando el scope es "selected". */
    if (actingOnScope !== "selected") return null
    if (!effectiveSelectedMessageId) return null
    const msg = threadMessages.find((m) => m.id === effectiveSelectedMessageId)
    if (!msg) return null
    const collapsed = msg.content?.trim().replace(/\s+/g, " ") ?? ""
    const snippet = collapsed.length > 120 ? `${collapsed.slice(0, 120)}…` : collapsed

    /** Raw message for direction + metadata.shortIntent fallback. */
    const rawMsg = selected?.messages?.find((m) => m.id === effectiveSelectedMessageId) ?? null

    /** Defensive read of metadata.shortIntent — metadata may be string, object, null or malformed. */
    let metaShortIntent: string | null = null
    try {
      if (rawMsg?.metadata) {
        const parsed = typeof rawMsg.metadata === "string" ? JSON.parse(rawMsg.metadata) : rawMsg.metadata
        const candidate = (parsed as { shortIntent?: unknown } | null | undefined)?.shortIntent
        if (typeof candidate === "string" && candidate.trim()) {
          metaShortIntent = candidate.trim()
        }
      }
    } catch {
      /* metadata corrupto: cae al fallback del map */
    }

    /** Fallback: usar el map ya cargado (mismo dato que pinta el left column). */
    let mappedShortIntent: string | null = null
    if (!metaShortIntent && selectedId) {
      const arr = messageShortIntentsById[selectedId]
      if (Array.isArray(arr)) {
        const hit = arr.find((entry) => entry.messageId === effectiveSelectedMessageId)
        if (hit?.text) mappedShortIntent = hit.text.trim() || null
      }
    }

    const shortIntent = metaShortIntent ?? mappedShortIntent ?? null

    const direction = typeof rawMsg?.direction === "string" ? rawMsg.direction : null
    const isInternal = Boolean(rawMsg?.isInternal)
    const isInbound = !isInternal && direction === "inbound"
    const isOutbound = !isInternal && direction === "outbound"

    const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0
    const hasLinks = typeof msg.content === "string" && /https?:\/\//i.test(msg.content)

    /**
     * Phase 1 calendar hint — only surface when the AI persisted a `create_event` action
     * anchored to THIS message AND the message itself is inbound non-internal. We refuse to
     * derive an EventHint for outbound or internal messages, even if a stale action somehow
     * exists, to keep the rule "Add to calendar = inbound only" honest.
     */
    let eventHint: SelectedMessageInfo["eventHint"] = null
    if (isInbound) {
      const candidate = (selected?.actions ?? []).find((action) =>
        action.type === "create_event"
        && action.status !== "dismissed"
        && action.status !== "failed"
        && action.sourceMessageId === effectiveSelectedMessageId,
      )
      const rawData = candidate?.data
      const innerData = (rawData as { data?: Record<string, unknown> } | null | undefined)?.data
      const hint = (innerData && typeof innerData === "object" ? innerData : rawData) as Record<string, unknown> | null | undefined
      if (hint && typeof hint === "object") {
        const startISO = typeof hint.startISO === "string" && hint.startISO.trim() ? hint.startISO : null
        const allDay = hint.allDay === true
        if (startISO || allDay) {
          eventHint = {
            title: typeof hint.title === "string" ? hint.title : "",
            startISO,
            endISO: typeof hint.endISO === "string" && hint.endISO.trim() ? hint.endISO : null,
            allDay,
            location: typeof hint.location === "string" && hint.location.trim() ? hint.location : null,
            purpose: typeof hint.purpose === "string" && hint.purpose.trim() ? hint.purpose : null,
            sourceMessageId: typeof hint.sourceMessageId === "string" ? hint.sourceMessageId : effectiveSelectedMessageId,
            confidence: typeof hint.confidence === "number" ? hint.confidence : null,
            actionId: candidate?.id ?? null,
          }
        }
      }
    }

    return {
      messageId: effectiveSelectedMessageId,
      authorLabel: msg.authorLabel,
      timestampLabel: msg.timestampLabel,
      snippet: snippet || null,
      shortIntent,
      direction,
      isInbound,
      isOutbound,
      hasAttachments,
      hasLinks,
      eventHint,
    }
  }, [actingOnScope, effectiveSelectedMessageId, threadMessages, selected, selectedId, messageShortIntentsById])

  /**
   * Phase 4: anchor "por defecto" cuando NO hay selección por-mensaje. Refleja `lastInboundMessageId`
   * que es el mismo fallback que usa `effectiveSourceMessageId` para el envío. Sirve como preview en
   * el composer ("Replying to latest message") para que el usuario nunca tenga ambigüedad sobre qué
   * mensaje recibirá la acción.
   */
  const latestActionAnchor = useMemo(() => {
    /** Acting on gate: solo mostrar latest cuando el scope es "latest". */
    if (actingOnScope !== "latest") return null
    if (!lastInboundMessageId) return null
    const msg = threadMessages.find((m) => m.id === lastInboundMessageId)
    if (!msg) return null
    const collapsed = msg.content?.trim().replace(/\s+/g, " ") ?? ""
    const snippet = collapsed.length > 120 ? `${collapsed.slice(0, 120)}…` : collapsed
    return {
      messageId: lastInboundMessageId,
      authorLabel: msg.authorLabel,
      timestampLabel: msg.timestampLabel,
      snippet: snippet || null,
    }
  }, [actingOnScope, lastInboundMessageId, threadMessages])

  const handleClearReplyTarget = useCallback(() => {
    setSelectedMessageId(null)
  }, [])

  /**
   * Phase C: draft sugerido elegido para el panel. Prefiere el draft anclado al mensaje
   * actualmente seleccionado (`sourceMessageId === effectiveSelectedMessageId`); si no hay,
   * cae al primer draft válido. Sin AI extra, sin endpoints — usa lo que ya cargó el detail.
   */
  const suggestedDraftForPanel = useMemo(() => {
    const drafts = selected?.drafts
    if (!Array.isArray(drafts) || drafts.length === 0) return null
    const valid = drafts.filter(
      (d) =>
        ["draft", "edited", "approved"].includes(d.status)
        && typeof d.content === "string"
        && d.content.trim().length > 0,
    )
    if (valid.length === 0) return null
    if (effectiveSelectedMessageId) {
      const scoped = valid.find((d) => d.sourceMessageId === effectiveSelectedMessageId)
      if (scoped) return scoped
    }
    return valid[0]
  }, [selected, effectiveSelectedMessageId])

  /**
   * Phase C: aplica el draft sugerido al composer. Mismo patrón que el autopopulate (ref + flag),
   * pero disparado manualmente desde el botón "Reply with AI draft" del Smart actions block.
   */
  const handleUseSuggestedDraft = useCallback(() => {
    if (!suggestedDraftForPanel) return
    activeDraftIdRef.current = suggestedDraftForPanel.id
    setReplyContent(suggestedDraftForPanel.content)
    setAutoPopulated(true)
  }, [suggestedDraftForPanel])

  /**
   * Ask Fanny: inserta el answer recibido del panel en el composer. NO está atado a ningún draft
   * persistido (no hay schema). Limpiamos la ref de draft activo para no marcar como "edited" un
   * draft que en realidad no inspiró este texto.
   */
  const handleInsertReply = useCallback((text: string) => {
    if (typeof text !== "string" || text.trim().length === 0) return
    activeDraftIdRef.current = null
    setReplyContent(text)
    setAutoPopulated(true)
  }, [])

  /**
   * Phase 4: handlers conversation-level reusan `handleStatusChange` (sin nuevos endpoints, sin schema).
   * Disparan archive/close/trash sobre la conversación completa; el chip se autodeshabilita si ya
   * está en ese status. Funciones inline (sin useCallback) para que cierren sobre el `handleStatusChange`
   * actual del render — re-crear en cada render es barato y evita capturas obsoletas.
   */
  const handleArchiveConversation = () => {
    if (!activeSelectedId) return
    void handleStatusChange("archived").catch(() => null)
  }
  const handleCloseConversation = () => {
    if (!activeSelectedId) return
    void handleStatusChange("closed").catch(() => null)
  }
  const handleTrashConversation = () => {
    if (!activeSelectedId) return
    void handleStatusChange("trashed").catch(() => null)
  }
  /**
   * Mark the conversation as resolved (Done) — distinct from "Close". The status flag stays in
   * Conversation.status; transitions are validated by `transitionConversation`. The thread
   * remains visible and the operator can move it to closed/archived later.
   */
  const handleMarkConversationResolved = () => {
    if (!activeSelectedId) return
    void handleStatusChange("resolved").catch(() => null)
  }

  /**
   * Reversible state handlers — each one undoes a terminal/done state by transitioning the
   * conversation back to a legal active status. The targets honor the existing TRANSITIONS
   * table in modules/inbox/state.ts (no new schema, no new endpoint, validated server-side):
   *  - Restore from Trash → "triaged" (only legal exit from trashed; matches getReopenStatusFrom).
   *  - Unarchive          → "triaged" (consistent with restore-from-trash; neutral active).
   *  - Reopen (from closed) → "triaged" (closed → awaiting_response is NOT in the transition
   *                           table, so we pick the closest neutral: triaged. The conversation
   *                           is re-classified by the AI on next inbound, which is the same
   *                           path getReopenStatusFrom takes).
   *  - Mark as needs action → "awaiting_response" (resolved → awaiting_response is allowed and
   *                           semantically matches "needs my attention").
   *
   * The page does no client-side validation: `transitionConversation` in the service rejects
   * invalid moves (returns null) and the PATCH endpoint surfaces the error. We swallow the
   * promise here just like the existing forward handlers do.
   */
  const handleRestoreConversationFromTrash = () => {
    if (!activeSelectedId) return
    void handleStatusChange("triaged").catch(() => null)
  }
  const handleUnarchiveConversation = () => {
    if (!activeSelectedId) return
    void handleStatusChange("triaged").catch(() => null)
  }
  const handleReopenConversation = () => {
    if (!activeSelectedId) return
    void handleStatusChange("triaged").catch(() => null)
  }
  /**
   * Inverse of "Mark as resolved" at the conversation level. We deliberately do NOT touch any
   * Message.metadata.intentStatus here — the message-level "Mark as needs action" lives in
   * the More panel's Message actions group and reuses the existing toggle handler. Splitting
   * the two flips keeps the operator in control: they can resolve the conversation while
   * leaving individual message intents alone, and vice versa.
   */
  const handleMarkConversationNeedsAction = () => {
    if (!activeSelectedId) return
    void handleStatusChange("awaiting_response").catch(() => null)
  }

  /**
   * Mark a single message intent as done/open (toggle). Storage lives in
   * Message.metadata.intentStatus (no schema change). The page resolves which message id is
   * affected by mapping `actingOnScope` to either `effectiveSelectedMessageId` or
   * `lastInboundMessageId` before calling this handler.
   *
   * On success we trigger a detail refetch so the More button immediately reflects the new
   * state ("Marked as done" disabled). The list left-column will pick up the metadata in the
   * next phase that filters pending intents.
   */
  const handleMarkMessageDone = useCallback(
    async (messageId: string, nextStatus: "done" | "open" = "done") => {
      if (!activeSelectedId) return
      try {
        const res = await fetch(
          `/api/inbox/conversations/${activeSelectedId}/messages/${messageId}/intent-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        )
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message || "Could not update message status")
        setRefreshKey((value) => value + 1)
        refetchDetail()
      } catch (err) {
        setActionState(err instanceof Error ? err.message : "Could not mark as done")
      }
    },
    [activeSelectedId, refetchDetail],
  )

  /**
   * Quick-add an internal note about the scoped message. We just flip the composer into
   * internal mode and ensure the existing `effectiveSourceMessageId` resolves to the right
   * message; the operator types the note as usual and Send/Save persists it via the regular
   * messages endpoint with `isInternal: true` and `sourceMessageId` set.
   *
   *  - "selected": scope already resolves selectedMessageId → effectiveSourceMessageId.
   *  - "latest"  : effectiveSourceMessageId falls back to lastInboundMessageId.
   * Both already work without further plumbing, so this handler only owns the UX bits
   * (toggle internal mode + focus the textarea).
   */
  const handleAddInternalNoteAbout = useCallback(() => {
    setReplyIsInternal(true)
    /** Defer focus to next frame so the toggle has rendered the privacy banner first. */
    requestAnimationFrame(() => {
      composerTextareaRef.current?.focus()
    })
  }, [])

  /**
   * Soft-trash / restore a single message. Storage lives in `Message.metadata.trashedAt`
   * (plus optional `trashedBy`/`trashReason`) — no schema change. The endpoint is idempotent,
   * so repeating the same call is safe. After the write we refetch the detail so the bubble
   * flips to placeholder (or back to its content) and the More panel re-evaluates targets
   * (lastInboundMessageId skips trashed entries).
   *
   * Restore can be triggered both from the bubble's inline CTA and (in theory) from the More
   * panel; in practice the More panel only ever targets non-trashed messages, so the
   * inline path is the canonical restore UX.
   */
  const handleTrashMessage = useCallback(
    async (messageId: string, trashed: boolean) => {
      if (!activeSelectedId) return
      try {
        const res = await fetch(
          `/api/inbox/conversations/${activeSelectedId}/messages/${messageId}/trash`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trashed }),
          },
        )
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error?.message || "Could not update message trash state")
        }
        /** When trashing the message that's currently selected, drop the visual selection so
         *  the composer doesn't keep the placeholder highlighted. effectiveSelectedMessageId
         *  already returns null in this case, but the raw selection state would still ring
         *  the bubble — clearing it here keeps state and effect in lockstep. */
        if (trashed && selectedMessageId === messageId) {
          setSelectedMessageId(null)
        }
        setRefreshKey((value) => value + 1)
        refetchDetail()
      } catch (err) {
        setActionState(err instanceof Error ? err.message : "Could not move to trash")
      }
    },
    [activeSelectedId, refetchDetail, selectedMessageId],
  )

  /**
   * The More panel's message-level actions object. Computed *after* the handlers it references
   * so JS hoisting rules don't bite (useCallback closures are not hoisted). When the scope is
   * "selected" without a real selection, we report `unavailable` so the composer hides the
   * panel instead of running on a stale target.
   */
  /**
   * Phase 3 — convert a Smart Hub `Still needed` pending item into an `InboxTodo`.
   * Used by `ContextPanel.onCreateTodoFromPendingItem`. The panel passes the raw text
   * (already trimmed) and the optional `sourceMessageId` (only set when in message mode).
   * Returns boolean to let the panel toggle its session "converted" state.
   *
   * Notes:
   *  - `createdSource = "ai_pending_item"` so the persistence trail makes the origin obvious
   *    in the To-do view (UI uses this to render the "AI" provenance chip via metadata).
   *  - Conversation id is required (the AI signal only exists inside a conversation).
   *  - Priority defaults to `normal` regardless of conversation urgency: the operator already
   *    decided this item is worth tracking, so we don't add urgency noise on top.
   *  - When the operator is currently inside the To-do view (`isTodoMode`), bump the refresh
   *    key so the new item appears immediately. Otherwise just show a brief feedback toast.
   */
  const handleCreateTodoFromPendingItem = useCallback(
    async (input: { text: string; sourceMessageId: string | null }): Promise<boolean> => {
      if (!activeSelectedId || !input.text.trim()) return false
      const result = await createTodoOnServer({
        title: truncateForTitle(input.text, 200),
        conversationId: activeSelectedId,
        sourceMessageId: input.sourceMessageId,
        createdSource: "ai_pending_item",
        priority: "normal",
        assigneeType: "me",
        metadata: { origin: "smart_hub_pending_item" },
      })
      if (!result.success) {
        setActionState(result.error || "Could not convert pending item to To-do")
        return false
      }
      setTodoCaptureFeedback("To-do created from pending item")
      /**
       * Bump `todosRefreshKey` unconditionally so the Triage Summary counter (which depends on
       * it via a per-conversation fetch) refreshes even when the operator is not in
       * `isTodoMode`. The workspace-wide `todos` loader is still gated by `isTodoMode` itself,
       * so this bump is cheap when the To-do view isn't active.
       */
      setTodosRefreshKey((k) => k + 1)
      return true
    },
    [activeSelectedId],
  )

  /**
   * Phase 3 — capture the scoped (latest or selected) message as an `InboxTodo`. The composer
   * delegates here via `messageActions.onAddToTodo`; we own the whole derivation:
   *  - title: prefer the message's `metadata.shortIntent` when present, otherwise truncate the
   *    cleaned message body to ≤120 chars at a word boundary.
   *  - description: short excerpt of the message body (best-effort, may be null for empty
   *    bodies — attachments-only messages still get a useful title).
   *  - priority: derived from conversation urgency via `priorityFromUrgency`. We only escalate
   *    when the conversation already carries `alta`/`critica`; medium/low map to `normal`/`low`.
   *  - We deliberately do *not* mark the message done — Done lives one entry up so the
   *    operator decides explicitly when to close the loop.
   *  - Hard guard against double-click via `creatingTodoFromMessage` lock.
   */
  const handleAddMessageToTodo = useCallback(async () => {
    if (!activeSelectedId || !moreActionsTargetMessageId || creatingTodoFromMessage) return
    const targetId = moreActionsTargetMessageId
    const rawMsg = selected?.messages?.find((m) => m.id === targetId) ?? null
    if (!rawMsg) {
      setActionState("Could not resolve message for To-do")
      return
    }

    /** Mirror the defensive metadata read from `replyTarget`: tolerate string/object/null. */
    let metaShortIntent: string | null = null
    try {
      if (rawMsg.metadata) {
        const parsed = typeof rawMsg.metadata === "string" ? JSON.parse(rawMsg.metadata) : rawMsg.metadata
        const candidate = (parsed as { shortIntent?: unknown } | null | undefined)?.shortIntent
        if (typeof candidate === "string" && candidate.trim()) metaShortIntent = candidate.trim()
      }
    } catch {
      /* malformed metadata — fall back to body */
    }

    const cleanedBody = (rawMsg.content || "").replace(/\s+/g, " ").trim()
    const title = metaShortIntent || truncateForTitle(cleanedBody || "Message follow-up", 120)
    const description = cleanedBody && cleanedBody !== title ? truncateForTitle(cleanedBody, 280) : null

    setCreatingTodoFromMessage(true)
    const result = await createTodoOnServer({
      title,
      description,
      conversationId: activeSelectedId,
      sourceMessageId: targetId,
      createdSource: "operator_message",
      priority: priorityFromUrgency(selected?.urgency),
      assigneeType: "me",
      metadata: {
        origin: actingOnScope === "selected" ? "operator_selected_message" : "operator_latest_message",
      },
    })
    setCreatingTodoFromMessage(false)
    if (!result.success) {
      setActionState(result.error || "Could not create To-do from message")
      return
    }
    setTodoCaptureFeedback(actingOnScope === "selected" ? "To-do created from selected message" : "To-do created from latest message")
    /** See bump rationale in `handleCreateTodoFromPendingItem` — keeps the Triage counter fresh. */
    setTodosRefreshKey((k) => k + 1)
  }, [activeSelectedId, moreActionsTargetMessageId, selected, actingOnScope, creatingTodoFromMessage])

  /**
   * Phase 3 — accept the internal-note TODO suggestion. Reads the captured title + note id
   * (set inside `sendReply` when the just-saved internal note matched the prefix detector),
   * POSTs the To-do, and clears the banner. The internal note message itself stays untouched
   * — we never auto-mark it done or alter its content.
   *
   * `createdSource = "internal_note"` makes the To-do view's provenance chip explicit. We
   * only attach `sourceNoteId` when the messages POST response surfaced an id; otherwise we
   * fall back to `conversationId` only.
   */
  const handleAcceptInternalNoteTodo = useCallback(async () => {
    if (!internalNoteTodoSuggestion || internalNoteTodoBusy) return
    setInternalNoteTodoBusy(true)
    const result = await createTodoOnServer({
      title: internalNoteTodoSuggestion.title,
      conversationId: internalNoteTodoSuggestion.conversationId,
      sourceNoteId: internalNoteTodoSuggestion.noteMessageId,
      createdSource: "internal_note",
      priority: "normal",
      assigneeType: "me",
      metadata: { origin: "internal_note_prefix" },
    })
    setInternalNoteTodoBusy(false)
    if (!result.success) {
      setActionState(result.error || "Could not create To-do from internal note")
      return
    }
    setTodoCaptureFeedback("To-do created from internal note")
    setInternalNoteTodoSuggestion(null)
    /** See bump rationale in `handleCreateTodoFromPendingItem` — keeps the Triage counter fresh. */
    setTodosRefreshKey((k) => k + 1)
  }, [internalNoteTodoSuggestion, internalNoteTodoBusy])

  const handleDismissInternalNoteTodo = useCallback(() => {
    setInternalNoteTodoSuggestion(null)
  }, [])

  /**
   * Drop a stale suggestion when the operator switches conversations. The banner is gated by
   * `conversationId === activeSelectedId` at render time too, but resetting state explicitly
   * keeps the lifecycle predictable (no banner re-appearing if you come back to the same
   * conversation later).
   */
  useEffect(() => {
    if (
      internalNoteTodoSuggestion &&
      internalNoteTodoSuggestion.conversationId !== activeSelectedId
    ) {
      setInternalNoteTodoSuggestion(null)
    }
  }, [activeSelectedId, internalNoteTodoSuggestion])

  const messageActionsForComposer = useMemo(() => {
    if (actingOnScope === "all") return undefined
    if (!moreActionsTargetMessageId) return { unavailable: true as const }
    return {
      onMarkDone: () => {
        const next: "done" | "open" = moreActionsTargetIntentStatus === "done" ? "open" : "done"
        void handleMarkMessageDone(moreActionsTargetMessageId, next)
      },
      onAddInternalNote: handleAddInternalNoteAbout,
      onAddToTodo: () => {
        void handleAddMessageToTodo()
      },
      onTrashMessage: () => {
        void handleTrashMessage(moreActionsTargetMessageId, true)
      },
      intentStatus: moreActionsTargetIntentStatus,
    }
  }, [actingOnScope, moreActionsTargetMessageId, moreActionsTargetIntentStatus, handleMarkMessageDone, handleAddInternalNoteAbout, handleAddMessageToTodo, handleTrashMessage])

  /**
   * `selectedIndex` and `navigateConversation` work over the *visible* list (after Work +
   * Sender filters) so j/k key navigation only walks through items the operator can actually
   * see. Auto-selection on load still uses the wider `conversationsForList` so applying a
   * filter never silently drops the open conversation.
   */
  const selectedIndex = useMemo(
    () => conversationsAfterUserFilters.findIndex((item) => item.id === activeSelectedId),
    [activeSelectedId, conversationsAfterUserFilters],
  )

  const isMobileInboxViewport = useCallback(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 1279px)").matches
  }, [])

  const focusComposerTextarea = useCallback(() => {
    const textarea = composerTextareaRef.current
    if (!textarea) return false

    textarea.focus()
    const cursorPosition = textarea.value.length
    textarea.setSelectionRange(cursorPosition, cursorPosition)

    return true
  }, [])

  const requestComposerFocus = useCallback((nextMode?: boolean) => {
    if (!activeSelectedId) return

    if (typeof nextMode === "boolean") {
      setReplyIsInternal(nextMode)
    }

    pendingComposerFocusRef.current = true

    if (isMobileInboxViewport() && mobileView !== "thread") {
      setMobileView("thread")
    }

    requestAnimationFrame(() => {
      if (focusComposerTextarea()) {
        pendingComposerFocusRef.current = false
      }
    })
  }, [activeSelectedId, focusComposerTextarea, isMobileInboxViewport, mobileView])

  useEffect(() => {
    if (!pendingComposerFocusRef.current) return
    if (!selected) return
    if (isMobileInboxViewport() && mobileView !== "thread") return

    requestAnimationFrame(() => {
      if (focusComposerTextarea()) {
        pendingComposerFocusRef.current = false
      }
    })
  }, [focusComposerTextarea, isMobileInboxViewport, mobileView, selected])

  function handleSelectConversation(id: string) {
    setSelectedId(id)
    setMobileView("thread")
    setPendingActionInput(null)
  }

  /**
   * Load To-dos when the operator switches to the To-do view. We use `status=open,waiting` (the
   * MVP slice — neither `done` nor `dismissed` are surfaced) and bail early in non-todo mode to
   * avoid an unnecessary request. `todosRefreshKey` is a manual bump after mutations or when the
   * user clicks the refresh icon; we don't poll because the list is short-lived per session.
   */
  useEffect(() => {
    if (!isTodoMode) {
      /** Reset todo selection when leaving the view so we don't reanchor on stale data. */
      setSelectedTodoId(null)
      return
    }

    let cancelled = false
    setTodosLoading(true)
    setTodosError(null)

    fetch("/api/inbox/todos?status=open,waiting", { credentials: "same-origin" })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || !json?.success) {
          const message =
            (json && typeof json.error === "string" && json.error)
            || "Could not load To-dos."
          setTodosError(message)
          setTodos([])
          return
        }
        const data = Array.isArray(json.data) ? (json.data as ClientInboxTodo[]) : []
        setTodos(data)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Could not load To-dos."
        setTodosError(message)
        setTodos([])
      })
      .finally(() => {
        if (!cancelled) setTodosLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isTodoMode, todosRefreshKey])

  /**
   * Triage Summary counter — load the per-conversation open To-do count whenever the active
   * conversation changes or `todosRefreshKey` bumps. The query is intentionally narrow
   * (`take=200` + scoped status) so this stays a tiny, idempotent number fetch even on busy
   * threads. Failures fall back to `0` rather than surfacing a UI error: a stale-but-zero
   * counter is preferable to an alarming red banner for an informational chip.
   */
  useEffect(() => {
    if (!activeSelectedId) {
      setConversationTodoCount(0)
      return
    }

    let cancelled = false
    fetch(
      `/api/inbox/todos?conversationId=${encodeURIComponent(activeSelectedId)}&status=open,waiting&take=200`,
      { credentials: "same-origin" },
    )
      .then(async (response) => {
        const json = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || !json?.success) {
          setConversationTodoCount(0)
          return
        }
        const data = Array.isArray(json.data) ? json.data : []
        setConversationTodoCount(data.length)
      })
      .catch(() => {
        if (!cancelled) setConversationTodoCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [activeSelectedId, todosRefreshKey])

  const handleRefreshTodos = useCallback(() => {
    setTodosRefreshKey((k) => k + 1)
  }, [])

  /**
   * Click on a To-do row.
   *  - Linked to a conversation → push `?id=<conversationId>[&messageId=<sourceMessageId>]` so
   *    the existing deep-link effect resolves the right pane. We KEEP `?filter=todo` so the
   *    operator can return to the queue after dealing with one item.
   *  - No conversation → just highlight the row. Phase 3 will add a detail pane for these.
   * The optimistic `setSelectedId` keeps the UI snappy even if the source conversation isn't
   * in the loaded conversations list (e.g. archived); the right pane fetches `/api/inbox/
   * conversations/[id]` directly so it renders regardless of the list state.
   */
  const handleSelectTodo = useCallback(
    (todo: ClientInboxTodo) => {
      setSelectedTodoId(todo.id)
      if (!todo.conversationId) return

      const params = new URLSearchParams(searchParams.toString())
      params.set("id", todo.conversationId)
      if (todo.sourceMessageId) {
        params.set("messageId", todo.sourceMessageId)
      } else {
        params.delete("messageId")
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      setSelectedId(todo.conversationId)
      setMobileView("thread")
    },
    [pathname, router, searchParams],
  )

  /**
   * Toggle done ↔ open. We optimistically update `todos` so the checkbox flips immediately;
   * on failure we revert. Items moved to `done` stay visible until the next refresh — the
   * operator may want to "undo" without scrolling away.
   */
  const handleToggleTodoDone = useCallback(
    async (todo: ClientInboxTodo) => {
      const nextStatus: ClientInboxTodo["status"] = todo.status === "done" ? "open" : "done"
      const previous = todos
      setBusyTodoId(todo.id)
      setTodos((items) =>
        items.map((item) => (item.id === todo.id ? { ...item, status: nextStatus } : item)),
      )

      try {
        const response = await fetch(`/api/inbox/todos/${todo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ status: nextStatus }),
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok || !json?.success) {
          throw new Error(typeof json?.error === "string" ? json.error : "Update failed")
        }
        if (json.data && typeof json.data === "object") {
          const updated = json.data as ClientInboxTodo
          setTodos((items) => items.map((item) => (item.id === updated.id ? updated : item)))
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[inbox:todo] toggle done failed", err)
        }
        setTodos(previous)
      } finally {
        setBusyTodoId(null)
      }
    },
    [todos],
  )

  /**
   * Dismiss removes the To-do from the local list immediately. The backend keeps the record
   * (status=dismissed) so it can be audited or undismissed via API later. No UI restore in MVP
   * — the operator can re-create from the source signal in Phase 3.
   */
  const handleDismissTodo = useCallback(async (todo: ClientInboxTodo) => {
    setBusyTodoId(todo.id)
    const previous = todos
    setTodos((items) => items.filter((item) => item.id !== todo.id))

    try {
      const response = await fetch(`/api/inbox/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: "dismissed" }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.success) {
        throw new Error(typeof json?.error === "string" ? json.error : "Dismiss failed")
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[inbox:todo] dismiss failed", err)
      }
      setTodos(previous)
    } finally {
      setBusyTodoId(null)
    }
  }, [todos])

  /**
   * Click en un intent expandido (columna izquierda):
   * - Misma conversación → solo `setSelectedMessageId(messageId)`; el effect URL-sync lo escribe en `?messageId=`.
   * - Otra conversación → escribimos `?id=...&messageId=...` atómicamente. El deep-link effect existente
   *   carga la conversación y el effect URL→state aplica el `messageId` cuando llega el detalle.
   */
  const handleSelectIntent = useCallback(
    (conversationId: string, messageId: string) => {
      if (conversationId === activeSelectedId) {
        setSelectedMessageId(messageId)
        setMobileView("thread")
        return
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set("id", conversationId)
      params.set("messageId", messageId)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      setMobileView("thread")
    },
    [activeSelectedId, pathname, router, searchParams],
  )

  /** Click directo en una burbuja del hilo central. */
  const handleSelectMessageInThread = useCallback((messageId: string) => {
    setSelectedMessageId((prev) => (prev === messageId ? prev : messageId))
  }, [])

  const handleToggleConversationExpand = useCallback((id: string) => {
    setExpandedConversationId((prev) => {
      if (prev === id) {
        setMessageIntentsLoadingId(null)
        return null
      }
      if (!loadedShortIntentIdsRef.current.has(id)) {
        setMessageIntentsLoadingId(id)
      }
      return id
    })
  }, [])

  useEffect(() => {
    setMessageShortIntentsById({})
    loadedShortIntentIdsRef.current.clear()
    setExpandedConversationId(null)
    setMessageIntentsLoadingId(null)
  }, [refreshKey])

  /**
   * Carga intents por mensaje; si viene vacío reintenta una vez tras ~2s (persistencia async de shortIntent).
   */
  useEffect(() => {
    if (!expandedConversationId) return
    if (loadedShortIntentIdsRef.current.has(expandedConversationId)) return

    let cancelled = false
    const conversationId = expandedConversationId

    /**
     * Devuelve `[{messageId, text}]`. `pickExpandedIntents` filtra/dedupa por TEXTO (last-wins),
     * así que para cada texto resultante mapeamos al ÚLTIMO `id` con ese `shortIntent` en el orden
     * cronológico recibido — preservando la semántica dedup-last-wins en el plano de mensajes.
     *
     * Phase 3 fix: el panel "actionable intents" del listado solo expone intents de mensajes
     * INBOUND. Outbound siguen visibles y seleccionables en el hilo central; aquí no compiten
     * como "lo que requiere acción". El backend ya devuelve `direction` por fila, sin borrar data.
     *
     * Active-intent filters (collapsed/expanded refactor): además del filtro por dirección,
     * descartamos rows que no son "trabajo pendiente" hoy:
     *  - `trashedAt` set → message-level soft trash (Message.metadata.trashedAt). Su intent no
     *    debe manejar la fila ni aparecer en el expanded panel; el bubble in-thread sigue
     *    mostrando un placeholder con CTA Restore para revertir.
     *  - `intentStatus === "done"` → el operador marcó ese mensaje como hecho desde el More
     *    menu. Lo escondemos del listado de pendientes para no contar trabajo cerrado.
     *  - `isInternal === true` → notas privadas del operador; nunca son intent del cliente.
     *  - `role === "system"` → eventos del sistema (asignaciones automáticas, transitions);
     *    no son intent.
     * Todos los flags vienen del backend en `listMessageShortIntents`; mantenemos un fallback
     * seguro para callers viejos (rows sin esos campos siguen pasando).
     */
    async function parseResponse(
      res: Response,
    ): Promise<Array<{ messageId: string; text: string }>> {
      const json = (await res.json()) as {
        success?: boolean
        data?: Array<{
          id: string
          direction?: string
          shortIntent: string
          intentStatus?: string
          trashedAt?: string
          isInternal?: boolean
          role?: string
        }>
      }
      const rawRows = json?.success && Array.isArray(json.data) ? json.data : []
      const rows = rawRows.filter((r) => {
        if (r.direction !== "inbound") return false
        if (r.trashedAt) return false
        if (r.intentStatus === "done") return false
        if (r.isInternal === true) return false
        if (r.role === "system") return false
        return true
      })
      const lines = rows.map((r) => r.shortIntent).filter(Boolean)
      const filteredTexts = pickExpandedIntents(lines)
      const result: Array<{ messageId: string; text: string }> = []
      for (const text of filteredTexts) {
        let lastId: string | null = null
        for (const row of rows) {
          if (row.shortIntent === text && row.id) lastId = row.id
        }
        if (lastId) result.push({ messageId: lastId, text })
      }
      return result
    }

    async function run() {
      try {
        let res = await fetch(`/api/inbox/conversations/${conversationId}/message-intents`)
        let filtered = await parseResponse(res)
        if (cancelled) return

        if (filtered.length === 0 && res.ok) {
          await new Promise((r) => setTimeout(r, 2200))
          if (cancelled) return
          res = await fetch(`/api/inbox/conversations/${conversationId}/message-intents`)
          if (cancelled) return
          filtered = await parseResponse(res)
        }

        if (cancelled) return
        loadedShortIntentIdsRef.current.add(conversationId)
        setMessageShortIntentsById((prev) => ({
          ...prev,
          [conversationId]: filtered,
        }))
      } catch {
        if (cancelled) return
        loadedShortIntentIdsRef.current.add(conversationId)
        setMessageShortIntentsById((prev) => ({
          ...prev,
          [conversationId]: [],
        }))
      } finally {
        if (!cancelled) {
          setMessageIntentsLoadingId((cur) =>
            cur === conversationId ? null : cur,
          )
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [expandedConversationId])

  function handleBackToList() {
    setMobileView("list")
    setCannedOpen(false)
    setContextSheetOpen(false)
  }

  const handleComposeSend = useCallback(async () => {
    if (!composeTo.includes("@") || !composeBody.trim()) return
    setComposeSending(true)
    try {
      const res = await fetch("/api/inbox/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, content: composeBody }),
      })
      const json = await res.json()
      if (res.ok && json.data?.conversationId) {
        setComposeOpen(false)
        setComposeTo("")
        setComposeSubject("")
        setComposeBody("")
        setRefreshKey((v) => v + 1)
        refetch()
        handleSelectConversation(json.data.conversationId)
      }
    } catch (err) {
      console.error("[inbox] Compose send failed:", err)
    } finally {
      setComposeSending(false)
    }
  }, [composeTo, composeSubject, composeBody, refetch])

  /**
   * Pulls the latest emails from the workspace's email connection and surfaces a diagnostic
   * banner so the operator can see *what happened* — the previous handler silently swallowed
   * every failure (NO_CONNECTION, CONNECTION_INACTIVE, IMAP errors) and produced an
   * indistinguishable green "Synced ✓" for both "synced 0 new" and "no connection at all".
   *
   * Branches:
   *  - HTTP error or `success === false`: parse `error.{code,message}` → set sticky banner
   *    with the code-specific UX. NO_CONNECTION / CONNECTION_INACTIVE / PROVIDER_NOT_FETCHABLE
   *    each carry their own remediation hint.
   *  - HTTP 200 + `data.ok`: read `{ ingested, fetched, skipped, errors[], cursorReset,
   *    connection }`. ingested>0 → success banner + refetch. Errors > 0 → error banner with
   *    the first error string (rest collapsed into "and N more"). cursorReset → warning.
   *  - When the user is currently inside a non-Inbox filter (`?filter=todo`, archived, trash,
   *    closed), surface a small visibilityHint so they know the new mail landed in Inbox.
   */
  const handleFetchEmails = useCallback(async () => {
    setFetchingEmails(true)
    try {
      const res = await fetch("/api/inbox/fetch", { method: "POST" })
      const json = await res.json().catch(() => null) as
        | {
            success?: boolean
            data?: {
              ok?: boolean
              count?: number
              fetched?: number
              ingested?: number
              skipped?: number
              errors?: string[]
              cursorReset?: boolean
              connection?: { connectionId?: string; provider?: string; status?: string; email?: string | null }
            }
            error?: { code?: string; message?: string }
          }
        | null

      setLastSyncedAt(new Date())

      const filterHint =
        sidebarFilter && sidebarFilter !== "inbox"
          ? `Estás en la vista "${sidebarFilter}" — los emails nuevos aparecen en "Smart Inbox → Inbox".`
          : null

      if (!res.ok || !json?.success) {
        const code = json?.error?.code ?? "FETCH_ERROR"
        const message = json?.error?.message ?? "No se pudo sincronizar el email."
        if (code === "NO_CONNECTION") {
          setFetchFeedback({
            level: "error",
            message: "No hay conexión de email configurada.",
            detail: "Configura una en Administración → Canales para empezar a recibir mensajes.",
          })
        } else if (code === "CONNECTION_INACTIVE") {
          setFetchFeedback({
            level: "error",
            message: "La conexión de email está inactiva.",
            detail: message,
          })
        } else if (code === "PROVIDER_NOT_FETCHABLE") {
          setFetchFeedback({
            level: "warning",
            message: "Esta conexión no requiere fetch manual.",
            detail: message,
          })
        } else {
          setFetchFeedback({
            level: "error",
            message: "No se pudo sincronizar el email.",
            detail: message,
          })
        }
        return
      }

      const data = json.data ?? {}
      const ingested = typeof data.ingested === "number" ? data.ingested : data.count ?? 0
      const skipped = typeof data.skipped === "number" ? data.skipped : 0
      const errs = Array.isArray(data.errors) ? data.errors : []

      if (ingested > 0) {
        setRefreshKey((v) => v + 1)
        refetch()
        setFetchFeedback({
          level: "success",
          message: ingested === 1 ? "1 email nuevo recibido." : `${ingested} emails nuevos recibidos.`,
          detail: skipped > 0 ? `${skipped} ya conocidos / propios — omitidos.` : null,
          visibilityHint: filterHint,
        })
      } else if (errs.length > 0) {
        setFetchFeedback({
          level: "error",
          message: errs.length === 1 ? "Error durante el sync IMAP." : `${errs.length} errores durante el sync IMAP.`,
          detail: errs[0] + (errs.length > 1 ? ` … y ${errs.length - 1} más.` : ""),
        })
      } else if (data.cursorReset) {
        setFetchFeedback({
          level: "warning",
          message: "Cursor IMAP reiniciado.",
          detail: "El servidor reportó un cambio de uidValidity o un cursor inconsistente. El próximo sync recuperará mensajes recientes.",
        })
      } else {
        setFetchFeedback({
          level: "info",
          message: "Sin emails nuevos.",
          detail: skipped > 0 ? `${skipped} mensajes revisados (todos ya conocidos).` : null,
        })
      }
    } catch (err) {
      console.error("[inbox] Fetch failed:", err)
      setFetchFeedback({
        level: "error",
        message: "No se pudo contactar al servidor.",
        detail: err instanceof Error ? err.message : null,
      })
    } finally {
      setFetchingEmails(false)
    }
  }, [refetch, sidebarFilter])

  const navigateConversation = useCallback((offset: 1 | -1) => {
    if (!activeSelectedId || conversationsAfterUserFilters.length === 0 || selectedIndex < 0) return

    const nextIndex = selectedIndex + offset
    if (nextIndex < 0 || nextIndex >= conversationsAfterUserFilters.length) return

    setSelectedId(conversationsAfterUserFilters[nextIndex].id)
  }, [activeSelectedId, conversationsAfterUserFilters, selectedIndex])

  const handleInboxEscape = useCallback(() => {
    if (contextSheetOpen) {
      setContextSheetOpen(false)
      return
    }

    /** Esc primero limpia la selección por-mensaje (efecto URL-sync remueve `?messageId=`). */
    if (selectedMessageId) {
      setSelectedMessageId(null)
      return
    }

    if (activeSelectedId && mobileView === "thread" && isMobileInboxViewport()) {
      handleBackToList()
    }
  }, [activeSelectedId, contextSheetOpen, isMobileInboxViewport, mobileView, selectedMessageId])

  const inboxShortcuts = useMemo(
    () => [
      {
        id: "inbox-next-conversation",
        combo: "j",
        enabled: !cannedOpen && !contextSheetOpen,
        preventDefault: true,
        handler: () => navigateConversation(1),
      },
      {
        id: "inbox-previous-conversation",
        combo: "k",
        enabled: !cannedOpen && !contextSheetOpen,
        preventDefault: true,
        handler: () => navigateConversation(-1),
      },
      {
        id: "inbox-open-conversation",
        combo: "Enter",
        enabled: !cannedOpen && !contextSheetOpen,
        preventDefault: true,
        handler: () => {
          if (!activeSelectedId) return
          handleSelectConversation(activeSelectedId)
        },
      },
      {
        id: "inbox-focus-composer",
        combo: "e",
        enabled: !cannedOpen && !contextSheetOpen,
        preventDefault: true,
        handler: () => requestComposerFocus(),
      },
      {
        id: "inbox-reply-mode",
        combo: "r",
        enabled: !cannedOpen && !contextSheetOpen,
        preventDefault: true,
        handler: () => requestComposerFocus(false),
      },
      {
        id: "inbox-internal-mode",
        combo: "i",
        enabled: !cannedOpen && !contextSheetOpen,
        preventDefault: true,
        handler: () => requestComposerFocus(true),
      },
      {
        id: "inbox-escape",
        combo: "Escape",
        enabled: !cannedOpen,
        preventDefault: true,
        handler: handleInboxEscape,
      },
      {
        id: "inbox-send-reply",
        combo: "Mod+Enter",
        enabled: Boolean(activeSelectedId) && !cannedOpen,
        preventDefault: true,
        handler: () => sendReplyRef.current(),
      },
    ],
    [activeSelectedId, cannedOpen, contextSheetOpen, handleInboxEscape, navigateConversation, requestComposerFocus],
  )

  useKeyboardShortcuts(inboxShortcuts, { scope: "page" })

  const showInitialListSkeleton = loading && conversations.length === 0
  const detailBodyLoading = Boolean(activeSelectedId) && detailLoading && !selected

  const inboxAuditUiBranch = useMemo(
    () => ({
      listColumn: showInitialListSkeleton
        ? "list-skeleton-initial"
        : isWorkspaceUnavailable
          ? "list-inbox-unavailable"
          : isGenericListFailure
            ? "list-api-error"
            : !loading && conversations.length === 0
              ? "list-empty"
              : "list-visible",
      centerColumn: !activeSelectedId
        ? "center-no-selection"
        : detailBodyLoading
          ? "center-thread-inline-load"
          : detailError
            ? "center-detail-error"
            : "center-detail-ready",
      rightColumn: showInitialListSkeleton
        ? "right-skeleton-initial-blocked"
        : activeSelectedId && !selected
          ? "right-awaiting-detail"
          : selected
            ? "right-context"
            : "right-placeholder",
    }),
    [
      activeSelectedId,
      detailError,
      detailBodyLoading,
      isGenericListFailure,
      isWorkspaceUnavailable,
      loading,
      conversations.length,
      selected,
      showInitialListSkeleton,
    ],
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    console.log("[inbox:audit:state]", {
      loading,
      listError: listErrorMessage,
      listErrorCode: errorCode,
      conversationsLength: conversations.length,
      conversationsForSidebarLength: conversationsForSidebar.length,
      conversationsForListLength: conversationsForList.length,
      statusFilter: status,
      sidebarFilterParam: sidebarFilter,
      selectedId,
      activeSelectedId,
      deepLinkId,
      deepLinkMessageId,
      urlQuery: searchParams.toString(),
      detailLoading,
      detailError: detailError ? String(detailError) : null,
      detailErrorCode,
      detailErrorMessage,
      uiBranch: inboxAuditUiBranch,
    })
  }, [
    activeSelectedId,
    conversationItems.length,
    conversations.length,
    conversationsForList.length,
    conversationsForSidebar.length,
    deepLinkId,
    deepLinkMessageId,
    detailError,
    detailErrorCode,
    detailErrorMessage,
    detailLoading,
    errorCode,
    inboxAuditUiBranch,
    listErrorMessage,
    loading,
    searchParams,
    selectedId,
    sidebarFilter,
    status,
  ])

  const contextPanel = selected && conversationsForList.length > 0 ? (
    <ContextPanel
      selected={selected}
      updateHandoff={updateHandoff}
      handoffState={handoffState}
      pendingActionId={pendingActionId}
      handleSuggestedAction={handleSuggestedAction}
      handleConvert={handleConvert}
      actionState={actionState}
      members={displayedMembers}
      assignSaving={assignSaving}
      onAssign={handleAssign}
      selectedMessageId={effectiveSelectedMessageId}
      selectedMessageInfo={replyTarget}
      hasSuggestedDraft={Boolean(suggestedDraftForPanel)}
      onUseSuggestedDraft={handleUseSuggestedDraft}
      onInsertReply={handleInsertReply}
      onCreateCalendarEvent={handleCreateCalendarEvent}
      askMode={askMode}
      askAnchorMessageId={askAnchorMessageId}
      onCreateTodoFromPendingItem={handleCreateTodoFromPendingItem}
      conversationTodoCount={conversationTodoCount}
    />
  ) : null

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]} contentClassName="max-w-[1800px] min-h-0 flex-1">
      <div className="-mx-4 -mt-2 flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--inbox-background)] md:-mx-8">
        {process.env.NODE_ENV === "development" ? (
          <div
            className="pointer-events-none fixed bottom-2 left-2 z-[100] max-h-[42vh] max-w-[min(100vw-0.75rem,26rem)] overflow-auto rounded-md border border-emerald-500/35 bg-[#0c0c0e]/95 px-2 py-1.5 font-mono text-[10px] leading-snug text-emerald-400 shadow-lg"
            aria-hidden
          >
            <div className="font-semibold text-emerald-300">[inbox audit — dev]</div>
            <div>c.conversations.length: {conversations.length}</div>
            <div>visible (list): {conversationItems.length}</div>
            <div>sidebar filt.: {conversationsForSidebar.length} · effective: {conversationsForList.length}</div>
            <div>selectedId: {selectedId ?? "null"}</div>
            <div>activeSelectedId: {activeSelectedId ?? "null"}</div>
            <div className="truncate text-emerald-500/90" title={listErrorMessage ?? undefined}>
              listErr: {listErrorMessage ?? "—"}
            </div>
            <div className="truncate text-emerald-500/90" title={detailErrorMessage ?? undefined}>
              detailErr: {detailErrorMessage ?? "—"}
            </div>
            <div className="text-[9px] text-emerald-600">
              ui: list={inboxAuditUiBranch.listColumn} · center={inboxAuditUiBranch.centerColumn} · right=
              {inboxAuditUiBranch.rightColumn}
            </div>
          </div>
        ) : null}
        {/*
         * Inbox shell: a vertical stack of (toolbar) + (three-column grid). The toolbar
         * spans the full width above the grid so channel/work filters never compete for
         * space with the conversation list. The inner grid retains its original
         * `xl:grid-cols-[...]` contract — only the wrapper restructured.
         */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <InboxToolbar
            search={search}
            onSearchChange={setSearch}
            activeSearchTerm={debouncedSearch || undefined}
            onFetchEmails={handleFetchEmails}
            fetchingEmails={fetchingEmails}
            lastSyncedAt={lastSyncedAt}
            onCompose={() => setComposeOpen(true)}
            primaryWorkFilter={primaryWorkFilter}
            onPrimaryWorkFilterChange={handlePrimaryWorkFilterChange}
            channel={channel}
            channelOptions={channelSelectOptions}
            onChannelChange={setChannel}
            status={status}
            statusOptions={statusFilterOptions}
            onStatusChange={handleListStatusFilterChange}
            intentStatusFilter={intentStatusFilter}
            onIntentStatusFilterChange={setIntentStatusFilter}
            senderFilter={senderFilter}
            senderOptions={senderOptions}
            onSenderFilterChange={setSenderFilter}
            assignmentFilter={assignmentFilter}
            onAssignmentFilterChange={setAssignmentFilter}
            isTodoMode={isTodoMode}
          />
          {/*
           * Workspace taxonomy chips. Renders only when the active workspace
           * has a non-empty `Workspace.config.taxonomies.inbox` list — see
           * `core/workspace-taxonomies.ts`. For tenants without taxonomies
           * the component returns `null` so the Inbox layout is identical to
           * the pre-PR state. Selection is now FUNCTIONAL: clicking a chip
           * filters the conversation list by `Conversation.category` (set
           * manually via `<ConversationCategoryEditor>` on the thread).
           */}
          {!isTodoMode ? (
            <InboxTaxonomyChips
              selected={categoryFilter}
              onSelectedChange={setCategoryFilter}
            />
          ) : null}
          <div className={cn("flex min-h-0 flex-1 flex-col gap-3", DESKTOP_INBOX_GRID)}>
          <div
            className={cn(
              mobileView === "thread" && activeSelectedId ? "hidden" : "block",
              "min-h-0 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-list-background)] shadow-[var(--app-shadow-subtle)] xl:flex xl:h-full xl:flex-col",
            )}
          >
            {showInitialListSkeleton ? (
              <InboxListSkeleton />
            ) : (
              <>
                {/**
                 * IMPORTANTE: el estado "inbox vacío" debe verse VISUALMENTE distinto al estado
                 * "fallo de carga". Antes, un INTERNAL_ERROR (p. ej. drift de schema entre Prisma
                 * y Turso, ver fix de `Conversation.trashedAt`) dejaba la lista en blanco y el
                 * operador interpretaba que no había mensajes. Este banner rojo persistente lo
                 * hace explícito y ofrece reintento sin recargar la página.
                 */}
                {isGenericListFailure ? (
                  <div
                    className="shrink-0 border-b border-rose-500/35 bg-rose-500/[0.10] px-4 py-2.5 text-xs leading-snug text-[var(--inbox-list-text-secondary)]"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="font-semibold text-rose-300">
                      Inbox could not load conversations
                    </div>
                    <div className="mt-0.5 text-[var(--inbox-text)]">
                      The conversations API returned an error. This is not an empty inbox — your
                      data is intact. Try again, and if the problem persists check server logs for
                      a Prisma or schema-drift error.
                    </div>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200 hover:bg-rose-500/20"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {fetchFeedback ? (
                  /**
                   * Fetch diagnostic banner — replaces the silent toast pattern. Sticky for
                   * error/warning levels (operator must dismiss or run another fetch); auto-
                   * clears for success/info via the useEffect timer. Always visible regardless
                   * of `isTodoMode` so the operator sees diagnostics even from the To-do view.
                   */
                  <div
                    className={cn(
                      "flex shrink-0 items-start gap-2 border-b px-4 py-2.5 text-xs leading-snug",
                      fetchFeedback.level === "success" && "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100",
                      fetchFeedback.level === "info" && "border-[var(--inbox-border)]/40 bg-white/[0.03] text-[var(--inbox-list-text-secondary)]",
                      fetchFeedback.level === "warning" && "border-amber-500/25 bg-amber-500/[0.08] text-amber-100",
                      fetchFeedback.level === "error" && "border-rose-500/30 bg-rose-500/[0.08] text-rose-100",
                    )}
                    role="status"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{fetchFeedback.message}</div>
                      {fetchFeedback.detail ? (
                        <div className="mt-0.5 opacity-85">{fetchFeedback.detail}</div>
                      ) : null}
                      {fetchFeedback.visibilityHint ? (
                        <div className="mt-0.5 opacity-85">
                          {fetchFeedback.visibilityHint}{" "}
                          <Link className="font-medium underline-offset-2 hover:underline" href="/inbox?filter=inbox">
                            Ir al Inbox
                          </Link>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss fetch feedback"
                      onClick={() => setFetchFeedback(null)}
                      className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
                {inboxTerminalRescueActive && !isTodoMode ? (
                  <div
                    className="shrink-0 border-b border-amber-500/25 bg-amber-500/[0.08] px-4 py-2.5 text-xs leading-snug text-[var(--inbox-list-text-secondary)]"
                    role="status"
                  >
                    <span className="text-[var(--inbox-text)]">
                      All conversations are archived, closed, or in trash — nothing left in the main inbox view.
                    </span>{" "}
                    <span>
                      Showing the full list so you can still open them.{" "}
                      <Link
                        className="font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
                        href="/inbox?filter=trash"
                      >
                        Trash only
                      </Link>
                    </span>
                  </div>
                ) : null}
                {isTodoMode ? (
                  <InboxTodoList
                    todos={todos}
                    loading={todosLoading}
                    errorMessage={todosError}
                    selectedId={selectedTodoId}
                    contactsByConversationId={contactsByConversationId}
                    busyTodoId={busyTodoId}
                    onSelect={handleSelectTodo}
                    onToggleDone={handleToggleTodoDone}
                    onDismiss={handleDismissTodo}
                    onRefresh={handleRefreshTodos}
                  />
                ) : (
                  <ConversationList
                    loading={loading}
                    errorMessage={listErrorMessage}
                    conversations={conversationItems}
                    selectedId={activeSelectedId}
                    expandedConversationId={expandedConversationId}
                    onToggleConversationExpand={handleToggleConversationExpand}
                    messageShortIntentsById={messageShortIntentsById}
                    messageIntentsLoadingId={messageIntentsLoadingId}
                    onIntentSelect={handleSelectIntent}
                    assignmentFilter={assignmentFilter}
                    onSelect={handleSelectConversation}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                    activeSearchTerm={debouncedSearch || undefined}
                    onLoadMore={loadMore}
                  />
                )}
              </>
            )}
          </div>

          <div
            className={cn(
              activeSelectedId && mobileView === "thread" ? "flex" : "hidden",
              "min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-chat-surface)] shadow-[var(--app-shadow-subtle)] xl:flex xl:h-full xl:min-h-0",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--inbox-chat-background)]">
              {showInitialListSkeleton ? (
                <InboxCenterSkeleton />
              ) : (
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <ConversationThread
                      hasSelectedId={Boolean(activeSelectedId)}
                      detailLoading={detailLoading && !selected}
                      detailErrorMessage={detailErrorMessage}
                      headerTitle={selected?.subject || selected?.contact?.nombre || "Conversation"}
                      headerSubtitle={`${selected?.contact?.nombre || selected?.contact?.email || "Unidentified contact"}${selected?.contact?.empresa ? ` · ${selected.contact?.empresa}` : ""}`}
                      channel={selected?.channel || "email"}
                      statusValue={selected?.status || "new"}
                      statusOptions={statusEditOptions}
                      onStatusChange={handleStatusChange}
                      statusBadgeClassName={statusBadgeDisplay}
                      messages={threadMessages}
                      selectedMessageId={selectedMessageId}
                      onSelectMessage={handleSelectMessageInThread}
                      onRestoreMessage={(messageId) => handleTrashMessage(messageId, false)}
                      onBack={handleBackToList}
                      onOpenContext={() => setContextSheetOpen(true)}
                      emailViewMode={emailViewMode}
                      onEmailViewModeChange={handleEmailViewModeChange}
                    />
                  </div>

                  {selected && (
                    <>
                      {/*
                        Workspace category editor. Renders only when the active workspace
                        has a non-empty `taxonomies.inbox` (the editor short-circuits to
                        `null` otherwise, so tenants without taxonomies see no extra
                        chrome). On save we refetch BOTH the list and the detail so the
                        chip filter and any list rows reflect the new value immediately.
                        `canMutate` mirrors the API gate (>= MEMBER); VIEWER sees a
                        disabled selector with an explanatory tooltip.
                      */}
                      <ConversationCategoryEditor
                        conversationId={selected.id}
                        value={(selected as { category?: string | null }).category ?? null}
                        canMutate={Boolean(currentUserId)}
                        onSaved={() => {
                          refetch()
                          refetchDetail()
                        }}
                        className="mx-3 mb-2 rounded-lg border border-[var(--inbox-list-border)]/60 bg-[var(--inbox-list-surface)]/60 px-3 py-1.5"
                      />
                      {/*
                        Phase 3 — internal note TODO suggestion banner. Renders only when the
                        operator just saved an internal note whose body started with `TODO:`,
                        `To-do:`, or `Pendiente:` AND we're still on the same conversation.
                        The banner offers an opt-in CTA (we never auto-create silently); a
                        dismiss button kills the suggestion without leaving a trace. After a
                        successful create the banner clears itself and the generic capture
                        feedback toast (todoCaptureFeedback) handles the success message.
                      */}
                      {internalNoteTodoSuggestion &&
                      internalNoteTodoSuggestion.conversationId === activeSelectedId ? (
                        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100">
                          <ListPlus className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                          <div className="min-w-0 flex-1 leading-snug">
                            <div className="font-medium text-emerald-100/95">Create To-do from this note?</div>
                            <div className="truncate text-emerald-200/70">{internalNoteTodoSuggestion.title}</div>
                          </div>
                          <button
                            type="button"
                            disabled={internalNoteTodoBusy}
                            onClick={() => void handleAcceptInternalNoteTodo()}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-50 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {internalNoteTodoBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                            )}
                            Create To-do
                          </button>
                          <button
                            type="button"
                            aria-label="Dismiss To-do suggestion"
                            onClick={handleDismissInternalNoteTodo}
                            className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-emerald-200/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-50"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                      {/*
                        Phase 3 — generic capture feedback toast. Reused by all three capture
                        surfaces (pending item, message action, internal note). Auto-clears on
                        a timer (~3.5s). Kept compact and on the same row band so it doesn't
                        push the composer down on every confirmation.
                      */}
                      {todoCaptureFeedback ? (
                        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5 text-[11px] text-emerald-100">
                          <Sparkles className="h-3 w-3 shrink-0 text-emerald-300" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{todoCaptureFeedback}</span>
                        </div>
                      ) : null}
                      <ReplyComposer
                        channel={selected.channel}
                        channelLabel={channelLabel(selected.channel, uiLocale)}
                        signedInEmail={currentUserEmail}
                        subject={selected.subject}
                        detectedLanguage={selected.detectedLanguage}
                        replyContent={replyContent}
                        replyIsInternal={replyIsInternal}
                        replySending={replySending}
                        replyStatus={replyStatus}
                        cannedOpen={cannedOpen}
                        composerTextareaRef={composerTextareaRef}
                        attachments={replyAttachments}
                        attachmentUploading={attachmentUploading}
                        emailMode={emailMode}
                        emailCc={emailCc}
                        emailBcc={emailBcc}
                        emailForwardTo={emailForwardTo}
                        onEmailModeChange={setEmailMode}
                        onEmailCcChange={setEmailCc}
                        onEmailBccChange={setEmailBcc}
                        onEmailForwardToChange={setEmailForwardTo}
                        onReplyModeChange={setReplyIsInternal}
                        onReplyContentChange={(value) => {
                          setReplyContent(value)
                          if (autoPopulated) setAutoPopulated(false)
                        }}
                        onCannedOpenChange={setCannedOpen}
                        onAttachFiles={handleAttachFiles}
                        onRemoveAttachment={handleRemoveAttachment}
                        onSend={sendReply}
                        replyTarget={replyTarget}
                        onClearReplyTarget={handleClearReplyTarget}
                        latestActionAnchor={latestActionAnchor}
                        actingOnScope={actingOnScope}
                        onActingOnScopeChange={setActingOnScope}
                        hasSelectedMessage={Boolean(effectiveSelectedMessageId)}
                        requestConfirmation={requestConfirmation}
                        onRequestConfirmationChange={setRequestConfirmation}
                        conversationActions={{
                          onArchive: handleArchiveConversation,
                          onClose: handleCloseConversation,
                          onTrash: handleTrashConversation,
                          onMarkResolved: handleMarkConversationResolved,
                          onRestoreFromTrash: handleRestoreConversationFromTrash,
                          onUnarchive: handleUnarchiveConversation,
                          onReopen: handleReopenConversation,
                          onMarkNeedsAction: handleMarkConversationNeedsAction,
                          currentStatus: selected.status,
                        }}
                        messageActions={messageActionsForComposer}
                        fannySuggestionTitle={suggestedDraft?.title ?? null}
                        fannySuggestionContent={suggestedDraft?.content ?? null}
                        onApplyFannySuggestion={
                          suggestedDraft?.content
                            ? (content) => {
                                const trimmed = content.trim()
                                const baseline = suggestedDraft.content.trim()
                                const unchanged = trimmed === baseline
                                setReplyContent(content)
                                setReplyIsInternal(false)
                                setReplyStatus(null)
                                activeDraftIdRef.current = suggestedDraft.id
                                if (unchanged) {
                                  setAutoPopulated(true)
                                } else {
                                  updateDraft(suggestedDraft.id, { status: "edited" }).catch(() => null)
                                }
                                requestComposerFocus(false)
                              }
                            : undefined
                        }
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden min-h-0 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-intelligence-background)] shadow-[var(--app-shadow-subtle)] xl:flex xl:flex-col xl:h-full xl:min-h-0">
            {showInitialListSkeleton ? (
              <InboxContextSkeleton />
            ) : selected ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">{contextPanel}</div>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[var(--inbox-background)]/7">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-[var(--inbox-text-secondary)]/30" />
                  <p className="text-xs text-[var(--inbox-text-secondary)]">Context will appear here</p>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        <Sheet open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
          <SheetContent side="bottom" className="h-[85dvh] rounded-t-[28px] border-t border-[var(--inbox-border)] bg-[var(--inbox-surface)] p-0 xl:hidden">
            <SheetHeader className="border-b border-[var(--inbox-divider)] px-4 py-4 text-left">
              <SheetTitle>{selected?.subject || selected?.contact.nombre || "Conversation context"}</SheetTitle>
              <SheetDescription>
                Smart Handoff, drafts, actions, and business context for the current conversation.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto bg-[var(--inbox-background)]/10 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              {contextPanel}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Action input dialog — replaces window.prompt */}
      <Dialog open={!!pendingActionInput} onOpenChange={(open) => { if (!open) setPendingActionInput(null) }}>
        <DialogContent className="max-w-sm">
          {pendingActionInput?.dialogType === "assign" && (
            <>
              <DialogHeader>
                <DialogTitle>Assign owner</DialogTitle>
                <DialogDescription>Select a team member to assign this conversation to.</DialogDescription>
              </DialogHeader>
              <div className="py-3">
                {members.length > 0 ? (
                  <select
                    className="w-full rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 text-sm text-[var(--inbox-text)]"
                    value={dialogAssignValue}
                    onChange={(e) => setDialogAssignValue(e.target.value)}
                    autoFocus
                  >
                    <option value="">Choose a member…</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.nombre || m.email} ({formatRoleLabel(m.role)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="User ID"
                    className="w-full rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 text-sm text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]"
                    value={dialogAssignValue}
                    onChange={(e) => setDialogAssignValue(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  type="button"
                  className="rounded-md border border-[var(--inbox-border)] px-4 py-2 text-sm hover:bg-[var(--inbox-background)]"
                  onClick={() => setPendingActionInput(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[var(--inbox-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={!dialogAssignValue.trim()}
                  onClick={handleDialogConfirm}
                >
                  Assign
                </button>
              </DialogFooter>
            </>
          )}

          {pendingActionInput?.dialogType === "dismiss" && (
            <>
              <DialogHeader>
                <DialogTitle>Dismiss action</DialogTitle>
                <DialogDescription>Optionally explain why this action is being dismissed.</DialogDescription>
              </DialogHeader>
              <div className="py-3">
                <textarea
                  className="w-full rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 text-sm text-[var(--inbox-text)] placeholder:text-[var(--inbox-text-secondary)]"
                  rows={3}
                  placeholder="Reason (optional)"
                  value={dialogDismissReason}
                  onChange={(e) => setDialogDismissReason(e.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  type="button"
                  className="rounded-md border border-[var(--inbox-border)] px-4 py-2 text-sm hover:bg-[var(--inbox-background)]"
                  onClick={() => setPendingActionInput(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[var(--inbox-destructive)] px-4 py-2 text-sm font-medium text-white"
                  onClick={handleDialogConfirm}
                >
                  Dismiss
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Compose new email */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Email</DialogTitle>
            <DialogDescription>Compose and send a new email from your inbox.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Input
                placeholder="Recipient email"
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                disabled={composeSending}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
              <Input
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                disabled={composeSending}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                placeholder="Write your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                disabled={composeSending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={composeSending}>
              Cancel
            </Button>
            <Button
              onClick={handleComposeSend}
              disabled={composeSending || !composeTo.includes("@") || !composeBody.trim()}
              className="gap-1.5"
            >
              {composeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {composeSending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
       * Talk to Fanny — control de IA a nivel Inbox, separado del composer. El Mic del composer
       * (tab Voice del AI panel) sigue siendo el dictado de respuesta; este botón es para preguntar
       * a Fanny sobre mensajes/conversaciones/inbox sin escribir un reply.
       */}
      <TalkToFanny
        conversationId={activeSelectedId}
        selectedMessageId={effectiveSelectedMessageId}
        actingOnScope={actingOnScope}
        latestInboundMessageId={lastInboundMessageId}
      />
    </AppShell>
  )
}

function InboxPageFallback() {
  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]} contentClassName="max-w-[1800px] min-h-0 flex-1">
      <div className="-mx-4 -mt-2 flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--inbox-background)] md:-mx-8">
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 p-3", DESKTOP_INBOX_GRID)}>
          <div className="min-h-0 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-list-background)] shadow-[var(--app-shadow-subtle)] xl:h-full">
            <InboxListSkeleton />
          </div>
          <div className="hidden min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-chat-surface)] shadow-[var(--app-shadow-subtle)] xl:flex xl:h-full xl:min-h-0">
            <InboxCenterSkeleton />
          </div>
          <div className="hidden min-h-0 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--inbox-intelligence-background)] shadow-[var(--app-shadow-subtle)] xl:flex xl:flex-col xl:h-full xl:min-h-0">
            <InboxContextSkeleton />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxPageFallback />}>
      <InboxPageContent />
    </Suspense>
  )
}

function InboxListSkeleton() {
  return (
    <div className="h-full w-full bg-[var(--inbox-surface)] xl:flex xl:flex-col xl:overflow-hidden">
      <div className="space-y-3 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)] px-4 py-4 md:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 bg-white/15" />
            <Skeleton className="h-3 w-40 bg-white/15" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full bg-white/15" />
            <Skeleton className="h-6 w-14 rounded-full bg-white/15" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-[var(--inbox-radius-control)] bg-white/15" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 w-full rounded-[var(--inbox-radius-control)] bg-white/15" />
          <Skeleton className="h-10 w-full rounded-[var(--inbox-radius-control)] bg-white/15" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-8 w-full rounded-[var(--inbox-radius-control)] bg-white/15" />
          <Skeleton className="h-8 w-full rounded-[var(--inbox-radius-control)] bg-white/15" />
          <Skeleton className="h-8 w-full rounded-[var(--inbox-radius-control)] bg-white/15" />
        </div>
      </div>
      <div className="space-y-2 px-3 py-3 md:px-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="rounded-[var(--inbox-radius-control)] border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5 bg-white/15" />
                <Skeleton className="h-3 w-1/2 bg-white/15" />
              </div>
              <Skeleton className="h-3 w-12 bg-white/15" />
            </div>
            <Skeleton className="mt-3 h-3 w-full bg-white/15" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full bg-white/15" />
              <Skeleton className="h-5 w-14 rounded-full bg-white/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InboxCenterSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--inbox-chat-background)]">
      <div className="shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20 bg-white/15" />
            <Skeleton className="h-5 w-2/3 bg-white/15" />
            <Skeleton className="h-4 w-1/2 bg-white/15" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-44 rounded-[var(--inbox-radius-control)] bg-white/15" />
            <Skeleton className="h-9 w-28 rounded-[var(--inbox-radius-control)] bg-white/15" />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 bg-[var(--inbox-chat-background)] px-4 py-4 md:px-5 md:py-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[78%] rounded-[18px] border border-white/12 bg-white/[0.07] p-4 shadow-sm",
              index % 2 === 1 && "ml-auto",
            )}
          >
            <Skeleton className="h-3 w-24 bg-white/15" />
            <Skeleton className="mt-3 h-3 w-full bg-white/15" />
            <Skeleton className="mt-2 h-3 w-4/5 bg-white/15" />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-3 md:px-5">
        <div className="rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] p-4 shadow-[var(--inbox-panel-shadow-sm)]">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-[var(--inbox-radius-control)] bg-white/15" />
            <Skeleton className="h-8 w-24 rounded-[var(--inbox-radius-control)] bg-white/15" />
          </div>
          <Skeleton className="mt-4 h-32 w-full rounded-2xl bg-white/15" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-[var(--inbox-radius-control)] bg-white/15" />
              <Skeleton className="h-8 w-20 rounded-[var(--inbox-radius-control)] bg-white/15" />
            </div>
            <Skeleton className="h-9 w-32 rounded-[var(--inbox-radius-control)] bg-white/15" />
          </div>
        </div>
      </div>
    </div>
  )
}

function InboxContextSkeleton() {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--inbox-background)]/7 p-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] p-4 shadow-[var(--inbox-panel-shadow-sm)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-[10px] bg-white/15" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-white/15" />
                <Skeleton className="h-3 w-40 bg-white/15" />
              </div>
            </div>
            <Skeleton className="h-4 w-4 rounded-full bg-white/15" />
          </div>
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-16 w-full rounded-[10px] bg-white/15" />
            <Skeleton className="h-12 w-full rounded-[10px] bg-white/15" />
          </div>
        </div>
      ))}
    </div>
  )
}
