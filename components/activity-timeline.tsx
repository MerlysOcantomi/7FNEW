"use client"

import { useMemo } from "react"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import {
  Plus,
  Pencil,
  RefreshCw,
  UserPlus,
  UserMinus,
  Link2,
  Unlink,
  MessageSquare,
  AtSign,
  Trash2,
  Loader2,
  History,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface ActivityEntry {
  id: string
  module: string
  recordId: string
  type: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  data: Record<string, unknown> | null
  createdAt: string
}

interface ActivityTimelineProps {
  module: string
  recordId: string
  refreshKey?: number
}

const FIELD_LABELS: Record<string, string> = {
  titulo: "Title",
  nombre: "Name",
  descripcion: "Description",
  estado: "Status",
  prioridad: "Priority",
  progreso: "Progress",
  presupuesto: "Budget",
  fechaInicio: "Start date",
  fechaFin: "End date",
  fechaLimite: "Due date",
  fechaEmision: "Issue date",
  fechaVencimiento: "Due date",
  clienteId: "Client",
  proyectoId: "Project",
  usuarioId: "Owner",
  numero: "Number",
  email: "Email",
  telefono: "Phone",
  empresa: "Company",
  tipo: "Type",
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  created: { icon: Plus, color: "text-emerald-500 bg-emerald-500/10", label: "Created" },
  updated: { icon: Pencil, color: "text-blue-500 bg-blue-500/10", label: "Updated" },
  deleted: { icon: Trash2, color: "text-red-500 bg-red-500/10", label: "Deleted" },
  status_change: { icon: RefreshCw, color: "text-amber-500 bg-amber-500/10", label: "Status" },
  assigned: { icon: UserPlus, color: "text-purple-500 bg-purple-500/10", label: "Assigned" },
  unassigned: { icon: UserMinus, color: "text-orange-500 bg-orange-500/10", label: "Unassigned" },
  relation_added: { icon: Link2, color: "text-cyan-500 bg-cyan-500/10", label: "Linked" },
  relation_removed: { icon: Unlink, color: "text-rose-500 bg-rose-500/10", label: "Unlinked" },
  comment: { icon: MessageSquare, color: "text-indigo-500 bg-indigo-500/10", label: "Comment" },
  mention: { icon: AtSign, color: "text-pink-500 bg-pink-500/10", label: "Mention" },
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—"
  if (typeof val === "boolean") return val ? "Yes" : "No"
  return String(val)
}

function renderDescription(entry: ActivityEntry): React.ReactNode {
  const data = entry.data
  if (!data) return null

  if (entry.type === "comment") {
    return (
      <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words mt-1 pl-0.5">
        {String(data.comment ?? "")}
      </p>
    )
  }

  if (entry.type === "status_change") {
    return (
      <span className="text-xs text-muted-foreground">
        {formatValue(data.oldValue)} → <span className="font-medium text-foreground">{formatValue(data.newValue)}</span>
      </span>
    )
  }

  if (entry.type === "assigned" || entry.type === "unassigned") {
    const label = FIELD_LABELS[String(data.field ?? "")] ?? data.field
    return (
      <span className="text-xs text-muted-foreground">
        {label}: {entry.type === "assigned" ? formatValue(data.newValue) : "removed"}
      </span>
    )
  }

  if (entry.type === "updated" && Array.isArray(data.changes)) {
    return (
      <div className="space-y-0.5 mt-0.5">
        {(data.changes as { field: string; oldValue: unknown; newValue: unknown }[]).slice(0, 5).map((c, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            <span className="font-medium">{FIELD_LABELS[c.field] ?? c.field}:</span>{" "}
            {formatValue(c.oldValue)} → {formatValue(c.newValue)}
          </p>
        ))}
      </div>
    )
  }

  if (entry.type === "relation_added" || entry.type === "relation_removed") {
    return (
      <span className="text-xs text-muted-foreground">
        {String(data.label ?? data.field ?? "Relation")}
      </span>
    )
  }

  return null
}

export function ActivityTimeline({ module, recordId, refreshKey }: ActivityTimelineProps) {
  const url = `/api/activity?module=${module}&recordId=${recordId}&limit=50`
  const { data: rawData, loading } = useFetch<ActivityEntry[]>(
    url,
    { refreshKey }
  )

  const entries = useMemo(() => {
    if (!Array.isArray(rawData)) return []
    return rawData
  }, [rawData])

  if (loading && entries.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        {entries.length > 0 && (
          <span className="text-xs text-muted-foreground">({entries.length})</span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">No activity recorded.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {entries.map((entry) => {
              const config = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.updated
              const Icon = config.icon
              const [iconColor, iconBg] = config.color.split(" ")

              return (
                <div key={entry.id} className="relative flex gap-3 pl-0">
                  <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0", iconBg)}>
                    <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {entry.userName ?? entry.userEmail ?? "System"}
                      </span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", iconBg, iconColor)}>
                        {config.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                    {renderDescription(entry)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
