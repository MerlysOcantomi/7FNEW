"use client"

import { useMemo, useState, createContext, useContext } from "react"
import { GlobalSearch } from "@/components/global-search"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

const GlobalSearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => {} })

export function useGlobalSearch() {
  return useContext(GlobalSearchContext)
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = () => setSearchOpen(true)
  const closeSearch = () => setSearchOpen(false)

  const shortcuts = useMemo(
    () => [
      {
        id: "open-global-search",
        combo: "Mod+K",
        allowInEditable: true,
        preventDefault: true,
        handler: openSearch,
      },
    ],
    [],
  )

  useKeyboardShortcuts(shortcuts, { scope: "global" })

  return (
    <GlobalSearchContext.Provider value={{ openSearch }}>
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
      {children}
    </GlobalSearchContext.Provider>
  )
}
