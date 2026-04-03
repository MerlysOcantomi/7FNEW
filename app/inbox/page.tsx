"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { InlineSelect, InlineText, InlineTextarea } from "@/components/inline-edit"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Play,
  FolderKanban,
  History,
  Loader2,
  Mail,
  MessageSquare,
  ShieldCheck,
  Search,
  Send,
  Sparkles,
  User,
  Users,
  WandSparkles,
  X,
} from "lucide-react"

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

function ConversationCard({
  item,
  selected,
  onClick,
}: {
  item: ConversationListItem
  selected: boolean
  onClick: () => void
}) {
  const preview = item.summary ?? item.classification?.summary ?? item.messages?.[0]?.content ?? "No summary"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        selected ? "border-[#BFDBFE] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#0F172A] truncate">
              {item.subject || item.contact.nombre || "New conversation"}
            </p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusBadge(item.status))}>
              {statusLabel(item.status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B] truncate">
            {item.contact.nombre || item.contact.email || "Unidentified contact"}
            {item.contact.empresa ? ` · ${item.contact.empresa}` : ""}
          </p>
        </div>
        <span className="text-[10px] text-[#94A3B8]">{formatRelativeDate(item.lastMessageAt)}</span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#64748B]">
        {preview}
      </p>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
          {channelLabel(item.channel)}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyBadge(item.urgency))}>
          {urgencyLabel(item.urgency)}
        </span>
        {typeof item.leadScore === "number" && (
          <span className="rounded-full bg-[#0F172A] px-2 py-0.5 text-[10px] font-medium text-white">
            Lead {item.leadScore}
          </span>
        )}
      </div>
    </button>
  )
}

export default function InboxPage() {
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
  const lastAutoPopulatedDraftRef = useRef<string | null>(null)

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
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
    if (selectedId && !conversations.some((item) => item.id === selectedId)) {
      setSelectedId(conversations[0]?.id ?? null)
    }
  }, [conversations, selectedId])

  useEffect(() => {
    setReplyContent("")
    setReplyIsInternal(false)
    setReplyStatus(null)
    setHandoffExpanded(false)
    setDraftsExpanded(false)
    setActionsExpanded(false)
    setAutoPopulated(false)
    lastAutoPopulatedDraftRef.current = null
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

  const statusSelectOptions = STATUS_OPTIONS
    .filter((s) => s !== "all")
    .map((s) => ({ value: s, label: statusLabel(s) }))

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

  const contextPanel = selected ? (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
        {selected.handoff ? (
          <>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1E3A8A]">
                  {selected.handoff.headline || "Smart Handoff"}
                </p>
                {selected.handoff.summary && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#1D4ED8]/80">
                    {selected.handoff.summary}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", handoffStatusBadge(selected.handoff.status))}>
                  {handoffStatusLabel(selected.handoff.status)}
                </span>
                {selected.handoff.status !== "reviewed" && (
                  <button
                    onClick={() => updateHandoff({ status: "reviewed" }, "Handoff marked as reviewed")}
                    className="rounded-md p-1 text-[#1D4ED8] hover:bg-[#DBEAFE]"
                    title="Mark as reviewed"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setHandoffExpanded(!handoffExpanded)}
                  className="rounded-md p-1 text-[#1D4ED8] hover:bg-[#DBEAFE]"
                >
                  {handoffExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!handoffExpanded && selected.handoff.nextRecommendedAction && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5">
                <Play className="h-3 w-3 shrink-0 text-[#2563EB]" />
                <p className="text-[11px] font-medium text-[#1E3A8A]">{selected.handoff.nextRecommendedAction}</p>
              </div>
            )}

            {handoffExpanded && (
              <div className="mt-4 space-y-4 border-t border-[#BFDBFE]/50 pt-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Headline</p>
                  <div className="mt-1 text-[#1E3A8A]">
                    <InlineText value={selected.handoff.headline || ""} placeholder="Add operational headline..." className="text-sm font-semibold" onSave={(value) => updateHandoff({ headline: value })} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Summary</p>
                  <InlineTextarea value={selected.handoff.summary || ""} placeholder="Add operational summary..." className="mt-1 bg-white/70 text-[#1E3A8A]" rows={3} onSave={(value) => updateHandoff({ summary: value })} />
                </div>
                <div className="grid gap-2">
                  {([
                    { label: "Facts", key: "facts" as const },
                    { label: "Decisions", key: "decisions" as const },
                    { label: "Pending items", key: "pendingItems" as const },
                    { label: "Risks", key: "risks" as const },
                  ]).map(({ label, key }) => (
                    <div key={key} className="rounded-lg bg-white/80 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{label}</p>
                      <InlineTextarea value={linesToText(selected.handoff![key])} placeholder={`One ${label.toLowerCase().replace(/s$/, "")} per line...`} className="mt-1 bg-transparent px-0 py-0 text-sm text-[#1E3A8A]" rows={2} onSave={(value) => updateHandoff({ [key]: textToLines(value) })} />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Next recommended action</p>
                  <InlineTextarea value={selected.handoff.nextRecommendedAction || ""} placeholder="Add recommended next step..." className="mt-1 bg-white/70 text-[#1E3A8A]" rows={2} onSave={(value) => updateHandoff({ nextRecommendedAction: value })} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                  {confidenceLabel(selected.handoff.confidence) && <span>Confidence {confidenceLabel(selected.handoff.confidence)}</span>}
                  {selected.handoff.reviewedBy && <span>· Reviewed by {selected.handoff.reviewedBy}</span>}
                  {selected.handoff.reviewedAt && <span>· {formatDateTime(selected.handoff.reviewedAt)}</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1D4ED8]">Smart Handoff</p>
              <p className="mt-1 text-xs leading-relaxed text-[#1E3A8A]">
                {selected.classification?.summary || selected.summary || "AI has not generated a summary for this conversation yet."}
              </p>
              {(selected.classification?.intent || selected.classification?.suggestedTags?.length) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.classification?.intent && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#1D4ED8]">{selected.classification.intent}</span>
                  )}
                  {selected.classification?.suggestedTags?.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#475569]">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {handoffState && <p className="mt-2 text-xs text-[#475569]">{handoffState}</p>}
      </div>

      {selected.drafts && selected.drafts.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <button onClick={() => setDraftsExpanded(!draftsExpanded)} className="flex w-full items-center justify-between gap-2 p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Drafts</p>
              <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#475569]">{selected.drafts.length}</span>
            </div>
            {draftsExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          {draftsExpanded && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
              {selected.drafts.map((draft) => (
                <div key={draft.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <InlineText value={draft.title || ""} placeholder="Draft title..." className="text-sm font-semibold text-foreground" onSave={(value) => updateDraft(draft.id, { title: value })} />
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", draftStatusBadge(draft.status))}>{draftStatusLabel(draft.status)}</span>
                    </div>
                    <InlineSelect value={draft.status} options={editableDraftStatusOptions(draft.status)} onSave={(value) => updateDraft(draft.id, { status: value }, "Draft status updated")} badgeClassName={(value) => draftStatusBadge(value)} />
                  </div>
                  <div className="mt-2">
                    <InlineTextarea value={draft.content || ""} placeholder="Draft content..." className="mt-0" rows={4} onSave={(value) => updateDraft(draft.id, { content: value })} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      {draft.tone && <span>Tone: {draft.tone}</span>}
                      <span>{formatRelativeDate(draft.createdAt)}</span>
                    </div>
                    {["draft", "edited", "approved"].includes(draft.status) && draft.content?.trim() && (
                      <button onClick={() => { setReplyContent(draft.content); setReplyIsInternal(false); setReplyStatus(null) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]">
                        <Send className="h-3 w-3" /> Use as reply
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {draftState && <p className="text-xs text-muted-foreground">{draftState}</p>}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <button onClick={() => setActionsExpanded(!actionsExpanded)} className="flex w-full items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Actions</p>
            {selected.actions && selected.actions.filter((a) => a.status === "suggested").length > 0 && (
              <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">
                {selected.actions.filter((a) => a.status === "suggested").length} suggested
              </span>
            )}
          </div>
          {actionsExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {actionsExpanded && (
          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
            {selected.actions && selected.actions.length > 0 && (
              <div className="space-y-2">
                {selected.actions.map((action) => {
                  const title = typeof action.data?.title === "string" && action.data.title.trim() ? action.data.title : actionTypeLabel(action.type)
                  const description = typeof action.data?.description === "string" ? action.data.description : null
                  const isPending = pendingActionId === action.id
                  return (
                    <div key={action.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{title}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", actionStatusBadge(action.status))}>{actionStatusLabel(action.status)}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {action.status === "suggested" && (
                            <>
                              <button onClick={() => handleSuggestedAction(action, "approve")} disabled={isPending} className="rounded-md bg-[#0F172A] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#1E293B] disabled:opacity-50">
                                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                              </button>
                              <button onClick={() => handleSuggestedAction(action, "dismiss")} disabled={isPending} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">Dismiss</button>
                            </>
                          )}
                          {action.status === "approved" && (
                            <button onClick={() => handleSuggestedAction(action, "execute")} disabled={isPending} className="rounded-md bg-[#2563EB] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50">
                              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Execute"}
                            </button>
                          )}
                        </div>
                      </div>
                      {description && <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>}
                      {action.executionNotes && <p className="mt-1.5 text-xs text-[#475569]"><span className="font-semibold">Notes:</span> {action.executionNotes}</p>}
                      {action.errorMessage && <p className="mt-1.5 text-xs text-[#991B1B]"><span className="font-semibold">Error:</span> {action.errorMessage}</p>}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Convert</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => handleConvert("cliente")} className="inline-flex items-center gap-1.5 rounded-md bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#1E293B]"><User className="h-3 w-3" /> Client</button>
                <button onClick={() => handleConvert("proyecto")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"><FolderKanban className="h-3 w-3" /> Project</button>
                <button onClick={() => handleConvert("tarea")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"><CheckSquare className="h-3 w-3" /> Task</button>
              </div>
            </div>
            {actionState && <p className="mt-2 text-xs text-muted-foreground">{actionState}</p>}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Business context</p>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Mail className="h-4 w-4" /><span>{selected.contact.email || "No email"}</span></div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Building2 className="h-4 w-4" /><span>{selected.contact.empresa || "No company"}</span></div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /><span>{selected.messageCount} messages</span></div>
          {selected.cliente && (
            <Link href={`/clientes/${selected.cliente.id}`} className="flex items-center gap-3 text-sm text-[#2563EB] hover:underline"><User className="h-4 w-4" />Linked client: {selected.cliente.nombre}</Link>
          )}
          {selected.proyecto && (
            <Link href={`/proyectos/${selected.proyecto.id}`} className="flex items-center gap-3 text-sm text-[#2563EB] hover:underline"><FolderKanban className="h-4 w-4" />Linked project: {selected.proyecto.nombre}</Link>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#F8FAFC] p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[#64748B]">Channel</p>
            <p className="mt-0.5 text-xs font-medium text-[#0F172A]">{channelLabel(selected.channel)}</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[#64748B]">Lead</p>
            <p className="mt-0.5 text-xs font-medium text-[#0F172A]">{selected.leadScore ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[#64748B]">Lang</p>
            <p className="mt-0.5 text-xs font-medium text-[#0F172A]">{selected.detectedLanguage?.toUpperCase() || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]}>
      <div className="-mx-4 -mt-2 md:-mx-8 lg:h-[calc(100dvh-4.5rem)] lg:overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:h-full">

          {/* ── Col 1: Inbox List ── */}
          <div className="shrink-0 border-b border-border bg-card lg:w-[340px] lg:border-b-0 lg:border-r lg:flex lg:flex-col lg:h-full">
            <div className="p-4 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <h1 className="text-base font-semibold text-foreground">Inbox</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{loading ? "—" : stats.total} conv</span>
                  {stats.leads > 0 && <span className="rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-semibold text-[#166534]">{stats.leads} leads</span>}
                  {stats.urgent > 0 && <span className="rounded-full bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#991B1B]">{stats.urgent} urgent</span>}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground outline-none transition-colors focus:border-[#3B82F6]"
                />
              </div>
              <div className="flex gap-2">
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none">
                  {STATUS_OPTIONS.map((option) => (<option key={option} value={option}>{option === "all" ? "All statuses" : option}</option>))}
                </select>
                <select value={channel} onChange={(event) => setChannel(event.target.value)} className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none">
                  {CHANNEL_OPTIONS.map((option) => (<option key={option} value={option}>{option === "all" ? "All channels" : channelLabel(option)}</option>))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                {(["all", "mine", "unassigned"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setAssignmentFilter(value)}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                      assignmentFilter === value ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]",
                    )}
                  >
                    {value === "all" ? "All" : value === "mine" ? "Mine" : "Unassigned"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : listErrorMessage ? (
                <div className="p-6 text-center">
                  <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">{isWorkspaceUnavailable ? "Activate a workspace." : listErrorMessage}</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs font-medium text-foreground">No conversations</p>
                </div>
              ) : (
                conversations.map((item) => (
                  <ConversationCard key={item.id} item={item} selected={selectedId === item.id} onClick={() => setSelectedId(item.id)} />
                ))
              )}
            </div>
          </div>

          {/* ── Col 2: Conversation ── */}
          <div className="flex-1 min-w-0 flex flex-col lg:h-full">
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Select a conversation</p>
                </div>
              </div>
            ) : detailLoading && !selected ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailErrorMessage ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">Could not load conversation</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detailErrorMessage}</p>
                </div>
              </div>
            ) : selected ? (
              <>
                {/* Header */}
                <div className="shrink-0 border-b border-border bg-card px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">
                        {selected.subject || selected.contact.nombre || "Conversation"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selected.contact.nombre || selected.contact.email || "Unidentified contact"}
                        {selected.contact.empresa ? ` · ${selected.contact.empresa}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          value={selected.assignedTo ?? ""}
                          onChange={(e) => handleAssign(e.target.value)}
                          disabled={assignSaving}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (<option key={m.userId} value={m.userId}>{m.nombre || m.email}</option>))}
                          {selected.assignedTo && !members.some((m) => m.userId === selected.assignedTo) && (
                            <option value={selected.assignedTo} disabled>{selected.assignedTo} (unknown)</option>
                          )}
                        </select>
                        {assignSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>
                      <InlineSelect
                        value={selected.status}
                        options={statusSelectOptions}
                        onSave={handleStatusChange}
                        badgeClassName={(value) => statusBadge(value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Messages thread */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-3">
                    {selected.messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages.</p>
                    ) : (
                      selected.messages.map((message) => {
                        const isOutbound = message.direction === "outbound" && !message.isInternal
                        const isInternal = message.isInternal
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "rounded-lg border p-3",
                              isInternal
                                ? "border-[#FDE68A] bg-[#FFFBEB]"
                                : isOutbound
                                  ? "border-[#BFDBFE] bg-[#EFF6FF]"
                                  : "border-border bg-background",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{message.role}</span>
                                <span className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                                  isInternal ? "bg-[#FEF3C7] text-[#92400E]" : isOutbound ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#475569]",
                                )}>
                                  {isInternal ? "Internal note" : message.direction}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{formatRelativeDate(message.createdAt)}</span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-foreground">{message.content}</p>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Context panel inline for < 1440px */}
                  <div className="mt-6 min-[1440px]:hidden">
                    {contextPanel}
                  </div>
                </div>

                {/* Composer — sticky bottom */}
                <div className="shrink-0 border-t border-border bg-card px-5 py-4 space-y-3">
                  {(() => {
                    const suggestedDraft = selected.drafts?.find(
                      (d) => ["draft", "edited", "approved"].includes(d.status) && d.content?.trim()
                    )
                    if (!suggestedDraft || replyContent.trim()) return null
                    return (
                      <div className="flex items-start gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-[#1D4ED8]">Farah suggests a reply{suggestedDraft.title ? `: ${suggestedDraft.title}` : ""}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#1E3A8A]/80">{suggestedDraft.content}</p>
                        </div>
                        <button onClick={() => { setReplyContent(suggestedDraft.content); setReplyIsInternal(false); setReplyStatus(null) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#2563EB] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]">
                          <Send className="h-3 w-3" /> Use
                        </button>
                      </div>
                    )
                  })()}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setReplyIsInternal(false)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", !replyIsInternal ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]")}>Reply</button>
                    <button onClick={() => setReplyIsInternal(true)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", replyIsInternal ? "bg-[#92400E] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]")}>Internal note</button>
                  </div>
                  {autoPopulated && (
                    <div className="flex items-center gap-1.5 rounded-md bg-[#EDE9FE] px-2.5 py-1.5">
                      <Sparkles className="h-3 w-3 text-[#7C3AED]" />
                      <span className="text-[11px] font-medium text-[#6D28D9]">Suggested by Farah</span>
                      <button onClick={() => { setReplyContent(""); setAutoPopulated(false) }} className="ml-auto rounded p-0.5 text-[#7C3AED] hover:bg-[#DDD6FE]" title="Clear suggestion"><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  <textarea
                    value={replyContent}
                    onChange={(event) => { setReplyContent(event.target.value); if (autoPopulated) setAutoPopulated(false) }}
                    placeholder={replyIsInternal ? "Write an internal note..." : "Write a reply..."}
                    rows={3}
                    className={cn(
                      "w-full resize-none rounded-lg border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[#3B82F6]",
                      replyIsInternal ? "border-[#FDE68A] bg-[#FFFBEB]" : "border-border bg-background",
                    )}
                    onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendReply() }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-muted-foreground">
                      {replyIsInternal ? "This note will not be delivered externally" : "Outbound reply"}{" \u00B7 Ctrl+Enter"}
                    </p>
                    <button
                      onClick={sendReply}
                      disabled={replySending || !replyContent.trim()}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50",
                        replyIsInternal ? "bg-[#92400E] hover:bg-[#78350F]" : "bg-[#0F172A] hover:bg-[#1E293B]",
                      )}
                    >
                      {replySending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {replyIsInternal ? "Save note" : "Send reply"}
                    </button>
                  </div>
                  {replyStatus && <p className="text-xs text-muted-foreground">{replyStatus}</p>}
                </div>
              </>
            ) : null}
          </div>

          {/* ── Col 3: Farah Context Panel (>= 1440px) ── */}
          <div className="hidden min-[1440px]:flex w-[360px] shrink-0 flex-col border-l border-border bg-card lg:h-full">
            {selected ? (
              <div className="flex-1 overflow-y-auto p-4">
                {contextPanel}
              </div>
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
      </div>
    </AppShell>
  )
}
