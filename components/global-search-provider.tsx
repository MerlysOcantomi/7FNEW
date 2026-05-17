"use client"

import { useCallback, useMemo, useState, createContext, useContext } from "react"
import { GlobalSearch } from "@/components/global-search"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useGlobalNew } from "@/components/global-new/use-global-new"

export interface GlobalSearchContextValue {
  openSearch: () => void
  closeSearch: () => void
  searchOpen: boolean
}

const noopSearch: GlobalSearchContextValue = {
  openSearch: () => {},
  closeSearch: () => {},
  searchOpen: false,
}

const GlobalSearchContext = createContext<GlobalSearchContextValue>(noopSearch)

export function useGlobalSearch() {
  return useContext(GlobalSearchContext)
}

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const { closeAll } = useGlobalNew()

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  const openSearch = useCallback(() => {
    closeAll()
    setSearchOpen(true)
  }, [closeAll])

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
    [openSearch],
  )

  useKeyboardShortcuts(shortcuts, { scope: "global" })

  const value = useMemo(
    () => ({ openSearch, closeSearch, searchOpen }),
    [openSearch, closeSearch, searchOpen],
  )

  return (
    <GlobalSearchContext.Provider value={value}>
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
      {children}
    </GlobalSearchContext.Provider>
  )
}
