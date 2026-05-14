"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import {
  Search,
  X,
  Users,
  FolderKanban,
  CheckSquare,
  Receipt,
  FolderOpen,
  Loader2,
  CornerDownLeft,
  LayoutDashboard,
  Inbox,
  PenLine,
  FileText,
  Building2,
  Settings,
  DollarSign,
  MessageSquare,
  BellRing,
  History,
  Workflow,
  Fingerprint,
  BookOpen,
  UserCircle,
  StickyNote,
  Paperclip,
  Mail,
  ListTodo,
  Calendar,
} from "lucide-react"

// ── Static quick-links (shown when query is empty) ──────────────────
const quickLinks = [
  { label: "Overview", href: "/", icon: LayoutDashboard, keywords: "dashboard home overview" },
  { label: "Smart Inbox", href: "/inbox", icon: Inbox, keywords: "inbox messages conversations" },
  { label: "Manual Intake", href: "/entrada", icon: PenLine, keywords: "manual intake capture" },
  { label: "Clients", href: "/clientes", icon: Users, keywords: "clients companies contacts" },
  { label: "Projects", href: "/proyectos", icon: FolderKanban, keywords: "projects work" },
  { label: "Marketing", href: "/contenido", icon: FileText, keywords: "marketing content editorial calendar" },
  { label: "Tasks", href: "/tareas", icon: CheckSquare, keywords: "tasks pending assignments" },
  { label: "Files", href: "/archivos", icon: FolderOpen, keywords: "files documents assets" },
  { label: "Departments", href: "/departamentos", icon: Building2, keywords: "departments teams areas" },
  { label: "Improvements", href: "/forte/improvements", icon: Settings, keywords: "improvements optimize workspace modules forte" },
  { label: "Finance", href: "/finanzas", icon: DollarSign, keywords: "finance money revenue expenses" },
  { label: "Invoices", href: "/facturacion", icon: Receipt, keywords: "invoices collections payments billing" },
  { label: "Communication", href: "/comunicacion", icon: MessageSquare, keywords: "messages chat threads" },
  { label: "Notifications", href: "/notificaciones", icon: BellRing, keywords: "alerts notices" },
  { label: "AI workspace", href: "/motor", icon: Workflow, keywords: "ai workspace classification rules automations" },
  { label: "Identity Resolution", href: "/identidad", icon: Fingerprint, keywords: "identity duplicates" },
  { label: "History", href: "/historial", icon: History, keywords: "history activity log" },
  { label: "Library", href: "/biblioteca", icon: BookOpen, keywords: "resources templates guides" },
  { label: "Users", href: "/usuarios", icon: UserCircle, keywords: "team members roles" },
]

const EXAMPLE_SEARCH_CHIPS = [
  "Ana factura",
  "contrato Carlos",
  "cita mañana",
  "propuesta",
] as const

// ── Types ───────────────────────────────────────────────────────────
interface SearchResults {
  clientes: { id: string; nombre: string; empresa?: string | null; estado: string }[]
  proyectos: { id: string; nombre: string; estado: string; cliente?: { nombre: string } | null }[]
  tareas: { id: string; titulo: string; estado: string; prioridad: string; proyecto?: { nombre: string } | null }[]
  facturas: { id: string; numero: string; estado: string; total: number; cliente?: { nombre: string } | null }[]
  documentos: { id: string; nombre: string; tipo: string; tamano?: number | null; proyecto?: { nombre: string } | null }[]
  notas?: { id: string; titulo: string; clienteId?: string | null; proyectoId?: string | null; cliente?: { nombre: string } | null; proyecto?: { nombre: string } | null }[]
  archivos?: { id: string; nombre: string; module: string; recordId: string }[]
  conversations?: {
    id: string
    channel: string
    status: string
    subject: string | null
    summary: string | null
    lastMessageAt: string
    category: string | null
    contact: { nombre: string | null; email: string | null; empresa: string | null }
  }[]
  workspaceTasks?: {
    id: string
    title: string
    status: string
    priority: string
    dueAt: string | null
    conversationId: string | null
    clienteId: string | null
    proyectoId: string | null
    completedAt: string | null
    sourceLabel: string | null
  }[]
  eventos?: {
    id: string
    titulo: string
    tipo: string
    fechaInicio: string
    cliente: { nombre: string } | null
  }[]
}

interface FlatResult {
  id: string
  title: string
  subtitle: string
  href: string
  group: string
  icon: React.ElementType
  badge?: string
  badgeColor?: string
}

const estadoColors: Record<string, string> = {
  activo: "bg-emerald-500/15 text-emerald-600",
  completado: "bg-blue-500/15 text-blue-600",
  completada: "bg-blue-500/15 text-blue-600",
  en_progreso: "bg-amber-500/15 text-amber-600",
  pendiente: "bg-gray-500/15 text-gray-500",
  pagada: "bg-emerald-500/15 text-emerald-600",
  vencida: "bg-red-500/15 text-red-600",
  cancelado: "bg-red-500/15 text-red-600",
  cancelada: "bg-red-500/15 text-red-600",
  pausado: "bg-orange-500/15 text-orange-600",
  alta: "bg-red-500/15 text-red-600",
  media: "bg-amber-500/15 text-amber-600",
  baja: "bg-gray-500/15 text-gray-500",
}

function truncate(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function contactLabel(c: { nombre: string | null; email: string | null; empresa: string | null }) {
  return c.nombre?.trim() || c.empresa?.trim() || c.email?.trim() || "Contact"
}

function flattenResults(raw: SearchResults): FlatResult[] {
  const conversations = raw.conversations ?? []
  const workspaceTasks = raw.workspaceTasks ?? []
  const eventos = raw.eventos ?? []

  const results: FlatResult[] = []

  for (const cv of conversations) {
    const title =
      truncate(cv.subject?.trim() || "", 72) ||
      truncate(cv.summary?.trim() || "", 72) ||
      `Conversation · ${contactLabel(cv.contact)}`
    const subtitleParts = [
      `${contactLabel(cv.contact)} · ${cv.channel}`,
      cv.summary ? truncate(cv.summary, 96) : null,
      formatWhen(cv.lastMessageAt),
    ].filter(Boolean)
    results.push({
      id: `conversation-${cv.id}`,
      title,
      subtitle: subtitleParts.join(" · "),
      href: `/inbox?id=${encodeURIComponent(cv.id)}`,
      group: "Inbox conversations",
      icon: Mail,
      badge: cv.category || cv.status,
      badgeColor:
        estadoColors[cv.category || ""] ||
        estadoColors[cv.status] ||
        "",
    })
  }

  for (const wt of workspaceTasks) {
    const due = formatWhen(wt.dueAt || undefined)
    const subtitleParts = [
      "Opens Today board (full workspace task)",
      wt.sourceLabel ? truncate(wt.sourceLabel, 64) : null,
      due ? `Due ${due}` : null,
    ].filter(Boolean)
    results.push({
      id: `workspace-task-${wt.id}`,
      title: wt.title,
      subtitle: subtitleParts.join(" · "),
      href: "/today",
      group: "Today tasks",
      icon: ListTodo,
      badge: wt.status,
      badgeColor: estadoColors[wt.status] || "",
    })
  }

  for (const t of raw.tareas) {
    results.push({
      id: `tarea-${t.id}`,
      title: t.titulo,
      subtitle: t.proyecto?.nombre || "Legacy task · no project",
      href: `/tareas/${t.id}`,
      group: "Tasks",
      icon: CheckSquare,
      badge: t.estado,
      badgeColor: estadoColors[t.estado] || "",
    })
  }

  for (const c of raw.clientes) {
    results.push({
      id: `cliente-${c.id}`,
      title: c.nombre,
      subtitle: c.empresa || "Client",
      href: `/clientes/${c.id}`,
      group: "Clients",
      icon: Users,
      badge: c.estado,
      badgeColor: estadoColors[c.estado] || "",
    })
  }

  for (const p of raw.proyectos) {
    results.push({
      id: `proyecto-${p.id}`,
      title: p.nombre,
      subtitle: p.cliente?.nombre || "Project",
      href: `/proyectos/${p.id}`,
      group: "Projects",
      icon: FolderKanban,
      badge: p.estado,
      badgeColor: estadoColors[p.estado] || "",
    })
  }

  for (const f of raw.facturas) {
    results.push({
      id: `factura-${f.id}`,
      title: `Invoice ${f.numero}`,
      subtitle: f.cliente?.nombre || "No client",
      href: `/facturacion/${f.id}`,
      group: "Invoices",
      icon: Receipt,
      badge: f.estado,
      badgeColor: estadoColors[f.estado] || "",
    })
  }

  for (const ev of eventos) {
    results.push({
      id: `evento-${ev.id}`,
      title: ev.titulo,
      subtitle: [
        "Opens Calendar (workspace event)",
        ev.tipo,
        formatWhen(ev.fechaInicio),
        ev.cliente?.nombre || null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/calendario",
      group: "Schedule",
      icon: Calendar,
      badge: ev.tipo,
      badgeColor: "",
    })
  }

  for (const n of raw.notas ?? []) {
    const href = n.clienteId ? `/clientes/${n.clienteId}` : n.proyectoId ? `/proyectos/${n.proyectoId}` : null
    if (!href) continue
    results.push({
      id: `nota-${n.id}`,
      title: n.titulo,
      subtitle: n.cliente?.nombre ?? n.proyecto?.nombre ?? "Note",
      href,
      group: "Notes",
      icon: StickyNote,
    })
  }

  for (const d of raw.documentos) {
    results.push({
      id: `documento-${d.id}`,
      title: d.nombre,
      subtitle: d.proyecto?.nombre || d.tipo,
      href: `/archivos/${d.id}`,
      group: "Documents",
      icon: FolderOpen,
    })
  }

  for (const a of raw.archivos ?? []) {
    results.push({
      id: `archivo-${a.id}`,
      title: a.nombre,
      subtitle: `${a.module} · attachment`,
      href: `/${a.module}/${a.recordId}`,
      group: "Attachments",
      icon: Paperclip,
    })
  }

  return results
}

// ── Component ───────────────────────────────────────────────────────
interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FlatResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced API search
  const searchApi = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data as SearchResults
        setResults(
          flattenResults({
            clientes: d.clientes ?? [],
            proyectos: d.proyectos ?? [],
            tareas: d.tareas ?? [],
            facturas: d.facturas ?? [],
            documentos: d.documentos ?? [],
            notas: d.notas ?? [],
            archivos: d.archivos ?? [],
            conversations: d.conversations ?? [],
            workspaceTasks: d.workspaceTasks ?? [],
            eventos: d.eventos ?? [],
          }),
        )
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => searchApi(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, searchApi])

  // Filtered quick links when no query
  const filteredLinks = useMemo(
    () =>
      query.length === 0
        ? quickLinks
        : query.length < 2
          ? quickLinks.filter(
              (r) =>
                r.label.toLowerCase().includes(query.toLowerCase()) ||
                r.keywords.toLowerCase().includes(query.toLowerCase()),
            )
          : [],
    [query],
  )

  // Combined items for keyboard navigation
  const displayMode: "links" | "results" = query.length >= 2 ? "results" : "links"
  const navigableCount = displayMode === "results" ? results.length : filteredLinks.length

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [results, filteredLinks.length])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector("[data-active='true']")
    active?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const handleSubmitSelection = useCallback(() => {
    if (displayMode === "results" && results[activeIndex]) {
      router.push(results[activeIndex].href)
      onClose()
      return
    }

    if (displayMode === "links" && filteredLinks[activeIndex]) {
      router.push(filteredLinks[activeIndex].href)
      onClose()
    }
  }, [activeIndex, displayMode, filteredLinks, onClose, results, router])

  const overlayShortcuts = useMemo(
    () => [
      {
        id: "global-search-close",
        combo: "Escape",
        enabled: open,
        allowInEditable: true,
        preventDefault: true,
        handler: onClose,
      },
      {
        id: "global-search-next",
        combo: "ArrowDown",
        enabled: open,
        allowInEditable: true,
        preventDefault: true,
        handler: () => {
          setActiveIndex((index) => (index + 1) % Math.max(navigableCount, 1))
        },
      },
      {
        id: "global-search-previous",
        combo: "ArrowUp",
        enabled: open,
        allowInEditable: true,
        preventDefault: true,
        handler: () => {
          setActiveIndex((index) => (index - 1 + Math.max(navigableCount, 1)) % Math.max(navigableCount, 1))
        },
      },
      {
        id: "global-search-submit",
        combo: "Enter",
        enabled: open,
        allowInEditable: true,
        preventDefault: true,
        handler: handleSubmitSelection,
      },
    ],
    [handleSubmitSelection, navigableCount, onClose, open],
  )

  useKeyboardShortcuts(overlayShortcuts, { scope: "overlay" })

  if (!open) return null

  // Group results by category for display
  const grouped = new Map<string, FlatResult[]>()
  for (const r of results) {
    if (!grouped.has(r.group)) grouped.set(r.group, [])
    grouped.get(r.group)!.push(r)
  }

  let globalIdx = -1

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[12vh] p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/[0.12] backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-xl overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_14px_50px_-12px_rgba(0,0,0,0.14)] animate-in fade-in zoom-in-[0.985] duration-150 ring-1 ring-black/[0.04] dark:shadow-[0_18px_55px_-14px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/90 bg-muted/25 px-4 py-2.5 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.06)]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages, tasks, clients, invoices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm leading-snug text-foreground outline-none placeholder:text-muted-foreground/80"
          />
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />}
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {displayMode === "links" ? (
            <div className="space-y-3 p-3">
              {query.length === 0 && (
                <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3 shadow-sm">
                  <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
                    Search your workspace
                  </h2>
                  <p className="mt-1 max-w-none text-[12px] leading-relaxed text-muted-foreground">
                    Find inbox conversations, Today tasks, clients, projects, invoices, events and files.
                  </p>
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Example workspace searches"
                  >
                    {EXAMPLE_SEARCH_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setQuery(chip)
                          setTimeout(() => inputRef.current?.focus(), 0)
                        }}
                        className="rounded-md border border-border/90 bg-background/80 px-2.5 py-1 text-left text-[11px] font-medium leading-tight text-foreground/85 shadow-sm transition-colors hover:bg-accent/55 hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-[0.5px]"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filteredLinks.length > 0 ? (
                <>
                  <div className="px-1 pb-0.5 pt-0">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Quick navigation
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {filteredLinks.map((route, i) => {
                      const Icon = route.icon
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={onClose}
                          data-active={i === activeIndex}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            i === activeIndex
                              ? "bg-accent text-foreground shadow-sm ring-1 ring-border/70"
                              : "text-foreground/85 hover:bg-muted/55",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{route.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </>
              ) : (
                <EmptyState query={query} />
              )}
            </div>
          ) : (
            /* API results mode */
            <div className="p-2">
              {loading && results.length === 0 ? (
                <div className="py-10 text-center">
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Buscando…</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <EmptyState query={query} />
              ) : (
                Array.from(grouped.entries()).map(([group, items]) => (
                  <div key={group} className="mb-1">
                    <div className="px-3 py-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {group}
                      </span>
                    </div>
                    {items.map((item) => {
                      globalIdx++
                      const idx = globalIdx
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={onClose}
                          data-active={idx === activeIndex}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            idx === activeIndex
                              ? "bg-accent text-foreground shadow-sm ring-1 ring-border/60"
                              : "text-foreground/85 hover:bg-muted/55",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{item.title}</div>
                            <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                          </div>
                          {item.badge && (
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize flex-shrink-0",
                              item.badgeColor || "bg-gray-500/15 text-gray-500"
                            )}>
                              {item.badge.replace("_", " ")}
                            </span>
                          )}
                          <CornerDownLeft className={cn(
                            "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-0 transition-opacity",
                            idx === activeIndex && "opacity-100"
                          )} />
                        </Link>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center gap-4 border-t border-border/90 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[10px] font-mono">↑</kbd>
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[10px] font-mono">↓</kbd>
            <span>navegar</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[10px] font-mono">↵</kbd>
            <span>abrir</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[10px] font-mono">esc</kbd>
            <span>close</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {displayMode === "results"
              ? `${results.length} result${results.length !== 1 ? "s" : ""}`
              : `${filteredLinks.length} link${filteredLinks.length !== 1 ? "s" : ""}`
            }
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="py-10 text-center">
      <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">
        No results for <span className="font-medium text-foreground">&quot;{query}&quot;</span>
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Try another search term
      </p>
    </div>
  )
}
