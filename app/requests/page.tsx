"use client"

import { useEffect, useState, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import {
  MessageSquarePlus,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderKanban,
  User,
  Paperclip,
} from "lucide-react"

interface RequestItem {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  createdAt: string
  cliente?: { id: string; nombre: string; empresa: string | null } | null
  proyecto?: { id: string; nombre: string } | null
  assets?: { id: string; assetName: string }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", color: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]", icon: Clock },
  IN_PROGRESS: { label: "In progress", color: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]", icon: AlertCircle },
  DONE: { label: "Completed", color: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]", icon: CheckCircle },
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-[var(--status-neutral-text)]",
  MEDIUM: "text-[var(--status-warning-text)]",
  HIGH: "text-[var(--status-danger-text)]",
}

export default function InternalRequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  const load = useCallback(() => {
    fetch("/api/requests")
      .then((r) => r.json())
      .then((res) => setRequests(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function changeStatus(id: string, status: string) {
    try {
      await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      load()
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  const filtered = filter ? requests.filter((r) => r.status === filter) : requests

  return (
    <AppShell
      currentSection="requests"
      breadcrumbs={[{ label: "7F" }, { label: "Client Requests" }]}
    >
      <SectionPage
        title="Client requests"
        description="Requests submitted through the client portal. Manage the status of each one."
      >
        {/* Stats */}
        <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--status-info-text)]">
              {requests.filter((r) => r.status === "OPEN").length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">In progress</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--status-warning-text)]">
              {requests.filter((r) => r.status === "IN_PROGRESS").length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--status-success-text)]">
              {requests.filter((r) => r.status === "DONE").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "", label: "All" },
            { key: "OPEN", label: "Open" },
            { key: "IN_PROGRESS", label: "In progress" },
            { key: "DONE", label: "Completed" },
          ].map((s) => (
            <button
              key={s.key || "all"}
              onClick={() => setFilter(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === s.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <MessageSquarePlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">No requests yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {filtered.map((req) => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.OPEN
              const StatusIcon = cfg.icon
              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-foreground">
                          {req.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        <span
                          className={`text-xs font-medium ${PRIORITY_COLORS[req.priority] || "text-[var(--status-neutral-text)]"}`}
                        >
                          {req.priority}
                        </span>
                      </div>
                      {req.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {req.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>
                          {new Date(req.createdAt).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {req.cliente && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {req.cliente.nombre}
                            {req.cliente.empresa && ` (${req.cliente.empresa})`}
                          </span>
                        )}
                        {req.proyecto && (
                          <span className="inline-flex items-center gap-1">
                            <FolderKanban className="h-3 w-3" />
                            {req.proyecto.nombre}
                          </span>
                        )}
                        {req.assets && req.assets.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {req.assets.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status change */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {req.status === "OPEN" && (
                        <button
                          onClick={() => changeStatus(req.id, "IN_PROGRESS")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Move to in progress
                        </button>
                      )}
                      {req.status !== "DONE" && (
                        <button
                          onClick={() => changeStatus(req.id, "DONE")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Mark completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionPage>
    </AppShell>
  )
}
