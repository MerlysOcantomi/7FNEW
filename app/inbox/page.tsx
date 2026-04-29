"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ConversationList } from "@/components/inbox/conversation-list"
import { ContextPanel } from "@/components/inbox/context-panel"
import { ReplyComposer, type ComposerAttachment, type EmailSendMode } from "@/components/inbox/reply-composer"
import { ConversationThread } from "@/components/inbox/conversation-thread"
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
import { firstShortIntentFromRecentMessages } from "@/lib/inbox/parse-message-metadata"
import { formatSenderIntentPhrase } from "@/lib/inbox/format-sender-intent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Send, Loader2 } from "lucide-react"

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
  urgency: string
  leadScore: number | null
  assignedTo: string | null
  lastMessageAt: string
  messageCount: number
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
}

const STATUS_OPTIONS = [
  "all",
  "new",
  "triaged",
  "assigned",
  "awaiting_response",
  "lead_detected",
  "converted",
  "closed",
  "archived",
  "trashed",
]
const CHANNEL_OPTIONS = ["all", "manual", "web_chat", "email", "portal", "whatsapp"]
const DESKTOP_INBOX_GRID =
  "xl:grid xl:grid-cols-[minmax(288px,30%)_minmax(0,1fr)_minmax(320px,30%)] xl:grid-rows-[minmax(0,1fr)]"

function mapSidebarFilter(filter: string | null): { status?: string; urgency?: string } {
  switch (filter) {
    case "archived": return { status: "archived" }
    case "new": return { status: "new" }
    case "in_progress": return { status: "assigned,awaiting_response,triaged" }
    case "done": return { status: "closed,converted" }
    case "urgent": return { urgency: "alta,critica" }
    case "needs_reply": return { status: "awaiting_response" }
    case "leads": return { status: "lead_detected" }
    case "trash": return { status: "trashed" }
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
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionState, setActionState] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [handoffState, setHandoffState] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replyIsInternal, setReplyIsInternal] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [replyStatus, setReplyStatus] = useState<string | null>(null)
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")
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
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
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
  const lastDeepLinkRef = useRef<string | null>(null)

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
  if (status !== "all") {
    params.set("status", status)
  }
  if (filterParams.urgency) params.set("urgency", filterParams.urgency)
  if (channel !== "all") params.set("channel", channel)
  if (assignmentFilter === "mine" && currentUserId) params.set("assignedTo", currentUserId)
  if (assignmentFilter === "unassigned") params.set("assignedTo", "unassigned")

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
   */
  const conversationsForSidebar = useMemo(() => {
    if (status !== "all") return conversations
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
  }, [conversations, status])

  /**
   * Lista única para pintar/seleccionar/navegar: mismo filtro que `conversationsForSidebar`,
   * pero si ese filtro deja 0 filas y la API sí devolvió datos, degradamos a `conversations`.
   */
  const conversationsForList = useMemo(() => {
    if (conversations.length === 0) return []
    if (conversationsForSidebar.length > 0) return conversationsForSidebar
    return conversations
  }, [conversations, conversationsForSidebar])

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

    if (!selectedId && conversationsForList.length > 0) {
      setSelectedId(conversationsForList[0].id)
    }
    if (selectedId && !conversationsForList.some((item) => item.id === selectedId)) {
      setSelectedId(conversationsForList[0]?.id ?? null)
    }
  }, [conversationsForList, selectedId, deepLinkId])

  useEffect(() => {
    setReplyContent("")
    setReplyIsInternal(false)
    setReplyStatus(null)
    setAutoPopulated(false)
    setContextSheetOpen(false)
    setCannedOpen(false)
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

  const serverLeads = typeof conversationsMeta?.leads === "number" ? conversationsMeta.leads : null
  const serverUrgent = typeof conversationsMeta?.urgent === "number" ? conversationsMeta.urgent : null

  const stats = useMemo(() => {
    if (conversations.length === 0) {
      return {
        total: 0,
        leads: 0,
        urgent: 0,
        unread: 0,
        reply: 0,
        waiting: 0,
        done: 0,
        archived: 0,
        trash: 0,
      }
    }
    
    // Safe counting to avoid hydration mismatches
    const unreadCount = conversations.filter(conv => conv.status === "new").length
    const replyCount = conversations.filter(conv => 
      conv.status === "awaiting_response" || conv.status === "triaged"
    ).length
    
    return {
      total: serverTotal ?? conversations.length,
      leads: serverLeads ?? conversations.filter((item) => item.status === "lead_detected").length,
      urgent: serverUrgent ?? conversations.filter((item) => item.urgency === "alta" || item.urgency === "critica").length,
      unread: unreadCount,
      reply: replyCount,
      waiting: conversations.filter(conv => conv.status === "triaged").length,
      done: conversations.filter(conv => conv.status === "closed").length,
      archived: conversations.filter(conv => conv.status === "archived").length,
      trash: conversations.filter((conv) => conv.status === "trashed").length,
    }
  }, [conversations, serverTotal, serverLeads, serverUrgent])

  async function handleConvert(action: "cliente" | "proyecto" | "tarea" | "todo") {
    if (!selectedId) return

    setActionState("Processing...")
    try {
      /**
       * Phase 3: si hay un mensaje seleccionado válido en el detalle, pasamos `sourceMessageId`
       * para que el service prefiera ese mensaje como anchor del `sourceText`. Sin selección,
       * comportamiento previo (primer inbound).
       */
      const scopedMessageId = effectiveSelectedMessageId ?? null
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
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not send message")

      if (draftIdToMark) {
        updateDraft(draftIdToMark, { status: "sent" }).catch(() => null)
        activeDraftIdRef.current = null
      }

      setReplyContent("")
      setReplyIsInternal(false)
      setAutoPopulated(false)
      setReplyAttachments([])
      setEmailMode("reply")
      setEmailCc("")
      setEmailBcc("")
      setEmailForwardTo("")
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

  const conversationItems = useMemo(() =>
    conversationsForList.map((conversation) => {
      try {
        const contact = conversation.contact
        const primaryTitle =
          contact?.nombre?.trim() ||
          contact?.empresa?.trim() ||
          contact?.email?.trim() ||
          "Contact"

        const shortFromMessages = firstShortIntentFromRecentMessages(conversation.messages)

        const senderIntent =
          formatSenderIntentPhrase(shortFromMessages) ||
          formatSenderIntentPhrase(conversation.classification?.intent?.trim() || null) ||
          formatSenderIntentPhrase(conversation.intent?.trim() || null) ||
          formatSenderIntentPhrase(conversation.subject?.trim() || null) ||
          null

        return {
          id: conversation.id,
          channel: conversation.channel,
          title: primaryTitle,
          senderIntent,
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
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[inbox:audit:render] conversationItems row failed", conversation?.id, e)
        }
        return {
          id: conversation.id,
          channel: conversation.channel,
          title: "Conversation",
          senderIntent: null as string | null,
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
        }
      }
    }),
    [conversationsForList, uiLocale],
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

      return {
        id: message.id,
        authorLabel,
        roleLabel: formatRoleLabel(message.role),
        metaLabel: isInternal ? "Internal note" : isOutbound ? "Outbound" : isInbound ? "Inbound" : "System",
        timestampLabel: formatRelativeDate(message.createdAt, uiLocale),
        content: message.content,
        tone,
        attachments: msgAttachments,
        emailMeta: msgEmailMeta,
        fromLabel,
        recipientsLabel,
        subject,
        timestampFull,
      }
    }) ?? []

  const suggestedDraft =
    selected?.drafts?.find(
      (draft) => ["draft", "edited", "approved"].includes(draft.status) && draft.content?.trim(),
    ) ?? null

  /** Último mensaje inbound (anchor por defecto si no hay selección por-mensaje). */
  const lastInboundMessageId = useMemo(() => {
    if (!selected?.messages?.length) return null
    for (let i = selected.messages.length - 1; i >= 0; i--) {
      const m = selected.messages[i]
      if (m.direction === "inbound") return m.id
    }
    return null
  }, [selected])

  /**
   * `selectedMessageId` validado contra el detalle activo. Si no pertenece a la conversación
   * actualmente cargada, lo ignoramos (evita enviar un `sourceMessageId` inválido por race
   * entre el cambio de conversación y la llegada del nuevo detalle).
   */
  const effectiveSelectedMessageId = useMemo(() => {
    if (!selectedMessageId || !selected?.messages?.length) return null
    return selected.messages.some((m) => m.id === selectedMessageId) ? selectedMessageId : null
  }, [selectedMessageId, selected])

  /** Prioridad: mensaje seleccionado válido → último inbound → null. */
  const effectiveSourceMessageId = effectiveSelectedMessageId ?? lastInboundMessageId

  /**
   * Vista compacta del target de la respuesta. Phase B: además del autor/snippet/hora, derivamos
   * signals client-side (shortIntent, direction booleana, has attachments, has link) que el panel
   * usa para "What this message means". Sin AI extra, sin endpoints nuevos.
   */
  const replyTarget = useMemo(() => {
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
    }
  }, [effectiveSelectedMessageId, threadMessages, selected, selectedId, messageShortIntentsById])

  /**
   * Phase 4: anchor "por defecto" cuando NO hay selección por-mensaje. Refleja `lastInboundMessageId`
   * que es el mismo fallback que usa `effectiveSourceMessageId` para el envío. Sirve como preview en
   * el composer ("Replying to latest message") para que el usuario nunca tenga ambigüedad sobre qué
   * mensaje recibirá la acción.
   */
  const latestActionAnchor = useMemo(() => {
    if (effectiveSelectedMessageId) return null
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
  }, [effectiveSelectedMessageId, lastInboundMessageId, threadMessages])

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

  const selectedIndex = useMemo(
    () => conversationsForList.findIndex((item) => item.id === activeSelectedId),
    [activeSelectedId, conversationsForList],
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
     */
    async function parseResponse(
      res: Response,
    ): Promise<Array<{ messageId: string; text: string }>> {
      const json = (await res.json()) as {
        success?: boolean
        data?: Array<{ id: string; direction?: string; shortIntent: string }>
      }
      const rawRows = json?.success && Array.isArray(json.data) ? json.data : []
      const rows = rawRows.filter((r) => r.direction === "inbound")
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

  const handleFetchEmails = useCallback(async () => {
    setFetchingEmails(true)
    try {
      const res = await fetch("/api/inbox/fetch", { method: "POST" })
      const json = await res.json()
      setLastSyncedAt(new Date())
      if (json.data?.count > 0) {
        setRefreshKey((v) => v + 1)
        refetch()
      }
    } catch (err) {
      console.error("[inbox] Fetch failed:", err)
    } finally {
      setFetchingEmails(false)
    }
  }, [refetch])

  const navigateConversation = useCallback((offset: 1 | -1) => {
    if (!activeSelectedId || conversationsForList.length === 0 || selectedIndex < 0) return

    const nextIndex = selectedIndex + offset
    if (nextIndex < 0 || nextIndex >= conversationsForList.length) return

    setSelectedId(conversationsForList[nextIndex].id)
  }, [activeSelectedId, conversationsForList, selectedIndex])

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
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 p-3", DESKTOP_INBOX_GRID)}>
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
                {inboxTerminalRescueActive ? (
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
                search={search}
                onSearchChange={setSearch}
                status={status}
                statusOptions={statusFilterOptions}
                onStatusChange={handleListStatusFilterChange}
                channel={channel}
                channelOptions={channelSelectOptions}
                onChannelChange={setChannel}
                assignmentFilter={assignmentFilter}
                onAssignmentFilterChange={setAssignmentFilter}
                stats={stats}
                onSelect={handleSelectConversation}
                hasMore={hasMore}
                loadingMore={loadingMore}
                activeSearchTerm={debouncedSearch || undefined}
                onLoadMore={loadMore}
                onFetchEmails={handleFetchEmails}
                fetchingEmails={fetchingEmails}
                lastSyncedAt={lastSyncedAt}
                onCompose={() => setComposeOpen(true)}
              />
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
                      onBack={handleBackToList}
                      onOpenContext={() => setContextSheetOpen(true)}
                    />
                  </div>

                  {selected && (
                    <>
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
                        conversationActions={{
                          onArchive: handleArchiveConversation,
                          onClose: handleCloseConversation,
                          onTrash: handleTrashConversation,
                          currentStatus: selected.status,
                        }}
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
