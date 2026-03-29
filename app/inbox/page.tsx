"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { InlineSelect, InlineText, InlineTextarea } from "@/components/inline-edit"
import { SectionPage } from "@/components/section-page"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Bot,
  Briefcase,
  Building2,
  Check,
  CheckSquare,
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
  WandSparkles,
  X,
} from "lucide-react"

interface ConversationListItem {
  id: string
  channel: string
  status: string
  subject: string | null
  summary: string | null
  intent: string | null
  urgency: string
  leadScore: number | null
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

  const params = new URLSearchParams()
  params.set("pageSize", "100")
  if (search.trim()) params.set("q", search.trim())
  if (status !== "all") params.set("status", status)
  if (channel !== "all") params.set("channel", channel)

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

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]}>
      <SectionPage
        title="Smart Inbox"
        description="Conversational business layer: conversations, AI classification, operational context, and CRM transition without leaving 7F."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Conversations</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Detected leads</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.leads}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Converted</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.converted}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">High priority</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.urgent}</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by contact, subject, or context..."
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-[#3B82F6]"
                  />
                </div>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All statuses" : option}
                    </option>
                  ))}
                </select>
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All channels" : channelLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : listErrorMessage ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">Inbox is currently unavailable</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isWorkspaceUnavailable
                    ? "Activate or select a workspace to load conversations."
                    : listErrorMessage}
                </p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No conversations yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Conversations created from the inbox will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((item) => (
                  <ConversationCard
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {!selectedId ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Select a conversation.</p>
              </div>
            ) : detailLoading && !selected ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailErrorMessage ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Could not load this conversation</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {detailErrorMessage}
                </p>
              </div>
            ) : selected ? (
              <>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-foreground">
                        {selected.subject || selected.contact.nombre || "Conversation"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selected.contact.nombre || selected.contact.email || "Unidentified contact"}
                        {selected.contact.empresa ? ` · ${selected.contact.empresa}` : ""}
                      </p>
                    </div>
                    <InlineSelect
                      value={selected.status}
                      options={statusSelectOptions}
                      onSave={handleStatusChange}
                      badgeClassName={(value) => statusBadge(value)}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Channel</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{channelLabel(selected.channel)}</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Lead score</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{selected.leadScore ?? "No score"}</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Language</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{selected.detectedLanguage?.toUpperCase() || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#2563EB]" />
                    <p className="text-sm font-semibold text-[#1D4ED8]">Smart Handoff</p>
                  </div>
                  {selected.handoff ? (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", handoffStatusBadge(selected.handoff.status))}>
                          {handoffStatusLabel(selected.handoff.status)}
                        </span>
                        {confidenceLabel(selected.handoff.confidence) && (
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#1D4ED8]">
                            Confidence {confidenceLabel(selected.handoff.confidence)}
                          </span>
                        )}
                        {selected.handoff.reviewedAt && (
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#475569]">
                            Reviewed {formatDateTime(selected.handoff.reviewedAt)}
                          </span>
                        )}
                        {selected.handoff.status === "stale" && (
                          <span className="rounded-full bg-[#FEF3C7] px-2 py-1 text-[10px] font-medium text-[#92400E]">
                            Needs review
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Headline</p>
                          <div className="mt-1 text-[#1E3A8A]">
                            <InlineText
                              value={selected.handoff.headline || ""}
                              placeholder="Add operational headline..."
                              className="text-sm font-semibold"
                              onSave={(value) => updateHandoff({ headline: value })}
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Summary</p>
                          <InlineTextarea
                            value={selected.handoff.summary || ""}
                            placeholder="Add operational summary..."
                            className="mt-1 bg-white/70 text-[#1E3A8A]"
                            rows={4}
                            onSave={(value) => updateHandoff({ summary: value })}
                          />
                        </div>

                        <div className="grid gap-3">
                          <div className="rounded-lg bg-white/80 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Facts</p>
                            <InlineTextarea
                              value={linesToText(selected.handoff.facts)}
                              placeholder="One fact per line..."
                              className="mt-1 bg-transparent px-0 py-1 text-sm text-[#1E3A8A]"
                              rows={3}
                              onSave={(value) => updateHandoff({ facts: textToLines(value) })}
                            />
                          </div>
                          <div className="rounded-lg bg-white/80 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Decisions</p>
                            <InlineTextarea
                              value={linesToText(selected.handoff.decisions)}
                              placeholder="One decision per line..."
                              className="mt-1 bg-transparent px-0 py-1 text-sm text-[#1E3A8A]"
                              rows={3}
                              onSave={(value) => updateHandoff({ decisions: textToLines(value) })}
                            />
                          </div>
                          <div className="rounded-lg bg-white/80 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Pending items</p>
                            <InlineTextarea
                              value={linesToText(selected.handoff.pendingItems)}
                              placeholder="One pending item per line..."
                              className="mt-1 bg-transparent px-0 py-1 text-sm text-[#1E3A8A]"
                              rows={3}
                              onSave={(value) => updateHandoff({ pendingItems: textToLines(value) })}
                            />
                          </div>
                          <div className="rounded-lg bg-white/80 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Risks</p>
                            <InlineTextarea
                              value={linesToText(selected.handoff.risks)}
                              placeholder="One risk per line..."
                              className="mt-1 bg-transparent px-0 py-1 text-sm text-[#1E3A8A]"
                              rows={3}
                              onSave={(value) => updateHandoff({ risks: textToLines(value) })}
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Next recommended action</p>
                          <InlineTextarea
                            value={selected.handoff.nextRecommendedAction || ""}
                            placeholder="Add recommended next step..."
                            className="mt-1 bg-white/70 text-[#1E3A8A]"
                            rows={2}
                            onSave={(value) => updateHandoff({ nextRecommendedAction: value })}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => updateHandoff({ status: "reviewed" }, "Handoff marked as reviewed")}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Mark as reviewed
                          </button>
                          {selected.handoff.reviewedBy && (
                            <span className="text-xs text-[#475569]">
                              Reviewed by {selected.handoff.reviewedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-sm leading-relaxed text-[#1E3A8A]">
                        {selected.classification?.summary || selected.summary || "AI has not generated a summary for this conversation yet."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selected.classification?.intent && (
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#1D4ED8]">
                            Intent: {selected.classification.intent}
                          </span>
                        )}
                        {selected.classification?.suggestedTags?.map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#475569]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {handoffState && <p className="mt-3 text-xs text-[#475569]">{handoffState}</p>}
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Ghost Drafts</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {!selected.drafts || selected.drafts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                        No saved drafts for this conversation yet.
                      </div>
                    ) : (
                      selected.drafts.map((draft) => (
                        <div key={draft.id} className="rounded-lg border border-border bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <InlineText
                                  value={draft.title || ""}
                                  placeholder="Draft title..."
                                  className="text-sm font-semibold text-foreground"
                                  onSave={(value) => updateDraft(draft.id, { title: value })}
                                />
                                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", draftStatusBadge(draft.status))}>
                                  {draftStatusLabel(draft.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                                {draft.type}
                                {draft.targetChannel ? ` · ${channelLabel(draft.targetChannel)}` : ""}
                              </p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeDate(draft.createdAt)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
                              <div className="mt-1">
                                <InlineSelect
                                  value={draft.status}
                                  options={editableDraftStatusOptions(draft.status)}
                                  onSave={(value) => updateDraft(draft.id, { status: value }, "Draft status updated")}
                                  badgeClassName={(value) => draftStatusBadge(value)}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tone</p>
                              <div className="mt-1">
                                <InlineText
                                  value={draft.tone || ""}
                                  placeholder="Define tone..."
                                  className="text-sm text-foreground"
                                  onSave={(value) => updateDraft(draft.id, { tone: value })}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Content</p>
                            <InlineTextarea
                              value={draft.content || ""}
                              placeholder="Draft content..."
                              className="mt-1"
                              rows={6}
                              onSave={(value) => updateDraft(draft.id, { content: value })}
                            />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {draft.sourceMessageId && <span>Source message: {draft.sourceMessageId}</span>}
                              {draft.reviewedBy && <span>Reviewed by: {draft.reviewedBy}</span>}
                              {draft.reviewedAt && <span>Reviewed: {formatDateTime(draft.reviewedAt)}</span>}
                            </div>
                            {["draft", "edited", "approved"].includes(draft.status) && draft.content?.trim() && (
                              <button
                                onClick={() => {
                                  setReplyContent(draft.content)
                                  setReplyIsInternal(false)
                                  setReplyStatus(null)
                                }}
                                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                              >
                                <Send className="h-3 w-3" />
                                Use as reply
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {draftState && <p className="mt-3 text-xs text-muted-foreground">{draftState}</p>}
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <WandSparkles className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Suggested actions</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {!selected.actions || selected.actions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                        AI has not suggested actions for this conversation yet.
                      </div>
                    ) : (
                      selected.actions.map((action) => {
                        const title =
                          typeof action.data?.title === "string" && action.data.title.trim()
                            ? action.data.title
                            : actionTypeLabel(action.type)
                        const description =
                          typeof action.data?.description === "string" ? action.data.description : null
                        const isPending = pendingActionId === action.id

                        return (
                          <div key={action.id} className="rounded-lg border border-border bg-background p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">{title}</p>
                                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", actionStatusBadge(action.status))}>
                                    {actionStatusLabel(action.status)}
                                  </span>
                                  {confidenceLabel(action.confidence) && (
                                    <span className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                                      Confidence {confidenceLabel(action.confidence)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                                  {actionTypeLabel(action.type)}
                                </p>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeDate(action.createdAt)}
                              </span>
                            </div>

                            {description && (
                              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
                            )}

                            {action.executionNotes && (
                              <div className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-xs text-[#475569]">
                                <span className="font-semibold text-[#0F172A]">Notes:</span> {action.executionNotes}
                              </div>
                            )}

                            {action.errorMessage && (
                              <div className="mt-3 rounded-md bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
                                <span className="font-semibold">Error:</span> {action.errorMessage}
                              </div>
                            )}

                            {action.resultModule && action.resultId && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Result: {action.resultModule} · {action.resultId}
                              </p>
                            )}

                            {action.status === "suggested" && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleSuggestedAction(action, "approve")}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1E293B] disabled:opacity-50"
                                >
                                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleSuggestedAction(action, "dismiss")}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Dismiss
                                </button>
                              </div>
                            )}

                            {action.status === "approved" && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleSuggestedAction(action, "execute")}
                                  disabled={isPending}
                                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                                >
                                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                  Execute
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                  {actionState && <p className="mt-3 text-xs text-muted-foreground">{actionState}</p>}
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Manual actions</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleConvert("cliente")}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1E293B]"
                    >
                      <User className="h-3.5 w-3.5" />
                      Create client
                    </button>
                    <button
                      onClick={() => handleConvert("proyecto")}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      Create project
                    </button>
                    <button
                      onClick={() => handleConvert("tarea")}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Create task
                    </button>
                  </div>
                  {actionState && <p className="mt-3 text-xs text-muted-foreground">{actionState}</p>}
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Messages</p>
                  </div>
                  <div className="mt-4 space-y-3">
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
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                  {message.role}
                                </span>
                                <span className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                                  isInternal
                                    ? "bg-[#FEF3C7] text-[#92400E]"
                                    : isOutbound
                                      ? "bg-[#DBEAFE] text-[#1D4ED8]"
                                      : "bg-[#F1F5F9] text-[#475569]",
                                )}>
                                  {isInternal ? "Internal note" : message.direction}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeDate(message.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-foreground">{message.content}</p>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReplyIsInternal(false)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          !replyIsInternal ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]",
                        )}
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => setReplyIsInternal(true)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          replyIsInternal ? "bg-[#92400E] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]",
                        )}
                      >
                        Internal note
                      </button>
                    </div>
                    <textarea
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                      placeholder={replyIsInternal ? "Write an internal note..." : "Write a reply..."}
                      rows={3}
                      className={cn(
                        "w-full resize-none rounded-lg border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[#3B82F6]",
                        replyIsInternal ? "border-[#FDE68A] bg-[#FFFBEB]" : "border-border bg-background",
                      )}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          sendReply()
                        }
                      }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] text-muted-foreground">
                        {replyIsInternal
                          ? "This note will not be delivered externally"
                          : "This message will be recorded as an outbound reply"}
                        {" \u00B7 Ctrl+Enter to send"}
                      </p>
                      <button
                        onClick={sendReply}
                        disabled={replySending || !replyContent.trim()}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50",
                          replyIsInternal
                            ? "bg-[#92400E] hover:bg-[#78350F]"
                            : "bg-[#0F172A] hover:bg-[#1E293B]",
                        )}
                      >
                        {replySending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {replyIsInternal ? "Save note" : "Send reply"}
                      </button>
                    </div>
                    {replyStatus && <p className="text-xs text-muted-foreground">{replyStatus}</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Business context</p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{selected.contact.email || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{selected.contact.empresa || "No company"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{selected.messageCount} messages</span>
                    </div>
                    {selected.cliente && (
                      <Link href={`/clientes/${selected.cliente.id}`} className="flex items-center gap-3 text-sm text-[#2563EB] hover:underline">
                        <User className="h-4 w-4" />
                        Linked client: {selected.cliente.nombre}
                      </Link>
                    )}
                    {selected.proyecto && (
                      <Link href={`/proyectos/${selected.proyecto.id}`} className="flex items-center gap-3 text-sm text-[#2563EB] hover:underline">
                        <FolderKanban className="h-4 w-4" />
                        Linked project: {selected.proyecto.nombre}
                      </Link>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}
