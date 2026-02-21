"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"

export interface AuthUser {
  userId: string
  email: string
  role: string
  nombre: string | null
  avatar: string | null
}

interface UserContextValue {
  user: AuthUser | null
  loading: boolean
  role: string
  avatar: string | null
  isAdmin: boolean
  isEditor: boolean
  isViewer: boolean
  canEdit: boolean
  refetch: () => void
  logout: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      const data = await res.json()
      if (data.authenticated && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = useCallback(() => {
    window.location.href = "/api/auth/logout"
  }, [])

  const role = user?.role ?? "viewer"

  const value: UserContextValue = {
    user,
    loading,
    role,
    avatar: user?.avatar ?? null,
    isAdmin: role === "admin",
    isEditor: role === "editor",
    isViewer: role === "viewer",
    canEdit: role === "admin" || role === "editor",
    refetch: fetchUser,
    logout,
  }

  return <UserContext value={value}>{children}</UserContext>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    return {
      user: null,
      loading: true,
      role: "viewer",
      avatar: null,
      isAdmin: false,
      isEditor: false,
      isViewer: true,
      canEdit: false,
      refetch: () => {},
      logout: () => {},
    }
  }
  return ctx
}
