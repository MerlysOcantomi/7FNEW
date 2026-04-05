"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { ConversationList } from "@/components/inbox/conversation-list"
import { ContextPanel } from "@/components/inbox/context-panel"
import { ReplyComposer } from "@/components/inbox/reply-composer"
import { ConversationThread } from "@/components/inbox/conversation-thread"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
      return "bg-[#DCFCE7] text-[#166534]"
    case "converted":
      return "bg-[#DBEAFE] text-[#1D4ED8]"
    case "assigned":
      return "bg-[#EDE9FE] text-[#6D28D9]"
    case "awaiting_response":
      return "bg-[#FCE7F3] text-[#BE185D]"
    case "closed":
    case "archived":
      return "bg-[#F1F5F9] text-[#64748B]"
    case "triaged":
      return "bg-[#FEF3C7] text-[#92400E]"
    case "new":
    default:
      return "bg-[#FEE2E2] text-[#991B1B]"
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
      return "bg-[#FEE2E2] text-[#991B1B]"
    case "alta":
      return "bg-[#FEF3C7] text-[#92400E]"
    case "media":
      return "bg-[#DBEAFE] text-[#1D4ED8]"
    default:
      return "bg-[#F1F5F9] text-[#64748B]"
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
      return "bg-[#EDE9FE] text-[#6D28D9]"
    case "executed":
      return "bg-[#DCFCE7] text-[#166534]"
    case "dismissed":
      return "bg-[#F1F5F9] text-[#64748B]"
    case "failed":
      return "bg-[#FEE2E2] text-[#991B1B]"
    case "suggested":
    default:
      return "bg-[#DBEAFE] text-[#1D4ED8]"
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

function handoffStatusBadge(status: string) {
  switch (status) {
    case "reviewed":
      return "bg-[#DCFCE7] text-[#166534]"
    case "stale":
      return "bg-[#FEF3C7] text-[#92400E]"
    case "generated":
    default:
      return "bg-[#DBEAFE] text-[#1D4ED8]"
  }
}

function handoffStatusLabel(status: string) {
  return {
    generated: "Generated",
    reviewed: "Reviewed",
    stale: "Stale",
  }[status] ?? status
}

function draftStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return "bg-[#EDE9FE] text-[#6D28D9]"
    case "sent":
      return "bg-[#DCFCE7] text-[#166534]"
    case "discarded":
    case "superseded":
      return "bg-[#F1F5F9] text-[#64748B]"
    case "edited":
      return "bg-[#FEF3C7] text-[#92400E]"
    case "draft":
    default:
      return "bg-[#DBEAFE] text-[#1D4ED8]"
  }
}

function draftStatusLabel(status: string) {
  return {
    draft: "Draft",
    edited: "Edited",
    approved: "Approved",
    sent: "Sent",
    discarded: "Discarded",
    superseded: "Superseded",
  }[status] ?? status
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

function editableDraftStatusOptions(currentStatus: string) {
  const options = [
    { value: "draft", label: "draft" },
    { value: "edited", label: "edited" },
    { value: "approved", label: "approved" },
    { value: "discarded", label: "discarded" },
  ]

  if (currentStatus === "sent") {
    return [{ value: "sent", label: "sent" }, ...options]
  }

  return options
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
  const [draftsExpanded, setDraftsExpanded] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [autoPopulated, setAutoPopulated] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "thread">("list")
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [cannedOpen, setCannedOpen] = useState(false)
  const lastAutoPopulatedDraftRef = useRef<string | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
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

  const params = new URLSearchParams()
  params.set("pageSize", "100")
  if (search.trim()) params.set("q", search.trim())
  if (status !== "all") params.set("status", status)
  if (channel !== "all") params.set("channel", channel)
  if (assignmentFilter === "mine" && currentUserId) params.set("assignedTo", currentUserId)
  if (assignmentFilter === "unassigned") params.set("assignedTo", "unassigned")

  const {
    data: conversationsData,
    loading,
    error,
    refetch,
  } = useFetch<ConversationListItem[]>(`/api/inbox/conversations?${params.toString()}`, { refreshKey })

  const conversations = Array.isArray(conversationsData) ? conversationsData : []
  const isWorkspaceUnavailable = error === "No tienes workspace asignado"
  const isGenericListFailure = error === "Error interno del servidor"
  const listErrorMessage =
    isWorkspaceUnavailable
      ? "Inbox is not available yet for this workspace."
      : isGenericListFailure
        ? "Inbox could not load conversations right now."
      : error

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
    setDraftsExpanded(false)
    setActionsExpanded(false)
    setAutoPopulated(false)
    setContextSheetOpen(false)
    setCannedOpen(false)
    lastAutoPopulatedDraftRef.current = null
    if (!selectedId) {
      setMobileView("list")
    }
    if (selectedId) {
      fetch(`/api/inbox/conversations/${selectedId}/read`, { method: "POST" }).catch(() => null)
    }
  }, [selectedId])

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useFetch<ConversationDetail>(
    selectedId ? `/api/inbox/conversations/${selectedId}` : null,
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
  const selected = detailData ?? null

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
    setReplyContent(draft.content)
    setAutoPopulated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const stats = useMemo(() => {
    return {
      total: conversations.length,
      leads: conversations.filter((item) => item.status === "lead_detected").length,
      converted: conversations.filter((item) => item.status === "converted").length,
      urgent: conversations.filter((item) => item.urgency === "alta" || item.urgency === "critica").length,
    }
  }, [conversations])

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

  async function handleSuggestedAction(action: NonNullable<ConversationDetail["actions"]>[number], operation: "approve" | "dismiss" | "execute") {
    if (!selectedId) return

    let payload: Record<string, unknown> = {}

    if (operation === "dismiss") {
      const executionNotes = window.prompt("Dismiss reason (optional):", "") ?? ""
      payload = executionNotes.trim() ? { executionNotes: executionNotes.trim() } : {}
    }

    if (operation === "execute") {
      if (action.type === "assign_operator") {
        const assignedTo = window.prompt("Enter the owner for this conversation:", "") ?? ""
        if (!assignedTo.trim()) return
        payload = { assignedTo: assignedTo.trim() }
      } else if (action.type === "schedule_followup" || action.type === "generate_proposal") {
        const executionNotes = window.prompt("Describe how this action was executed:", "") ?? ""
        if (!executionNotes.trim()) return
        payload = { executionNotes: executionNotes.trim() }
      }
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
    if (!selectedId || !replyContent.trim() || replySending) return

    setReplySending(true)
    setReplyStatus(null)
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          direction: "outbound",
          isInternal: replyIsInternal,
          role: "operator",
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Could not send message")

      setReplyContent("")
      setReplyIsInternal(false)
      setAutoPopulated(false)
      setReplyStatus(replyIsInternal ? "Note saved" : "Reply sent")
      setRefreshKey((value) => value + 1)
      refetch()
      refetchDetail()
    } catch (err) {
      setReplyStatus(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setReplySending(false)
    }
  }

  const sendReplyRef = useRef(sendReply)
  sendReplyRef.current = sendReply

  const statusSelectOptions = STATUS_OPTIONS
    .filter((s) => s !== "all")
    .map((s) => ({ value: s, label: statusLabel(s) }))

  const channelSelectOptions = CHANNEL_OPTIONS.map((option) => ({
    value: option,
    label: option === "all" ? "All channels" : channelLabel(option),
  }))

  const handleAssign = useCallback(async (newAssignedTo: string) => {
    if (!selectedId) return
    const value = newAssignedTo === "" ? null : newAssignedTo
    setAssignSaving(true)
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
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
  }, [selectedId, refetch, refetchDetail])

  async function handleStatusChange(newStatus: string) {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
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

  const conversationItems = conversations.map((item) => ({
    id: item.id,
    title: item.subject || item.contact.nombre || "New conversation",
    subtitle: `${item.contact.nombre || item.contact.email || "Unidentified contact"}${item.contact.empresa ? ` · ${item.contact.empresa}` : ""}`,
    preview: item.summary ?? item.classification?.summary ?? item.messages?.[0]?.content ?? "No summary",
    timeLabel: formatRelativeDate(item.lastMessageAt),
    isUnread: item.status === "new",
    statusLabel: statusLabel(item.status),
    statusClassName: statusBadge(item.status),
    channelLabel: channelLabel(item.channel),
    urgencyLabel: urgencyLabel(item.urgency),
    urgencyClassName: urgencyBadge(item.urgency),
    leadScore: item.leadScore,
  }))

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
      }
    }) ?? []

  const suggestedDraft =
    selected?.drafts?.find(
      (draft) => ["draft", "edited", "approved"].includes(draft.status) && draft.content?.trim(),
    ) ?? null

  const selectedIndex = useMemo(
    () => conversations.findIndex((item) => item.id === selectedId),
    [conversations, selectedId],
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
    if (!selectedId) return

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
  }, [focusComposerTextarea, isMobileInboxViewport, mobileView, selectedId])

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
  }

  function handleBackToList() {
    setMobileView("list")
    setCannedOpen(false)
    setContextSheetOpen(false)
  }

  const navigateConversation = useCallback((offset: 1 | -1) => {
    if (!selectedId || conversations.length === 0 || selectedIndex < 0) return

    const nextIndex = selectedIndex + offset
    if (nextIndex < 0 || nextIndex >= conversations.length) return

    setSelectedId(conversations[nextIndex].id)
  }, [conversations, selectedId, selectedIndex])

  const handleInboxEscape = useCallback(() => {
    if (contextSheetOpen) {
      setContextSheetOpen(false)
      return
    }

    if (selectedId && mobileView === "thread" && isMobileInboxViewport()) {
      handleBackToList()
    }
  }, [contextSheetOpen, isMobileInboxViewport, mobileView, selectedId])

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
          if (!selectedId) return
          handleSelectConversation(selectedId)
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
        enabled: Boolean(selectedId) && !cannedOpen,
        preventDefault: true,
        handler: () => sendReplyRef.current(),
      },
    ],
    [cannedOpen, contextSheetOpen, handleInboxEscape, navigateConversation, requestComposerFocus, selectedId],
  )

  useKeyboardShortcuts(inboxShortcuts, { scope: "page" })

  const contextPanel = selected ? (
    <ContextPanel
      selected={selected}
      handoffExpanded={handoffExpanded}
      setHandoffExpanded={setHandoffExpanded}
      draftsExpanded={draftsExpanded}
      setDraftsExpanded={setDraftsExpanded}
      actionsExpanded={actionsExpanded}
      setActionsExpanded={setActionsExpanded}
      updateHandoff={updateHandoff}
      handoffStatusBadge={handoffStatusBadge}
      handoffStatusLabel={handoffStatusLabel}
      handoffState={handoffState}
      linesToText={linesToText}
      textToLines={textToLines}
      confidenceLabel={confidenceLabel}
      formatDateTime={formatDateTime}
      editableDraftStatusOptions={editableDraftStatusOptions}
      updateDraft={updateDraft}
      draftStatusBadge={draftStatusBadge}
      draftStatusLabel={draftStatusLabel}
      formatRelativeDate={formatRelativeDate}
      setReplyContent={setReplyContent}
      setReplyIsInternal={setReplyIsInternal}
      setReplyStatus={setReplyStatus}
      pendingActionId={pendingActionId}
      handleSuggestedAction={handleSuggestedAction}
      actionTypeLabel={actionTypeLabel}
      actionStatusBadge={actionStatusBadge}
      actionStatusLabel={actionStatusLabel}
      handleConvert={handleConvert}
      actionState={actionState}
      channelLabel={channelLabel}
    />
  ) : null

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]}>
      <div className="-mx-4 -mt-2 md:-mx-8 xl:h-[calc(100dvh-4.5rem)] xl:overflow-hidden">
        <div className="flex h-full min-h-0 flex-col bg-background xl:flex-row">
          <div className={cn(mobileView === "thread" && selectedId ? "hidden" : "block", "min-h-0 xl:block xl:shrink-0")}>
            <ConversationList
              loading={loading}
              errorMessage={listErrorMessage}
              conversations={conversationItems}
              selectedId={selectedId}
              search={search}
              onSearchChange={setSearch}
              status={status}
              statusOptions={STATUS_OPTIONS}
              onStatusChange={setStatus}
              channel={channel}
              channelOptions={channelSelectOptions}
              onChannelChange={setChannel}
              assignmentFilter={assignmentFilter}
              onAssignmentFilterChange={setAssignmentFilter}
              stats={{ total: stats.total, leads: stats.leads, urgent: stats.urgent }}
              onSelect={handleSelectConversation}
            />
          </div>

          <div
            className={cn(
              selectedId && mobileView === "thread" ? "flex" : "hidden",
              "min-w-0 flex-1 flex-col xl:flex xl:h-full xl:min-h-0",
            )}
          >
            <ConversationThread
              hasSelectedId={Boolean(selectedId)}
              detailLoading={detailLoading && !selected}
              detailErrorMessage={detailErrorMessage}
              headerTitle={selected?.subject || selected?.contact.nombre || "Conversation"}
              headerSubtitle={`${selected?.contact.nombre || selected?.contact.email || "Unidentified contact"}${selected?.contact.empresa ? ` · ${selected.contact.empresa}` : ""}`}
              assignedTo={selected?.assignedTo ?? ""}
              members={displayedMembers}
              assignSaving={assignSaving}
              onAssign={handleAssign}
              statusValue={selected?.status || "new"}
              statusOptions={statusSelectOptions}
              onStatusChange={handleStatusChange}
              statusBadgeClassName={statusBadge}
              messages={threadMessages}
              onBack={handleBackToList}
              onOpenContext={() => setContextSheetOpen(true)}
            />

            {selected && (
              <ReplyComposer
                replyContent={replyContent}
                replyIsInternal={replyIsInternal}
                replySending={replySending}
                replyStatus={replyStatus}
                autoPopulated={autoPopulated}
                suggestedDraft={suggestedDraft}
                cannedOpen={cannedOpen}
                composerTextareaRef={composerTextareaRef}
                onReplyModeChange={setReplyIsInternal}
                onReplyContentChange={(value) => {
                  setReplyContent(value)
                  if (autoPopulated) setAutoPopulated(false)
                }}
                onCannedOpenChange={setCannedOpen}
                onSend={sendReply}
                onUseSuggestion={(content) => {
                  setReplyContent(content)
                  setReplyIsInternal(false)
                  setReplyStatus(null)
                }}
                onClearSuggestion={() => {
                  setReplyContent("")
                  setAutoPopulated(false)
                }}
              />
            )}
          </div>

          <div className="hidden w-[360px] shrink-0 border-l border-border bg-card min-[1440px]:flex xl:h-full xl:min-h-0">
            {selected ? (
              <div className="flex-1 overflow-y-auto p-4">{contextPanel}</div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Context will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <Sheet open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
          <SheetContent side="bottom" className="h-[85dvh] rounded-t-[28px] border-t p-0 min-[1440px]:hidden">
            <SheetHeader className="border-b border-border px-4 py-4 text-left">
              <SheetTitle>{selected?.subject || selected?.contact.nombre || "Conversation context"}</SheetTitle>
              <SheetDescription>
                Smart Handoff, drafts, actions, and business context for the current conversation.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              {contextPanel}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  )
}

function InboxPageFallback() {
  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]}>
      <div className="-mx-4 -mt-2 md:-mx-8">
        <div className="flex min-h-[50vh] items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading inbox...</p>
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
