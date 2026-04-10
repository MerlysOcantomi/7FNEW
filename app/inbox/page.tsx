"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ConversationList } from "@/components/inbox/conversation-list"
import { ContextPanel } from "@/components/inbox/context-panel"
import { FannyAssistCard, type FannyAssistState } from "@/components/inbox/fanny-assist-card"
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
import { Sparkles } from "lucide-react"

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
  } | null
  messages?: Array<{ content: string; role: string }>
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
]
const CHANNEL_OPTIONS = ["all", "manual", "web_chat", "email", "portal", "whatsapp"]
const DESKTOP_INBOX_GRID = "xl:grid xl:grid-cols-[minmax(296px,332px)_minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)] min-[1536px]:grid-cols-[minmax(312px,352px)_minmax(0,1fr)_408px] min-[1720px]:grid-cols-[minmax(320px,360px)_minmax(0,1fr)_440px]"

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Now"
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} h ago`
  if (days < 7) return `${days} d ago`
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

function statusBadge(status: string) {
  switch (status) {
    case "lead_detected":
      return "status-lead-detected"
    case "converted":
      return "status-converted"
    case "assigned":
      return "status-assigned"
    case "awaiting_response":
      return "status-awaiting-response"
    case "closed":
    case "archived":
      return "status-closed"
    case "triaged":
      return "status-triaged"
    case "new":
    default:
      return "status-new"
  }
}

function statusLabel(status: string) {
  return {
    new: "New",
    triaged: "Triaged",
    assigned: "Assigned",
    awaiting_response: "Awaiting response",
    lead_detected: "Lead detected",
    converted: "Converted",
    closed: "Closed",
    archived: "Archived",
  }[status] ?? status
}

function urgencyBadge(urgency: string) {
  switch (urgency) {
    case "critica":
      return "urgency-critical"
    case "alta":
      return "urgency-high"
    case "media":
      return "urgency-medium"
    default:
      return "urgency-low"
  }
}

function urgencyLabel(urgency: string) {
  return {
    critica: "Critical",
    alta: "High",
    media: "Medium",
    baja: "Low",
  }[urgency] ?? urgency
}

function channelLabel(channel: string) {
  return {
    manual: "Manual",
    web_chat: "Web chat",
    email: "Email",
    portal: "Portal",
    whatsapp: "WhatsApp",
  }[channel] ?? channel
}

function actionTypeLabel(type: string) {
  return {
    create_client: "Create client",
    create_project: "Create project",
    create_task: "Create task",
    schedule_followup: "Schedule follow-up",
    assign_operator: "Assign owner",
    generate_proposal: "Generate proposal",
  }[type] ?? type
}

function actionStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return "action-approved"
    case "executed":
      return "action-executed"
    case "dismissed":
      return "action-dismissed"
    case "failed":
      return "action-failed"
    case "suggested":
    default:
      return "action-suggested"
  }
}

function actionStatusLabel(status: string) {
  return {
    suggested: "Suggested",
    approved: "Approved",
    executed: "Executed",
    dismissed: "Dismissed",
    failed: "Failed",
  }[status] ?? status
}

function confidenceLabel(value?: number | null) {
  if (typeof value !== "number") return null
  return `${Math.round(value * 100)}%`
}

function formatDateTime(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function linesToText(value?: string[] | null) {
  return Array.isArray(value) ? value.join("\n") : ""
}

function textToLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatRoleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function InboxPageContent() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [channel, setChannel] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionState, setActionState] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [handoffState, setHandoffState] = useState<string | null>(null)
  const [draftState, setDraftState] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replyIsInternal, setReplyIsInternal] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [replyStatus, setReplyStatus] = useState<string | null>(null)
  const [handoffExpanded, setHandoffExpanded] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const [businessContextExpanded, setBusinessContextExpanded] = useState(false)
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [autoPopulated, setAutoPopulated] = useState(false)
  const [fannyDismissed, setFannyDismissed] = useState(false)
  const [fannyExpanded, setFannyExpanded] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "thread">("list")
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [cannedOpen, setCannedOpen] = useState(false)
  const [pendingActionInput, setPendingActionInput] = useState<PendingActionInput | null>(null)
  const [dialogAssignValue, setDialogAssignValue] = useState("")
  const [dialogDismissReason, setDialogDismissReason] = useState("")
  const [replyAttachments, setReplyAttachments] = useState<ComposerAttachment[]>([])
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [emailMode, setEmailMode] = useState<EmailSendMode>("reply")
  const [emailCc, setEmailCc] = useState("")
  const [emailBcc, setEmailBcc] = useState("")
  const [emailForwardTo, setEmailForwardTo] = useState("")
  const lastAutoPopulatedDraftRef = useRef<string | null>(null)
  const activeDraftIdRef = useRef<string | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [extraConversations, setExtraConversations] = useState<ConversationListItem[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pendingComposerFocusRef = useRef(false)

  const searchParams = useSearchParams()
  const deepLinkId = searchParams.get("id")
  const lastDeepLinkRef = useRef<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.authenticated && json.user?.userId) setCurrentUserId(json.user.userId)
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

  const PAGE_SIZE = 50

  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const params = new URLSearchParams()
  params.set("pageSize", String(PAGE_SIZE))
  if (debouncedSearch) params.set("q", debouncedSearch)
  if (status !== "all") params.set("status", status)
  if (channel !== "all") params.set("channel", channel)
  if (assignmentFilter === "mine" && currentUserId) params.set("assignedTo", currentUserId)
  if (assignmentFilter === "unassigned") params.set("assignedTo", "unassigned")

  const {
    data: conversationsData,
    meta: conversationsMeta,
    loading,
    error,
    refetch,
  } = useFetch<ConversationListItem[]>(`/api/inbox/conversations?${params.toString()}`, { refreshKey })

  const baseConversations = useMemo(
    () => (Array.isArray(conversationsData) ? conversationsData : []),
    [conversationsData],
  )
  const conversations = useMemo(
    () => [...baseConversations, ...extraConversations],
    [baseConversations, extraConversations],
  )

  const filterKey = `${debouncedSearch}|${status}|${channel}|${assignmentFilter}|${currentUserId}|${refreshKey}`
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

  const isWorkspaceUnavailable = error === "No tienes workspace asignado"
  const isGenericListFailure = error === "Error interno del servidor"
  const listErrorMessage =
    isWorkspaceUnavailable
      ? "Inbox is not available yet for this workspace."
      : isGenericListFailure
        ? "Inbox could not load conversations right now."
      : error

  const activeSelectedId = useMemo(() => {
    if (selectedId && conversations.some((item) => item.id === selectedId)) {
      return selectedId
    }

    if (deepLinkId && conversations.some((item) => item.id === deepLinkId)) {
      return deepLinkId
    }

    return conversations[0]?.id ?? null
  }, [conversations, deepLinkId, selectedId])

  useEffect(() => {
    if (deepLinkId && deepLinkId !== lastDeepLinkRef.current) {
      lastDeepLinkRef.current = deepLinkId
      if (conversations.some((c) => c.id === deepLinkId)) {
        setSelectedId(deepLinkId)
        setMobileView("thread")
        return
      }
    }

    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
    if (selectedId && !conversations.some((item) => item.id === selectedId)) {
      setSelectedId(conversations[0]?.id ?? null)
    }
  }, [conversations, selectedId, deepLinkId])

  useEffect(() => {
    setReplyContent("")
    setReplyIsInternal(false)
    setReplyStatus(null)
    setHandoffExpanded(false)
    setActionsExpanded(false)
    setBusinessContextExpanded(false)
    setAutoPopulated(false)
    setFannyDismissed(false)
    setFannyExpanded(false)
    setContextSheetOpen(false)
    setCannedOpen(false)
    lastAutoPopulatedDraftRef.current = null
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
    refetch: refetchDetail,
  } = useFetch<ConversationDetail>(
    activeSelectedId ? `/api/inbox/conversations/${activeSelectedId}` : null,
    { refreshKey },
  )

  const isDetailWorkspaceUnavailable = detailError === "No tienes workspace asignado"
  const isGenericDetailFailure = detailError === "Error interno del servidor"
  const detailErrorMessage =
    isDetailWorkspaceUnavailable
      ? "This conversation is not available until a workspace is active."
      : isGenericDetailFailure
        ? "This conversation could not be loaded right now."
        : detailError
  const selected = activeSelectedId ? (detailData ?? null) : null

  useEffect(() => {
    if (!selected?.drafts?.length || !selected?.messages?.length) return
    if (replyContent.trim()) return

    const lastMsg = selected.messages[selected.messages.length - 1]
    if (lastMsg.direction !== "inbound") return

    const draft = selected.drafts.find(
      (d) =>
        d.type === "ghost_reply" &&
        ["draft", "edited"].includes(d.status) &&
        d.sourceMessageId === lastMsg.id &&
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const serverLeads = typeof conversationsMeta?.leads === "number" ? conversationsMeta.leads : null
  const serverUrgent = typeof conversationsMeta?.urgent === "number" ? conversationsMeta.urgent : null

  const stats = useMemo(() => {
    if (conversations.length === 0) {
      return { total: 0, leads: 0, converted: 0, urgent: 0 }
    }
    return {
      total: serverTotal ?? conversations.length,
      leads: serverLeads ?? conversations.filter((item) => item.status === "lead_detected").length,
      converted: conversations.filter((item) => item.status === "converted").length,
      urgent: serverUrgent ?? conversations.filter((item) => item.urgency === "alta" || item.urgency === "critica").length,
    }
  }, [conversations, serverTotal, serverLeads, serverUrgent])

  async function handleConvert(action: "cliente" | "proyecto" | "tarea" | "todo") {
    if (!selectedId) return

    setActionState("Processing...")
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
    setDraftState("Saving draft...")
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not save the draft")
      setDraftState(successMessage)
      setRefreshKey((value) => value + 1)
      refetchDetail()
    } catch (err) {
      setDraftState(err instanceof Error ? err.message : "Unknown error")
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

  const statusFilterOptions = STATUS_OPTIONS
    .map((s) => ({ value: s, label: s === "all" ? "All statuses" : statusLabel(s) }))

  const statusEditOptions = STATUS_OPTIONS
    .filter((s) => s !== "all")
    .map((s) => ({ value: s, label: statusLabel(s) }))

  const channelSelectOptions = CHANNEL_OPTIONS.map((option) => ({
    value: option,
    label: option === "all" ? "All channels" : channelLabel(option),
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
            nombre: `${selected.assignedTo} (unknown)`,
            email: selected.assignedTo,
            avatar: null,
            role: "unknown",
          },
        ]
      : members

  // Get all messages from all conversations for the left column
  const allMessages = conversations.flatMap((conversation) => 
    (conversation.messages || [])
      .filter(message => message.content && message.content.trim().length > 0)
      .map((message) => {
      const isOutbound = message.direction === "outbound" && !message.isInternal
      const isInbound = message.direction === "inbound" && !message.isInternal
      const isInternal = message.isInternal
      
      return {
        id: `${conversation.id}-${message.id}`,
        conversationId: conversation.id,
        messageId: message.id,
        channel: conversation.channel,
        title: isOutbound 
          ? "You" 
          : conversation.contact.nombre || conversation.contact.email || "Contact",
        subtitle: isInternal 
          ? `Internal note • ${conversation.contact.nombre || conversation.contact.email || "Unidentified"}`
          : `${conversation.contact.nombre || conversation.contact.email || "Unidentified contact"}${conversation.contact.empresa ? ` · ${conversation.contact.empresa}` : ""}`,
        preview: message.content.length > 100 ? `${message.content.slice(0, 100)}...` : message.content,
        fullMessage: message.content,
        timeLabel: formatRelativeDate(message.createdAt),
        createdAt: message.createdAt, // Keep raw date for sorting
        isUnread: conversation.status === "new" && isInbound,
        statusLabel: statusLabel(conversation.status),
        statusClassName: statusBadge(conversation.status),
        channelLabel: channelLabel(conversation.channel),
        urgencyLabel: urgencyLabel(conversation.urgency),
        urgencyClassName: urgencyBadge(conversation.urgency),
        leadScore: conversation.leadScore,
        direction: message.direction,
        isInternal: message.isInternal,
        tone: isInternal ? "internal" : isOutbound ? "outbound" : isInbound ? "inbound" : "system",
        authorName: isOutbound ? "You" : conversation.contact.nombre || conversation.contact.email || "Contact",
      }
    })
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Sort by most recent first

  // Keep conversation items for now (we might need them for other purposes)
  const conversationItems = conversations.map((item) => {
    // Get first client message (original message)
    const firstClientMessage = item.messages?.find(msg => 
      msg.direction === "inbound" && !msg.isInternal
    )
    
    return {
      id: item.id,
      channel: item.channel,
      title:
        item.channel === "email"
          ? item.subject || item.contact.nombre || "New conversation"
          : item.contact.nombre || item.contact.email || item.subject || "New conversation",
      subtitle: `${item.contact.nombre || item.contact.email || "Unidentified contact"}${item.contact.empresa ? ` · ${item.contact.empresa}` : ""}`,
      preview: item.summary ?? item.classification?.summary ?? null,
      fullMessage: firstClientMessage?.content || null,
      timeLabel: formatRelativeDate(item.lastMessageAt),
      isUnread: item.status === "new",
      statusLabel: statusLabel(item.status),
      statusClassName: statusBadge(item.status),
      channelLabel: channelLabel(item.channel),
      urgencyLabel: urgencyLabel(item.urgency),
      urgencyClassName: urgencyBadge(item.urgency),
      leadScore: item.leadScore,
    }
  })

  const threadMessages =
    selected?.messages.map((message) => {
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
        }
      } catch { /* ignore parse errors */ }

      return {
        id: message.id,
        authorLabel: isInternal
          ? "Internal note"
          : isOutbound
            ? "Team"
            : selected.contact.nombre || selected.contact.email || "Contact",
        roleLabel: formatRoleLabel(message.role),
        metaLabel: isInternal ? "Internal note" : isOutbound ? "Outbound" : isInbound ? "Inbound" : "System",
        timestampLabel: formatRelativeDate(message.createdAt),
        content: message.content,
        tone,
        attachments: msgAttachments,
        emailMeta: msgEmailMeta,
      }
    }) ?? []

  const suggestedDraft =
    selected?.drafts?.find(
      (draft) => ["draft", "edited", "approved"].includes(draft.status) && draft.content?.trim(),
    ) ?? null

  const fannySummary =
    selected?.handoff?.summary ||
    selected?.classification?.summary ||
    selected?.summary ||
    null
  const fannyNextAction =
    selected?.handoff?.nextRecommendedAction ||
    (selected?.classification?.nextBestAction &&
    typeof selected.classification.nextBestAction === "object"
      ? (
          ["label", "title", "action"]
            .map((key) => selected.classification?.nextBestAction?.[key])
            .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null
        )
      : null)
  const fannyHasContent = Boolean(suggestedDraft?.content?.trim() || fannySummary || fannyNextAction)
  const fannyState: FannyAssistState = !selected || fannyDismissed || !fannyHasContent || conversations.length === 0
    ? "hidden"
    : autoPopulated || fannyExpanded
      ? "expanded"
      : "compact"


  const selectedIndex = useMemo(
    () => conversations.findIndex((item) => item.id === activeSelectedId),
    [activeSelectedId, conversations],
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

  function handleBackToList() {
    setMobileView("list")
    setCannedOpen(false)
    setContextSheetOpen(false)
  }

  const navigateConversation = useCallback((offset: 1 | -1) => {
    if (!activeSelectedId || conversations.length === 0 || selectedIndex < 0) return

    const nextIndex = selectedIndex + offset
    if (nextIndex < 0 || nextIndex >= conversations.length) return

    setSelectedId(conversations[nextIndex].id)
  }, [activeSelectedId, conversations, selectedIndex])

  const handleInboxEscape = useCallback(() => {
    if (contextSheetOpen) {
      setContextSheetOpen(false)
      return
    }

    if (activeSelectedId && mobileView === "thread" && isMobileInboxViewport()) {
      handleBackToList()
    }
  }, [activeSelectedId, contextSheetOpen, isMobileInboxViewport, mobileView])

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
  const showDetailSkeleton = Boolean(activeSelectedId) && detailLoading && !selected

  const contextPanel = selected && conversations.length > 0 ? (
    <ContextPanel
      selected={selected}
      handoffExpanded={handoffExpanded}
      setHandoffExpanded={setHandoffExpanded}
      actionsExpanded={actionsExpanded}
      setActionsExpanded={setActionsExpanded}
      businessContextExpanded={businessContextExpanded}
      setBusinessContextExpanded={setBusinessContextExpanded}
      conversationStatusLabel={statusLabel(selected.status)}
      conversationStatusClassName={statusBadge(selected.status)}
      updateHandoff={updateHandoff}
      handoffState={handoffState}
      linesToText={linesToText}
      textToLines={textToLines}
      confidenceLabel={confidenceLabel}
      formatDateTime={formatDateTime}
      pendingActionId={pendingActionId}
      handleSuggestedAction={handleSuggestedAction}
      actionTypeLabel={actionTypeLabel}
      actionStatusBadge={actionStatusBadge}
      actionStatusLabel={actionStatusLabel}
      handleConvert={handleConvert}
      actionState={actionState}
      channelLabel={channelLabel}
      members={displayedMembers}
      assignSaving={assignSaving}
      onAssign={handleAssign}
    />
  ) : null

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]} contentClassName="max-w-[1520px]">
      <div className="-mx-4 -mt-2 flex h-full min-h-0 flex-col overflow-hidden bg-[var(--inbox-background)] md:-mx-8">
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 bg-[var(--inbox-background)] p-3", DESKTOP_INBOX_GRID)}>
          <div
            className={cn(
              mobileView === "thread" && activeSelectedId ? "hidden" : "block",
              "min-h-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] shadow-[var(--inbox-panel-shadow-sm)] xl:flex xl:h-full xl:flex-col",
            )}
          >
            {showInitialListSkeleton ? (
              <InboxListSkeleton />
            ) : (
              <ConversationList
                loading={loading}
                errorMessage={listErrorMessage}
                conversations={allMessages}
                selectedId={selected ? `${selected.id}-${selected.messages?.[selected.messages.length - 1]?.id || ''}` : null}
                search={search}
                onSearchChange={setSearch}
                status={status}
                statusOptions={statusFilterOptions}
                onStatusChange={setStatus}
                channel={channel}
                channelOptions={channelSelectOptions}
                onChannelChange={setChannel}
                assignmentFilter={assignmentFilter}
                onAssignmentFilterChange={setAssignmentFilter}
                stats={{ total: allMessages.length, leads: stats.leads, urgent: stats.urgent }}
                onSelect={(messageId) => {
                  // Extract conversationId from the messageId format: "conversationId-messageId"
                  const conversationId = messageId.split('-')[0]
                  handleSelectConversation(conversationId)
                }}
                hasMore={hasMore}
                loadingMore={loadingMore}
                activeSearchTerm={debouncedSearch || undefined}
                onLoadMore={loadMore}
              />
            )}
          </div>

          <div
            className={cn(
              activeSelectedId && mobileView === "thread" ? "flex" : "hidden",
              "min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] shadow-[var(--inbox-panel-shadow)] xl:flex xl:h-full xl:min-h-0",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--inbox-background)]/72">
              {showInitialListSkeleton || showDetailSkeleton ? (
                <InboxCenterSkeleton />
              ) : (
                <>
                  <div className="min-h-[280px] flex flex-1 flex-col overflow-hidden xl:min-h-[320px]">
                    <ConversationThread
                      hasSelectedId={Boolean(activeSelectedId)}
                      detailLoading={detailLoading && !selected}
                      detailErrorMessage={detailErrorMessage}
                      headerTitle={selected?.subject || selected?.contact.nombre || "Conversation"}
                      headerSubtitle={`${selected?.contact.nombre || selected?.contact.email || "Unidentified contact"}${selected?.contact.empresa ? ` · ${selected.contact.empresa}` : ""}`}
                      statusValue={selected?.status || "new"}
                      statusOptions={statusEditOptions}
                      onStatusChange={handleStatusChange}
                      statusBadgeClassName={statusBadge}
                      messages={threadMessages}
                      onBack={handleBackToList}
                      onOpenContext={() => setContextSheetOpen(true)}
                      fannyState={fannyState}
                      fannySummary={fannySummary}
                      fannySuggestionTitle={suggestedDraft?.title || null}
                      fannySuggestionContent={suggestedDraft?.content || null}
                      fannyNextRecommendedAction={fannyNextAction}
                      fannyConfidenceLabel={selected ? confidenceLabel(selected.handoff?.confidence) : null}
                      fannyDetectedLanguage={selected?.detectedLanguage}
                      fannyAutoPopulated={autoPopulated}
                      onFannyToggleExpanded={() => setFannyExpanded((value) => !value)}
                      onFannyInsertSuggestion={suggestedDraft?.content
                        ? () => {
                            setReplyContent(suggestedDraft.content)
                            setReplyIsInternal(false)
                            setReplyStatus(null)
                            setAutoPopulated(true)
                            setFannyExpanded(true)
                            activeDraftIdRef.current = suggestedDraft.id
                            requestComposerFocus(false)
                          }
                        : undefined}
                      onFannyEditSuggestion={suggestedDraft?.content
                        ? () => {
                            setReplyContent(suggestedDraft.content)
                            setReplyIsInternal(false)
                            setReplyStatus(null)
                            setFannyExpanded(true)
                            activeDraftIdRef.current = suggestedDraft.id
                            updateDraft(suggestedDraft.id, { status: "edited" }).catch(() => null)
                            requestComposerFocus(false)
                          }
                        : undefined}
                      onFannyDismiss={() => {
                        setFannyDismissed(true)
                        if (autoPopulated) {
                          setAutoPopulated(false)
                        }
                      }}
                    />
                  </div>

                  {selected && (
                    <>
                      <ReplyComposer
                        channel={selected.channel}
                        channelLabel={channelLabel(selected.channel)}
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
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden min-h-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] shadow-[var(--inbox-panel-shadow-sm)] xl:flex xl:flex-col xl:h-full xl:min-h-0">
            {showInitialListSkeleton || showDetailSkeleton ? (
              <InboxContextSkeleton />
            ) : selected ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--inbox-background)]/7 p-4">{contextPanel}</div>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[var(--inbox-background)]/7">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Context will appear here</p>
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
                    className="w-full rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 text-sm"
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
                    className="w-full rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 text-sm"
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
                  className="w-full rounded-md border border-[var(--inbox-border)] bg-[var(--inbox-surface)] px-3 py-2 text-sm"
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
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
                  onClick={handleDialogConfirm}
                >
                  Dismiss
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function InboxPageFallback() {
  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]} contentClassName="max-w-[1520px]">
      <div className="-mx-4 -mt-2 flex h-full min-h-0 flex-col overflow-hidden bg-[var(--inbox-background)] md:-mx-8">
        <div className={cn("flex min-h-0 flex-1 flex-col gap-3 bg-[var(--inbox-background)] p-3", DESKTOP_INBOX_GRID)}>
          <div className="min-h-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] shadow-[var(--inbox-panel-shadow-sm)] xl:h-full">
            <InboxListSkeleton />
          </div>
          <div className="hidden min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] shadow-[var(--inbox-panel-shadow)] xl:flex xl:h-full xl:min-h-0">
            <InboxCenterSkeleton />
          </div>
          <div className="hidden min-h-0 overflow-hidden rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] shadow-[var(--inbox-panel-shadow-sm)] xl:flex xl:flex-col xl:h-full xl:min-h-0">
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
            <Skeleton className="h-4 w-20 bg-[var(--inbox-divider)]" />
            <Skeleton className="h-3 w-40 bg-[var(--inbox-divider)]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full bg-[var(--inbox-divider)]" />
            <Skeleton className="h-6 w-14 rounded-full bg-[var(--inbox-divider)]" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 w-full rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
          <Skeleton className="h-10 w-full rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-8 w-full rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
          <Skeleton className="h-8 w-full rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
          <Skeleton className="h-8 w-full rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
        </div>
      </div>
      <div className="space-y-2 px-3 py-3 md:px-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="rounded-[var(--inbox-radius-control)] border border-[var(--inbox-divider)] bg-[var(--inbox-background)]/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5 bg-[var(--inbox-divider)]" />
                <Skeleton className="h-3 w-1/2 bg-[var(--inbox-divider)]" />
              </div>
              <Skeleton className="h-3 w-12 bg-[var(--inbox-divider)]" />
            </div>
            <Skeleton className="mt-3 h-3 w-full bg-[var(--inbox-divider)]" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full bg-[var(--inbox-divider)]" />
              <Skeleton className="h-5 w-14 rounded-full bg-[var(--inbox-divider)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InboxCenterSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--inbox-background)]/72">
      <div className="shrink-0 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/98 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20 bg-[var(--inbox-divider)]" />
            <Skeleton className="h-5 w-2/3 bg-[var(--inbox-divider)]" />
            <Skeleton className="h-4 w-1/2 bg-[var(--inbox-divider)]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-44 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
            <Skeleton className="h-9 w-28 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 bg-[linear-gradient(180deg,rgba(246,247,249,0.92)_0%,rgba(246,247,249,0.5)_72%,rgba(246,247,249,0.24)_100%)] px-4 py-4 md:px-5 md:py-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[78%] rounded-[18px] border border-[var(--inbox-divider)] bg-[var(--inbox-surface)] p-4 shadow-sm",
              index % 2 === 1 && "ml-auto",
            )}
          >
            <Skeleton className="h-3 w-24 bg-[var(--inbox-divider)]" />
            <Skeleton className="mt-3 h-3 w-full bg-[var(--inbox-divider)]" />
            <Skeleton className="mt-2 h-3 w-4/5 bg-[var(--inbox-divider)]" />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/96 px-4 py-3 md:px-5">
        <div className="rounded-[var(--inbox-radius-panel)] border border-[var(--inbox-border)] bg-[var(--inbox-surface)] p-4 shadow-[var(--inbox-panel-shadow-sm)]">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
            <Skeleton className="h-8 w-24 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
          </div>
          <Skeleton className="mt-4 h-32 w-full rounded-2xl bg-[var(--inbox-divider)]" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
              <Skeleton className="h-8 w-20 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
            </div>
            <Skeleton className="h-9 w-32 rounded-[var(--inbox-radius-control)] bg-[var(--inbox-divider)]" />
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
              <Skeleton className="h-8 w-8 rounded-[10px] bg-[var(--inbox-divider)]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-[var(--inbox-divider)]" />
                <Skeleton className="h-3 w-40 bg-[var(--inbox-divider)]" />
              </div>
            </div>
            <Skeleton className="h-4 w-4 rounded-full bg-[var(--inbox-divider)]" />
          </div>
          <div className="mt-4 grid gap-2">
            <Skeleton className="h-16 w-full rounded-[10px] bg-[var(--inbox-divider)]" />
            <Skeleton className="h-12 w-full rounded-[10px] bg-[var(--inbox-divider)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
