"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Search,
  PenTool,
  Image,
  FileText,
  Video,
  Palette,
  Type,
  Flag,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react"
import type { ContentItem } from "@/components/content-calendar"

const typeIcons: Record<string, React.ReactNode> = {
  diseno: <Palette className="h-4 w-4" />,
  copy: <Type className="h-4 w-4" />,
  documento: <FileText className="h-4 w-4" />,
  "pieza-creativa": <PenTool className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  fotografia: <Image className="h-4 w-4" />,
}

const typeLabels: Record<string, string> = {
  diseno: "Diseno",
  copy: "Copy",
  documento: "Documento",
  "pieza-creativa": "Pieza creativa",
  video: "Video",
  fotografia: "Fotografia",
}

const statusColors: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  "en-progreso": "bg-[var(--tab-info)] text-foreground/70",
  revision: "bg-[var(--tab-tasks)] text-foreground/70",
  aprobado: "bg-[var(--tab-phases)] text-foreground/70",
  entregado: "bg-[var(--tab-docs)] text-foreground/70",
  atrasado: "bg-[var(--tab-review)] text-foreground/70",
}

const statusLabels: Record<string, string> = {
  idea: "Idea",
  "en-progreso": "En progreso",
  revision: "Revision",
  aprobado: "Aprobado",
  entregado: "Entregado",
  atrasado: "Atrasado",
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  alta: { color: "text-red-500", label: "Alta" },
  media: { color: "text-amber-500", label: "Media" },
  baja: { color: "text-muted-foreground", label: "Baja" },
}

const ALL_STATUSES = Object.keys(statusLabels)

interface ContentListProps {
  items: ContentItem[]
  clients: string[]
  projects: string[]
}

export function ContentList({ items, clients, projects }: ContentListProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [clientFilter, setClientFilter] = useState<string>("todos")
  const [projectFilter, setProjectFilter] = useState<string>("todos")
  const [sortBy, setSortBy] = useState<"date" | "priority" | "title" | "client">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortBy(key); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    let result = [...items]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.client.toLowerCase().includes(q) ||
        i.project.toLowerCase().includes(q) ||
        i.responsible.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "todos") result = result.filter(i => i.status === statusFilter)
    if (clientFilter !== "todos") result = result.filter(i => i.client === clientFilter)
    if (projectFilter !== "todos") result = result.filter(i => i.project === projectFilter)

    const pOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 }
    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case "date": cmp = a.date.localeCompare(b.date); break
        case "priority": cmp = (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1); break
        case "title": cmp = a.title.localeCompare(b.title); break
        case "client": cmp = a.client.localeCompare(b.client); break
      }
      return sortDir === "desc" ? -cmp : cmp
    })

    return result
  }, [items, search, statusFilter, clientFilter, projectFilter, sortBy, sortDir])

  return (
    <div className="flex flex-col gap-5">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contenido, cliente, proyecto o responsable..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status pills */}
          <button
            onClick={() => setStatusFilter("todos")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              statusFilter === "todos" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Todos ({items.length})
          </button>
          {ALL_STATUSES.map(s => {
            const count = items.filter(i => i.status === s).length
            if (count === 0) return null
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "todos" : s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  statusFilter === s ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {statusLabels[s]} ({count})
              </button>
            )
          })}

          <div className="hidden sm:block h-5 w-px bg-border mx-1" />

          {/* Client dropdown */}
          <div className="relative">
            <select
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-card pl-3 pr-8 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="todos">Todos los clientes</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* Project dropdown */}
          <div className="relative">
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-card pl-3 pr-8 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="todos">Todos los proyectos</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* Sort */}
          <button
            onClick={() => toggleSort(sortBy === "date" ? "priority" : sortBy === "priority" ? "title" : sortBy === "title" ? "client" : "date")}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortBy === "date" ? "Fecha" : sortBy === "priority" ? "Prioridad" : sortBy === "title" ? "Titulo" : "Cliente"}
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} contenidos encontrados</p>

      {/* Content cards */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2">
          {filtered.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-shadow hover:shadow-sm"
            >
              {/* Type icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                {typeIcons[item.type]}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0", statusColors[item.status])}>
                    {statusLabels[item.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <Link href={`/clientes/${item.clientId}`} className="hover:text-foreground transition-colors">{item.client}</Link>
                  <span>&middot;</span>
                  <Link href={`/proyectos/${item.projectId}`} className="hover:text-foreground transition-colors">{item.project}</Link>
                  <span>&middot;</span>
                  <span>{typeLabels[item.type]}</span>
                  <span>&middot;</span>
                  <span>{item.responsible}</span>
                </div>
              </div>

              {/* Priority */}
              <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                <Flag className={cn("h-3 w-3", priorityConfig[item.priority].color)} />
                <span className="text-[11px] text-muted-foreground">{priorityConfig[item.priority].label}</span>
              </div>

              {/* Date */}
              <div className="text-right flex-shrink-0 hidden md:block">
                <p className="text-xs font-medium text-foreground">
                  {new Date(item.date + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Entrega</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No se encontraron contenidos con esos filtros</p>
        </div>
      )}
    </div>
  )
}
