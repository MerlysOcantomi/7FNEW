"use client"

import { useEffect, useState, useCallback } from "react"
import { ClientPortalShell } from "@/components/client-portal-shell"
import {
  MessageSquarePlus,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderKanban,
  Paperclip,
  X,
} from "lucide-react"

interface RequestItem {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  createdAt: string
  proyecto?: { id: string; nombre: string } | null
  assets?: { id: string; assetName: string; assetUrl: string }[]
}

interface ProjectOption {
  id: string
  nombre: string
  estado: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-700", icon: Clock },
  IN_PROGRESS: { label: "In progress", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  DONE: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle },
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
}

export default function ClienteSolicitudesPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState("")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState("")

  const loadRequests = useCallback(() => {
    fetch("/api/cliente/requests")
      .then((r) => r.json())
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadRequests()
    fetch("/api/cliente/projects")
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [loadRequests])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (title.trim().length < 3) return
    setSubmitting(true)

    try {
      const res = await fetch("/api/cliente/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
        }),
      })

      if (res.ok) {
        setTitle("")
        setDescription("")
        setProjectId("")
        setShowForm(false)
        loadRequests()
      }
    } catch (error) {
      console.error("Error creating request:", error)
    } finally {
      setSubmitting(false)
    }
  }

  async function markDone(id: string) {
    try {
      const res = await fetch(`/api/cliente/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      })
      if (res.ok) loadRequests()
    } catch (error) {
      console.error("Error closing request:", error)
    }
  }

  const filtered = filter ? requests.filter((r) => r.status === filter) : requests
  const openCount = requests.filter((r) => r.status === "OPEN").length
  const inProgressCount = requests.filter((r) => r.status === "IN_PROGRESS").length
  const doneCount = requests.filter((r) => r.status === "DONE").length

  return (
    <ClientPortalShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Requests</h1>
            <p className="text-sm text-gray-500">
              Create and manage requests for your team
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1f2937] transition-colors w-full sm:w-auto justify-center"
          >
            {showForm ? (
              <>
                <X className="h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <MessageSquarePlus className="h-4 w-4" /> New request
              </>
            )}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-gray-200 bg-white p-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Briefly describe your request"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project (optional)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || title.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1f2937] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit request
              </button>
            </div>
          </form>
        )}

        {/* Stats */}
        <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">Open</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{openCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">In progress</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{inProgressCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{doneCount}</p>
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
                  ? "bg-[#1a3a5c] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <MessageSquarePlus className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">
              {filter ? "No requests match this filter" : "You do not have any requests yet"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Create a new request to communicate with your team
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
            {filtered.map((req) => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.OPEN
              const StatusIcon = cfg.icon
              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {req.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                      {req.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {req.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        <span>
                          {new Date(req.createdAt).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span>Prioridad: {PRIORITY_LABELS[req.priority] || req.priority}</span>
                        {req.proyecto && (
                          <span className="inline-flex items-center gap-1">
                            <FolderKanban className="h-3 w-3" />
                            {req.proyecto.nombre}
                          </span>
                        )}
                        {req.assets && req.assets.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {req.assets.length} file{req.assets.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    {req.status !== "DONE" && (
                      <button
                        onClick={() => markDone(req.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Mark as completed
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}
