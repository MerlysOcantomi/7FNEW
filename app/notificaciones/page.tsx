"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  BellRing,
  Bell,
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  FileText,
  MessageSquare,
  AtSign,
  RefreshCw,
  Receipt,
  CheckCheck,
  Loader2,
  Inbox,
  Mail,
  UserCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface NotificationData {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  tarea_asignada: { icon: CheckSquare, color: "text-blue-500 bg-blue-500/10", label: "Task" },
  tarea_vencida: { icon: AlertTriangle, color: "text-red-500 bg-red-500/10", label: "Task" },
  tarea_estado: { icon: RefreshCw, color: "text-amber-500 bg-amber-500/10", label: "Task" },
  proyecto_actualizado: { icon: FolderKanban, color: "text-purple-500 bg-purple-500/10", label: "Project" },
  proyecto_estado: { icon: FolderKanban, color: "text-purple-500 bg-purple-500/10", label: "Project" },
  factura_creada: { icon: Receipt, color: "text-emerald-500 bg-emerald-500/10", label: "Invoices" },
  factura_vencida: { icon: AlertTriangle, color: "text-red-500 bg-red-500/10", label: "Invoices" },
  documento_subido: { icon: FileText, color: "text-cyan-500 bg-cyan-500/10", label: "Files" },
  comentario_nuevo: { icon: MessageSquare, color: "text-indigo-500 bg-indigo-500/10", label: "Comment" },
  mencion: { icon: AtSign, color: "text-pink-500 bg-pink-500/10", label: "Mention" },
  sistema: { icon: Bell, color: "text-[var(--text-secondary-light)] bg-white/[0.08]", label: "System" },
  inbox_nueva_conversacion: { icon: Inbox, color: "text-teal-500 bg-teal-500/10", label: "Inbox" },
  inbox_nuevo_mensaje: { icon: Mail, color: "text-teal-600 bg-teal-600/10", label: "Inbox" },
  inbox_asignacion: { icon: UserCheck, color: "text-violet-500 bg-violet-500/10", label: "Inbox" },
}

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "inbox", label: "Inbox" },
  { value: "tarea", label: "Tasks" },
  { value: "proyecto", label: "Projects" },
  { value: "factura", label: "Invoices" },
  { value: "documento", label: "Files" },
]

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("all")
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=50")
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.data ?? [])
      setUnreadCount(json.meta?.unreadCount ?? 0)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const handleClick = useCallback(
    (n: NotificationData) => {
      if (!n.read) markAsRead(n.id)
      if (n.link) router.push(n.link)
    },
    [markAsRead, router]
  )

  const filtered = notifications.filter((n) => {
    if (activeFilter !== "all" && !n.type.startsWith(activeFilter)) return false
    if (showUnreadOnly && n.read) return false
    return true
  })

  const todayCount = notifications.filter((n) => {
    const diff = Date.now() - new Date(n.createdAt).getTime()
    return diff < 86400000
  }).length

  return (
    <AppShell currentSection="notificaciones" breadcrumbs={[{ label: "7F" }, { label: "Notifications" }]}>
      <SectionPage title="Notifications" description="Platform alerts and updates." tone="canvas">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Unread</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{unreadCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Today</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{todayCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Total</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{notifications.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Read</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{notifications.length - unreadCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  activeFilter === f.value
                    ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-secondary-light)] hover:bg-white/[0.04] hover:text-[var(--text-primary-light)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                showUnreadOnly
                  ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-secondary-light)] hover:bg-white/[0.04] hover:text-[var(--text-primary-light)]",
              )}
            >
              <Bell className="h-3 w-3" /> Unread only
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary-light)] ring-1 ring-white/[0.03] transition-colors hover:bg-white/[0.04] hover:text-[var(--text-primary-light)]"
              >
                <CheckCheck className="h-3 w-3" /> Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary-light)]" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((n) => {
              const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.sistema
              const Icon = config.icon
              const [iconColor, iconBg] = config.color.split(" ")
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ring-1",
                    n.read
                      ? "border-[var(--border-dark)] bg-[var(--app-surface-dark)]/70 ring-transparent hover:bg-white/[0.04]"
                      : "border-[var(--accent-primary)]/25 bg-[var(--app-surface-dark)] shadow-none ring-white/[0.05] hover:bg-white/[0.06]",
                    n.link && "cursor-pointer",
                  )}
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5", iconBg)}>
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn("text-sm text-[var(--text-primary-light)]", !n.read && "font-semibold")}>{n.title}</p>
                          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]" />}
                        </div>
                        {n.message && (
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary-light)]">{n.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", iconBg, iconColor)}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-xs text-[var(--text-secondary-light)]">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/75 p-12 text-center ring-1 ring-white/[0.04]">
                <BellRing className="mx-auto mb-3 h-10 w-10 text-[var(--text-secondary-light)]/30" />
                <p className="text-sm font-medium text-[var(--text-secondary-light)]">
                  {showUnreadOnly ? "No unread notifications" : "No notifications"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary-light)]/75">
                  Notifications will appear here when there is activity in the platform.
                </p>
              </div>
            )}
          </div>
        )}
      </SectionPage>
    </AppShell>
  )
}
