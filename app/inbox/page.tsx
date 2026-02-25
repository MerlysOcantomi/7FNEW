"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { CanEdit } from "@/components/role-gate"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Globe,
  Star,
  Archive,
  CheckCircle2,
  Clock,
  Search,
  Sparkles,
  User,
  FolderKanban,
  Tag,
  Plus,
  Loader2,
  AlertTriangle,
  FileText,
  Users,
  ArrowRight,
  RefreshCw,
  X,
  ExternalLink,
  Zap,
  BarChart3,
  Send,
  ScanLine,
  Bot,
} from "lucide-react"

interface InboxEntry {
  id: string
  nombre: string | null
  email: string | null
  telefono: string | null
  mensaje: string
  fuente: string
  tipo: string
  categoria: string | null
  urgencia: string
  intencion: string | null
  resumen: string | null
  datosCliente: Record<string, string> | string | null
  datosProyecto: Record<string, string> | string | null
  notas: string | null
  tags: string[] | string | null
  estado: string
  clienteId: string | null
  proyectoId: string | null
  tareaId: string | null
  createdAt: string
}

function parseJSON<T>(val: T | string | null, fallback: T): T {
  if (!val) return fallback
  if (typeof val === "string") {
    try { return JSON.parse(val) } catch { return fallback }
  }
  return val
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "ahora"
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

const SOURCE_ICONS: Record<string, typeof Mail> = {
  "chatbot-skina": Bot,
  email: Mail,
  whatsapp: MessageSquare,
  llamada: Phone,
  formulario: Globe,
  "documento-escaneado": ScanLine,
  manual: FileText,
}

const SOURCE_LABELS: Record<string, string> = {
  "chatbot-skina": "Chatbot Skina",
  email: "Email",
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  formulario: "Formulario",
  "documento-escaneado": "Doc. escaneado",
  manual: "Manual",
}

const TIPO_COLORS: Record<string, string> = {
  lead: "bg-emerald-500/10 text-emerald-600",
  ticket: "bg-red-500/10 text-red-600",
  consulta: "bg-blue-500/10 text-blue-600",
  proyecto: "bg-purple-500/10 text-purple-600",
  factura: "bg-amber-500/10 text-amber-600",
}

const URGENCIA_COLORS: Record<string, string> = {
  critica: "bg-red-500/15 text-red-700 ring-1 ring-red-500/30",
  alta: "bg-orange-500/10 text-orange-600",
  media: "bg-yellow-500/10 text-yellow-700",
  baja: "bg-muted text-muted-foreground",
}

const ESTADO_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "nuevo", label: "Nuevos" },
  { key: "clasificado", label: "Clasificados" },
  { key: "procesado", label: "Procesados" },
  { key: "archivado", label: "Archivados" },
]

export default function InboxPage() {
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [estadoFilter, setEstadoFilter] = useState("todos")
  const [search, setSearch] = useState("")
  const [showNewForm, setShowNewForm] = useState(false)
  const [convertingAction, setConvertingAction] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (estadoFilter !== "todos") params.set("estado", estadoFilter)
      if (search) params.set("q", search)
      params.set("pageSize", "50")

      const res = await fetch(`/api/inbox?${params}`)
      const json = await res.json()
      if (json.success) {
        setEntries(json.data)
      }
    } catch {
      toast.error("Error al cargar inbox")
    } finally {
      setLoading(false)
    }
  }, [estadoFilter, search])

  useEffect(() => {
    setLoading(true)
    fetchEntries()
  }, [fetchEntries, refreshKey])

  // Poll for classification updates
  useEffect(() => {
    const hasProcessing = entries.some((e) => e.estado === "nuevo")
    if (!hasProcessing) return
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 5000)
    return () => clearInterval(interval)
  }, [entries])

  const selected = selectedId ? entries.find((e) => e.id === selectedId) : null

  const handleConvert = useCallback(
    async (action: string) => {
      if (!selected) return
      setConvertingAction(action)
      try {
        const res = await fetch(`/api/inbox/${selected.id}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message)

        const labels: Record<string, string> = {
          cliente: "Cliente creado",
          proyecto: "Proyecto creado",
          tarea: "Tarea creada",
          todo: "Cliente, proyecto y tarea creados",
        }
        toast.success(labels[action] || "Conversion exitosa")
        setRefreshKey((k) => k + 1)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al convertir")
      } finally {
        setConvertingAction(null)
      }
    },
    [selected],
  )

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/inbox/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "archivado" }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message)
        toast.success("Entrada archivada")
        if (selectedId === id) setSelectedId(null)
        setRefreshKey((k) => k + 1)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al archivar")
      }
    },
    [selectedId],
  )

  const stats = {
    nuevos: entries.filter((e) => e.estado === "nuevo" || e.estado === "clasificado").length,
    leads: entries.filter((e) => e.tipo === "lead").length,
    tickets: entries.filter((e) => e.tipo === "ticket").length,
    procesados: entries.filter((e) => e.estado === "procesado").length,
  }

  return (
    <AppShell currentSection="inbox" breadcrumbs={[{ label: "7F" }, { label: "Inbox Inteligente" }]}>
      <SectionPage title="Inbox Inteligente" description="Bandeja unificada con clasificacion automatica por IA.">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pendientes", value: stats.nuevos, icon: Inbox, color: "text-primary" },
            { label: "Leads", value: stats.leads, icon: Zap, color: "text-emerald-500" },
            { label: "Tickets", value: stats.tickets, icon: AlertTriangle, color: "text-red-500" },
            { label: "Procesados", value: stats.procesados, icon: CheckCircle2, color: "text-muted-foreground" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + filters + new */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en inbox..."
              className="w-full rounded-lg bg-muted/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
            {ESTADO_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setEstadoFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  estadoFilter === f.key
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <CanEdit>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-xs font-medium hover:bg-primary/90 shadow-sm transition-opacity flex-shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva entrada
            </button>
          </CanEdit>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Inbox list */}
          <div className="lg:w-[420px] flex-shrink-0 flex flex-col gap-2">
            {loading ? (
              <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Cargando...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin entradas</p>
              </div>
            ) : (
              entries.map((entry) => {
                const SourceIcon = SOURCE_ICONS[entry.fuente] || Mail
                const isActive = selectedId === entry.id
                const tags = parseJSON<string[]>(entry.tags, [])
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3.5 transition-all",
                      isActive
                        ? "border-foreground/20 bg-card shadow-sm"
                        : "border-border bg-card/60 hover:bg-card",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0 mt-0.5">
                        <SourceIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {entry.nombre || entry.email || "Sin nombre"}
                          </span>
                          {(entry.estado === "nuevo" || entry.estado === "clasificado") && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                            {timeAgo(entry.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/70 truncate mt-0.5">
                          {entry.resumen || entry.mensaje.slice(0, 80)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {entry.tipo && (
                            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium", TIPO_COLORS[entry.tipo] || "bg-muted text-muted-foreground")}>
                              {entry.tipo}
                            </span>
                          )}
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", URGENCIA_COLORS[entry.urgencia] || "bg-muted text-muted-foreground")}>
                            {entry.urgencia}
                          </span>
                          {entry.estado === "nuevo" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Clasificando...
                            </span>
                          )}
                          {entry.estado === "procesado" && (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Detail panel */}
          {selected ? (
            <DetailPanel
              entry={selected}
              onConvert={handleConvert}
              onArchive={handleArchive}
              convertingAction={convertingAction}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          ) : (
            <div className="flex-1 rounded-xl border border-border bg-card/50 flex items-center justify-center p-12 min-h-[300px]">
              <div className="text-center">
                <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Selecciona una entrada para ver los detalles</p>
              </div>
            </div>
          )}
        </div>

        {/* New entry modal */}
        {showNewForm && (
          <NewEntryModal
            onClose={() => setShowNewForm(false)}
            onCreated={() => {
              setShowNewForm(false)
              setRefreshKey((k) => k + 1)
            }}
          />
        )}
      </SectionPage>
    </AppShell>
  )
}

/* ─── Detail Panel ─── */

function DetailPanel({
  entry,
  onConvert,
  onArchive,
  convertingAction,
  onRefresh,
}: {
  entry: InboxEntry
  onConvert: (action: string) => void
  onArchive: (id: string) => void
  convertingAction: string | null
  onRefresh: () => void
}) {
  const datosCliente = parseJSON<Record<string, string>>(entry.datosCliente, {})
  const datosProyecto = parseJSON<Record<string, string>>(entry.datosProyecto, {})
  const tags = parseJSON<string[]>(entry.tags, [])
  const SourceIcon = SOURCE_ICONS[entry.fuente] || Mail
  const isProcessed = entry.estado === "procesado"

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("rounded-md px-2.5 py-0.5 text-[11px] font-medium", TIPO_COLORS[entry.tipo] || "bg-muted text-muted-foreground")}>
                {entry.tipo}
              </span>
              <span className={cn("rounded-md px-2.5 py-0.5 text-[11px] font-medium", URGENCIA_COLORS[entry.urgencia])}>
                {entry.urgencia}
              </span>
              {entry.categoria && (
                <span className="rounded-md bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {entry.categoria}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-foreground mt-2">
              {entry.nombre || entry.email || "Entrada sin nombre"}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <SourceIcon className="h-3 w-3" />
                {SOURCE_LABELS[entry.fuente] || entry.fuente}
              </span>
              {entry.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{entry.email}</span>}
              {entry.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{entry.telefono}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(entry.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isProcessed && (
              <CanEdit>
                <button
                  onClick={() => onArchive(entry.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Archivar"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </CanEdit>
            )}
            <button
              onClick={onRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Refrescar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {tags.map((tag, i) => (
              <span key={i} className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI analysis */}
      {(entry.resumen || entry.intencion) && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analisis IA</p>
          </div>

          {entry.resumen && (
            <div className="mb-3">
              <p className="text-[11px] text-muted-foreground mb-1">Resumen</p>
              <p className="text-sm text-foreground leading-relaxed">{entry.resumen}</p>
            </div>
          )}

          {entry.intencion && (
            <div className="mb-3">
              <p className="text-[11px] text-muted-foreground mb-1">Intencion detectada</p>
              <p className="text-sm font-medium text-foreground">{entry.intencion}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {(datosCliente.nombre || datosCliente.empresa || datosCliente.email) && (
              <div className="rounded-lg bg-background border border-border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="h-3 w-3" /> Datos del cliente
                </p>
                {datosCliente.nombre && <p className="text-sm text-foreground">{datosCliente.nombre}</p>}
                {datosCliente.empresa && <p className="text-xs text-muted-foreground">{datosCliente.empresa}</p>}
                {datosCliente.email && <p className="text-xs text-muted-foreground">{datosCliente.email}</p>}
                {datosCliente.telefono && <p className="text-xs text-muted-foreground">{datosCliente.telefono}</p>}
              </div>
            )}
            {(datosProyecto.nombre || datosProyecto.descripcion) && (
              <div className="rounded-lg bg-background border border-border p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" /> Datos del proyecto
                </p>
                {datosProyecto.nombre && <p className="text-sm text-foreground">{datosProyecto.nombre}</p>}
                {datosProyecto.descripcion && <p className="text-xs text-muted-foreground">{datosProyecto.descripcion}</p>}
                {datosProyecto.presupuesto && <p className="text-xs text-muted-foreground">Presupuesto: {datosProyecto.presupuesto}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5">
        <p className="text-[11px] text-muted-foreground mb-2 font-medium">Mensaje original</p>
        <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{entry.mensaje}</p>
      </div>

      {/* Notes */}
      {entry.notas && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <p className="text-[11px] text-muted-foreground mb-2 font-medium">Notas IA</p>
          <p className="text-sm text-foreground/70">{entry.notas}</p>
        </div>
      )}

      {/* Linked records */}
      {(entry.clienteId || entry.proyectoId || entry.tareaId) && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Registros creados
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.clienteId && (
              <Link
                href={`/clientes/${entry.clienteId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Users className="h-3 w-3 text-muted-foreground" />
                Ver cliente
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </Link>
            )}
            {entry.proyectoId && (
              <Link
                href={`/proyectos/${entry.proyectoId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <FolderKanban className="h-3 w-3 text-muted-foreground" />
                Ver proyecto
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </Link>
            )}
            {entry.tareaId && (
              <Link
                href={`/tareas/${entry.tareaId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                Ver tarea
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!isProcessed && entry.estado !== "archivado" && (
        <CanEdit>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2.5">Acciones rapidas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionButton
                label="Crear cliente"
                icon={Users}
                action="cliente"
                loading={convertingAction === "cliente"}
                disabled={!!convertingAction || !!entry.clienteId}
                onClick={onConvert}
              />
              <ActionButton
                label="Crear proyecto"
                icon={FolderKanban}
                action="proyecto"
                loading={convertingAction === "proyecto"}
                disabled={!!convertingAction || !!entry.proyectoId}
                onClick={onConvert}
              />
              <ActionButton
                label="Asignar tarea"
                icon={CheckCircle2}
                action="tarea"
                loading={convertingAction === "tarea"}
                disabled={!!convertingAction || !!entry.tareaId}
                onClick={onConvert}
              />
              <ActionButton
                label="Convertir todo"
                icon={Zap}
                action="todo"
                loading={convertingAction === "todo"}
                disabled={!!convertingAction}
                onClick={onConvert}
                primary
              />
            </div>
          </div>
        </CanEdit>
      )}
    </div>
  )
}

function ActionButton({
  label,
  icon: Icon,
  action,
  loading,
  disabled,
  onClick,
  primary,
}: {
  label: string
  icon: typeof CheckCircle2
  action: string
  loading: boolean
  disabled: boolean
  onClick: (action: string) => void
  primary?: boolean
}) {
  return (
    <button
      onClick={() => onClick(action)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors",
        primary
          ? "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          : "border-border bg-card text-foreground hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}

/* ─── New Entry Modal ─── */

function NewEntryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [fuente, setFuente] = useState("manual")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mensaje.trim()) {
      toast.error("El mensaje es requerido")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || undefined,
          email: email || undefined,
          telefono: telefono || undefined,
          mensaje,
          fuente,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      toast.success("Entrada creada. Clasificando con IA...")
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear entrada")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-card border border-border shadow-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Nueva entrada al Inbox
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del remitente"
                className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fuente</label>
              <select
                value={fuente}
                onChange={(e) => setFuente(e.target.value)}
                className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="manual">Manual</option>
                <option value="chatbot-skina">Chatbot Skina</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="llamada">Llamada</option>
                <option value="formulario">Formulario web</option>
                <option value="documento-escaneado">Doc. escaneado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Telefono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+52 55 1234 5678"
                className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mensaje *</label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={5}
              placeholder="Contenido del mensaje, consulta, solicitud..."
              className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !mensaje.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 shadow-sm transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {saving ? "Enviando..." : "Enviar y clasificar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            La IA clasificara automaticamente el tipo, urgencia e intencion del mensaje.
          </p>
        </form>
      </div>
    </div>
  )
}
