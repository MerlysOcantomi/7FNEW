"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { GlobalSearch } from "@/components/global-search"

const GlobalSearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => {} })

export function useGlobalSearch() {
  return useContext(GlobalSearchContext)
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = () => setSearchOpen(true)
  const closeSearch = () => setSearchOpen(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <GlobalSearchContext.Provider value={{ openSearch }}>
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
      {children}
    </GlobalSearchContext.Provider>
  )
}
