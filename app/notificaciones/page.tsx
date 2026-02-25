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
  tarea_asignada: { icon: CheckSquare, color: "text-blue-500 bg-blue-500/10", label: "Tarea" },
  tarea_vencida: { icon: AlertTriangle, color: "text-red-500 bg-red-500/10", label: "Tarea" },
  tarea_estado: { icon: RefreshCw, color: "text-amber-500 bg-amber-500/10", label: "Tarea" },
  proyecto_actualizado: { icon: FolderKanban, color: "text-purple-500 bg-purple-500/10", label: "Proyecto" },
  proyecto_estado: { icon: FolderKanban, color: "text-purple-500 bg-purple-500/10", label: "Proyecto" },
  factura_creada: { icon: Receipt, color: "text-emerald-500 bg-emerald-500/10", label: "Factura" },
  factura_vencida: { icon: AlertTriangle, color: "text-red-500 bg-red-500/10", label: "Factura" },
  documento_subido: { icon: FileText, color: "text-cyan-500 bg-cyan-500/10", label: "Documento" },
  comentario_nuevo: { icon: MessageSquare, color: "text-indigo-500 bg-indigo-500/10", label: "Comentario" },
  mencion: { icon: AtSign, color: "text-pink-500 bg-pink-500/10", label: "Mencion" },
  sistema: { icon: Bell, color: "text-muted-foreground bg-muted", label: "Sistema" },
}

const TYPE_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "tarea", label: "Tareas" },
  { value: "proyecto", label: "Proyectos" },
  { value: "factura", label: "Facturas" },
  { value: "documento", label: "Documentos" },
]

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "ahora"
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
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
    <AppShell currentSection="notificaciones" breadcrumbs={[{ label: "7F" }, { label: "Notificaciones" }]}>
      <SectionPage title="Notificaciones" description="Alertas y actualizaciones de la plataforma.">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">No leidas</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{unreadCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hoy</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{todayCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{notifications.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Leidas</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{notifications.length - unreadCount}</p>
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
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  activeFilter === f.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
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
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                showUnreadOnly ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Bell className="h-3 w-3" /> Solo no leidas
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3 w-3" /> Marcar todas leidas
              </button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all w-full",
                    n.read ? "border-border bg-card shadow-sm hover:bg-muted/40" : "border-primary/20 bg-primary/5 shadow-sm hover:bg-muted/40",
                    n.link && "cursor-pointer"
                  )}
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5", iconBg)}>
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn("text-sm text-foreground", !n.read && "font-semibold")}>{n.title}</p>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium", iconBg, iconColor)}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
                <BellRing className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {showUnreadOnly ? "Sin notificaciones no leidas" : "Sin notificaciones"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Las notificaciones apareceran aqui cuando haya actividad en la plataforma.
                </p>
              </div>
            )}
          </div>
        )}
      </SectionPage>
    </AppShell>
  )
}
