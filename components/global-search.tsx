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

const estadoChromeColors: Record<string, string> = {
  activo: "bg-emerald-400/12 text-emerald-200/95 ring-1 ring-white/[0.06]",
  completado: "bg-sky-400/12 text-sky-200/95 ring-1 ring-white/[0.06]",
  completada: "bg-sky-400/12 text-sky-200/95 ring-1 ring-white/[0.06]",
  en_progreso: "bg-amber-400/12 text-amber-200/95 ring-1 ring-white/[0.06]",
  pendiente: "bg-white/[0.07] text-[var(--text-secondary-light)] ring-1 ring-white/[0.06]",
  pagada: "bg-emerald-400/12 text-emerald-200/95 ring-1 ring-white/[0.06]",
  vencida: "bg-rose-400/14 text-rose-200/95 ring-1 ring-white/[0.06]",
  cancelado: "bg-rose-400/14 text-rose-200/95 ring-1 ring-white/[0.06]",
  cancelada: "bg-rose-400/14 text-rose-200/95 ring-1 ring-white/[0.06]",
  pausado: "bg-orange-400/12 text-orange-200/95 ring-1 ring-white/[0.06]",
  alta: "bg-rose-400/14 text-rose-200/95 ring-1 ring-white/[0.06]",
  media: "bg-amber-400/12 text-amber-200/95 ring-1 ring-white/[0.06]",
  baja: "bg-white/[0.07] text-[var(--text-secondary-light)] ring-1 ring-white/[0.06]",
  /** fallback workspace-task / inbox-ish keys */
  open: "bg-white/[0.07] text-[var(--text-primary-light)] ring-1 ring-white/[0.06]",
  new: "bg-white/[0.07] text-[var(--text-primary-light)] ring-1 ring-white/[0.06]",
  closed: "bg-white/[0.06] text-[var(--text-secondary-light)] ring-1 ring-white/[0.06]",
}

const SEARCH_ROW_BASE =
  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors"
const SEARCH_ROW_IDLE = "text-[var(--text-primary-light)] hover:bg-white/[0.06]"
const SEARCH_ROW_ACTIVE =
  "bg-[var(--accent-primary)]/14 text-[var(--text-primary-light)] shadow-[inset_0_0_0_1px_rgba(124,77,255,0.35)] ring-1 ring-[var(--accent-primary)]/20"
const SEARCH_ROW_QUICK_NAV = "text-[var(--text-secondary-light)] hover:bg-white/[0.04]"
const SEARCH_ROW_QUICK_NAV_ACTIVE =
  "bg-white/[0.07] text-[var(--text-primary-light)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"

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
        estadoChromeColors[cv.category || ""] ||
        estadoChromeColors[cv.status] ||
        estadoChromeColors.open ||
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
      badgeColor: estadoChromeColors[wt.status] || estadoChromeColors.open || "",
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
      badgeColor: estadoChromeColors[t.estado] || "",
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
      badgeColor: estadoChromeColors[c.estado] || "",
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
      badgeColor: estadoChromeColors[p.estado] || "",
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
      badgeColor: estadoChromeColors[f.estado] || "",
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
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[11vh] p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--app-canvas)]/78 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        className="relative z-[1] w-full max-w-xl animate-in fade-in zoom-in-[0.99] duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace search"
      >
        <div className="overflow-hidden rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-[0_22px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(124,77,255,0.14)_inset]">
        {/* Search input — elevated chrome strip */}
        <div className="flex items-center gap-3 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2 shadow-[inset_0_-1px_0_0_rgba(124,77,255,0.06)]">
          <Search className="h-[15px] w-[15px] shrink-0 text-[var(--accent-primary)] opacity-90" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages, tasks, clients, invoices..."
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "min-h-0 flex-1 bg-transparent text-[13px] leading-snug outline-none",
              "text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] placeholder:opacity-90",
            )}
          />
          {loading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent-primary)] opacity-85" aria-hidden />
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary-light)]"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[min(52vh,520px)] overflow-y-auto bg-[var(--app-surface-dark)]">
          {displayMode === "links" ? (
            <div className="space-y-3 p-3">
              {query.length === 0 && (
                <div className="rounded-lg border border-[var(--border-dark)] bg-white/[0.025] px-3.5 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                  <div className="flex gap-2.5">
                    <span
                      className="mt-0.5 h-9 w-0.5 shrink-0 rounded-full bg-[var(--accent-primary)]/70"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary-light)]">
                        Search your workspace
                      </h2>
                      <p className="mt-1 max-w-none text-[11.5px] leading-relaxed text-[var(--text-secondary-light)]">
                        Find inbox conversations, Today tasks, clients, projects, invoices, events and files.
                      </p>
                      <div
                        className="mt-2.5 flex flex-wrap gap-1.5"
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
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-left text-[11px] font-medium leading-tight transition-colors",
                              "border-[var(--border-dark)] bg-white/[0.04] text-[var(--text-primary-light)]",
                              "hover:border-[var(--accent-primary)]/35 hover:bg-[var(--accent-primary)]/12",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface-dark)] active:translate-y-px",
                            )}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {filteredLinks.length > 0 ? (
                <>
                  <div className="px-0.5 pt-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary-light)]/55">
                      Quick navigation
                    </span>
                  </div>
                  <div className="flex flex-col gap-px pb-1">
                    {filteredLinks.map((route, i) => {
                      const Icon = route.icon
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={onClose}
                          data-active={i === activeIndex}
                          className={cn(
                            SEARCH_ROW_BASE,
                            i === activeIndex ? SEARCH_ROW_QUICK_NAV_ACTIVE : SEARCH_ROW_QUICK_NAV,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary-light)]/80 opacity-85" />
                          <span>{route.label}</span>
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
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[var(--accent-primary)] opacity-85" />
                  <p className="text-[13px] text-[var(--text-secondary-light)]">Buscando…</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <EmptyState query={query} />
              ) : (
                Array.from(grouped.entries()).map(([group, items]) => (
                  <div key={group} className="mb-0.5">
                    <div className="px-2 py-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary-light)]/65">
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
                            SEARCH_ROW_BASE,
                            idx === activeIndex ? SEARCH_ROW_ACTIVE : SEARCH_ROW_IDLE,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)] opacity-85" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.title}</div>
                            <div className="truncate text-[11px] text-[var(--text-secondary-light)]">
                              {item.subtitle}
                            </div>
                          </div>
                          {item.badge && (
                            <span className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize leading-none",
                              item.badgeColor || "bg-white/[0.07] text-[var(--text-secondary-light)] ring-1 ring-[var(--border-dark)]",
                            )}>
                              {item.badge.replace("_", " ")}
                            </span>
                          )}
                          <CornerDownLeft className={cn(
                            "h-3 w-3 shrink-0 text-[var(--text-secondary-light)] opacity-0 transition-opacity",
                            idx === activeIndex && "opacity-80",
                          )} aria-hidden />
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
        <div className="flex items-center gap-4 border-t border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary-light)]">
            <kbd className="rounded border border-[var(--border-dark)] bg-white/[0.05] px-1 py-0.5 font-mono text-[10px] text-[var(--text-secondary-light)]">↑</kbd>
            <kbd className="rounded border border-[var(--border-dark)] bg-white/[0.05] px-1 py-0.5 font-mono text-[10px] text-[var(--text-secondary-light)]">↓</kbd>
            <span>navegar</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary-light)]">
            <kbd className="rounded border border-[var(--border-dark)] bg-white/[0.05] px-1 py-0.5 font-mono text-[10px] text-[var(--text-secondary-light)]">↵</kbd>
            <span>abrir</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary-light)]">
            <kbd className="rounded border border-[var(--border-dark)] bg-white/[0.05] px-1 py-0.5 font-mono text-[10px] text-[var(--text-secondary-light)]">esc</kbd>
            <span>close</span>
          </div>
          <span className="ml-auto text-[10px] text-[var(--text-secondary-light)]/80">
            {displayMode === "results"
              ? `${results.length} result${results.length !== 1 ? "s" : ""}`
              : `${filteredLinks.length} link${filteredLinks.length !== 1 ? "s" : ""}`
            }
          </span>
        </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="py-10 text-center">
      <Search className="mx-auto mb-3 h-8 w-8 text-[var(--accent-primary)]/35" aria-hidden />
      <p className="text-[13px] text-[var(--text-secondary-light)]">
        No results for <span className="font-medium text-[var(--text-primary-light)]">&quot;{query}&quot;</span>
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-secondary-light)]/80">
        Try another search term
      </p>
    </div>
  )
}
