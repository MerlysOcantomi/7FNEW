"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import {
  History,
  Search,
  User,
  FolderKanban,
  FileText,
  CheckCircle2,
  MessageSquare,
  DollarSign,
  Calendar,
  Loader2,
  AlertTriangle,
  FileEdit,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string
  module: string
  recordId: string
  type: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  data: { label?: string; comment?: string; field?: string; oldValue?: unknown; newValue?: unknown; changes?: { field: string; oldValue: unknown; newValue: unknown }[] } | null
  createdAt: string
}

const MODULE_LABELS: Record<string, string> = {
  clientes: "Client",
  proyectos: "Project",
  tareas: "Task",
  facturacion: "Invoice",
  documentos: "Document",
  contenido: "Content",
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  clientes: User,
  proyectos: FolderKanban,
  tareas: CheckCircle2,
  facturacion: DollarSign,
  documentos: FileText,
  contenido: FileEdit,
}

const TYPE_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  comment: "Comment",
  status_change: "Status change",
  assigned: "Assigned",
  unassigned: "Unassigned",
}

function getModuleHref(module: string, recordId: string): string | null {
  if (module === "clientes") return `/clientes/${recordId}`
  if (module === "proyectos") return `/proyectos/${recordId}`
  if (module === "tareas") return `/tareas/${recordId}`
  if (module === "facturacion") return `/facturacion/${recordId}`
  return null
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "Just now"
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
}

function formatDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
}

function getActionLabel(entry: ActivityEntry): string {
  const data = entry.data
  switch (entry.type) {
    case "created":
      return data?.label ? `created ${data.label}` : "created record"
    case "deleted":
      return data?.label ? `deleted ${data.label}` : "deleted record"
    case "comment":
      return data?.comment ? `commented: ${(data.comment as string).slice(0, 60)}${(data.comment as string).length > 60 ? "…" : ""}` : "left a comment"
    case "status_change":
      return data?.field ? `changed ${data.field}: ${data.oldValue} → ${data.newValue}` : "changed status"
    case "assigned":
      return "assigned owner"
    case "unassigned":
      return "unassigned owner"
    case "updated":
      return data?.label ? `updated ${data.label}` : "made changes"
    default:
      return entry.type
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

const MODULE_FILTERS = ["All", "clientes", "proyectos", "tareas", "facturacion", "documentos"]
const TYPE_FILTERS = ["All", "created", "updated", "deleted", "comment", "status_change"]

export default function HistorialPage() {
  const [moduleFilter, setModuleFilter] = useState("All")
  const [typeFilter, setTypeFilter] = useState("All")
  const [search, setSearch] = useState("")

  const params = new URLSearchParams()
  params.set("limit", "100")
  if (moduleFilter !== "All") params.set("module", moduleFilter)
  if (typeFilter !== "All") params.set("type", typeFilter)
  if (search.trim()) params.set("search", search.trim())

  const url = `/api/activity?${params.toString()}`
  const { data: rawData, loading, error, refetch } = useFetch<ActivityEntry[]>(url)

  const activities = useMemo(() => {
    if (!Array.isArray(rawData)) return []
    return rawData
  }, [rawData])

  const filtered = activities

  const grouped = useMemo(() => {
    const acc: Record<string, ActivityEntry[]> = {}
    for (const event of filtered) {
      const key = formatDateKey(event.createdAt)
      if (!acc[key]) acc[key] = []
      acc[key].push(event)
    }
    return acc
  }, [filtered])

  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
    const todayCount = filtered.filter((e) => formatDateKey(e.createdAt) === today).length
    const commentCount = filtered.filter((e) => e.type === "comment").length
    const uniqueActors = new Set(filtered.map((e) => e.userName || e.userEmail || "System")).size
    return { todayCount, commentCount, uniqueActors, total: filtered.length }
  }, [filtered])

  return (
    <AppShell currentSection="historial" breadcrumbs={[{ label: "7F" }, { label: "History" }]}>
      <SectionPage
        tone="canvas"
        title="History"
        description="Unified log of all workspace activity. Every action, change, and event recorded chronologically."
      >
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Events today</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{loading ? "—" : stats.todayCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Comments</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{loading ? "—" : stats.commentCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Unique actors</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{loading ? "—" : stats.uniqueActors}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Total records</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{loading ? "—" : stats.total}</p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary-light)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by text, user, or entity..."
              className="w-full rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] ring-1 ring-white/[0.04] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--text-secondary-light)]">Module:</span>
            {MODULE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setModuleFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  moduleFilter === f
                    ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-secondary-light)] hover:bg-white/[0.04] hover:text-[var(--text-primary-light)]",
                )}
              >
                {f === "All" ? "All" : MODULE_LABELS[f] ?? f}
              </button>
            ))}
            <span className="ml-2 mr-1 text-xs text-[var(--text-secondary-light)]">Action:</span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  typeFilter === f
                    ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-secondary-light)] hover:bg-white/[0.04] hover:text-[var(--text-primary-light)]",
                )}
              >
                {f === "All" ? "All" : TYPE_LABELS[f] ?? f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] py-20 ring-1 ring-white/[0.04]">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-[var(--text-secondary-light)]" />
            <p className="text-sm text-[var(--text-secondary-light)]">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] py-20 ring-1 ring-white/[0.04]">
            <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
            <p className="mb-1 text-sm font-medium text-[var(--text-primary-light)]">Error loading history</p>
            <p className="mb-4 text-sm text-[var(--text-secondary-light)]">{error}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-2 text-sm font-medium text-[var(--text-primary-light)] ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.06]"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)]/75 py-20 ring-1 ring-white/[0.03]">
            <History className="mb-3 h-12 w-12 text-[var(--text-secondary-light)]/40" />
            <p className="text-sm font-medium text-[var(--text-primary-light)]">No activity recorded</p>
            <p className="mt-1 max-w-sm text-center text-xs text-[var(--text-secondary-light)]">
              Activity from clients, projects, tasks, billing, and documents will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(grouped).map(([date, events]) => (
              <div key={date}>
                <div className="mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--text-secondary-light)]" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary-light)]">{date}</h3>
                  <span className="text-xs text-[var(--text-secondary-light)]">{events.length} events</span>
                </div>

                <div className="relative ml-4 flex flex-col gap-0 border-l-2 border-[var(--border-dark)] pl-6">
                  {events.map((event) => {
                    const EventIcon = MODULE_ICONS[event.module] ?? MessageSquare
                    const href = getModuleHref(event.module, event.recordId)
                    const actionLabel = getActionLabel(event)
                    const actor = event.userName ?? event.userEmail ?? "System"

                    return (
                      <div key={event.id} className="relative pb-5 last:pb-0">
                        <div
                          className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--app-shell-bg)] bg-[var(--app-surface-dark-elevated)]"
                        >
                          <EventIcon className="h-3 w-3 text-[var(--text-secondary-light)]" />
                        </div>

                        <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3 ring-1 ring-white/[0.04] transition-shadow hover:shadow-none">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-relaxed text-[var(--text-primary-light)]">
                                <span className="font-medium">{actor}</span> {actionLabel}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary-light)]">
                                  {MODULE_LABELS[event.module] ?? event.module}
                                </span>
                                {event.type !== "comment" && event.data?.label && (
                                  <span className="max-w-[200px] truncate text-[10px] text-[var(--text-secondary-light)]">
                                    {event.data.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              {href && (
                                <Link
                                  href={href}
                                  className="text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85 hover:underline"
                                >
                                  View
                                </Link>
                              )}
                              <span className="text-xs text-[var(--text-secondary-light)]">{formatTimeAgo(event.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPage>
    </AppShell>
  )
}
