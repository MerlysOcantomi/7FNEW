"use client"

import { useState, createContext, useContext, useCallback } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
}

const colors: Record<ToastType, string> = {
  success: "bg-[var(--tab-phases)]",
  error: "bg-[var(--tab-review)]",
  warning: "bg-[var(--tab-tasks)]",
  info: "bg-[var(--tab-info)]",
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => {
          const Icon = icons[toast.type]
          return (
            <div
              key={toast.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300"
            >
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0", colors[toast.type])}>
                <Icon className="h-3.5 w-3.5 text-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label={t.common.close}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}
