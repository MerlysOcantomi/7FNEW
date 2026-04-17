"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"

export interface GlobalNewContextValue {
  desktopOpen: boolean
  mobileOpen: boolean
  setDesktopOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  toggleDesktop: () => void
  closeAll: () => void
}

const GlobalNewContext = createContext<GlobalNewContextValue | null>(null)

export function GlobalNewProvider({ children }: { children: ReactNode }) {
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setDesktopOpen(false)
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!desktopOpen && !mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDesktopOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [desktopOpen, mobileOpen])

  const toggleDesktop = useCallback(() => {
    setDesktopOpen((v) => !v)
  }, [])

  const closeAll = useCallback(() => {
    setDesktopOpen(false)
    setMobileOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      desktopOpen,
      mobileOpen,
      setDesktopOpen,
      setMobileOpen,
      toggleDesktop,
      closeAll,
    }),
    [desktopOpen, mobileOpen, toggleDesktop, closeAll],
  )

  return <GlobalNewContext.Provider value={value}>{children}</GlobalNewContext.Provider>
}

export function useGlobalNew(): GlobalNewContextValue {
  const ctx = useContext(GlobalNewContext)
  if (!ctx) {
    throw new Error("useGlobalNew must be used within GlobalNewProvider")
  }
  return ctx
}
