"use client"

import { useUser } from "@/hooks/use-user"
import { ShieldAlert, Loader2 } from "lucide-react"

type Role = "admin" | "editor" | "viewer"

const ROLE_LEVEL: Record<Role, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
}

interface RoleGateProps {
  requiredRole: Role
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({ requiredRole, children, fallback }: RoleGateProps) {
  const { role, loading } = useUser()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const userLevel = ROLE_LEVEL[role as Role] ?? 1
  const requiredLevel = ROLE_LEVEL[requiredRole]

  if (userLevel < requiredLevel) {
    if (fallback) return <>{fallback}</>
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Acceso restringido</h2>
        <p className="mt-1.5 text-sm text-muted-foreground text-center max-w-sm">
          No tienes permisos para acceder a esta seccion.
          Contacta a la administradora para solicitar acceso.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

interface CanEditProps {
  children: React.ReactNode
}

export function CanEdit({ children }: CanEditProps) {
  const { canEdit } = useUser()
  if (!canEdit) return null
  return <>{children}</>
}

export function CanDelete({ children }: CanEditProps) {
  const { isAdmin } = useUser()
  if (!isAdmin) return null
  return <>{children}</>
}

export function AdminOnly({ children }: CanEditProps) {
  const { isAdmin } = useUser()
  if (!isAdmin) return null
  return <>{children}</>
}
