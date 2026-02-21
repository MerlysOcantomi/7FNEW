"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { CanEdit } from "@/components/role-gate"
import type { LucideIcon } from "lucide-react"

interface FormComponentProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

interface SmartActionProps {
  label: string
  icon?: LucideIcon
  FormComponent: React.ComponentType<FormComponentProps>
  defaultValues?: Record<string, unknown>
  onCreated?: () => void
  variant?: "default" | "primary" | "ghost"
  size?: "sm" | "md"
  className?: string
  aiSuggest?: boolean
}

export function SmartAction({
  label,
  icon: Icon,
  FormComponent,
  defaultValues,
  onCreated,
  variant = "default",
  size = "md",
  className,
}: SmartActionProps) {
  const [open, setOpen] = useState(false)

  const handleSuccess = useCallback(() => {
    setOpen(false)
    onCreated?.()
  }, [onCreated])

  const variantClasses = {
    default: "border border-border bg-card text-foreground hover:bg-muted",
    primary: "bg-foreground text-background hover:opacity-80",
    ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  }

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-3 py-2 text-sm gap-1.5",
  }

  return (
    <>
      <CanEdit>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center rounded-lg font-medium transition-colors",
            variantClasses[variant],
            sizeClasses[size],
            className
          )}
        >
          {Icon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          {label}
        </button>
      </CanEdit>
      <FormComponent
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
        data={defaultValues}
      />
    </>
  )
}

interface SmartActionGroupProps {
  children: React.ReactNode
  className?: string
}

export function SmartActionGroup({ children, className }: SmartActionGroupProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {children}
    </div>
  )
}
