"use client"

import { useState, useRef, useEffect } from "react"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import { LogOut, User, ChevronDown, Shield, Edit3, Eye } from "lucide-react"

const ROLE_LABELS: Record<string, { label: string; icon: typeof Shield }> = {
  admin: { label: "Administrator", icon: Shield },
  editor: { label: "Editor", icon: Edit3 },
  viewer: { label: "Read only", icon: Eye },
}

export function UserMenu() {
  const { user, role, logout, loading } = useUser()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (loading || !user) return null

  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.viewer
  const RoleIcon = roleInfo.icon

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60 transition-colors w-full"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-8 w-8 rounded-full flex-shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold flex-shrink-0">
            {(user.nombre ?? user.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {user.nombre ?? user.email.split("@")[0]}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                  {(user.nombre ?? user.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.nombre ?? "User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <RoleIcon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">{roleInfo.label}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              View profile
            </button>
            <button
              onClick={() => { setOpen(false); logout() }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
