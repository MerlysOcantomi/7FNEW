"use client"

import { useI18n } from "@/components/i18n-provider"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  Receipt,
  FileText,
  MessageSquare,
  AtSign,
  Bell,
  RefreshCw,
  CheckCheck,
  X,
  Inbox,
  Mail,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
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

interface NotificationsPanelProps {
  notifications: NotificationData[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClose: () => void
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string }> = {
  tarea_asignada: { icon: CheckSquare, color: "text-blue-500" },
  tarea_vencida: { icon: AlertTriangle, color: "text-red-500" },
  tarea_estado: { icon: RefreshCw, color: "text-amber-500" },
  proyecto_actualizado: { icon: FolderKanban, color: "text-purple-500" },
  proyecto_estado: { icon: FolderKanban, color: "text-purple-500" },
  factura_creada: { icon: Receipt, color: "text-emerald-500" },
  factura_vencida: { icon: AlertTriangle, color: "text-red-500" },
  documento_subido: { icon: FileText, color: "text-cyan-500" },
  comentario_nuevo: { icon: MessageSquare, color: "text-indigo-500" },
  mencion: { icon: AtSign, color: "text-pink-500" },
  sistema: { icon: Bell, color: "text-muted-foreground" },
  inbox_nueva_conversacion: { icon: Inbox, color: "text-teal-500" },
  inbox_nuevo_mensaje: { icon: Mail, color: "text-teal-600" },
  inbox_asignacion: { icon: UserCheck, color: "text-violet-500" },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return "now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

export function NotificationsPanel({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: NotificationsPanelProps) {
  const { t } = useI18n()
  const router = useRouter()

  const handleClick = useCallback(
    (n: NotificationData) => {
      if (!n.read) onMarkRead(n.id)
      if (n.link) {
        router.push(n.link)
        onClose()
      }
    },
    [onMarkRead, router, onClose]
  )

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t.common.notifications.label}</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              {t.common.notifications.newCount(unreadCount)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title={t.common.notifications.markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 px-4">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t.common.notifications.empty}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.sistema
              const Icon = config.icon
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                    !n.read && "bg-accent/20"
                  )}
                >
                  <div className={cn("mt-0.5 flex-shrink-0", config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug truncate", !n.read ? "font-semibold text-foreground" : "text-foreground/80")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    {n.message && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t border-border px-4 py-2">
          <button
            onClick={() => {
              router.push("/notificaciones")
              onClose()
            }}
            className="w-full rounded-md py-1.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.common.notifications.viewAll}
          </button>
        </div>
      )}
    </div>
  )
}
