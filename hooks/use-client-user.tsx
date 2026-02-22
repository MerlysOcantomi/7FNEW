"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"

export interface ClientUser {
  clienteId: string
  email: string
  nombre: string
}

interface ClientUserContextValue {
  user: ClientUser | null
  loading: boolean
  refetch: () => void
  logout: () => void
}

const ClientUserContext = createContext<ClientUserContextValue | null>(null)

export function ClientUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/cliente/auth/me")
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

  const logout = useCallback(async () => {
    await fetch("/api/cliente/auth/logout", { method: "POST" })
    window.location.href = "/cliente/login"
  }, [])

  return (
    <ClientUserContext value={{ user, loading, refetch: fetchUser, logout }}>
      {children}
    </ClientUserContext>
  )
}

export function useClientUser(): ClientUserContextValue {
  const ctx = useContext(ClientUserContext)
  if (!ctx) {
    return {
      user: null,
      loading: true,
      refetch: () => {},
      logout: () => {},
    }
  }
  return ctx
}
