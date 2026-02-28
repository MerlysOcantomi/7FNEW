"use client"

import { useState, useMemo, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { ContentAI } from "@/components/content-ai"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ContentPieceForm } from "@/components/forms/content-piece-form"
import { CampaignForm } from "@/components/forms/campaign-form"
import { ConfirmModal } from "@/components/confirm-modal"
import {
  Calendar,
  List,
  Lightbulb,
  Sparkles,
  Megaphone,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Instagram,
  Youtube,
  Linkedin,
  Globe,
  Hash,
  Clock,
  CheckCircle2,
  Eye,
  Send,
  X,
  Loader2,
} from "lucide-react"
import { CanEdit, CanDelete } from "@/components/role-gate"

/* ── Constants ── */
const PLATAFORMA_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  tiktok: Hash,
  facebook: Globe,
  twitter: Hash,
  blog: Globe,
  newsletter: Send,
  web: Globe,
  otro: Globe,
}

const ESTADO_COLOR: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  borrador: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "en-progreso": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  revision: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  programado: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  publicado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const CAMPAIGN_ESTADO_COLOR: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  planificacion: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  activa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pausada: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  completada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const MARCA_COLOR: Record<string, string> = {
  skina: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "7f": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cliente: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  general: "bg-muted text-muted-foreground",
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const DAY_NAMES = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"]

function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function fmtDate(d: string | null | undefined) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) } catch { return "—" } }

type ViewId = "calendario" | "lista" | "campanas" | "ideas" | "ia"

const views: { id: ViewId; label: string; icon: typeof Calendar }[] = [
  { id: "calendario", label: "Calendario", icon: Calendar },
  { id: "lista", label: "Lista", icon: List },
  { id: "campanas", label: "Campanas", icon: Megaphone },
  { id: "ideas", label: "Banco Creativo", icon: Lightbulb },
  { id: "ia", label: "IA Editorial", icon: Sparkles },
]

export default function ContenidoPage() {
  const [activeView, setActiveView] = useState<ViewId>("calendario")
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState("")
  const [filterPlataforma, setFilterPlataforma] = useState("")

  // Content pieces
  const contentUrl = useMemo(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set("search", search.trim())
    if (filterEstado) p.set("estado", filterEstado)
    if (filterPlataforma) p.set("plataforma", filterPlataforma)
    p.set("pageSize", "200")
    return `/api/contenido?${p.toString()}`
  }, [search, filterEstado, filterPlataforma])
  const { data: contentRaw, loading: contentLoading, refetch: refetchContent } = useFetch<any>(contentUrl)
  const pieces: any[] = Array.isArray(contentRaw) ? contentRaw : contentRaw?.data ?? []

  // Campaigns
  const { data: campaignRaw, loading: campaignLoading, refetch: refetchCampaigns } = useFetch<any>("/api/campanas?pageSize=100")
  const campaigns: any[] = Array.isArray(campaignRaw) ? campaignRaw : campaignRaw?.data ?? []

  // Ideas
  const { data: ideasRaw, loading: ideasLoading, refetch: refetchIdeas } = useFetch<any>("/api/contenido/ideas?pageSize=100")
  const ideas: any[] = Array.isArray(ideasRaw) ? ideasRaw : ideasRaw?.data ?? []

  // Forms
  const [pieceFormOpen, setPieceFormOpen] = useState(false)
  const [editingPiece, setEditingPiece] = useState<any>(null)
  const [campaignFormOpen, setCampaignFormOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; label: string } | null>(null)

  // Idea form inline
  const [newIdeaTitle, setNewIdeaTitle] = useState("")
  const [newIdeaDesc, setNewIdeaDesc] = useState("")
  const [savingIdea, setSavingIdea] = useState(false)

  // Calendar state
  const [calDate, setCalDate] = useState(new Date())

  async function handleDelete() {
    if (!deleteItem) return
    try {
      const url = deleteItem.type === "campaign" ? `/api/campanas/${deleteItem.id}` : deleteItem.type === "idea" ? `/api/contenido/ideas/${deleteItem.id}` : `/api/contenido/${deleteItem.id}`
      await fetch(url, { method: "DELETE" })
      toast.success("Eliminado")
      refetchContent(); refetchCampaigns(); refetchIdeas()
    } catch { toast.error("Error al eliminar") }
    setDeleteItem(null)
  }

  async function createIdea() {
    if (!newIdeaTitle.trim()) return
    setSavingIdea(true)
    try {
      await fetch("/api/contenido/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: newIdeaTitle.trim(), descripcion: newIdeaDesc.trim() || null }),
      })
      toast.success("Idea guardada")
      setNewIdeaTitle(""); setNewIdeaDesc("")
      refetchIdeas()
    } catch { toast.error("Error") }
    setSavingIdea(false)
  }

  async function convertIdeaToPiece(idea: any) {
    try {
      await fetch("/api/contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: idea.titulo, notas: idea.descripcion || null, estado: "borrador" }),
      })
      await fetch(`/api/contenido/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "convertida" }),
      })
      toast.success("Idea convertida a pieza de contenido")
      refetchContent(); refetchIdeas()
    } catch { toast.error("Error") }
  }

  // Stats
  const stats = useMemo(() => ({
    total: pieces.length,
    ideas: pieces.filter((p) => p.estado === "idea").length,
    enProgreso: pieces.filter((p) => p.estado === "en-progreso" || p.estado === "borrador").length,
    programados: pieces.filter((p) => p.estado === "programado").length,
    publicados: pieces.filter((p) => p.estado === "publicado").length,
    campanasActivas: campaigns.filter((c) => c.estado === "activa").length,
  }), [pieces, campaigns])

  // Calendar grid
  const monthDays = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth()
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
    const offset = (first.getDay() + 6) % 7
    const days: { date: Date; inMonth: boolean }[] = []
    for (let i = offset - 1; i >= 0; i--) days.push({ date: new Date(y, m, -i), inMonth: false })
    for (let i = 1; i <= last.getDate(); i++) days.push({ date: new Date(y, m, i), inMonth: true })
    const rem = 7 - (days.length % 7)
    if (rem < 7) for (let i = 1; i <= rem; i++) days.push({ date: new Date(y, m + 1, i), inMonth: false })
    return days
  }, [calDate])

  const getPiecesForDate = useCallback((date: Date) => pieces.filter((p) => {
    const d = p.fechaProgramada || p.createdAt
    if (!d) return false
    return isSameDay(new Date(d), date)
  }), [pieces])

  const today = new Date()

  return (
    <AppShell currentSection="contenido" breadcrumbs={[{ label: "7F" }, { label: "Campanas & Contenido" }]}>
      <SectionPage title="Campanas & Contenido" description="Cerebro editorial. Planifica, crea y ejecuta la narrativa de marca.">

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total", value: stats.total },
            { label: "Ideas", value: stats.ideas },
            { label: "En progreso", value: stats.enProgreso },
            { label: "Programados", value: stats.programados },
            { label: "Publicados", value: stats.publicados },
            { label: "Campanas activas", value: stats.campanasActivas },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* View switcher + actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 overflow-x-auto flex-1" style={{ scrollbarWidth: "none" }}>
            {views.map((v) => {
              const Icon = v.icon
              return (
                <button key={v.id} onClick={() => setActiveView(v.id)} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors flex-shrink-0", activeView === v.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                  <Icon className="h-4 w-4" /> {v.label}
                </button>
              )
            })}
          </div>
          <CanEdit>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingPiece(null); setPieceFormOpen(true) }} className="flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background hover:opacity-80 transition-opacity">
                <Plus className="h-3.5 w-3.5" /> Pieza
              </button>
              <button onClick={() => { setEditingCampaign(null); setCampaignFormOpen(true) }} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
                <Megaphone className="h-3.5 w-3.5" /> Campana
              </button>
            </div>
          </CanEdit>
        </div>

        {/* Search + filters (for lista/calendario) */}
        {(activeView === "lista" || activeView === "calendario") && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-[140px] sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar contenido..." className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="w-full sm:w-auto rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none">
              <option value="">Estado</option>
              <option value="idea">Idea</option>
              <option value="borrador">Borrador</option>
              <option value="en-progreso">En progreso</option>
              <option value="revision">Revision</option>
              <option value="programado">Programado</option>
              <option value="publicado">Publicado</option>
            </select>
            <select value={filterPlataforma} onChange={(e) => setFilterPlataforma(e.target.value)} className="w-full sm:w-auto rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none">
              <option value="">Plataforma</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">X/Twitter</option>
              <option value="blog">Blog</option>
              <option value="newsletter">Newsletter</option>
            </select>
          </div>
        )}

        {/* Loading */}
        {(contentLoading || campaignLoading || ideasLoading) && activeView !== "ia" && (
          <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        )}

        {/* ── CALENDARIO ── */}
        {activeView === "calendario" && !contentLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() - 1); setCalDate(d) }} className="p-1.5 rounded-md hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
              <h3 className="text-sm font-semibold">{MONTH_NAMES[calDate.getMonth()]} {calDate.getFullYear()}</h3>
              <button onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() + 1); setCalDate(d) }} className="p-1.5 rounded-md hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-border">
              {DAY_NAMES.map((d) => <div key={d} className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map(({ date, inMonth }, idx) => {
                const dayPieces = getPiecesForDate(date)
                const isToday = isSameDay(date, today)
                return (
                  <div key={idx} className={cn("min-h-[55px] sm:min-h-[85px] border-b border-r border-border p-1.5", !inMonth && "bg-muted/20", idx % 7 === 6 && "border-r-0")}>
                    <span className={cn("text-xs font-medium", isToday ? "flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background" : inMonth ? "text-foreground" : "text-muted-foreground/50")}>{date.getDate()}</span>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {dayPieces.slice(0, 3).map((p: any) => {
                        const PIcon = PLATAFORMA_ICON[p.plataforma] ?? Globe
                        return (
                          <button key={p.id} onClick={() => { setEditingPiece(p); setPieceFormOpen(true) }} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/50 transition-colors text-left">
                            <PIcon className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                            <span className="text-[10px] truncate text-foreground">{p.titulo}</span>
                          </button>
                        )
                      })}
                      {dayPieces.length > 3 && <span className="text-[9px] text-muted-foreground px-1">+{dayPieces.length - 3}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── LISTA ── */}
        {activeView === "lista" && !contentLoading && (
          <div className="flex flex-col gap-2">
            {pieces.length === 0 && (
              <div className="text-center py-12">
                <List className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No hay piezas de contenido. Crea la primera.</p>
              </div>
            )}
            {pieces.map((p: any) => {
              const PIcon = PLATAFORMA_ICON[p.plataforma] ?? Globe
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                    <PIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ESTADO_COLOR[p.estado] ?? "bg-muted text-muted-foreground")}>{p.estado}</span>
                      <span className="text-[10px] text-muted-foreground">{p.plataforma}</span>
                      <span className="text-[10px] text-muted-foreground">{p.tipo}</span>
                      {p.responsable && <span className="text-[10px] text-muted-foreground">· {p.responsable}</span>}
                      {p.fechaProgramada && <span className="text-[10px] text-muted-foreground">· {fmtDate(p.fechaProgramada)}</span>}
                      {p.campaign && <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">· {p.campaign.nombre}</span>}
                    </div>
                  </div>
                  <CanEdit>
                    <button onClick={() => { setEditingPiece(p); setPieceFormOpen(true) }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  </CanEdit>
                  <CanDelete>
                    <button onClick={() => setDeleteItem({ type: "piece", id: p.id, label: p.titulo })} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </CanDelete>
                </div>
              )
            })}
          </div>
        )}

        {/* ── CAMPANAS ── */}
        {activeView === "campanas" && !campaignLoading && (
          <div className="flex flex-col gap-3">
            {campaigns.length === 0 && (
              <div className="text-center py-12">
                <Megaphone className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No hay campanas. Crea la primera.</p>
              </div>
            )}
            {campaigns.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{c.nombre}</h3>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CAMPAIGN_ESTADO_COLOR[c.estado] ?? "bg-muted text-muted-foreground")}>{c.estado}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", MARCA_COLOR[c.marca] ?? "bg-muted text-muted-foreground")}>{c.marca}</span>
                    </div>
                    {c.descripcion && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.descripcion}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      {c.fechaInicio && <span>{fmtDate(c.fechaInicio)} — {fmtDate(c.fechaFin)}</span>}
                      <span>{c._count?.piezas ?? 0} piezas</span>
                      {c.cliente && <span>· {c.cliente.nombre}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <CanEdit>
                      <button onClick={() => { setEditingCampaign(c); setCampaignFormOpen(true) }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    </CanEdit>
                    <CanDelete>
                      <button onClick={() => setDeleteItem({ type: "campaign", id: c.id, label: c.nombre })} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </CanDelete>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── IDEAS ── */}
        {activeView === "ideas" && !ideasLoading && (
          <div className="flex flex-col gap-4">
            {/* New idea form */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Nueva idea</p>
              <div className="flex flex-col gap-2">
                <input value={newIdeaTitle} onChange={(e) => setNewIdeaTitle(e.target.value)} placeholder="Titulo de la idea..." className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
                <textarea value={newIdeaDesc} onChange={(e) => setNewIdeaDesc(e.target.value)} placeholder="Descripcion (opcional)" rows={2} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none resize-none" />
                <button onClick={createIdea} disabled={savingIdea || !newIdeaTitle.trim()} className={cn("self-end rounded-lg px-4 py-2 text-xs font-medium transition-opacity", !newIdeaTitle.trim() ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")}>
                  {savingIdea ? "Guardando..." : "Guardar idea"}
                </button>
              </div>
            </div>

            {/* Ideas list */}
            {ideas.length === 0 && (
              <div className="text-center py-8">
                <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">El banco de ideas esta vacio. Agrega tu primera idea.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ideas.filter((i: any) => i.estado !== "convertida").map((idea: any) => (
                <div key={idea.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <p className="text-sm font-medium text-foreground">{idea.titulo}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0", idea.estado === "aprobada" ? "bg-emerald-100 text-emerald-700" : idea.estado === "evaluando" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>{idea.estado}</span>
                  </div>
                  {idea.descripcion && <p className="text-xs text-muted-foreground line-clamp-3">{idea.descripcion}</p>}
                  {idea.tags && <div className="flex flex-wrap gap-1">{idea.tags.split(",").filter(Boolean).map((t: string, i: number) => <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{t.trim()}</span>)}</div>}
                  <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border">
                    <button onClick={() => convertIdeaToPiece(idea)} className="flex-1 rounded-md py-1.5 text-[10px] font-medium text-foreground hover:bg-muted/50 transition-colors border border-border">Convertir a pieza</button>
                    <button onClick={() => setDeleteItem({ type: "idea", id: idea.id, label: idea.titulo })} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── IA EDITORIAL ── */}
        {activeView === "ia" && <ContentAI />}

        {/* Forms & Modals */}
        <ContentPieceForm open={pieceFormOpen} onClose={() => { setPieceFormOpen(false); setEditingPiece(null) }} onSuccess={refetchContent} data={editingPiece} />
        <CampaignForm open={campaignFormOpen} onClose={() => { setCampaignFormOpen(false); setEditingCampaign(null) }} onSuccess={refetchCampaigns} data={editingCampaign} />
        <ConfirmModal open={!!deleteItem} title="Eliminar" description={`¿Seguro que quieres eliminar "${deleteItem?.label}"?`} confirmLabel="Eliminar" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteItem(null)} />
      </SectionPage>
    </AppShell>
  )
}
