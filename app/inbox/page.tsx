"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Bot,
  Briefcase,
  Building2,
  CheckSquare,
  Clock3,
  FolderKanban,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  User,
  WandSparkles,
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
  actions?: Array<{
    id: string
    type: string
    status: string
    data?: Record<string, unknown> | null
    resultModule?: string | null
    resultId?: string | null
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
  "todos",
  "new",
  "triaged",
  "assigned",
  "awaiting_response",
  "lead_detected",
  "converted",
  "closed",
  "archived",
]
const CHANNEL_OPTIONS = ["todos", "manual", "web_chat", "email", "portal", "whatsapp"]

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Ahora"
  if (minutes < 60) return `Hace ${minutes} min`
  if (hours < 24) return `Hace ${hours} h`
  if (days < 7) return `Hace ${days} d`
  return date.toLocaleDateString("es", { day: "numeric", month: "short" })
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

function channelLabel(channel: string) {
  return {
    manual: "Manual",
    web_chat: "Chat web",
    email: "Email",
    portal: "Portal",
    whatsapp: "WhatsApp",
  }[channel] ?? channel
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
  const preview = item.summary ?? item.classification?.summary ?? item.messages?.[0]?.content ?? "Sin resumen"

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
              {item.subject || item.contact.nombre || "Nueva conversación"}
            </p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusBadge(item.status))}>
              {item.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B] truncate">
            {item.contact.nombre || item.contact.email || "Contacto sin identificar"}
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
          {item.urgency}
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
  const [status, setStatus] = useState("todos")
  const [channel, setChannel] = useState("todos")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionState, setActionState] = useState<string | null>(null)

  const params = new URLSearchParams()
  params.set("pageSize", "100")
  if (search.trim()) params.set("q", search.trim())
  if (status !== "todos") params.set("status", status)
  if (channel !== "todos") params.set("channel", channel)

  const {
    data: conversationsData,
    loading,
    error,
    refetch,
  } = useFetch<ConversationListItem[]>(`/api/inbox/conversations?${params.toString()}`, { refreshKey })

  const conversations = Array.isArray(conversationsData) ? conversationsData : []

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
    if (selectedId && !conversations.some((item) => item.id === selectedId)) {
      setSelectedId(conversations[0]?.id ?? null)
    }
  }, [conversations, selectedId])

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useFetch<ConversationDetail>(
    selectedId ? `/api/inbox/conversations/${selectedId}` : null,
    { refreshKey },
  )

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

    setActionState("Procesando...")
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Error ejecutando acción")

      setActionState("Acción aplicada")
      setRefreshKey((value) => value + 1)
      refetch()
      refetchDetail()
    } catch (err) {
      setActionState(err instanceof Error ? err.message : "Error desconocido")
    }
  }

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox" }]}>
      <SectionPage
        title="Smart Inbox"
        description="Capa conversacional del negocio: conversaciones, clasificación IA, contexto operativo y transición a CRM sin salir de 7F."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Conversaciones</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Leads detectados</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.leads}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Convertidas</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "—" : stats.converted}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Alta prioridad</p>
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
                    placeholder="Buscar por contacto, asunto o contexto..."
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
                      {option === "todos" ? "Todos los estados" : option}
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
                      {option === "todos" ? "Todos los canales" : channelLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#EF4444]" />
                <p className="text-sm font-medium text-[#991B1B]">{error}</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No hay conversaciones aún</p>
                <p className="mt-1 text-xs text-muted-foreground">Las conversaciones creadas desde el inbox aparecerán aquí.</p>
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
                <p className="text-sm text-muted-foreground">Selecciona una conversación.</p>
              </div>
            ) : detailLoading && !selected ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailError ? (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#EF4444]" />
                <p className="text-sm font-medium text-[#991B1B]">{detailError}</p>
              </div>
            ) : selected ? (
              <>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-foreground">
                        {selected.subject || selected.contact.nombre || "Conversación"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selected.contact.nombre || selected.contact.email || "Contacto sin identificar"}
                        {selected.contact.empresa ? ` · ${selected.contact.empresa}` : ""}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", statusBadge(selected.status))}>
                      {selected.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Canal</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{channelLabel(selected.channel)}</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Lead score</p>
                      <p className="mt-1 text-sm font-medium text-[#0F172A]">{selected.leadScore ?? "Sin score"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#2563EB]" />
                    <p className="text-sm font-semibold text-[#1D4ED8]">Smart Handoff</p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#1E3A8A]">
                    {selected.classification?.summary || selected.summary || "La IA todavía no generó un contexto resumido para esta conversación."}
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
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <WandSparkles className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Acciones sugeridas</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleConvert("cliente")}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1E293B]"
                    >
                      <User className="h-3.5 w-3.5" />
                      Crear cliente
                    </button>
                    <button
                      onClick={() => handleConvert("proyecto")}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      Crear proyecto
                    </button>
                    <button
                      onClick={() => handleConvert("tarea")}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Crear tarea
                    </button>
                  </div>
                  {actionState && <p className="mt-3 text-xs text-muted-foreground">{actionState}</p>}
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Mensajes</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selected.messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin mensajes.</p>
                    ) : (
                      selected.messages.map((message) => (
                        <div key={message.id} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              {message.role}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeDate(message.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">{message.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Contexto de negocio</p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{selected.contact.email || "Sin email"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{selected.contact.empresa || "Sin empresa"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{selected.messageCount} mensajes</span>
                    </div>
                    {selected.cliente && (
                      <Link href={`/clientes/${selected.cliente.id}`} className="flex items-center gap-3 text-sm text-[#2563EB] hover:underline">
                        <User className="h-4 w-4" />
                        Cliente vinculado: {selected.cliente.nombre}
                      </Link>
                    )}
                    {selected.proyecto && (
                      <Link href={`/proyectos/${selected.proyecto.id}`} className="flex items-center gap-3 text-sm text-[#2563EB] hover:underline">
                        <FolderKanban className="h-4 w-4" />
                        Proyecto vinculado: {selected.proyecto.nombre}
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
