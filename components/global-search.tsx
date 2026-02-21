"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
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
  ArrowUp,
  ArrowDown,
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
} from "lucide-react"

// ── Static quick-links (shown when query is empty) ──────────────────
const quickLinks = [
  { label: "Dirección General", href: "/", icon: LayoutDashboard, keywords: "dashboard inicio home" },
  { label: "Inbox Inteligente", href: "/inbox", icon: Inbox, keywords: "bandeja entrada mensajes" },
  { label: "Entrada Manual", href: "/entrada", icon: PenLine, keywords: "entrada manual captura" },
  { label: "Clientes", href: "/clientes", icon: Users, keywords: "clientes empresas contactos" },
  { label: "Proyectos", href: "/proyectos", icon: FolderKanban, keywords: "proyectos trabajo" },
  { label: "Contenido", href: "/contenido", icon: FileText, keywords: "contenido editorial calendario" },
  { label: "Tareas", href: "/tareas", icon: CheckSquare, keywords: "tareas pendientes asignaciones" },
  { label: "Archivos", href: "/archivos", icon: FolderOpen, keywords: "archivos documentos files" },
  { label: "Departamentos", href: "/departamentos", icon: Building2, keywords: "departamentos equipos areas" },
  { label: "Administración", href: "/administracion", icon: Settings, keywords: "configuracion admin" },
  { label: "Finanzas", href: "/finanzas", icon: DollarSign, keywords: "finanzas dinero ingresos gastos" },
  { label: "Facturación", href: "/facturacion", icon: Receipt, keywords: "facturas cobros pagos" },
  { label: "Comunicación", href: "/comunicacion", icon: MessageSquare, keywords: "mensajes chat hilos" },
  { label: "Notificaciones", href: "/notificaciones", icon: BellRing, keywords: "alertas avisos" },
  { label: "Motor IA", href: "/motor", icon: Workflow, keywords: "motor ia clasificacion reglas automatizaciones" },
  { label: "Resolución Identidad", href: "/identidad", icon: Fingerprint, keywords: "identidad duplicados" },
  { label: "Historial", href: "/historial", icon: History, keywords: "historial log actividad" },
  { label: "Biblioteca", href: "/biblioteca", icon: BookOpen, keywords: "recursos plantillas guias" },
  { label: "Usuarios", href: "/usuarios", icon: UserCircle, keywords: "equipo miembros roles" },
]

// ── Types ───────────────────────────────────────────────────────────
interface SearchResults {
  clientes: { id: string; nombre: string; empresa?: string | null; estado: string }[]
  proyectos: { id: string; nombre: string; estado: string; cliente?: { nombre: string } | null }[]
  tareas: { id: string; titulo: string; estado: string; prioridad: string; proyecto?: { nombre: string } | null }[]
  facturas: { id: string; numero: string; estado: string; total: number; cliente?: { nombre: string } | null }[]
  documentos: { id: string; nombre: string; tipo: string; tamano?: string | null; proyecto?: { nombre: string } | null }[]
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

function flattenResults(data: SearchResults): FlatResult[] {
  const results: FlatResult[] = []

  for (const c of data.clientes) {
    results.push({
      id: `cliente-${c.id}`,
      title: c.nombre,
      subtitle: c.empresa || "Sin empresa",
      href: `/clientes/${c.id}`,
      group: "Clientes",
      icon: Users,
      badge: c.estado,
      badgeColor: estadoColors[c.estado] || "",
    })
  }

  for (const p of data.proyectos) {
    results.push({
      id: `proyecto-${p.id}`,
      title: p.nombre,
      subtitle: p.cliente?.nombre || "Sin cliente",
      href: `/proyectos/${p.id}`,
      group: "Proyectos",
      icon: FolderKanban,
      badge: p.estado,
      badgeColor: estadoColors[p.estado] || "",
    })
  }

  for (const t of data.tareas) {
    results.push({
      id: `tarea-${t.id}`,
      title: t.titulo,
      subtitle: t.proyecto?.nombre || "Sin proyecto",
      href: `/tareas/${t.id}`,
      group: "Tareas",
      icon: CheckSquare,
      badge: t.estado,
      badgeColor: estadoColors[t.estado] || "",
    })
  }

  for (const f of data.facturas) {
    results.push({
      id: `factura-${f.id}`,
      title: `Factura ${f.numero}`,
      subtitle: f.cliente?.nombre || "Sin cliente",
      href: `/facturacion/${f.id}`,
      group: "Facturas",
      icon: Receipt,
      badge: f.estado,
      badgeColor: estadoColors[f.estado] || "",
    })
  }

  for (const d of data.documentos) {
    results.push({
      id: `documento-${d.id}`,
      title: d.nombre,
      subtitle: d.proyecto?.nombre || d.tipo,
      href: `/archivos/${d.id}`,
      group: "Documentos",
      icon: FolderOpen,
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
      if (json.data) {
        setResults(flattenResults(json.data))
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
  const filteredLinks = query.length === 0
    ? quickLinks
    : query.length < 2
    ? quickLinks.filter(r =>
        r.label.toLowerCase().includes(query.toLowerCase()) ||
        r.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : []

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

  // Keyboard handler
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % Math.max(navigableCount, 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + Math.max(navigableCount, 1)) % Math.max(navigableCount, 1))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (displayMode === "results" && results[activeIndex]) {
          router.push(results[activeIndex].href)
          onClose()
        } else if (displayMode === "links" && filteredLinks[activeIndex]) {
          router.push(filteredLinks[activeIndex].href)
          onClose()
        }
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose, displayMode, results, filteredLinks, activeIndex, navigableCount, router])

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
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar clientes, proyectos, tareas, facturas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />}
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {displayMode === "links" ? (
            /* Quick links mode */
            <div className="p-2">
              {filteredLinks.length > 0 ? (
                <>
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {query.length === 0 ? "Navegación rápida" : "Páginas"}
                    </span>
                  </div>
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
                            ? "bg-accent text-foreground"
                            : "text-foreground/80 hover:bg-accent/50"
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{route.label}</span>
                      </Link>
                    )
                  })}
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
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors group",
                            idx === activeIndex
                              ? "bg-accent text-foreground"
                              : "text-foreground/80 hover:bg-accent/50"
                          )}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
        <div className="border-t border-border px-4 py-2 flex items-center gap-4">
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
            <span>cerrar</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {displayMode === "results"
              ? `${results.length} resultado${results.length !== 1 ? "s" : ""}`
              : `${filteredLinks.length} enlace${filteredLinks.length !== 1 ? "s" : ""}`
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
        Sin resultados para <span className="font-medium text-foreground">&quot;{query}&quot;</span>
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Intenta con otro término de búsqueda
      </p>
    </div>
  )
}
